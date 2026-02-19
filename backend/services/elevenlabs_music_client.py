"""
ElevenLabs Music API client for loop stem generation.

Uses OpenAI to build a composition plan, then sends it to
ElevenLabs /v1/music to produce audio.
"""
from __future__ import annotations

import io
import json
import logging
import os
import time
from pathlib import Path

import httpx
import numpy as np
import soundfile as sf
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Load .env from project root
# ---------------------------------------------------------------------------

_PROJECT_ROOT = Path(__file__).resolve().parents[2]

def _load_env():
    env_path = _PROJECT_ROOT / ".env"
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

_load_env()

# ---------------------------------------------------------------------------
# Duration helper
# ---------------------------------------------------------------------------

def calc_duration_ms(bpm: int, bars: int) -> int:
    return int((60.0 / bpm) * 4 * bars * 1000)

# ---------------------------------------------------------------------------
# Audio helpers
# ---------------------------------------------------------------------------

def pcm_to_wav(pcm_data: bytes, sample_rate: int = 44100) -> bytes:
    samples = np.frombuffer(pcm_data, dtype=np.int16).reshape(-1, 2)
    out = io.BytesIO()
    sf.write(out, samples, sample_rate, format="WAV", subtype="PCM_16")
    out.seek(0)
    return out.read()


def crossfade_loop(wav_data: bytes, crossfade_ms: int = 100) -> bytes:
    with io.BytesIO(wav_data) as buf:
        audio, sr = sf.read(buf)
    xf_samples = int(crossfade_ms * sr / 1000)
    if len(audio) < xf_samples * 2:
        return wav_data
    is_stereo = len(audio.shape) > 1
    if is_stereo:
        end_seg = audio[-xf_samples:, :].copy()
        start_seg = audio[:xf_samples, :].copy()
        fade_out = np.linspace(1, 0, xf_samples).reshape(-1, 1)
        fade_in = np.linspace(0, 1, xf_samples).reshape(-1, 1)
        xfaded = end_seg * fade_out + start_seg * fade_in
        looped = audio[:-xf_samples, :].copy()
        looped[:xf_samples, :] = xfaded
    else:
        end_seg = audio[-xf_samples:].copy()
        start_seg = audio[:xf_samples].copy()
        fade_out = np.linspace(1, 0, xf_samples)
        fade_in = np.linspace(0, 1, xf_samples)
        xfaded = end_seg * fade_out + start_seg * fade_in
        looped = audio[:-xf_samples].copy()
        looped[:xf_samples] = xfaded
    out = io.BytesIO()
    sf.write(out, looped, sr, format="WAV", subtype="PCM_16")
    out.seek(0)
    return out.read()

# ---------------------------------------------------------------------------
# Composition plan system prompt
# ---------------------------------------------------------------------------

