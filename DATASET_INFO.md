# DrumGen Scorer Dataset Information

## Dataset Overview

**Total Prompts**: 2,010 (2,000 from main dataset + 10 from initial testing)

## Distribution

### By Difficulty Level
- Difficulty 1: 202 prompts
- Difficulty 2: 200 prompts
- Difficulty 3: 200 prompts
- Difficulty 4: 200 prompts
- Difficulty 5: 202 prompts
- Difficulty 6: 201 prompts
- Difficulty 7: 200 prompts
- Difficulty 8: 201 prompts
- Difficulty 9: 202 prompts
- Difficulty 10: 202 prompts

### By Category
- Technical: 295 prompts (focus on specs, materials, sizes)
- Emotional: 291 prompts (descriptive adjectives, feel)
- Artistic: 291 prompts (references to songs, artists, eras)
- Genre: 290 prompts (genre-specific sounds)
- Combo: 282 prompts (combination of approaches)
- Sampler: 281 prompts (vintage samplers and machines)
- Processing: 280 prompts (effects and production techniques)

### Drum Types Coverage
Each difficulty level includes prompts for all 15 drum types:
- kick
- snare
- hihat (closed/open)
- ride
- crash
- tom (floor/rack)
- china
- splash
- cowbell
- tambourine
- shaker

## Prompt Characteristics

### Difficulty Progression

**Easy (1-3)**: Simple, direct descriptions
- "dry kick"
- "808 snare"
- "warm crash"
- "vintage hihat"

**Medium (4-6)**: More specific with additional context
- "14 inch maple snare"
- "Questlove style tom"
- "hip-hop kick with some room"
- "compressed crash with a bit of reverb"

**Complex (7-10)**: Detailed, multi-faceted requests
- "John Bonham floor tom from the Led Zeppelin IV sessions"
- "snare with plate reverb, close mics only, overhead perspective"
- "jazz tom, aggressive with transient shaping"
- "saturated hihat with spring reverb"

## Natural Language Approach

All prompts are written in natural language as a user would type them, NOT using template labels. They incorporate real-world references:

- **Artists**: John Bonham, Steve Gadd, Tony Williams, Questlove, J Dilla
- **Songs**: Billie Jean, When the Levee Breaks, Superstition, Rosanna
- **Samplers**: MPC, SP-404, Roland TR-808/909, LinnDrum, E-mu SP-1200
- **Materials**: birch, maple, mahogany, acrylic, steel, bronze
- **Processing**: plate reverb, compression, tape saturation, transient shaping
- **Eras**: 60s, 70s, 80s, 90s, modern, vintage
- **Genres**: rock, jazz, funk, hip-hop, soul, R&B, metal

## Files

- **Source**: `backend/prompts_dataset_2000.json`
- **Generator**: `backend/generate_dataset.py`
- **Loader**: `backend/load_dataset.py`
- **Database**: `drumgen.db` (SQLite)

## Usage

The dataset is already loaded into the database. The UI will randomly select prompts for testing. Users can also filter by:
- Difficulty level
- Category
- Search text (fuzzy search)
- Times used (to ensure even distribution of testing)

## Regeneration

To regenerate the dataset:

```bash
cd backend
python generate_dataset.py
python load_dataset.py
```

Note: This will ADD to the existing database. Clear the database first if you want to replace it completely.

