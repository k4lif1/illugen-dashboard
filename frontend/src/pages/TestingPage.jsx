import React, { useState, useEffect, useRef } from 'react';
import api, { API_BASE_URL } from '../services/api';
import AudioPlayer from '../components/AudioPlayer';
import ScoringSliders from '../components/ScoringSliders';
import JsonViewer from '../components/JsonViewer';

export default function TestingPage() {
  // Detect if this is a page refresh (reload) vs navigation
  const isPageRefresh = useRef(false);

  useEffect(() => {
    const navEntries = performance.getEntriesByType('navigation');
    if (navEntries.length > 0) {
      isPageRefresh.current = navEntries[0].type === 'reload';
    }
  }, []);

  // Helper to get state from sessionStorage (only if not a refresh)
  const getInitialState = (key, defaultValue) => {
    if (isPageRefresh.current) {
      return defaultValue;
    }
    try {
      const saved = sessionStorage.getItem(`testingPage_${key}`);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const [currentPrompt, setCurrentPrompt] = useState(() => getInitialState('currentPrompt', null));
  const [llmJson, setLlmJson] = useState(() => getInitialState('llmJson', null));
  const [llmResponse, setLlmResponse] = useState(() => getInitialState('llmResponse', null));
  const [audioUrl, setAudioUrl] = useState(() => getInitialState('audioUrl', ''));
  const [audioId, setAudioId] = useState(() => getInitialState('audioId', ''));
  const [audioFilePath, setAudioFilePath] = useState(() => getInitialState('audioFilePath', ''));
  const [status, setStatus] = useState('');
  const [scores, setScores] = useState(() => getInitialState('scores', { audio_quality_score: null, llm_accuracy_score: null }));
  const [notes, setNotes] = useState(() => getInitialState('notes', ''));
  const [notesPanelOpen, setNotesPanelOpen] = useState(false);
  const [noteAudioFile, setNoteAudioFile] = useState(null);
  const [noteAudioPath, setNoteAudioPath] = useState('');
  const [noteAttachments, setNoteAttachments] = useState(() => getInitialState('noteAttachments', []));
  const [noteDragActive, setNoteDragActive] = useState(false);
  const noteFileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [wasGenerating, setWasGenerating] = useState(false);
  const [freeTextMode, setFreeTextMode] = useState(() => getInitialState('freeTextMode', false));
  const [freeText, setFreeText] = useState(() => getInitialState('freeText', ''));

  // ElevenLabs generation parameters
  const [bpm, setBpm] = useState(() => getInitialState('bpm', ''));       // '' = auto
  const [bars, setBars] = useState(() => getInitialState('bars', 4));
  const [musicalKey, setMusicalKey] = useState(() => getInitialState('musicalKey', 'auto'));  // 'auto' = LLM decides
  const [outputFormat, setOutputFormat] = useState(() => getInitialState('outputFormat', 'pcm_44100'));

  // Variations from parallel generation
  const [variations, setVariations] = useState(() => getInitialState('variations', []));

  // Generation metadata from response
  const [generationMeta, setGenerationMeta] = useState(() => getInitialState('generationMeta', null));

  // Free text metadata - user fills these in after generation
  const [freeTextMetadata, setFreeTextMetadata] = useState(() => getInitialState('freeTextMetadata', {
    difficulty: null
  }));
  const [difficultyError, setDifficultyError] = useState(false);
  const [freeTextError, setFreeTextError] = useState(false);
  const [generationScoreError, setGenerationScoreError] = useState(false);
  const [llmScoreError, setLlmScoreError] = useState(false);

  // Prompt queue — pre-fetched batch so the next prompt is always ready
  const QUEUE_SIZE = 10;
  const [promptQueue, setPromptQueue] = useState(() => getInitialState('promptQueue', []));
  const promptQueueRef = useRef(promptQueue);
  useEffect(() => { promptQueueRef.current = promptQueue; }, [promptQueue]);

  // Pre-generation pipeline — generates audio for queued prompts in background
  const pregenResults = useRef(new Map());
  const pregenInFlight = useRef(new Set());
  const [pregenReadyCount, setPregenReadyCount] = useState(0);
  const [pregenTotal, setPregenTotal] = useState(0);

  // User-set difficulty for auto-prompt mode (independent of prompt DB value)
  const [autoPromptDifficulty, setAutoPromptDifficulty] = useState(() => getInitialState('autoPromptDifficulty', null));

  // Edit/Delete prompt state
  const [editMode, setEditMode] = useState(false);
  const [editedPromptText, setEditedPromptText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const resetTestingForm = () => {
    [
      'testingPage_llmJson',
      'testingPage_llmResponse',
      'testingPage_audioUrl',
      'testingPage_scores',
      'testingPage_notes',
      'testingPage_noteAttachments',
      'testingPage_freeText',
      'testingPage_freeTextMetadata',
      'testingPage_generationMeta',
      'testingPage_variations',
      'testingPage_promptQueue',
      'testingPage_autoPromptDifficulty',
    ].forEach((key) => sessionStorage.removeItem(key));

    setStatus('');
    setScores({ audio_quality_score: null, llm_accuracy_score: null });
    setNotes('');
    setNotesPanelOpen(false);
    setNoteAudioFile(null);
    setNoteAudioPath('');
    setNoteAttachments([]);
    setNoteDragActive(false);
    setAudioUrl('');
    setLlmJson(null);
    setLlmResponse(null);
    setWasGenerating(false);
    setSubmitting(false);
    setGenerationScoreError(false);
    setLlmScoreError(false);
    setDifficultyError(false);
    setFreeTextError(false);
    setGenerationMeta(null);
    setVariations([]);
    if (noteFileInputRef.current) {
      noteFileInputRef.current.value = '';
    }
    if (freeTextMode) {
      setFreeText('');
      setFreeTextMetadata({ difficulty: null });
    }
  };

  // Save state to sessionStorage whenever it changes
  useEffect(() => {
    sessionStorage.setItem('testingPage_currentPrompt', JSON.stringify(currentPrompt));
  }, [currentPrompt]);

  useEffect(() => {
    sessionStorage.setItem('testingPage_llmJson', JSON.stringify(llmJson));
  }, [llmJson]);

  useEffect(() => {
    sessionStorage.setItem('testingPage_llmResponse', JSON.stringify(llmResponse));
  }, [llmResponse]);

  useEffect(() => {
    sessionStorage.setItem('testingPage_audioUrl', JSON.stringify(audioUrl));
  }, [audioUrl]);

  useEffect(() => {
    sessionStorage.setItem('testingPage_scores', JSON.stringify(scores));
  }, [scores]);

  useEffect(() => {
    sessionStorage.setItem('testingPage_freeTextMode', JSON.stringify(freeTextMode));
  }, [freeTextMode]);

  useEffect(() => {
    sessionStorage.setItem('testingPage_freeText', JSON.stringify(freeText));
  }, [freeText]);

  useEffect(() => {
    sessionStorage.setItem('testingPage_bpm', JSON.stringify(bpm));
  }, [bpm]);

  useEffect(() => {
    sessionStorage.setItem('testingPage_bars', JSON.stringify(bars));
  }, [bars]);

  useEffect(() => {
    sessionStorage.setItem('testingPage_musicalKey', JSON.stringify(musicalKey));
  }, [musicalKey]);

  useEffect(() => {
    sessionStorage.setItem('testingPage_outputFormat', JSON.stringify(outputFormat));
  }, [outputFormat]);

  useEffect(() => {
    sessionStorage.setItem('testingPage_freeTextMetadata', JSON.stringify(freeTextMetadata));
  }, [freeTextMetadata]);

  useEffect(() => {
    sessionStorage.setItem('testingPage_notes', JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    sessionStorage.setItem('testingPage_variations', JSON.stringify(variations));
  }, [variations]);

  useEffect(() => {
    sessionStorage.setItem('testingPage_generationMeta', JSON.stringify(generationMeta));
  }, [generationMeta]);

  useEffect(() => {
    sessionStorage.setItem('testingPage_promptQueue', JSON.stringify(promptQueue));
  }, [promptQueue]);

  useEffect(() => {
    sessionStorage.setItem('testingPage_autoPromptDifficulty', JSON.stringify(autoPromptDifficulty));
  }, [autoPromptDifficulty]);

  // Track when generation completes for letter drop animation
  useEffect(() => {
    if (loading) {
      setWasGenerating(true);
    } else if (wasGenerating) {
      const timer = setTimeout(() => setWasGenerating(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [loading, wasGenerating]);

  useEffect(() => {
    sessionStorage.setItem('testingPage_noteAttachments', JSON.stringify(noteAttachments));
  }, [noteAttachments]);

  // Track if we've loaded the initial prompt (only once per component lifecycle)
  const hasLoadedInitialPrompt = useRef(false);
  // AbortController for cancelling in-flight generation when skipping
  const generationAbortRef = useRef(null);

  // Derive logical BPM / bars / key from prompt text for auto-prompt mode
  const getSettingsForPrompt = (text) => {
    const t = (text || '').toLowerCase();

    // BPM ranges by genre/style keywords
    const bpmRules = [
      { pattern: /\b(drill|uk drill)\b/, min: 140, max: 150 },
      { pattern: /\b(trap|phonk)\b/, min: 130, max: 155 },
      { pattern: /\b(dnb|drum\s*(?:and|&|n)\s*bass|jungle)\b/, min: 160, max: 180 },
      { pattern: /\b(dubstep|riddim)\b/, min: 140, max: 150 },
      { pattern: /\b(house|deep house|tech house|disco)\b/, min: 120, max: 128 },
      { pattern: /\b(techno|industrial)\b/, min: 125, max: 138 },
      { pattern: /\b(edm|dance|electro)\b/, min: 124, max: 132 },
      { pattern: /\b(pop|synth.?pop|indie)\b/, min: 100, max: 128 },
      { pattern: /\b(r&b|rnb|neo.?soul|soul)\b/, min: 70, max: 95 },
      { pattern: /\b(hip\s*hop|boom\s*bap|lo.?fi|lofi)\b/, min: 80, max: 100 },
      { pattern: /\b(reggae(ton)?|dancehall)\b/, min: 90, max: 105 },
      { pattern: /\b(latin|salsa|bossa)\b/, min: 100, max: 120 },
      { pattern: /\b(rock|punk|metal|grunge)\b/, min: 110, max: 160 },
      { pattern: /\b(jazz|swing|blues)\b/, min: 90, max: 140 },
      { pattern: /\b(ambient|chill|downtempo|meditation)\b/, min: 60, max: 85 },
      { pattern: /\b(cinematic|orchestral|epic)\b/, min: 80, max: 120 },
      { pattern: /\b(funk|groove)\b/, min: 100, max: 120 },
      { pattern: /\b(afro|afrobeat)\b/, min: 100, max: 115 },
      { pattern: /\b(garage|2.?step)\b/, min: 130, max: 140 },
    ];
    let bpmMin = 85, bpmMax = 130;
    for (const rule of bpmRules) {
      if (rule.pattern.test(t)) { bpmMin = rule.min; bpmMax = rule.max; break; }
    }
    const bpmVal = bpmMin + Math.floor(Math.random() * (bpmMax - bpmMin + 1));

    // Bars: longer loops for ambient/cinematic/jazz, shorter for punchy genres
    let barsVal = 4;
    if (/\b(ambient|cinematic|orchestral|epic|chill|downtempo|jazz)\b/.test(t)) barsVal = 8;
    else if (/\b(stinger|one.?shot|fill|riser|impact)\b/.test(t)) barsVal = 2;
    else barsVal = Math.random() < 0.35 ? 8 : 4;

    // Key: pick from a set with tonal variety, bias minor for dark/moody
    const majorKeys = ['C major','D major','E major','F major','G major','A major','Bb major','Eb major'];
    const minorKeys = ['A minor','C minor','D minor','E minor','F# minor','G minor','B minor','Eb minor'];
    const darkWords = /\b(dark|moody|minor|sad|melanchol|eerie|horror|sinister|aggressive|hard|evil)\b/;
    const brightWords = /\b(bright|happy|major|uplifting|upbeat|cheerful|sunny|joy)\b/;
    let keyPool;
    if (darkWords.test(t)) keyPool = minorKeys;
    else if (brightWords.test(t)) keyPool = majorKeys;
    else keyPool = [...majorKeys, ...minorKeys];
    const keyVal = keyPool[Math.floor(Math.random() * keyPool.length)];

    return { bpm: bpmVal, bars: barsVal, key: keyVal };
  };

  // Reset edit mode when loading a new prompt
  useEffect(() => {
    if (currentPrompt) {
      setEditMode(false);
    }
  }, [currentPrompt?.id]);

  // Fetch a batch of prompts for the queue, excluding IDs already in queue + current
  const fetchBatch = async (currentQueue = [], currentId = null, count = QUEUE_SIZE) => {
    const excludeIds = currentQueue.map(p => p.id);
    if (currentId) excludeIds.push(currentId);
    const needed = Math.max(0, count - currentQueue.length);
    if (needed === 0) return currentQueue;
    try {
      const params = { count: needed };
      if (excludeIds.length) params.exclude_ids = excludeIds.join(',');
      const { data } = await api.get('/api/prompts/batch', { params });
      return [...currentQueue, ...data];
    } catch {
      return currentQueue;
    }
  };

  // Pre-generate a single prompt and store result
  const pregenOne = async (prompt, settings) => {
    if (pregenResults.current.has(prompt.id) || pregenInFlight.current.has(prompt.id)) return;
    pregenInFlight.current.add(prompt.id);
    try {
      // Derive logical settings from prompt text (auto-prompt mode)
      const derived = getSettingsForPrompt(prompt.text);
      const payload = { prompt_id: prompt.id, bars: derived.bars, output_format: settings.outputFormat };
      payload.bpm = derived.bpm;
      payload.key = derived.key;
      const { data } = await api.post('/api/test/send-prompt', payload);
      pregenResults.current.set(prompt.id, {
        llmJson: data.composition_plan,
        llmResponse: data.llm_response || null,
        audioUrl: data.audio_url ? `${API_BASE_URL}${data.audio_url}` : '',
        audioId: data.audio_id || '',
        audioFilePath: data.audio_url || '',
        variations: (data.variations || []).map(v => ({
          audio_id: v.audio_id,
          audio_url: `${API_BASE_URL}${v.audio_url}`,
          original_audio_id: v.original_audio_id || null,
          original_audio_url: v.original_audio_url ? `${API_BASE_URL}${v.original_audio_url}` : null,
        })),
        generationMeta: { bpm: data.bpm, bars: data.bars, key: data.key, duration_ms: data.duration_ms, api_time_ms: data.api_time_ms },
      });
      setPregenReadyCount(pregenResults.current.size);
    } catch (err) {
      console.error(`Pre-gen failed for prompt ${prompt.id}:`, err);
    } finally {
      pregenInFlight.current.delete(prompt.id);
    }
  };

  // Run pre-generation pipeline with limited concurrency
  const startPregenPipeline = (prompts, settings) => {
    setPregenTotal(prompts.length);
    const queue = [...prompts];
    const MAX_CONCURRENT = 2;
    const worker = async () => {
      while (queue.length > 0) {
        const p = queue.shift();
        if (p) await pregenOne(p, settings);
      }
    };
    for (let i = 0; i < Math.min(MAX_CONCURRENT, prompts.length); i++) worker();
  };

  // Apply a pre-generated result to the current UI state
  const applyPregenResult = (result) => {
    setLlmJson(result.llmJson);
    setLlmResponse(result.llmResponse);
    setAudioUrl(result.audioUrl);
    setAudioId(result.audioId);
    setAudioFilePath(result.audioFilePath);
    setVariations(result.variations);
    setGenerationMeta(result.generationMeta);
    setNoteAttachments([]);
    setNoteAudioFile(null);
    setNoteAudioPath('');
    const keyLabel = result.generationMeta.key || 'No key';
    setStatus(`Generated in ${(result.generationMeta.api_time_ms / 1000).toFixed(1)}s | ${result.generationMeta.duration_ms}ms @ ${result.generationMeta.bpm} BPM | ${keyLabel}`);
  };

  // Pop the next prompt from the queue and refill in background
  const advanceFromQueue = (queue) => {
    if (queue.length === 0) return null;
    const [next, ...rest] = queue;
    setPromptQueue(rest);
    setAutoPromptDifficulty(null);
    setScores({ audio_quality_score: null, llm_accuracy_score: null });
    setGenerationMeta(null);
    setVariations([]);
    resetNotesAndAttachments();
    setNotesPanelOpen(false);
    setStatus('');

    // Check if pre-gen result is already available
    const cached = pregenResults.current.get(next.id);
    if (cached) {
      // Apply cached result directly — no setTimeout to avoid race
      pregenResults.current.delete(next.id);
      setPregenReadyCount(pregenResults.current.size);
      setCurrentPrompt(next);
      setLlmJson(cached.llmJson);
      setLlmResponse(cached.llmResponse);
      setAudioUrl(cached.audioUrl);
      setAudioId(cached.audioId);
      setAudioFilePath(cached.audioFilePath);
      setVariations(cached.variations);
      setGenerationMeta(cached.generationMeta);
      const keyLabel = cached.generationMeta.key || 'No key';
      setStatus(`Generated in ${(cached.generationMeta.api_time_ms / 1000).toFixed(1)}s | ${cached.generationMeta.duration_ms}ms @ ${cached.generationMeta.bpm} BPM | ${keyLabel}`);
    } else {
      // No cached result yet — set prompt and clear results (will poll below)
      setCurrentPrompt(next);
      setLlmJson(null);
      setLlmResponse(null);
      setAudioUrl('');
      // If not even in-flight, kick off generation for this prompt
      if (!pregenInFlight.current.has(next.id)) {
        pregenOne(next, { outputFormat });
      }
    }

    // Refill queue + start pregen for any new prompts
    fetchBatch(rest, next.id, QUEUE_SIZE).then(newQueue => {
      setPromptQueue(newQueue);
      const newPrompts = newQueue.filter(p => !pregenResults.current.has(p.id) && !pregenInFlight.current.has(p.id));
      if (newPrompts.length > 0) {
        startPregenPipeline(newPrompts, { outputFormat });
      }
    });
    return next;
  };

  // Poll for current prompt's pre-gen result while it's being generated.
  // Generation is started elsewhere (pipeline, advanceFromQueue, or loadNextPrompt fallback).
  // This effect only checks the cache and polls — it never starts new generation.
  useEffect(() => {
    if (!freeTextMode && currentPrompt && !llmJson && !audioUrl) {
      const cached = pregenResults.current.get(currentPrompt.id);
      if (cached) {
        pregenResults.current.delete(currentPrompt.id);
        setPregenReadyCount(pregenResults.current.size);
        applyPregenResult(cached);
        return;
      }
      // Poll until result is ready (generation was already started)
      const interval = setInterval(() => {
        const result = pregenResults.current.get(currentPrompt.id);
        if (result) {
          pregenResults.current.delete(currentPrompt.id);
          setPregenReadyCount(pregenResults.current.size);
          applyPregenResult(result);
          clearInterval(interval);
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, [currentPrompt?.id, llmJson, audioUrl]);

  // Initial load: populate queue + start pre-generation pipeline
  useEffect(() => {
    if (!freeTextMode && !currentPrompt && !hasLoadedInitialPrompt.current) {
      hasLoadedInitialPrompt.current = true;
      (async () => {
        setLoading(true);
        setStatus('Loading prompts and pre-generating loops...');
        try {
          const batch = await fetchBatch([], null, QUEUE_SIZE + 1);
          if (batch.length > 0) {
            const [first, ...rest] = batch;
            setCurrentPrompt(first);
            setPromptQueue(rest);
            // Start pre-generating ALL prompts (current + queue) via the pipeline
            startPregenPipeline(batch, { outputFormat });
          } else {
            setStatus('No prompts in the database.');
          }
        } catch (err) {
          setStatus(`Error loading prompts: ${err?.response?.data?.detail || err.message}`);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, []);

  const handleNoteFileSelect = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.wav')) {
      setStatus('Error: Only .wav files are supported for attachments');
      setTimeout(() => setStatus(''), 2000);
      return;
    }
    setNoteAudioFile(file);
    setNoteAudioPath('');
  };

  const handleNoteFileInput = (event) => {
    const file = event.target.files?.[0];
    handleNoteFileSelect(file);
  };

  const resetNotesAndAttachments = () => {
    setNotes('');
    setNoteAudioFile(null);
    setNoteAudioPath('');
    setNoteAttachments([]);
    setNoteDragActive(false);
    if (noteFileInputRef.current) {
      noteFileInputRef.current.value = '';
    }
  };

  const uploadNoteAttachment = async () => {
    if (!noteAudioFile) return null;
    const formData = new FormData();
    formData.append('file', noteAudioFile);
    const { data } = await api.post('/api/results/upload-note-audio', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data?.path || null;
  };

  const loadNextPrompt = async () => {
    // Cancel any in-flight generation for the current prompt
    if (generationAbortRef.current) {
      generationAbortRef.current.abort();
      generationAbortRef.current = null;
    }
    setLoading(false);

    // Read queue from ref to avoid stale closure issues
    const queue = promptQueueRef.current;
    if (queue.length > 0) {
      advanceFromQueue(queue);
      return;
    }
    // Queue empty — fallback to single fetch
    setStatus('Loading next prompt...');
    setLoading(true);
    try {
      const params = {};
      if (currentPrompt) {
        params.current_drum_type = currentPrompt.drum_type;
        params.current_difficulty = currentPrompt.difficulty;
        params.exclude_id = currentPrompt.id;
      }
      const { data } = await api.get('/api/prompts/next-in-rotation', { params });
      setCurrentPrompt(data);
      setLlmJson(null);
      setLlmResponse(null);
      setAudioUrl('');
      setScores({ audio_quality_score: null, llm_accuracy_score: null });
      setGenerationMeta(null);
      setVariations([]);
      resetNotesAndAttachments();
      setNotesPanelOpen(false);
      setAutoPromptDifficulty(null);
      setStatus('');
      // Start generation for this single prompt (no pipeline covers it)
      pregenOne(data, { outputFormat });
      // Re-fill queue in background
      fetchBatch([], data.id).then(setPromptQueue);
    } catch (err) {
      setStatus(`Error loading prompt: ${err?.response?.data?.detail || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const sendPrompt = async () => {
    if (freeTextMode) {
      if (!freeText.trim()) {
        setFreeTextError(true);
        setTimeout(() => setFreeTextError(false), 2400);
        return;
      }
    }

    setStatus('Generating loop via ElevenLabs...');
    setLoading(true);
    // Create an AbortController so skip can cancel this request
    const abortCtrl = new AbortController();
    generationAbortRef.current = abortCtrl;
    try {
      const payload = freeTextMode
        ? { text: freeText }
        : { prompt_id: currentPrompt.id };

      if (!freeTextMode && currentPrompt) {
        const derived = getSettingsForPrompt(currentPrompt.text);
        payload.bpm = derived.bpm;
        payload.bars = derived.bars;
        payload.key = derived.key;
      } else {
        payload.bpm = bpm === '' ? null : parseInt(bpm);
        payload.bars = bars;
        if (musicalKey && musicalKey !== 'auto') payload.key = musicalKey;
      }
      payload.output_format = outputFormat;

      const { data } = await api.post('/api/test/send-prompt', payload, { signal: abortCtrl.signal });
      setLlmJson(data.composition_plan);
      setLlmResponse(data.llm_response || null);
      setAudioUrl(data.audio_url ? `${API_BASE_URL}${data.audio_url}` : '');
      setAudioId(data.audio_id || '');
      setAudioFilePath(data.audio_url || '');
      setVariations((data.variations || []).map(v => ({
        audio_id: v.audio_id,
        audio_url: `${API_BASE_URL}${v.audio_url}`,
        original_audio_id: v.original_audio_id || null,
        original_audio_url: v.original_audio_url ? `${API_BASE_URL}${v.original_audio_url}` : null,
      })));
      setNoteAttachments([]);
      setNoteAudioFile(null);
      setNoteAudioPath('');
      setGenerationMeta({
        bpm: data.bpm,
        bars: data.bars,
        key: data.key,
        duration_ms: data.duration_ms,
        api_time_ms: data.api_time_ms,
      });

      const keyLabel = data.key || 'No key';
      setStatus(`Generated in ${(data.api_time_ms / 1000).toFixed(1)}s | ${data.duration_ms}ms @ ${data.bpm} BPM | ${keyLabel}`);

      setDifficultyError(false);
      setFreeTextError(false);
    } catch (err) {
      if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError' || abortCtrl.signal.aborted) {
        return; // Skipped — silently ignore
      }
      if (err?.response?.status === 502) {
        const detail = err?.response?.data?.detail || 'The generation service is temporarily unavailable.';
        setStatus(`Error: ${detail}`);
      } else {
        setStatus(`Error: ${err?.response?.data?.detail || err.message || 'An unexpected error occurred'}`);
      }
    } finally {
      if (!abortCtrl.signal.aborted) setLoading(false);
      generationAbortRef.current = null;
    }
  };

  const submitScoreAndNext = async () => {
    if (!currentPrompt && !freeTextMode) {
      setStatus('Cannot submit score without prompt.');
      return;
    }

    const currentDifficulty = freeTextMode ? freeTextMetadata.difficulty : autoPromptDifficulty;
    if (currentDifficulty === null || currentDifficulty === undefined) {
      setDifficultyError(true);
      setTimeout(() => setDifficultyError(false), 2400);
      return;
    }

    // Check that scores are set
    let hasError = false;
    if (scores.audio_quality_score === null || scores.audio_quality_score === undefined) {
      setGenerationScoreError(true);
      hasError = true;
      setTimeout(() => setGenerationScoreError(false), 2000);
    }

    if (scores.llm_accuracy_score === null || scores.llm_accuracy_score === undefined) {
      setLlmScoreError(true);
      hasError = true;
      setTimeout(() => setLlmScoreError(false), 2000);
    }

    if (hasError) return;

    setSubmitting(true);
    setStatus('Submitting score...');
    try {
      let notesAudioPathValue = noteAudioPath || null;
      let attachmentsPayload = [...noteAttachments];
      if (noteAudioFile) {
        try {
          const uploadedPath = await uploadNoteAttachment();
          notesAudioPathValue = uploadedPath;
          attachmentsPayload = [
            ...attachmentsPayload,
            {
              id: `upload-${Date.now()}`,
              type: 'upload',
              label: noteAudioFile.name,
              serve_path: uploadedPath,
              url: uploadedPath ? `${API_BASE_URL}${uploadedPath}` : '',
            },
          ];
        } catch (err) {
          setStatus(`Error uploading note audio: ${err?.response?.data?.detail || err.message}`);
          setSubmitting(false);
          setLoading(false);
          return;
        }
      } else if (noteAudioPath) {
        attachmentsPayload = [
          ...attachmentsPayload,
          {
            id: 'upload-existing',
            type: 'upload',
            label: 'Note attachment',
            serve_path: noteAudioPath,
            url: `${API_BASE_URL}${noteAudioPath}`,
          },
        ];
      }

      const currentAudioId = audioUrl?.split('/').pop() || null;

      const payload = {
        llm_accuracy_score: scores.llm_accuracy_score,
        audio_quality_score: scores.audio_quality_score,
        generated_json: llmJson,
        llm_response: llmResponse,
        audio_id: currentAudioId,
        audio_file_path: currentAudioId ? `audio_files/${currentAudioId}.wav` : null,
        audio_variations: variations.length > 0
          ? variations.map(v => ({
              audio_id: v.audio_id,
              original_audio_id: v.original_audio_id || null,
            }))
          : (currentAudioId ? [{ audio_id: currentAudioId }] : null),
        notes: notes.trim() || null,
        notes_audio_path: notesAudioPathValue,
        illugen_attachments: attachmentsPayload.length ? { items: attachmentsPayload } : null,
      };

      if (freeTextMode) {
        payload.free_text_prompt = freeText;
        payload.free_text_difficulty = currentDifficulty;
        payload.free_text_category = 'user-generated';
      } else {
        payload.prompt_id = currentPrompt.id;
        payload.free_text_difficulty = currentDifficulty;
      }

      console.log('[Difficulty Debug] Submitting with free_text_difficulty:', payload.free_text_difficulty, 'currentDifficulty:', currentDifficulty);
      await api.post('/api/results/score', payload);

      setStatus('Score saved!');
      setTimeout(() => setStatus(''), 3000);

      setNoteAudioFile(null);
      setNoteAudioPath('');
      setNoteAttachments([]);
      setNoteDragActive(false);
      if (noteFileInputRef.current) {
        noteFileInputRef.current.value = '';
      }

      if (!freeTextMode) {
        setTimeout(() => {
          setSubmitting(false);
          loadNextPrompt();
        }, 1000);
      } else {
        setLlmJson(null);
        setLlmResponse(null);
        setAudioUrl('');
        setScores({ audio_quality_score: null, llm_accuracy_score: null });
        setNotes('');
        setNotesPanelOpen(false);
        setFreeText('');
        setFreeTextMetadata({ difficulty: null });
        setGenerationMeta(null);
        setVariations([]);
        setSubmitting(false);
      }
    } catch (err) {
      setStatus(`Error: ${err?.response?.data?.detail || err.message}`);
      setSubmitting(false);
    }
  };

  const submitLLMFailure = async () => {
    if (!currentPrompt && !freeTextMode) {
      setStatus('Cannot submit LLM failure without prompt.');
      return;
    }

    if (!llmResponse) {
      setStatus('No LLM response to submit as failure.');
      return;
    }

    setSubmitting(true);
    setStatus('Submitting LLM failure...');
    try {
      const promptText = freeTextMode ? freeText : (currentPrompt?.text || '');

      const payload = {
        prompt_text: promptText,
        llm_response: llmResponse,
        audio_id: audioId || null,
        audio_file_path: audioFilePath || null,
        notes: notes || null,
        notes_audio_path: noteAudioPath || null,
      };

      if (freeTextMode) {
        payload.free_text_prompt = freeText;
        payload.free_text_difficulty = freeTextMetadata.difficulty;
        payload.free_text_category = 'user-generated';
      } else {
        payload.prompt_id = currentPrompt.id;
      }

      await api.post('/api/llm-failures/', payload);

      setStatus('LLM failure recorded!');
      setTimeout(() => setStatus(''), 3000);

      setNoteAudioFile(null);
      setNoteAudioPath('');
      setNoteAttachments([]);
      setNoteDragActive(false);
      if (noteFileInputRef.current) {
        noteFileInputRef.current.value = '';
      }

      if (!freeTextMode) {
        setTimeout(() => {
          setSubmitting(false);
          loadNextPrompt();
        }, 1000);
      } else {
        setLlmJson(null);
        setLlmResponse(null);
        setAudioUrl('');
        setScores({ audio_quality_score: null, llm_accuracy_score: null });
        setNotes('');
        setNotesPanelOpen(false);
        setFreeText('');
        setFreeTextMetadata({ difficulty: null });
        setGenerationMeta(null);
        setVariations([]);
        setSubmitting(false);
      }
    } catch (err) {
      setStatus(`Error: ${err?.response?.data?.detail || err.message || 'An unexpected error occurred'}`);
      setSubmitting(false);
    }
  };

  const toggleMode = () => {
    const newMode = !freeTextMode;
    setFreeTextMode(newMode);
    setLlmJson(null);
    setLlmResponse(null);
    setAudioUrl('');
    setGenerationMeta(null);
    setVariations([]);
    setStatus('');
  };

  const handleEditPrompt = () => {
    if (!currentPrompt) return;
    setEditedPromptText(currentPrompt.text);
    setEditMode(true);
  };

  const handleSaveEdit = async () => {
    if (!currentPrompt) return;

    if (!editedPromptText.trim()) {
      setStatus('Error: Prompt text cannot be empty');
      return;
    }

    setLoading(true);
    setStatus('Updating prompt...');
    try {
      await api.put(`/api/prompts/${currentPrompt.id}`, {
        text: editedPromptText.trim(),
        difficulty: currentPrompt.difficulty,
        drum_type: currentPrompt.drum_type,
        category: currentPrompt.category,
        is_user_generated: currentPrompt.is_user_generated,
        expected_parameters: currentPrompt.expected_parameters,
      });

      const { data } = await api.get(`/api/prompts/${currentPrompt.id}`);
      setCurrentPrompt(data);
      setEditMode(false);
      setEditedPromptText('');
      setStatus('Prompt updated!');
      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      setStatus(`Error updating prompt: ${err?.response?.data?.detail || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePrompt = async () => {
    if (!currentPrompt) return;

    setLoading(true);
    setStatus('Deleting prompt...');
    try {
      await api.delete(`/api/prompts/${currentPrompt.id}`);
      setShowDeleteConfirm(false);
      setStatus('Prompt deleted!');

      setTimeout(() => {
        setStatus('');
        loadNextPrompt();
      }, 1000);
    } catch (err) {
      setStatus(`Error deleting prompt: ${err?.response?.data?.detail || err.message}`);
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditedPromptText('');
  };

  return (
    <div className="grid" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Mode Toggle & Generation Parameters */}
      <div className="card" style={{ zIndex: 1, overflow: 'visible' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', zIndex: 1 }}>Testing Mode</h2>
          <button
            onClick={resetTestingForm}
            className="btn btn-secondary"
            style={{ zIndex: 1, background: 'var(--secondary-bg)', border: '1px solid var(--border-color)' }}
            title="Reset form fields and attachments"
          >
            Reset
          </button>
        </div>

        {/* Generation Parameters */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label className="label" style={{ margin: 0, fontSize: '14px', whiteSpace: 'nowrap' }}>BPM:</label>
            <input
              type="text"
              value={bpm}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  setBpm('');
                } else if (/^\d{0,3}$/.test(val)) {
                  setBpm(val);
                }
              }}
              onBlur={() => {
                if (bpm !== '') {
                  const num = parseInt(bpm);
                  if (isNaN(num) || num < 40) setBpm(40);
                  else if (num > 300) setBpm(300);
                  else setBpm(num);
                }
              }}
              onWheel={(e) => {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 1 : -1;
                const current = bpm === '' ? 120 : (parseInt(bpm) || 120);
                setBpm(Math.max(40, Math.min(300, current + delta)));
              }}
              onDoubleClick={(e) => e.target.select()}
              placeholder="Auto"
              className="input"
              style={{ width: '80px', textAlign: 'center', cursor: 'ns-resize' }}
              title="Scroll to adjust · Double-click to select · Clear for Auto"
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label className="label" style={{ margin: 0, fontSize: '14px', whiteSpace: 'nowrap' }}>Bars:</label>
            <select
              value={bars}
              onChange={(e) => setBars(parseInt(e.target.value))}
              className="input"
              style={{ width: '70px', cursor: 'pointer' }}
            >
              <option value={2}>2</option>
              <option value={4}>4</option>
              <option value={8}>8</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label className="label" style={{ margin: 0, fontSize: '14px', whiteSpace: 'nowrap' }}>Key:</label>
            <select
              value={musicalKey}
              onChange={(e) => setMusicalKey(e.target.value)}
              className="input"
              style={{ width: '140px', cursor: 'pointer' }}
            >
              <option value="auto">Auto</option>
              <option value="">None</option>
              <option value="C major">C major</option>
              <option value="C minor">C minor</option>
              <option value="C# major">C# major</option>
              <option value="C# minor">C# minor</option>
              <option value="D major">D major</option>
              <option value="D minor">D minor</option>
              <option value="Eb major">Eb major</option>
              <option value="Eb minor">Eb minor</option>
              <option value="E major">E major</option>
              <option value="E minor">E minor</option>
              <option value="F major">F major</option>
              <option value="F minor">F minor</option>
              <option value="F# major">F# major</option>
              <option value="F# minor">F# minor</option>
              <option value="G major">G major</option>
              <option value="G minor">G minor</option>
              <option value="Ab major">Ab major</option>
              <option value="Ab minor">Ab minor</option>
              <option value="A major">A major</option>
              <option value="A minor">A minor</option>
              <option value="Bb major">Bb major</option>
              <option value="Bb minor">Bb minor</option>
              <option value="B major">B major</option>
              <option value="B minor">B minor</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label className="label" style={{ margin: 0, fontSize: '14px', whiteSpace: 'nowrap' }}>Format:</label>
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
              className="input"
              style={{ width: '160px', cursor: 'pointer' }}
            >
              <option value="pcm_44100">WAV 44.1kHz</option>
              <option value="pcm_48000">WAV 48kHz</option>
              <option value="mp3_44100_128">MP3 128kbps</option>
              <option value="mp3_44100_192">MP3 192kbps</option>
            </select>
          </div>
        </div>
      </div>

      {/* Generate Loop Card — tabbed: Auto Prompt | Free Text */}
      <div className="card" style={{ zIndex: 1 }}>

        {/* Tab strip */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '20px' }}>
          {[
            { label: 'Auto Prompt', isActive: !freeTextMode },
            { label: 'Free Text',   isActive:  freeTextMode },
          ].map(({ label, isActive }) => (
            <button
              key={label}
              onClick={() => {
                if (label === 'Auto Prompt' && freeTextMode)  toggleMode();
                if (label === 'Free Text'   && !freeTextMode) toggleMode();
              }}
              style={{
                padding: '8px 20px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--primary-color)' : '2px solid transparent',
                color: isActive ? 'var(--primary-color)' : 'var(--text-secondary)',
                fontWeight: isActive ? '600' : '400',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'color 150ms ease, border-color 150ms ease',
                marginBottom: '-1px',
                userSelect: 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Free Text tab ── */}
        {freeTextMode ? (
          <div style={{ zIndex: 1 }}>
            <div>
              {/* Prompt textarea */}
              <div>
                <label className="label" style={{ marginBottom: '8px', display: 'block' }}>
                  {loading ? 'Your prompt:' : 'Enter your prompt:'}
                </label>
                {(loading || wasGenerating) ? (
                  <div style={{
                    padding: '16px',
                    background: 'var(--secondary-bg)',
                    borderRadius: '8px',
                    fontSize: '16px',
                    lineHeight: '1.6',
                    border: '1px solid var(--border-color)',
                    zIndex: 1,
                    minHeight: '60px',
                    display: 'flex',
                    alignItems: 'flex-start',
                  }}>
                    {loading && freeText ? (
                      <span>
                        {freeText.split('').map((char, index) => (
                          <span key={index} style={{
                            display: 'inline-block',
                            animationName: 'floatUp',
                            animationDuration: '3s',
                            animationTimingFunction: 'ease-in-out',
                            animationIterationCount: 'infinite',
                            animationDelay: `${index * 0.05}s`,
                            whiteSpace: char === ' ' ? 'pre' : 'normal'
                          }}>{char}</span>
                        ))}
                      </span>
                    ) : wasGenerating && freeText ? (
                      <span>
                        {freeText.split('').map((char, index) => (
                          <span key={index} style={{
                            display: 'inline-block',
                            animationName: 'dropDown',
                            animationDuration: '0.6s',
                            animationTimingFunction: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
                            animationDelay: `${index * 0.02}s`,
                            animationFillMode: 'backwards',
                            whiteSpace: char === ' ' ? 'pre' : 'normal'
                          }}>{char}</span>
                        ))}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <textarea
                    value={freeText}
                    onChange={(e) => { setFreeText(e.target.value); setFreeTextError(false); }}
                    placeholder="Describe the loop you want… e.g. 'solo 808 bass, dark trap' · 'jazzy Rhodes chords' · 'punchy boom bap drums'"
                    rows={2}
                    className={`input ${freeTextError ? 'flash-error-active' : ''}`}
                    style={{
                      fontFamily: 'inherit',
                      fontSize: '16px',
                      lineHeight: '1.6',
                      resize: 'vertical',
                      zIndex: 1,
                      width: '100%',
                      minHeight: '60px',
                      padding: '16px',
                      ...(freeTextError ? {
                        borderColor: 'var(--secondary-color)',
                        borderWidth: '2px',
                        backgroundColor: 'rgba(199, 155, 255, 0.08)'
                      } : {})
                    }}
                  />
                )}
              </div>

            </div>
          </div>

        ) : (
          /* ── Auto Prompt tab ── */
          currentPrompt ? (
            <div style={{ zIndex: 1 }}>
              {/* Pre-generation progress */}
              {pregenTotal > 0 && pregenReadyCount < pregenTotal && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  marginBottom: '12px', padding: '8px 14px',
                  borderRadius: '8px', background: 'rgba(124,58,237,0.08)',
                  border: '1px solid rgba(124,58,237,0.2)', fontSize: '13px',
                }}>
                  <div style={{
                    flex: 1, height: '4px', borderRadius: '2px',
                    background: 'var(--border-color)', overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${(pregenReadyCount / pregenTotal) * 100}%`,
                      height: '100%', borderRadius: '2px',
                      background: 'var(--primary-color)',
                      transition: 'width 300ms ease',
                    }} />
                  </div>
                  <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    Pre-generating {pregenReadyCount}/{pregenTotal} loops
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <div>
                  <label className="label">Current Prompt:</label>
                  <span className="text-secondary" style={{ fontSize: '13px', marginLeft: '12px' }}>
                    Category: {currentPrompt.category || 'N/A'} | Type: {currentPrompt.drum_type || 'N/A'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }} title="Prompts pre-loaded in queue">
                    {promptQueue.length} in queue
                  </span>
                  <button onClick={handleEditPrompt} className="btn btn-secondary" disabled={loading || editMode} style={{ zIndex: 1, fontSize: '13px', padding: '6px 12px' }}>Edit</button>
                  <button onClick={() => setShowDeleteConfirm(true)} className="btn btn-secondary" disabled={loading || editMode} style={{ zIndex: 1, fontSize: '13px', padding: '6px 12px', background: 'var(--error-color)', borderColor: 'var(--error-color)' }}>Delete</button>
                  <button onClick={() => loadNextPrompt()} className="btn btn-secondary" disabled={editMode || submitting} style={{ zIndex: 1 }}>Skip Prompt</button>
                </div>
              </div>

              {editMode ? (
                <div style={{ padding: '16px', background: 'var(--secondary-bg)', borderRadius: '8px', border: '2px solid var(--primary-color)', zIndex: 1 }}>
                  <div style={{ marginBottom: '16px' }}>
                    <label className="label" style={{ marginBottom: '8px', display: 'block' }}>Prompt Text:</label>
                    <textarea
                      value={editedPromptText}
                      onChange={(e) => setEditedPromptText(e.target.value)}
                      rows={4}
                      className="input"
                      style={{ width: '100%', fontFamily: 'inherit', resize: 'vertical' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={handleCancelEdit} className="btn btn-secondary" disabled={loading}>Cancel</button>
                    <button onClick={handleSaveEdit} className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save Changes'}</button>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '16px',
                  background: 'var(--secondary-bg)',
                  borderRadius: '8px',
                  fontSize: '16px',
                  lineHeight: '1.6',
                  border: '1px solid var(--border-color)',
                  zIndex: 1,
                  minHeight: '60px',
                  position: 'relative',
                }}>
                  {currentPrompt?.text || ''}

                  {/* Generating overlay — shown when current prompt has no results yet */}
                  {!llmJson && !audioUrl && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(var(--secondary-bg-rgb, 30,30,30), 0.7)',
                      backdropFilter: 'blur(2px)',
                      borderRadius: '8px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                      fontSize: '14px', color: 'var(--primary-color)', fontWeight: '500',
                    }}>
                      <div style={{
                        width: '18px', height: '18px',
                        border: '2px solid var(--border-color)',
                        borderTopColor: 'var(--primary-color)',
                        borderRadius: '50%',
                        animationName: 'spin',
                        animationDuration: '0.8s',
                        animationTimingFunction: 'linear',
                        animationIterationCount: 'infinite',
                      }} />
                      Generating…
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: 'var(--text-secondary)', padding: '8px 0 16px', fontSize: '15px' }}>
              No prompts in the database yet. Switch to the <strong>Free Text</strong> tab to generate a loop, or add prompts to the prompt bank.
            </div>
          )
        )}

        {/* Generate Loop button — Free Text only (Auto Prompt pre-generates) */}
        <div style={{ display: freeTextMode ? 'flex' : 'none', gap: '10px', marginTop: '20px' }}>
          <button
            onClick={sendPrompt}
            disabled={loading || (!freeTextMode && !currentPrompt)}
            className="btn"
            style={{
              width: '100%',
              justifyContent: 'center',
              zIndex: 1,
              background: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
              borderColor: '#8b5cf6',
              color: '#fff',
              fontWeight: '600',
              boxShadow: loading ? '0 0 0 4px rgba(124,58,237,0.2)' : '0 4px 16px rgba(124, 58, 237, 0.4)',
              transition: 'all 150ms ease',
              transform: loading ? 'scale(0.98)' : 'scale(1)'
            }}
            onMouseEnter={(e) => {
              if (!loading && (freeTextMode || currentPrompt)) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(124, 58, 237, 0.45)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(124, 58, 237, 0.4)';
              }
            }}
            onMouseDown={(e) => {
              if (!loading && (freeTextMode || currentPrompt)) e.currentTarget.style.transform = 'translateY(0)';
            }}
            onMouseUp={(e) => {
              if (!loading && (freeTextMode || currentPrompt)) e.currentTarget.style.transform = 'translateY(-2px)';
            }}
          >
            {loading ? 'Generating…' : 'Generate Loop'}
          </button>
        </div>
      </div>

      {/* Results Section - Only show after sending */}
      {(llmJson || audioUrl) && (
        <>
          {/* Generation Results Header */}
          <div className="card" style={{ zIndex: 1 }}>
            {generationMeta && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '16px' }}>
                {[
                  { label: 'BPM',      value: generationMeta.bpm },
                  { label: 'Key',      value: generationMeta.key || 'None' },
                  { label: 'Bars',     value: generationMeta.bars },
                  { label: 'Duration', value: `${(generationMeta.duration_ms / 1000).toFixed(1)}s` },
                  { label: 'API Time', value: `${(generationMeta.api_time_ms / 1000).toFixed(1)}s` },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    background: 'var(--secondary-bg)',
                    border: '1px solid var(--border-color)',
                    fontSize: '14px',
                  }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>{label}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{value}</span>
                  </div>
                ))}
              </div>
            )}

            <h3 className="label" style={{ fontSize: '16px', margin: 0, marginBottom: '8px', zIndex: 1 }}>
              Composition Plan
            </h3>
            <JsonViewer data={llmJson} />
          </div>

          {/* Audio Player and Scoring */}
          {submitting ? (
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '80px 20px',
              minHeight: '400px'
            }}>
              <div style={{ position: 'relative', width: '200px', height: '200px' }}>
                {/* Outer rotating gradient ring */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '180px',
                    height: '180px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #8247ff 0%, #54d0ff 25%, #ff6b9d 50%, #ffd93d 75%, #8247ff 100%)',
                    backgroundSize: '400% 400%',
                    animation: 'rotateGradient 3s linear infinite, pulse 2s ease-in-out infinite',
                    filter: 'blur(20px)',
                    opacity: 0.6
                  }}
                />
                {/* Middle spinning circle */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '140px',
                    height: '140px',
                    borderRadius: '50%',
                    border: '4px solid transparent',
                    borderTopColor: '#8247ff',
                    borderRightColor: '#54d0ff',
                    borderBottomColor: '#ff6b9d',
                    borderLeftColor: '#ffd93d',
                    animation: 'spin 1.5s linear infinite'
                  }}
                />
                {/* Inner pulsing circle */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #8247ff 0%, #54d0ff 100%)',
                    animation: 'pulse 1.5s ease-in-out infinite',
                    opacity: 0.8
                  }}
                />
                {/* Center circle with shimmer */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #8247ff 0%, #54d0ff 30%, #ff6b9d 60%, #ffd93d 100%)',
                    backgroundSize: '300% 300%',
                    animation: 'shimmer 3s ease-in-out infinite',
                    boxShadow: '0 0 30px rgba(130, 71, 255, 0.6), 0 0 50px rgba(84, 208, 255, 0.4)'
                  }}
                />
                {/* Orbiting dots */}
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: ['#8247ff', '#54d0ff', '#ff6b9d', '#ffd93d'][i],
                      transform: `translate(-50%, -50%) rotate(${i * 90}deg) translateY(-70px)`,
                      animationName: 'orbit',
                      animationDuration: '2s',
                      animationTimingFunction: 'linear',
                      animationIterationCount: 'infinite',
                      animationDelay: `${i * 0.5}s`,
                      boxShadow: `0 0 15px ${['#8247ff', '#54d0ff', '#ff6b9d', '#ffd93d'][i]}`
                    }}
                  />
                ))}
              </div>
              <div
                style={{
                  position: 'absolute',
                  bottom: 'calc(50% - 140px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '18px',
                  fontWeight: '600',
                  background: 'linear-gradient(135deg, #8247ff 0%, #54d0ff 30%, #ff6b9d 60%, #ffd93d 100%)',
                  backgroundSize: '300% 300%',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  animation: 'shimmer 3s ease-in-out infinite',
                  letterSpacing: '1px'
                }}
              >
                Saving score...
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', maxWidth: '900px', margin: '0 auto' }}>
                {/* Audio Variations */}
                <div className="card" style={{ zIndex: 1, padding: '16px' }}>
                  <h3 className="label" style={{ fontSize: '16px', marginBottom: '10px', zIndex: 1 }}>
                    Generated Audio
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    {variations.length > 1 ? (
                      variations.map((v, idx) => (
                        <div key={v.audio_id}>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}>
                            Variation {idx + 1}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--primary-color)', marginBottom: '3px', fontWeight: '500' }}>Loop (crossfaded)</div>
                              <AudioPlayer src={v.audio_url} />
                            </div>
                            {v.original_audio_url && (
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '3px', fontWeight: '500' }}>Original (pre-crossfade)</div>
                                <AudioPlayer src={v.original_audio_url} loop={false} />
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <AudioPlayer src={audioUrl} />
                    )}
                  </div>
                </div>

                {/* Scoring */}
                <div className="card" style={{ zIndex: 1, padding: '16px' }}>
                  <h3 className="label" style={{ fontSize: '16px', marginBottom: '10px', zIndex: 1 }}>
                    Score the Results
                  </h3>
                  <ScoringSliders
                    scores={scores}
                    onChange={(newScores) => {
                      setScores(newScores);
                      if (newScores.audio_quality_score !== null && newScores.audio_quality_score !== undefined) {
                        setGenerationScoreError(false);
                      }
                      if (newScores.llm_accuracy_score !== null && newScores.llm_accuracy_score !== undefined) {
                        setLlmScoreError(false);
                      }
                    }}
                    generationError={generationScoreError}
                    llmError={llmScoreError}
                    difficultyValue={freeTextMode ? freeTextMetadata.difficulty : autoPromptDifficulty}
                    onDifficultyChange={(val) => {
                      if (freeTextMode) {
                        setFreeTextMetadata({ ...freeTextMetadata, difficulty: val });
                      } else {
                        setAutoPromptDifficulty(val);
                      }
                      setDifficultyError(false);
                    }}
                    difficultyError={difficultyError}
                  />
                </div>
              </div>

              {/* Notes Panel Toggle & Submit Button */}
              <div style={{ maxWidth: '520px', margin: '0 auto', marginTop: '20px' }}>
                <button
                  onClick={() => setNotesPanelOpen(!notesPanelOpen)}
                  className="btn btn-secondary"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    marginBottom: notesPanelOpen ? '12px' : '16px',
                    zIndex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    position: 'relative'
                  }}
                >
                  {notes && notes.trim() ? (
                    <>
                      <span
                        style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: '#ef4444'
                        }}
                      />
                      {notesPanelOpen ? 'Hide notes + attachments' : 'Add notes (optional)'}
                    </>
                  ) : (
                    <>
                      {notesPanelOpen ? 'Hide notes + attachments' : 'Add notes (optional)'}
                    </>
                  )}
                </button>

                {/* Collapsible Notes Panel */}
                <div
                  style={{
                    overflow: 'hidden',
                    maxHeight: notesPanelOpen ? '1200px' : '0px',
                    transition: 'max-height 240ms ease',
                    marginBottom: notesPanelOpen ? '16px' : '0px'
                  }}
                  aria-hidden={!notesPanelOpen}
                >
                  <div
                    className="card"
                    style={{
                      zIndex: 1,
                      padding: '16px',
                      opacity: notesPanelOpen ? 1 : 0,
                      transform: notesPanelOpen ? 'scaleX(1)' : 'scaleX(0.9)',
                      transformOrigin: 'left',
                      transition: 'opacity 200ms ease, transform 220ms ease',
                      pointerEvents: notesPanelOpen ? 'auto' : 'none'
                    }}
                  >
                    <label className="label" style={{ fontSize: '14px', marginBottom: '8px', display: 'block' }}>
                      Notes (optional)
                    </label>
                    <div
                      onDragOver={(e) => { e.preventDefault(); setNoteDragActive(true); }}
                      onDragLeave={() => setNoteDragActive(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setNoteDragActive(false);
                        const file = e.dataTransfer.files?.[0];
                        handleNoteFileSelect(file);
                      }}
                      style={{
                        position: 'relative',
                        border: noteDragActive ? '1px dashed var(--secondary-color)' : '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '4px',
                        background: noteDragActive ? 'rgba(99, 212, 255, 0.04)' : 'transparent'
                      }}
                    >
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add notes... drag & drop a .wav to attach."
                        rows={3}
                        className="input"
                        style={{
                          width: '100%',
                          fontFamily: 'inherit',
                          resize: 'vertical',
                          minHeight: '80px',
                          paddingRight: '90px'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => noteFileInputRef.current?.click()}
                        className="btn btn-secondary"
                        style={{
                          position: 'absolute',
                          right: '10px',
                          bottom: '10px',
                          padding: '6px 10px',
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                        title="Attach .wav file from your computer"
                      >
                        Attach .wav
                      </button>
                      <input
                        ref={noteFileInputRef}
                        type="file"
                        accept=".wav,audio/wav"
                        style={{ display: 'none' }}
                        onChange={handleNoteFileInput}
                      />
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {noteAudioFile
                        ? `Pending upload: ${noteAudioFile.name}`
                        : noteAudioPath
                        ? 'Audio note attached'
                        : 'Add a local .wav (drag/drop or paperclip).'}
                    </div>
                    {(noteAudioFile || noteAudioPath) && (
                      <div style={{ marginTop: '12px', padding: '10px', border: '1px dashed var(--border-color)', borderRadius: '8px', background: 'var(--secondary-bg)' }}>
                        <div style={{ fontWeight: 600, marginBottom: '6px' }}>Attached</div>
                        {noteAudioFile && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                            <span>Pending: {noteAudioFile.name}</span>
                            <button
                              onClick={() => {
                                setNoteAudioFile(null);
                                setNoteAudioPath('');
                                if (noteFileInputRef.current) noteFileInputRef.current.value = '';
                              }}
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                            >
                              Remove
                            </button>
                          </div>
                        )}
                        {!noteAudioFile && noteAudioPath && <div>Upload attached</div>}
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Buttons */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={submitScoreAndNext}
                    disabled={loading || submitting}
                    className="btn btn-primary"
                    style={{ flex: 2, justifyContent: 'center', zIndex: 1 }}
                  >
                    {freeTextMode ? 'Submit Score' : 'Submit Score & Next Prompt'}
                  </button>
                  <button
                    onClick={submitLLMFailure}
                    disabled={loading || submitting || !llmResponse}
                    className="btn"
                    style={{
                      flex: 1,
                      justifyContent: 'center',
                      zIndex: 1,
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)',
                      backgroundSize: '300% 300%',
                      borderColor: '#ef4444',
                      color: 'white',
                      fontWeight: '600',
                      boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                      transition: 'all 150ms ease',
                      animation: 'shimmer 3s ease-in-out infinite'
                    }}
                    onMouseEnter={(e) => {
                      if (!loading && !submitting && llmResponse) {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.4)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loading && !submitting) {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
                      }
                    }}
                    onMouseDown={(e) => {
                      if (!loading && !submitting && llmResponse) {
                        e.currentTarget.style.transform = 'translateY(0)';
                      }
                    }}
                    onMouseUp={(e) => {
                      if (!loading && !submitting && llmResponse) {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }
                    }}
                  >
                    LLM Failure
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px'
          }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: '500px',
              width: '100%',
              zIndex: 2001
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>
              Delete Prompt?
            </h3>
            <p style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
              Are you sure you want to delete this prompt? This action cannot be undone and will affect all results associated with this prompt.
            </p>
            {currentPrompt && (
              <div style={{
                padding: '12px',
                background: 'var(--secondary-bg)',
                borderRadius: '6px',
                marginBottom: '20px',
                fontSize: '14px'
              }}>
                <strong>Prompt:</strong> {currentPrompt.text.substring(0, 100)}{currentPrompt.text.length > 100 ? '...' : ''}
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePrompt}
                className="btn btn-secondary"
                disabled={loading}
                style={{
                  background: 'var(--error-color)',
                  borderColor: 'var(--error-color)',
                  color: '#fff'
                }}
              >
                {loading ? 'Deleting...' : 'Delete Prompt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Message */}
      {status && (
        <div
          className="card status-message-fade"
          style={{
            background: status.startsWith('Score saved') || status.startsWith('Prompt updated') || status.startsWith('Prompt deleted') || status.startsWith('LLM failure recorded') ? 'rgba(52, 211, 153, 0.1)' :
                       status.startsWith('Error') ? 'rgba(248, 113, 113, 0.15)' :
                       'var(--secondary-bg)',
            border: status.startsWith('Score saved') || status.startsWith('Prompt updated') || status.startsWith('Prompt deleted') || status.startsWith('LLM failure recorded') ? '1px solid var(--success-color)' :
                    status.startsWith('Error') ? '1px solid var(--error-color)' :
                    '1px solid var(--border-color)',
            zIndex: 1
          }}
        >
          <p style={{
            color: status.startsWith('Score saved') || status.startsWith('Prompt updated') || status.startsWith('Prompt deleted') || status.startsWith('LLM failure recorded') ? 'var(--success-color)' :
                   status.startsWith('Error') ? 'var(--error-color)' :
                   'var(--text-secondary)',
            zIndex: 1
          }}>
            {status}
          </p>
        </div>
      )}
    </div>
  );
}