COMPOSITION_PLAN_SYSTEM_PROMPT = """You are an expert music producer creating ElevenLabs composition plans for LOOP STEMS — isolated loops designed to be layered in a DAW.

## YOUR TASK
Transform the user's loop stem description into a structured composition plan JSON that the ElevenLabs Music API can consume to generate a focused, seamlessly looping stem.

## PERFECT LOOP PRIORITY (CRITICAL)
The #1 goal is a PERFECT LOOP — audio that repeats seamlessly with no audible seam, click, or rhythmic hiccup at the loop point.
- Always include "seamless loop" or "perfect loop" in positive_global_styles.
- Prefer sustained, rhythmic, and cyclical musical patterns over phrases with clear beginnings/endings.
- Avoid musical elements that create obvious start/stop cues (big builds, crashes, fade-outs, dramatic endings).
- If vocals are present, lyrics must be short and repetitive — designed to loop without an awkward cut-off mid-word or mid-phrase.

## INPUT
You receive:
- **prompt**: Description of the desired loop stem
- **bpm**: Tempo in BPM, OR "auto" — if "auto", YOU choose the best BPM for the genre/style described. Include your chosen BPM as a tag in positive_global_styles. If a specific BPM number is provided, use that EXACT value — do NOT override it.
- **bars**: Number of bars (4/4 time)
- **key**: Musical key (e.g. "A minor"), "auto", or "none" — if "auto", YOU choose the most fitting musical key for the mood/style. Include it in positive_global_styles. However, if the content is non-tonal (e.g. drums, percussion, noise, sound effects), set chosen_key to null and omit key from styles — non-tonal sounds have no key. If "none", omit key from styles. If a specific key is provided, use that EXACT key — do NOT override it.
- **duration_ms**: Total duration in milliseconds (when BPM is "auto", this will be null — you must include your chosen BPM in the response)

## OUTPUT
Return ONLY valid JSON — no markdown fences, no explanation.
Every style array must have AT MOST 10 entries but fewer is better — only include tags that add meaningful steering. Do not pad arrays with filler tags.
{
  "chosen_bpm": <integer — the BPM you are using, whether provided or auto-selected>,
  "chosen_key": <string or null — the key you are using, e.g. "A minor", or null if none>,
  "positive_global_styles": [max 10 short tags],
  "negative_global_styles": [max 10 short tags],
  "sections": [
    {
      "section_name": "...",
      "positive_local_styles": [max 10 short tags],
      "negative_local_styles": [max 10 short tags],
      "duration_ms": <integer>,
      "lines": []
    }
  ]
}

## CRITICAL RULES

### STEM vs SAMPLE DETECTION
Detect the user's intent from their prompt:

**STEM mode** — user says "solo X", names a specific single instrument (e.g. "solo 808 bass", "piano chords", "synth pad"):
- Focus on ONE instrument. Aggressively exclude other instrument families in negatives.

**SAMPLE mode** — user describes a vibe, era, or uses words like "sample", "loop", "beat" without specifying a single instrument (e.g. "jazzy sample", "funky groove", "soulful chop"):
- Include MULTIPLE style-appropriate instruments in positives (e.g. jazzy = Rhodes + vibes + muted trumpet + upright bass).
- Negatives should only exclude instruments/sounds that clash with the described vibe.
- Think like a record — what instruments would naturally play together on this track?

### STYLE ARRAYS
- **positive_global_styles**: Genre (if melodic/harmonic — see GENRE NAMES POLICY), mood, key, BPM (e.g. "90 bpm"), and the instrument(s). Always include the BPM tag. Include "instrumental" ONLY when no vocals are requested. MUST include ALL instrument tags. MAX 10 tags (fewer is fine — only use tags that add value).
- **negative_global_styles**: Exclude what does NOT belong. MAX 10 tags (fewer is fine).
- **positive_local_styles**: MUST include the SAME instrument tag(s) that appear in positive_global_styles — instruments must be present in BOTH arrays. Then add playing style, sonic qualities, and effects. MAX 10 tags per section (fewer is fine).
- **negative_local_styles**: Exclude unwanted elements. MUST mirror key exclusions from negative_global_styles (especially "drums", "percussion", "vocals") to reinforce at both levels. MAX 10 tags per section (fewer is fine).

### DRUMS POLICY
- Do NOT include drums/percussion UNLESS the user EXPLICITLY mentions: drums, percussion, hi-hats, kicks, snares, drum machine, beat, drum kit, breakbeat, or clearly drum-related terms.
- When drums are NOT mentioned: Add "drums", "percussion", "kick", "snare", "hi-hat", "cymbals" to BOTH negative_global_styles AND negative_local_styles for every section. Listing specific drum elements is critical — broad tags alone are not enough, the model tends to sneak in individual drum hits unless each is explicitly excluded.
- When drums ARE mentioned: Include drum-specific styles in positive, exclude melodic/harmonic instruments in negative.
- **GENRE NAMES POLICY**: Melodic/harmonic genres are OK to use as style tags: "soul", "jazz", "funk", "R&B", "blues", "bossa nova", "reggae", "flamenco", "classical", "neo-soul". These describe a tonal/harmonic language the model understands well. However, NEVER use drum-defined genres as style tags: "trap", "drill", "drum and bass", "jungle", "footwork", "breakbeat", "EDM", "dubstep", "hip-hop", "boom bap". These genres are defined by their drum patterns and will steer the model toward adding drums even when excluded. Instead, decompose drum-defined genres into their non-drum qualities: "trap" → "dark", "aggressive", "heavy low-end"; "drill" → "dark", "menacing", "sliding bass"; "hip-hop" → "swung", "urban", "head-nod groove".

### VOCALS POLICY
- Do NOT include vocals/singing UNLESS the user EXPLICITLY mentions: vocals, singing, voice, rapper, singer, a cappella, opera, soprano, tenor, baritone, alto, or clearly vocal-related terms.
- "Hums" are NOT vocals. If user mentions hums, they want wordless vocalizations — include "wordless vocal harmonies" or "ethereal hum" in positive styles. Do NOT add vocals to negative in this case.
- **When vocals are NOT mentioned:**
  - Add "vocals" to negative_global_styles (covers singing, voice, rap, spoken word).
  - The "lines" array must be empty [].
- **When vocals ARE explicitly mentioned:**
  - Do NOT add "vocals" to negative styles. Do NOT include "instrumental" in positive_global_styles.
  - Include vocal style tags in positive styles (e.g. "operatic soprano", "rap vocals", "soul singing").
  - The "lines" array MUST contain lyric lines — short phrases or sentences, max 200 characters per line.
  - Write lyrics that match the requested language, style, and mood. If a language is specified (e.g. "in Italian", "in Spanish"), write lyrics in that language.
  - Keep lyrics thematically appropriate to the genre and mood described.
  - For loops: lyrics should be short, repetitive, and designed to loop seamlessly — avoid narrative arcs or story progression. Think hook/refrain, not verse.

### SECTION RULES
- **<=4 bars**: ALWAYS exactly 1 section using the full duration_ms.
- **>4 bars**: Use 1 OR 2 sections. Default to 1 unless the music clearly benefits from subtle development (adding a layer, texture, or effect).
  - If 2 sections: EQUAL duration (duration_ms / 2 each, rounded to nearest integer).
  - Section 2 = the SAME loop with a small additive development (e.g. strings, reverb, sub-harmonic layer, wider stereo).
  - Name sections descriptively: "Main Loop" / "Main Loop + Strings", "Core Bass" / "Core Bass + Sub Harmonics", etc.
- Each section's durationMs must be between 3000 and 120000.

### STYLE FORMAT — SHORT TAGS ONLY
- Every style entry must be a SHORT TAG: 1-4 words max, like tags on Splice or Loopcloud.
- GOOD tags: "dark", "sub bass", "tape saturation", "808 glide", "Rhodes chords", "7th voicings", "staccato rhythm", "analog distortion", "warm", "swung rhythm"
- BAD (drum-defined genres): "trap", "drill", "hip-hop", "boom bap", "EDM", "dubstep", "drum and bass"
- BAD (too long): "warm analog sub bass with tape saturation and slow attack", "minimal processing aside from sub saturation"
- English only. Do NOT reference specific artists, bands, or copyrighted material.

### STYLE PRIORITY ORDER (CRITICAL)
Positive styles MUST prioritize in this order — instrument & musical content FIRST, production FX last:
1. **INSTRUMENT** — what is playing: "Rhodes piano", "808 bass", "nylon guitar", "analog synth pad", "horn section"
2. **HARMONY & CHARACTER** — the musical language: "7th chords", "minor 7ths", "Phrygian mode", "blues scale", "suspended chords"
3. **PLAYING STYLE** — how it's played: "swung rhythm", "staccato stabs", "legato phrases", "fingerpicked", "palm muted"
4. **PRODUCTION** (last, if room) — effects/texture: "tape warmth", "vinyl crackle", "reverb wash", "lo-fi filter"
Never fill styles with ONLY production/texture tags — the model needs to know WHAT instrument to generate and WHAT musical content to play.

**INSTRUMENT REINFORCEMENT RULE**: The primary instrument(s) MUST appear in BOTH positive_global_styles AND positive_local_styles for every section. Global styles set the overall palette; local styles reinforce what each section actually plays. Without instruments in local styles, the model may ignore them.

### NEGATIVE STYLE STRATEGY
- Use BROAD category tags to stay within 10. "vocals" covers singing/rap. For drums, list specific elements (kick, snare, hi-hat, cymbals).
- **STEM mode**: exclude all instrument families not requested.
- **SAMPLE mode**: only exclude instruments/sounds that clash with the described vibe. Do NOT exclude instruments that naturally belong — a jazzy sample should have Rhodes AND vibes AND bass AND horns, not just one.

## EXAMPLES

### Example 1: Bass stem — 4 bars (1 section, no vocals)
Input: prompt="solo 808 bass, dark trap", bpm=140, bars=4, key="F# minor", duration_ms=6857
NOTE: "trap" is a drum-defined genre — decompose into non-drum qualities: dark, aggressive, heavy low-end.
{
  "chosen_bpm": 140,
  "chosen_key": "F# minor",
  "positive_global_styles": ["808 bass", "sub bass", "dark", "aggressive", "F# minor", "140 bpm", "instrumental", "seamless loop"],
  "negative_global_styles": ["drums", "percussion", "kick", "snare", "hi-hat", "cymbals", "vocals", "melody", "chords"],
  "sections": [
    {
      "section_name": "808 Sub Loop",
      "positive_local_styles": ["808 bass", "sub bass", "808 sine bass", "pitch glide", "legato slides", "sustained notes", "analog distortion", "low-end focused"],
      "negative_local_styles": ["drums", "percussion", "kick", "snare", "hi-hat", "cymbals", "melodic content", "bright transients"],
      "duration_ms": 6857,
      "lines": []
    }
  ]
}

### Example 2: Jazz sample (SAMPLE mode — multi-instrument, no vocals) — 8 bars
Input: prompt="jazzy J Dilla style sample loop", bpm=88, bars=8, key="auto", duration_ms=21818
{
  "chosen_bpm": 88,
  "chosen_key": "D minor",
  "positive_global_styles": ["jazz", "Rhodes piano", "vibraphone", "upright bass", "88 bpm", "D minor", "instrumental", "seamless loop"],
  "negative_global_styles": ["drums", "percussion", "kick", "snare", "hi-hat", "cymbals", "vocals", "electronic synths", "metal guitar"],
  "sections": [
    {
      "section_name": "Jazz Sample Loop",
      "positive_local_styles": ["Rhodes piano", "vibraphone", "upright bass", "muted trumpet", "7th chords", "swung timing", "tape warmth", "warm analog"],
      "negative_local_styles": ["drums", "percussion", "kick", "snare", "hi-hat", "cymbals", "electronic", "distorted"],
      "duration_ms": 10909,
      "lines": []
    },
    {
      "section_name": "Jazz Sample Loop + Texture",
      "positive_local_styles": ["Rhodes piano", "vibraphone", "upright bass", "horn stabs", "extended chords", "vinyl crackle", "wider stereo", "chopped fills"],
      "negative_local_styles": ["drums", "percussion", "kick", "snare", "hi-hat", "cymbals", "electronic", "distorted"],
      "duration_ms": 10909,
      "lines": []
    }
  ]
}

### Example 3: Drum stem — explicit drums, no vocals
Input: prompt="punchy boom bap drums, swing feel", bpm=92, bars=4, key="none", duration_ms=10435
NOTE: "boom bap" and "hip-hop" are drum-defined genres — decompose into non-drum qualities: punchy, swung, vinyl-textured.
{
  "chosen_bpm": 92,
  "chosen_key": null,
  "positive_global_styles": ["punchy drums", "swung feel", "92 bpm", "instrumental", "seamless loop"],
  "negative_global_styles": ["vocals", "melody", "chords", "bass", "piano", "guitar", "strings", "synths"],
  "sections": [
    {
      "section_name": "Punchy Drum Groove",
      "positive_local_styles": ["punchy drums", "vinyl kick", "crispy snare", "shuffled hi-hats", "room reverb", "compressed bus", "swung timing"],
      "negative_local_styles": ["electronic drums", "808 bass", "melodic content", "synthesized"],
      "duration_ms": 10435,
      "lines": []
    }
  ]
}

### Example 4: Vocals explicitly requested — string quartet with opera vocals
Input: prompt="string quartet for flamenco dance with opera vocals in Italian", bpm=90, bars=8, key="A minor", duration_ms=21333
{
  "chosen_bpm": 90,
  "chosen_key": "A minor",
  "positive_global_styles": ["string quartet", "flamenco", "classical", "opera vocals", "A minor", "90 bpm", "seamless loop"],
  "negative_global_styles": ["drums", "percussion", "kick", "snare", "hi-hat", "cymbals", "electric instruments", "synths", "pop production"],
  "sections": [
    {
      "section_name": "Flamenco Quartet + Opera Loop",
      "positive_local_styles": ["string quartet", "first violin", "second violin", "viola", "cello", "operatic soprano", "Phrygian mode", "percussive bowing"],
      "negative_local_styles": ["drums", "percussion", "kick", "snare", "hi-hat", "cymbals", "electronic", "guitar"],
      "duration_ms": 10667,
      "lines": [
        "Fuoco nel mio cuore, fiamma che non muore",
        "Danza, danza, il vento canta"
      ]
    },
    {
      "section_name": "Flamenco Quartet + Dramatic Opera Loop",
      "positive_local_styles": ["string quartet", "first violin", "second violin", "viola", "cello", "operatic soprano", "wider vibrato", "increased dynamics", "room reverb"],
      "negative_local_styles": ["drums", "percussion", "kick", "snare", "hi-hat", "cymbals", "electronic", "guitar"],
      "duration_ms": 10667,
      "lines": [
        "Fuoco nel mio cuore, fiamma che non muore",
        "Danza, danza, il vento canta"
      ]
    }
  ]
}

### Example 5: Soul sample (SAMPLE mode — multi-instrument, auto BPM/key, no vocals)
Input: prompt="soul 70s sample jazzy chopped", bpm="auto", bars=4, key="auto", duration_ms=null
{
  "chosen_bpm": 82,
  "chosen_key": "Eb major",
  "positive_global_styles": ["soul", "jazz", "Rhodes piano", "Fender bass", "soul guitar", "82 bpm", "Eb major", "instrumental", "seamless loop"],
  "negative_global_styles": ["drums", "percussion", "kick", "snare", "hi-hat", "cymbals", "vocals", "electronic synths", "metal"],
  "sections": [
    {
      "section_name": "Warm Vintage Chop Loop",
      "positive_local_styles": ["Rhodes piano", "Fender bass", "soul guitar", "horn section", "7th chords", "swung groove", "warm analog", "vinyl texture"],
      "negative_local_styles": ["drums", "percussion", "kick", "snare", "hi-hat", "cymbals", "electronic", "distorted"],
      "duration_ms": 11707,
      "lines": []
    }
  ]
}"""

