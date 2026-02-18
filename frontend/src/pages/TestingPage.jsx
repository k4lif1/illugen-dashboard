import React, { useState, useEffect, useRef } from 'react';
import api, { API_BASE_URL } from '../services/api';
import AudioPlayer from '../components/AudioPlayer';
import ScoringSliders from '../components/ScoringSliders';
import DifficultySlider from '../components/DifficultySlider';
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
  const [bpm, setBpm] = useState(() => getInitialState('bpm', 90));
  const [bars, setBars] = useState(() => getInitialState('bars', 8));
  const [musicalKey, setMusicalKey] = useState(() => getInitialState('musicalKey', ''));
  const [outputFormat, setOutputFormat] = useState(() => getInitialState('outputFormat', 'pcm_44100'));

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
  const [showDifficultyTooltip, setShowDifficultyTooltip] = useState(false);

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
    sessionStorage.setItem('testingPage_generationMeta', JSON.stringify(generationMeta));
  }, [generationMeta]);

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

  // Reset edit mode when loading a new prompt
  useEffect(() => {
    if (currentPrompt) {
      setEditMode(false);
    }
  }, [currentPrompt?.id]);

  // Load initial prompt only if no state exists (first load or after refresh)
  useEffect(() => {
    if (!freeTextMode && !currentPrompt && !hasLoadedInitialPrompt.current) {
      loadNextPrompt(true);
      hasLoadedInitialPrompt.current = true;
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

  const loadNextPrompt = async (isInitialLoad = false) => {
    setStatus('Loading next prompt...');
    setLoading(true);
    try {
      const params = {};

      if (isInitialLoad === true) {
        params.start_from_beginning = true;
      } else if (currentPrompt) {
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
      resetNotesAndAttachments();
      setNotesPanelOpen(false);
      setStatus('');
    } catch (err) {
      setStatus(`Error loading prompt: ${err?.response?.data?.detail || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadRandomPrompt = async () => {
    setStatus('Loading random prompt...');
    setLoading(true);
    try {
      const params = {};
      if (currentPrompt) {
        params.exclude_id = currentPrompt.id;
      }

      const { data } = await api.get('/api/prompts/random', { params });
      setCurrentPrompt(data);
      setLlmJson(null);
      setLlmResponse(null);
      setAudioUrl('');
      setScores({ audio_quality_score: null, llm_accuracy_score: null });
      setGenerationMeta(null);
      resetNotesAndAttachments();
      setNotesPanelOpen(false);
      setStatus('');
    } catch (err) {
      setStatus(`Error loading random prompt: ${err?.response?.data?.detail || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const sendPrompt = async () => {
    // Validate free text mode requirements
    if (freeTextMode) {
      if (!freeText.trim()) {
        setFreeTextError(true);
        setTimeout(() => setFreeTextError(false), 2400);
        return;
      }

      const hasDifficulty = freeTextMetadata.difficulty !== null && freeTextMetadata.difficulty !== undefined;
      if (!hasDifficulty) {
        setDifficultyError(true);
        setTimeout(() => setDifficultyError(false), 2400);
        return;
      }
    }

    setStatus('Generating loop via ElevenLabs...');
    setLoading(true);
    try {
      const payload = freeTextMode
        ? { text: freeText }
        : { prompt_id: currentPrompt.id };

      payload.bpm = bpm;
      payload.bars = bars;
      payload.output_format = outputFormat;
      if (musicalKey) {
        payload.key = musicalKey;
      }

      const { data } = await api.post('/api/test/send-prompt', payload);
      setLlmJson(data.composition_plan);
      setLlmResponse(data.llm_response || null);
      setAudioUrl(data.audio_url ? `${API_BASE_URL}${data.audio_url}` : '');
      setAudioId(data.audio_id || '');
      setAudioFilePath(data.audio_url || '');
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

      setStatus(`Generated in ${(data.api_time_ms / 1000).toFixed(1)}s | ${data.duration_ms}ms @ ${data.bpm} BPM`);

      setDifficultyError(false);
      setFreeTextError(false);
    } catch (err) {
      if (err?.response?.status === 502) {
        const detail = err?.response?.data?.detail || 'The generation service is temporarily unavailable.';
        setStatus(`Error: ${detail}`);
      } else {
        setStatus(`Error: ${err?.response?.data?.detail || err.message || 'An unexpected error occurred'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const submitScoreAndNext = async () => {
    if (!currentPrompt && !freeTextMode) {
      setStatus('Cannot submit score without prompt.');
      return;
    }

    if (freeTextMode && (freeTextMetadata.difficulty === null || freeTextMetadata.difficulty === undefined)) {
      setStatus('Please set the difficulty before submitting.');
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

      // Build payload
      const payload = {
        llm_accuracy_score: scores.llm_accuracy_score,
        audio_quality_score: scores.audio_quality_score,
        generated_json: llmJson,
        llm_response: llmResponse,
        audio_id: currentAudioId,
        audio_file_path: currentAudioId ? `audio_files/${currentAudioId}.wav` : null,
        notes: notes.trim() || null,
        notes_audio_path: notesAudioPathValue,
        illugen_attachments: attachmentsPayload.length ? { items: attachmentsPayload } : null,
      };

      if (freeTextMode) {
        payload.free_text_prompt = freeText;
        payload.free_text_difficulty = freeTextMetadata.difficulty;
        payload.free_text_category = 'user-generated';
      } else {
        payload.prompt_id = currentPrompt.id;
      }

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
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', zIndex: 1 }}>
            <button
              onClick={resetTestingForm}
              className="btn btn-secondary"
              style={{ zIndex: 1, background: 'var(--secondary-bg)', border: '1px solid var(--border-color)' }}
              title="Reset form fields and attachments"
            >
              Reset
            </button>
            <button onClick={toggleMode} className="btn btn-secondary" style={{ zIndex: 1 }}>
              {freeTextMode ? '← Database Mode' : 'Free Text Mode'}
            </button>
          </div>
        </div>

        {/* Generation Parameters */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label className="label" style={{ margin: 0, fontSize: '14px', whiteSpace: 'nowrap' }}>BPM:</label>
            <input
              type="number"
              value={bpm}
              onChange={(e) => setBpm(Math.max(40, Math.min(300, parseInt(e.target.value) || 90)))}
              min={40}
              max={300}
              className="input"
              style={{ width: '80px', textAlign: 'center' }}
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
              <option value={4}>4</option>
              <option value={8}>8</option>
              <option value={16}>16</option>
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

      {/* Prompt Display */}
      <div className="card" style={{ zIndex: 1 }}>
        {freeTextMode ? (
          <div style={{ zIndex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px', alignItems: 'start' }}>
              {/* Left: Prompt Input */}
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
                    paddingTop: '16px'
                  }}>
                    {loading && freeText ? (
                      <span>
                        {freeText.split('').map((char, index) => (
                          <span
                            key={index}
                            style={{
                              display: 'inline-block',
                              animation: `floatUp 3s ease-in-out infinite`,
                              animationDelay: `${index * 0.05}s`,
                              whiteSpace: char === ' ' ? 'pre' : 'normal'
                            }}
                          >
                            {char}
                          </span>
                        ))}
                      </span>
                    ) : wasGenerating && freeText ? (
                      <span>
                        {freeText.split('').map((char, index) => (
                          <span
                            key={index}
                            style={{
                              display: 'inline-block',
                              animationName: 'dropDown',
                              animationDuration: '0.6s',
                              animationTimingFunction: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
                              animationDelay: `${index * 0.02}s`,
                              animationFillMode: 'backwards',
                              whiteSpace: char === ' ' ? 'pre' : 'normal'
                            }}
                          >
                            {char}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <textarea
                    value={freeText}
                    onChange={(e) => {
                      setFreeText(e.target.value);
                      setFreeTextError(false);
                    }}
                    placeholder="Describe the loop you want... (e.g., 'solo 808 bass, dark trap', 'jazzy Rhodes chords', 'punchy boom bap drums')"
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

              {/* Right: Difficulty */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'stretch', paddingTop: '28px' }}>
                <div style={{ zIndex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '85px', justifyContent: 'flex-end' }}>
                      <label className="label" style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', textAlign: 'right' }}>
                        Difficulty:
                      </label>
                      <div
                        style={{
                          position: 'relative',
                          cursor: 'pointer',
                          zIndex: 1100
                        }}
                        onMouseEnter={() => setShowDifficultyTooltip(true)}
                        onMouseLeave={() => setShowDifficultyTooltip(false)}
                      >
                        <span style={{
                          fontSize: '12px',
                          color: 'var(--primary-color)',
                          border: '1px solid var(--primary-color)',
                          borderRadius: '50%',
                          width: '16px',
                          height: '16px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'var(--primary-bg)',
                          fontWeight: '600'
                        }}>i</span>
                        {showDifficultyTooltip && (
                          <div style={{
                            position: 'absolute',
                            top: '0',
                            right: '120%',
                            background: 'var(--secondary-bg)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '12px',
                            width: '240px',
                            boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
                            fontSize: '12px',
                            lineHeight: '1.5',
                            zIndex: 3000,
                            whiteSpace: 'normal'
                          }}>
                            <div style={{ fontWeight: '600', marginBottom: '6px', color: 'var(--primary-color)' }}>
                              Difficulty Rating
                            </div>
                            <div style={{ color: 'var(--text-secondary)' }}>
                              Set how difficult you believe this prompt is for the model to generate. This helps weight the scoring appropriately.
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <DifficultySlider
                        value={freeTextMetadata.difficulty}
                        onChange={(value) => {
                          setFreeTextMetadata({ ...freeTextMetadata, difficulty: value });
                          setDifficultyError(false);
                        }}
                        showError={difficultyError}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          currentPrompt && (
            <div style={{ zIndex: 1 }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <label className="label">Current Prompt:</label>
                  <span className="text-secondary" style={{ fontSize: '13px', marginLeft: '12px' }}>
                    Difficulty: {currentPrompt.difficulty}/10 | Category: {currentPrompt.category || 'N/A'} | Type: {currentPrompt.drum_type || 'N/A'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleEditPrompt}
                    className="btn btn-secondary"
                    disabled={loading || editMode}
                    style={{ zIndex: 1, fontSize: '13px', padding: '6px 12px' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="btn btn-secondary"
                    disabled={loading || editMode}
                    style={{ zIndex: 1, fontSize: '13px', padding: '6px 12px', background: 'var(--error-color)', borderColor: 'var(--error-color)' }}
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => loadNextPrompt()}
                    className="btn btn-secondary"
                    disabled={loading || editMode}
                    style={{ zIndex: 1 }}
                  >
                    Next Prompt
                  </button>
                </div>
              </div>

              {editMode ? (
                <div style={{
                  padding: '16px',
                  background: 'var(--secondary-bg)',
                  borderRadius: '8px',
                  border: '2px solid var(--primary-color)',
                  zIndex: 1
                }}>
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
                    <button
                      onClick={handleCancelEdit}
                      className="btn btn-secondary"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="btn btn-primary"
                      disabled={loading}
                    >
                      {loading ? 'Saving...' : 'Save Changes'}
                    </button>
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
                  position: 'relative'
                }}>
                  {/* Random button in top right corner */}
                  <button
                    onClick={(e) => {
                      if (!loading && !editMode) {
                        e.currentTarget.style.transform = 'scale(0.95) rotate(-15deg)';
                        setTimeout(() => {
                          e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
                        }, 150);
                        loadRandomPrompt();
                      }
                    }}
                    disabled={loading || editMode}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      zIndex: 2,
                      fontSize: '20px',
                      padding: '6px 8px',
                      background: 'transparent',
                      border: 'none',
                      cursor: loading || editMode ? 'not-allowed' : 'pointer',
                      opacity: loading || editMode ? 0.4 : 1,
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '36px',
                      minHeight: '36px'
                    }}
                    onMouseEnter={(e) => {
                      if (!loading && !editMode) {
                        e.currentTarget.style.transform = 'scale(1.1) rotate(15deg)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
                    }}
                    title="Load a random prompt from the database"
                  >
                    🎲
                  </button>
                  {loading && currentPrompt?.text ? (
                    <span>
                      {currentPrompt.text.split('').map((char, index) => (
                        <span
                          key={index}
                          style={{
                            display: 'inline-block',
                            animation: `floatUp 3s ease-in-out infinite`,
                            animationDelay: `${index * 0.05}s`,
                            whiteSpace: char === ' ' ? 'pre' : 'normal'
                          }}
                        >
                          {char}
                        </span>
                      ))}
                    </span>
                  ) : wasGenerating && currentPrompt?.text ? (
                    <span>
                      {currentPrompt.text.split('').map((char, index) => (
                        <span
                          key={index}
                          style={{
                            display: 'inline-block',
                            animationName: 'dropDown',
                            animationDuration: '0.6s',
                            animationTimingFunction: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
                            animationDelay: `${index * 0.02}s`,
                            animationFillMode: 'backwards',
                            whiteSpace: char === ' ' ? 'pre' : 'normal'
                          }}
                        >
                          {char}
                        </span>
                      ))}
                    </span>
                  ) : (
                    currentPrompt?.text || ''
                  )}
                </div>
              )}
            </div>
          )
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
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
              if (!loading && (freeTextMode || currentPrompt)) {
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
            onMouseUp={(e) => {
              if (!loading && (freeTextMode || currentPrompt)) {
                e.currentTarget.style.transform = 'translateY(-2px)';
              }
            }}
          >
            {loading ? 'Generating...' : 'Generate Loop'}
          </button>
        </div>
      </div>

      {/* Results Section - Only show after sending */}
      {(llmJson || audioUrl) && (
        <>
          {/* Composition Plan Output */}
          <div className="card" style={{ zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 className="label" style={{ fontSize: '18px', margin: 0, zIndex: 1 }}>
                Composition Plan
              </h3>
              {generationMeta && (
                <span className="text-secondary" style={{ fontSize: '13px' }}>
                  {generationMeta.bpm} BPM | {generationMeta.bars} bars | {generationMeta.key || 'No key'} | {(generationMeta.duration_ms / 1000).toFixed(1)}s | API: {(generationMeta.api_time_ms / 1000).toFixed(1)}s
                </span>
              )}
            </div>
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
                      animation: `orbit 2s linear infinite`,
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
                {/* Audio Player */}
                <div className="card" style={{ zIndex: 1, padding: '16px' }}>
                  <h3 className="label" style={{ fontSize: '16px', marginBottom: '10px', zIndex: 1 }}>
                    Generated Audio
                  </h3>
                  <AudioPlayer src={audioUrl} />
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