ELEVENLABS_BASE = "https://api.elevenlabs.io"


class ElevenLabsMusicClient:
    """Async client for generating music via OpenAI + ElevenLabs."""

    def __init__(self) -> None:
        openai_key = os.getenv("samplemakerOpenAiApiKey")
        if not openai_key:
            raise RuntimeError("Missing samplemakerOpenAiApiKey in environment")

        self._eleven_key = os.getenv("samplemakerElevenLabsApiKey")
        if not self._eleven_key:
            raise RuntimeError("Missing samplemakerElevenLabsApiKey in environment")

        self._openai = AsyncOpenAI(api_key=openai_key)
        self._http = httpx.AsyncClient(timeout=httpx.Timeout(600.0))

    async def generate_composition_plan(
        self,
        prompt: str,
        bpm: int | str,
        bars: int,
        key: str | None,
        duration_ms: int | None,
    ) -> tuple[dict, str]:
        """Call OpenAI to turn a user prompt into a composition plan JSON.

        bpm can be an int or "auto". key can be a string, "auto", or None.
        duration_ms can be None when BPM is auto.

        Returns (composition_plan_dict, raw_llm_text).
        """
        duration_str = f"{duration_ms}ms" if duration_ms else "auto (calculate from your chosen BPM)"
        user_msg = (
            f"Prompt: {prompt}\n"
            f"BPM: {bpm}\n"
            f"Bars: {bars}\n"
            f"Key: {key or 'none'}\n"
            f"Duration: {duration_str}"
        )
        logger.info("[LLM] Sending to OpenAI ...")
        start = time.time()
        resp = await self._openai.responses.create(
            model="gpt-5-nano",
            instructions=COMPOSITION_PLAN_SYSTEM_PROMPT,
            input=user_msg + "\nRespond with JSON only.",
            text={"format": {"type": "json_object"}},
            tools=[],
        )
        elapsed = time.time() - start
        raw_text = resp.output_text
        plan = json.loads(raw_text)
        logger.info(f"[LLM] Done in {elapsed:.1f}s")
        return plan, raw_text

    async def generate_audio(
        self,
        composition_plan: dict,
        output_format: str = "pcm_44100",
    ) -> tuple[bytes, int]:
        """POST /v1/music with a composition plan -> raw audio bytes + api_time_ms."""
        url = f"{ELEVENLABS_BASE}/v1/music?output_format={output_format}"
        headers = {
            "xi-api-key": self._eleven_key,
            "Content-Type": "application/json",
            "Accept": "audio/*",
        }
        payload = {
            "model_id": "music_v1",
            "composition_plan": composition_plan,
            "respect_sections_durations": True,
        }
        logger.info("[11Labs] Posting to /v1/music ...")
        start = time.time()
        resp = await self._http.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        api_ms = int((time.time() - start) * 1000)
        logger.info(f"[11Labs] Received {len(resp.content)} bytes in {api_ms}ms")
        return resp.content, api_ms

    @staticmethod
    def process_audio(raw_audio: bytes, output_format: str = "pcm_44100") -> bytes:
        """Convert raw PCM to WAV and apply crossfade loop. Returns WAV bytes."""
        if output_format.startswith("pcm"):
            sr = int(output_format.split("_")[1])
            wav_data = pcm_to_wav(raw_audio, sample_rate=sr)
            return crossfade_loop(wav_data)
        # For mp3 or other formats, return as-is
        return raw_audio

    async def close(self) -> None:
        await self._http.aclose()
