import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import api, { API_BASE_URL } from '../services/api';
import AudioPlayer from '../components/AudioPlayer';
import LoadingOverlay from '../components/LoadingOverlay';

export default function ResultsPage() {
  const location = useLocation();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedResult, setSelectedResult] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editedScores, setEditedScores] = useState({ audio_quality_score: 5, llm_accuracy_score: 5, notes: '' });
  const [noteAttachmentFile, setNoteAttachmentFile] = useState(null);
  const [noteAttachmentPath, setNoteAttachmentPath] = useState('');
  const [noteDragActive, setNoteDragActive] = useState(false);
  const noteFileInputRef = useRef(null);
  
  // Filters (initialize from navigation state if provided)
  const [drumTypeFilter, setDrumTypeFilter] = useState(location.state?.drumType || 'all');
  const [drumTypeKeyFilter, setDrumTypeKeyFilter] = useState(location.state?.drumTypeKey || null);
  const [difficultyFilter, setDifficultyFilter] = useState(location.state?.difficulty ? String(location.state.difficulty) : 'all');
  const [versionFilter, setVersionFilter] = useState(location.state?.modelVersion || 'all');
  const [audioScoreFilter, setAudioScoreFilter] = useState(location.state?.audioScore ? String(location.state.audioScore) : 'all');
  const [hasNotesFilter, setHasNotesFilter] = useState(false);
  
  // Sorting - Default to most recent first
  const [sortColumn, setSortColumn] = useState('tested_at');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' or 'desc'
  
  // Cache key for preventing unnecessary refetches
  const cacheKeyRef = useRef('');
  
  // Memoize prompts map from results (no longer need separate API calls)
  const prompts = useMemo(() => {
    const map = {};
    results.forEach(r => {
      if (r.prompt) {
        map[r.prompt_id] = r.prompt;
      }
    });
    return map;
  }, [results]);
  
  // Memoize available drum types from results
  const availableDrumTypes = useMemo(() => {
    const types = new Set();
    results.forEach(r => {
      if (r.prompt?.drum_type) {
        types.add(r.prompt.drum_type);
      }
    });
    return Array.from(types).sort();
  }, [results]);
  
  // Update filters when navigating to results page with state (e.g., clicking from dashboard)
  // Use location.key to detect navigation changes even when pathname stays the same
  useEffect(() => {
    const state = location.state;
    if (state) {
      // Update filters from navigation state - always update when state is present
      setDrumTypeFilter(state.drumType || 'all');
      setDrumTypeKeyFilter(state.drumTypeKey || null);
      setDifficultyFilter(state.difficulty !== undefined && state.difficulty !== null ? String(state.difficulty) : 'all');
      setVersionFilter(state.modelVersion || 'all');
      setAudioScoreFilter(state.audioScore !== undefined && state.audioScore !== null ? String(state.audioScore) : 'all');
    }
  }, [location.key, location.state]);
  
  // Load results when filters change
  useEffect(() => {
    loadResults();
  }, [drumTypeFilter, drumTypeKeyFilter, difficultyFilter, versionFilter, audioScoreFilter, hasNotesFilter]);

  const handleNoteFileSelect = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.wav')) {
      alert('Only .wav files are supported for note attachments.');
      return;
    }
    setNoteAttachmentFile(file);
    setNoteAttachmentPath('');
  };

  const handleNoteFileInput = (e) => {
    const file = e.target.files?.[0];
    handleNoteFileSelect(file);
  };

  const uploadNoteAttachment = async () => {
    if (!noteAttachmentFile) return null;
    const formData = new FormData();
    formData.append('file', noteAttachmentFile);
    const { data } = await api.post('/api/results/upload-note-audio', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data?.path || null;
  };

  const clearNoteAttachment = () => {
    setNoteAttachmentFile(null);
    setNoteAttachmentPath('');
    if (noteFileInputRef.current) {
      noteFileInputRef.current.value = '';
    }
  };

  // Calculate color for scores (1=red, 10=green) - same as DashboardPage
  const getScoreColor = (score) => {
    const colors = [
      '#ef4444', // 1 - red
      '#f97316', // 2 - orange-red
      '#fb923c', // 3 - orange
      '#fbbf24', // 4 - yellow-orange
      '#facc15', // 5 - yellow
      '#bef264', // 6 - yellow-green
      '#86efac', // 7 - light green
      '#4ade80', // 8 - green
      '#22c55e', // 9 - bright green
      '#16a34a', // 10 - dark green
    ];
    return colors[score - 1] || colors[4]; // default to yellow
  };

  const loadResults = async () => {
    setLoading(true);
    try {
      const params = {};
      if (drumTypeKeyFilter) {
        params.drum_type_key = drumTypeKeyFilter;
      } else if (drumTypeFilter !== 'all') {
        params.drum_type = drumTypeFilter;
      }
      if (difficultyFilter !== 'all') params.difficulty = parseInt(difficultyFilter);
      if (versionFilter !== 'all') params.model_version = versionFilter;
      if (audioScoreFilter !== 'all') params.audio_quality_score = parseInt(audioScoreFilter);
      if (hasNotesFilter) params.has_notes = true;
      
      // Create cache key from filters
      const newCacheKey = JSON.stringify(params);
      
      // Only fetch if cache key changed (filters changed)
      if (newCacheKey === cacheKeyRef.current && results.length > 0) {
        setLoading(false);
        return;
      }
      
      const { data } = await api.get('/api/results/', { params });
      setResults(data);
      cacheKeyRef.current = newCacheKey;
    } catch (err) {
      console.error('Failed to load results:', err);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (result) => {
    setSelectedResult(result);
    setEditMode(false);
    setEditedScores({
      audio_quality_score: result.audio_quality_score,
      llm_accuracy_score: result.llm_accuracy_score,
      notes: result.notes || ''
    });
    setNoteAttachmentPath(result.notes_audio_path || '');
    setNoteAttachmentFile(null);
  };

  const closeDetail = () => {
    setSelectedResult(null);
    setEditMode(false);
    clearNoteAttachment();
  };
  
  const handleSetAsLLMFailure = async () => {
    if (!selectedResult) return;
    
    const confirmed = window.confirm(
      'Are you sure you want to set this result as an LLM failure?\n\n' +
      'This will:\n' +
      '• Create an LLM failure record\n' +
      '• Remove this result from all score averages\n' +
      '• Preserve the audio file and notes for reference\n\n' +
      'This action cannot be undone.'
    );
    
    if (!confirmed) return;
    
    try {
      await api.post(`/api/results/${selectedResult.id}/set-as-llm-failure`);
      
      // Remove from local state
      setResults(prev => prev.filter(r => r.id !== selectedResult.id));
      
      // Close modal
      closeDetail();
      
      // DON'T reload - we already updated local state!
    } catch (err) {
      console.error('Failed to set as LLM failure:', err);
      alert(`Error: ${err?.response?.data?.detail || err.message || 'An unexpected error occurred'}`);
    }
  };

  const saveEdit = async () => {
    try {
      let notesAudioPathValue = noteAttachmentPath;
      if (noteAttachmentFile) {
        const uploadedPath = await uploadNoteAttachment();
        notesAudioPathValue = uploadedPath;
      }

      const { data: updatedResult } = await api.put(`/api/results/${selectedResult.id}`, {
        ...editedScores,
        notes_audio_path: notesAudioPathValue ?? null,
      });
      
      // Update the result in local state instead of reloading everything
      setResults(prev => prev.map(r => 
        r.id === selectedResult.id ? { ...r, ...updatedResult } : r
      ));
      
      closeDetail();
      // DON'T reload - we already updated local state!
    } catch (err) {
      console.error('Failed to update result:', err);
      alert('Failed to save changes');
    }
  };

  const deleteResult = async (id) => {
    if (!confirm('Are you sure you want to delete this result?')) return;
    
    try {
      await api.delete(`/api/results/${id}`);
      
      // Remove from local state instead of reloading
      setResults(prev => prev.filter(r => r.id !== id));
      closeDetail();
      // DON'T reload - we already updated local state!
    } catch (err) {
      console.error('Failed to delete result:', err);
      alert('Failed to delete result');
    }
  };

  const parseTestedAt = (dateStr) => {
    if (!dateStr) return null;
    const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(dateStr);
    const normalized = hasTimezone ? dateStr : `${dateStr}Z`;
    return new Date(normalized);
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending (min/A first)
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortedResults = () => {
    const sorted = [...results].sort((a, b) => {
      let aVal, bVal;

      switch (sortColumn) {
        case 'id':
          aVal = a.id;
          bVal = b.id;
          break;
        case 'prompt':
          aVal = prompts[a.prompt_id]?.text || '';
          bVal = prompts[b.prompt_id]?.text || '';
          break;
        case 'drum_type':
          aVal = prompts[a.prompt_id]?.drum_type || '';
          bVal = prompts[b.prompt_id]?.drum_type || '';
          break;
        case 'difficulty':
          aVal = prompts[a.prompt_id]?.difficulty || 0;
          bVal = prompts[b.prompt_id]?.difficulty || 0;
          break;
        case 'version':
          aVal = a.model_version || '';
          bVal = b.model_version || '';
          break;
        case 'audio_score':
          aVal = a.audio_quality_score;
          bVal = b.audio_quality_score;
          break;
        case 'llm_score':
          aVal = a.llm_accuracy_score;
          bVal = b.llm_accuracy_score;
          break;
        case 'tested_at':
          aVal = parseTestedAt(a.tested_at)?.getTime() || 0;
          bVal = parseTestedAt(b.tested_at)?.getTime() || 0;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      } else {
        return sortDirection === 'asc' 
          ? aVal - bVal
          : bVal - aVal;
      }
    });

    return sorted;
  };

  const formatDate = (dateStr) => {
    const parsed = parseTestedAt(dateStr);
    return parsed
      ? parsed.toLocaleString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      : '-';
  };

  // Check if any filters are active (not default)
  const hasActiveFilters = () => {
    return drumTypeFilter !== 'all' || 
           difficultyFilter !== 'all' || 
           versionFilter !== 'all' || 
           audioScoreFilter !== 'all' || 
           hasNotesFilter;
  };

  // Reset all filters to default
  const resetFilters = () => {
    setDrumTypeFilter('all');
    setDrumTypeKeyFilter(null);
    setDifficultyFilter('all');
    setVersionFilter('all');
    setAudioScoreFilter('all');
    setHasNotesFilter(false);
  };

  return (
    <div className="grid" style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <LoadingOverlay isLoading={loading} />
      <h2 style={{ fontSize: '24px', fontWeight: '700' }}>Test Results</h2>

      {/* Filters */}
      <div className="card" style={{ zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>Filters</h3>
            <button
              onClick={resetFilters}
              disabled={!hasActiveFilters()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                background: hasActiveFilters() ? 'var(--secondary-bg)' : 'transparent',
                border: `1px solid ${hasActiveFilters() ? 'var(--border-color)' : 'transparent'}`,
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                color: hasActiveFilters() ? 'var(--primary-color)' : 'var(--text-secondary)',
                cursor: hasActiveFilters() ? 'pointer' : 'not-allowed',
                opacity: hasActiveFilters() ? 1 : 0.4,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (hasActiveFilters()) {
                  e.target.style.borderColor = 'var(--primary-color)';
                }
              }}
              onMouseLeave={(e) => {
                if (hasActiveFilters()) {
                  e.target.style.borderColor = 'var(--border-color)';
                }
              }}
              title={hasActiveFilters() ? 'Reset all filters' : 'No filters active'}
            >
              <svg 
                width="14" 
                height="14" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                style={{
                  transform: hasActiveFilters() ? 'none' : 'rotate(0deg)',
                  transition: 'transform 0.3s'
                }}
              >
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
              </svg>
              Reset
            </button>
          </div>
          <div style={{ 
            padding: '6px 16px', 
            background: 'var(--secondary-bg)', 
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '600',
            color: 'var(--primary-color)',
            border: '1px solid var(--border-color)'
          }}>
            {results.length} {results.length === 1 ? 'result' : 'results'}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div>
            <label className="label">Drum Type</label>
            <select 
              value={drumTypeFilter} 
              onChange={(e) => {
                setDrumTypeFilter(e.target.value);
                setDrumTypeKeyFilter(null);
              }} 
              className="input"
            >
              <option value="all">All</option>
              {availableDrumTypes.map(dt => (
                <option key={dt} value={dt}>{dt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Difficulty</label>
            <select value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)} className="input">
              <option value="all">All</option>
              {[...Array(10)].map((_, i) => (
                <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Model Version</label>
            <select value={versionFilter} onChange={(e) => setVersionFilter(e.target.value)} className="input">
              <option value="all">All</option>
              <option value="v11">V11</option>
              <option value="v12">V12</option>
              <option value="v13">V13</option>
              <option value="v14">V14</option>
              <option value="v15">V15</option>
              <option value="v16">V16</option>
              <option value="v17">V17</option>
            </select>
          </div>
          <div>
            <label className="label">Generation Score</label>
            <select value={audioScoreFilter} onChange={(e) => setAudioScoreFilter(e.target.value)} className="input">
              <option value="all">All</option>
              {[...Array(10)].map((_, i) => (
                <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <label className="label" style={{ textAlign: 'center', width: '100%' }}>Notes/Attachments</label>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '44px', // align vertically with adjacent selects
                marginTop: '6px',
                width: '100%',
              }}
            >
              <label 
                htmlFor="hasNotesFilter"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  cursor: 'pointer',
                  position: 'relative'
                }}
              >
                <input
                  type="checkbox"
                  id="hasNotesFilter"
                  checked={hasNotesFilter}
                  onChange={(e) => setHasNotesFilter(e.target.checked)}
                  style={{ 
                    width: '20px', 
                    height: '20px', 
                    cursor: 'pointer',
                    backgroundColor: hasNotesFilter ? 'var(--primary-color)' : 'var(--secondary-bg)',
                    border: `2px solid ${hasNotesFilter ? 'var(--primary-color)' : 'var(--border-color)'}`,
                    borderRadius: '4px',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    transition: 'all 0.2s ease',
                    outline: 'none',
                    margin: 0,
                    padding: 0
                  }}
                  onFocus={(e) => {
                    e.target.style.boxShadow = '0 0 0 3px var(--focus-outline)';
                  }}
                  onBlur={(e) => {
                    e.target.style.boxShadow = 'none';
                  }}
                  onMouseEnter={(e) => {
                    if (!hasNotesFilter) {
                      e.target.style.borderColor = 'var(--primary-color)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!hasNotesFilter) {
                      e.target.style.borderColor = 'var(--border-color)';
                    }
                  }}
                />
                {hasNotesFilter && (
                  <svg
                    style={{
                      position: 'absolute',
                      left: '4px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '12px',
                      height: '12px',
                      pointerEvents: 'none',
                      color: '#0d1016'
                    }}
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M16.7071 5.29289C17.0976 5.68342 17.0976 6.31658 16.7071 6.70711L8.70711 14.7071C8.31658 15.0976 7.68342 15.0976 7.29289 14.7071L3.29289 10.7071C2.90237 10.3166 2.90237 9.68342 3.29289 9.29289C3.68342 8.90237 4.31658 8.90237 4.70711 9.29289L8 12.5858L15.2929 5.29289C15.6834 4.90237 16.3166 4.90237 16.7071 5.29289Z"
                      fill="currentColor"
                    />
                  </svg>
                )}
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
              <th 
                onClick={() => handleSort('id')} 
                style={{ padding: '12px', textAlign: 'left', fontWeight: '600', cursor: 'pointer', userSelect: 'none' }}
              >
                ID {sortColumn === 'id' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                onClick={() => handleSort('prompt')} 
                style={{ padding: '12px', textAlign: 'left', fontWeight: '600', cursor: 'pointer', userSelect: 'none' }}
              >
                Prompt {sortColumn === 'prompt' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                onClick={() => handleSort('drum_type')} 
                style={{ padding: '12px', textAlign: 'left', fontWeight: '600', cursor: 'pointer', userSelect: 'none' }}
              >
                Drum {sortColumn === 'drum_type' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                onClick={() => handleSort('difficulty')} 
                style={{ padding: '12px', textAlign: 'center', fontWeight: '600', cursor: 'pointer', userSelect: 'none' }}
              >
                Diff {sortColumn === 'difficulty' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                onClick={() => handleSort('version')} 
                style={{ padding: '12px', textAlign: 'center', fontWeight: '600', cursor: 'pointer', userSelect: 'none' }}
              >
                Version {sortColumn === 'version' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                onClick={() => handleSort('audio_score')} 
                style={{ padding: '12px', textAlign: 'center', fontWeight: '600', cursor: 'pointer', userSelect: 'none' }}
              >
                Gen Score {sortColumn === 'audio_score' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                onClick={() => handleSort('llm_score')} 
                style={{ padding: '12px', textAlign: 'center', fontWeight: '600', cursor: 'pointer', userSelect: 'none' }}
              >
                LLM Score {sortColumn === 'llm_score' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                onClick={() => handleSort('tested_at')} 
                style={{ padding: '12px', textAlign: 'left', fontWeight: '600', cursor: 'pointer', userSelect: 'none' }}
              >
                Date {sortColumn === 'tested_at' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No results found. Start testing to see results here!
                </td>
              </tr>
            ) : (
              getSortedResults().map((result) => {
                const prompt = prompts[result.prompt_id];
                const hasNotes = (result.notes && result.notes.trim()) || result.notes_audio_path;
                const hasIllugen = result.illugen_attachments && result.illugen_attachments.items && result.illugen_attachments.items.length > 0;
                return (
                  <tr 
                    key={result.id}
                    onClick={() => openDetail(result)}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--secondary-bg)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px', position: 'relative' }}>
                      #{result.id}
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: '8px', verticalAlign: 'middle' }}>
                        {hasNotes && (
                          <span 
                            style={{
                              display: 'inline-block',
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: '#ef4444',
                            }}
                            title="This result has notes"
                          />
                        )}
                        {hasIllugen && (
                          <span 
                            style={{
                              display: 'inline-block',
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #8247ff 0%, #54d0ff 30%, #ff6b9d 60%, #ffd93d 100%)',
                              backgroundSize: '300% 300%',
                              animation: 'shimmer 3s ease-in-out infinite',
                              boxShadow: '0 2px 8px rgba(130,71,255,0.4)',
                            }}
                            title="This result has Illugen attachments"
                          />
                        )}
                      </span>
                    </td>
                    <td style={{ padding: '12px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {prompt?.text || 'Loading...'}
                    </td>
                    <td style={{ padding: '12px' }}>{prompt?.drum_type || '-'}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>{prompt?.difficulty || '-'}</td>
                    <td style={{ padding: '12px', textAlign: 'center', textTransform: 'uppercase' }}>{result.model_version || '-'}</td>
                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: getScoreColor(result.audio_quality_score) }}>
                      {result.audio_quality_score}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: getScoreColor(result.llm_accuracy_score) }}>
                      {result.llm_accuracy_score}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {formatDate(result.tested_at)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selectedResult && (
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
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={closeDetail}
        >
          <div 
            className="card"
            style={{ 
              maxWidth: '800px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button - fixed to modal card, outside scrollable area */}
            <button
              onClick={closeDetail}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'transparent',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                padding: '4px 8px',
                zIndex: 10,
                transition: 'color 0.2s ease'
              }}
              onMouseEnter={(e) => e.target.style.color = 'var(--text-primary)'}
              onMouseLeave={(e) => e.target.style.color = 'var(--text-secondary)'}
            >
              ×
            </button>

            {/* Scrollable content area */}
            <div 
              style={{ 
                overflowY: 'auto', 
                flex: 1, 
                paddingRight: '8px'
              }}
              className="custom-scrollbar"
            >
              <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Result #{selectedResult.id}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {((selectedResult.notes && selectedResult.notes.trim()) || selectedResult.notes_audio_path) && (
                    <span 
                      style={{
                        display: 'inline-block',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: '#ef4444',
                        verticalAlign: 'middle'
                      }}
                      title="This result has notes"
                    />
                  )}
                  {(selectedResult.illugen_attachments && selectedResult.illugen_attachments.items && selectedResult.illugen_attachments.items.length) && (
                    <span 
                      style={{
                        display: 'inline-block',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #8247ff 0%, #54d0ff 30%, #ff6b9d 60%, #ffd93d 100%)',
                        backgroundSize: '300% 300%',
                        animation: 'shimmer 3s ease-in-out infinite',
                        boxShadow: '0 2px 8px rgba(130,71,255,0.4)',
                        verticalAlign: 'middle'
                      }}
                      title="This result has Illugen attachments"
                    />
                  )}
                </span>
              </h3>

              {/* Prompt Info */}
              <div style={{ marginBottom: '20px', padding: '16px', background: 'var(--secondary-bg)', borderRadius: '8px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Prompt:</div>
                <div style={{ fontSize: '15px' }}>{prompts[selectedResult.prompt_id]?.text}</div>
                <div style={{ marginTop: '12px', display: 'flex', gap: '20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span>Drum: <strong>{prompts[selectedResult.prompt_id]?.drum_type}</strong></span>
                  <span>Difficulty: <strong>{prompts[selectedResult.prompt_id]?.difficulty}</strong></span>
                  <span>Version: <strong>{selectedResult.model_version?.toUpperCase()}</strong></span>
                </div>
              </div>

              {/* Audio Player */}
              {selectedResult.audio_id && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Audio:</div>
                  <AudioPlayer src={`${API_BASE_URL}/api/audio/${selectedResult.audio_id}`} />
                </div>
              )}

              {/* Notes Section - Prominently displayed */}
              {selectedResult.notes && selectedResult.notes.trim() && !editMode && (
                <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span 
                      style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#ef4444'
                      }}
                    />
                    Notes:
                  </div>
                  <div style={{ fontSize: '15px', lineHeight: '1.6', color: 'var(--text-primary)' }}>{selectedResult.notes}</div>
                  {selectedResult.notes_audio_path && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Attached audio:</div>
                      <AudioPlayer src={`${API_BASE_URL}${selectedResult.notes_audio_path}`} />
                      <a
                        href={`${API_BASE_URL}${selectedResult.notes_audio_path}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: '12px', color: 'var(--secondary-color)' }}
                      >
                        Download .wav
                      </a>
                    </div>
                  )}
                </div>
              )}
              {!editMode && !selectedResult.notes && selectedResult.notes_audio_path && (
                <div style={{ marginBottom: '20px', padding: '16px', background: 'var(--secondary-bg)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Attached audio note:</div>
                  <AudioPlayer src={`${API_BASE_URL}${selectedResult.notes_audio_path}`} />
                  <a
                    href={`${API_BASE_URL}${selectedResult.notes_audio_path}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '12px', color: 'var(--secondary-color)' }}
                  >
                    Download .wav
                  </a>
                </div>
              )}

              {!editMode && selectedResult.illugen_attachments?.items?.length ? (
                <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(84,208,255,0.07)', borderRadius: '8px', border: '1px solid rgba(84,208,255,0.2)' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img src="/illugen-icon.icns" alt="Illugen" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                    Illugen attachments
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {selectedResult.illugen_attachments.items.map((att) => (
                      <div key={att.id} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--secondary-bg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                            <img src="/illugen-icon.icns" alt="Illugen" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                            {att.label || 'Illugen Sample'}
                          </div>
                          {att.request_id && (
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Req: {att.request_id}</span>
                          )}
                        </div>
                        {(() => {
                          const playable = att.url
                            ? (att.url.startsWith('http') ? att.url : `${API_BASE_URL}${att.url}`)
                            : att.serve_path
                              ? `${API_BASE_URL}${att.serve_path}`
                              : null;
                          return playable ? <AudioPlayer src={playable} /> : null;
                        })()}
                        {(att.serve_path || att.url) && (
                          <a href={att.serve_path ? `${API_BASE_URL}${att.serve_path}` : att.url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--secondary-color)' }}>
                            Download
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Scores */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>Scores:</div>
                {editMode ? (
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <div>
                      <label className="label">Generation Score: {editedScores.audio_quality_score}</label>
                      <input 
                        type="range"
                        min="1"
                        max="10"
                        value={editedScores.audio_quality_score}
                        onChange={(e) => setEditedScores({...editedScores, audio_quality_score: parseInt(e.target.value)})}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label className="label">LLM Score: {editedScores.llm_accuracy_score}</label>
                      <input 
                        type="range"
                        min="1"
                        max="10"
                        value={editedScores.llm_accuracy_score}
                        onChange={(e) => setEditedScores({...editedScores, llm_accuracy_score: parseInt(e.target.value)})}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label className="label">Notes & Audio Attachment:</label>
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
                          value={editedScores.notes}
                          onChange={(e) => setEditedScores({...editedScores, notes: e.target.value})}
                          className="input"
                          rows="4"
                          placeholder="Add notes... drag & drop a .wav or tap the .wav icon to attach"
                          style={{ paddingRight: '90px', minHeight: '90px' }}
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
                          🎵 .wav
                        </button>
                        <input
                          ref={noteFileInputRef}
                          type="file"
                          accept=".wav,audio/wav"
                          style={{ display: 'none' }}
                          onChange={handleNoteFileInput}
                        />
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {noteAttachmentFile ? (
                          <span>Attached: {noteAttachmentFile.name}</span>
                        ) : noteAttachmentPath ? (
                          <>
                            <span>Attachment ready</span>
                            <a
                              href={`${API_BASE_URL}${noteAttachmentPath}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'var(--secondary-color)' }}
                            >
                              View/Download
                            </a>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                              onClick={clearNoteAttachment}
                            >
                              Remove
                            </button>
                          </>
                        ) : (
                          <span>You can drag & drop a .wav file or use the .wav button to attach.</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'var(--secondary-bg)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Generation Score</div>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: getScoreColor(selectedResult.audio_quality_score) }}>
                        {selectedResult.audio_quality_score}/10
                      </div>
                    </div>
                    <div style={{ padding: '12px', background: 'var(--secondary-bg)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>LLM Score</div>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: getScoreColor(selectedResult.llm_accuracy_score) }}>
                        {selectedResult.llm_accuracy_score}/10
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* LLM Response Text */}
              {selectedResult.llm_response && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>LLM Response:</div>
                  <div 
                    style={{ 
                      padding: '12px', 
                      background: 'var(--secondary-bg)', 
                      borderRadius: '6px',
                      fontSize: '13px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontFamily: 'monospace',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    {selectedResult.llm_response}
                  </div>
                </div>
              )}
            </div>

            {/* Actions - Fixed at bottom */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '20px', flexShrink: 0 }}>
              {editMode ? (
                <>
                  <button onClick={saveEdit} className="btn btn-primary" style={{ flex: 1 }}>
                    Save Changes
                  </button>
                  <button onClick={() => setEditMode(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setEditMode(true)} className="btn btn-primary" style={{ flex: 1 }}>
                    Edit Scores
                  </button>
                  <button 
                    onClick={handleSetAsLLMFailure} 
                    className="btn"
                    style={{ 
                      backgroundColor: '#dc3545', 
                      borderColor: '#dc3545',
                      color: 'white',
                      flex: 1
                    }}
                  >
                    Set as LLM Failure
                  </button>
                  <button 
                    onClick={() => deleteResult(selectedResult.id)} 
                    className="btn btn-secondary"
                    style={{ backgroundColor: '#ef4444', borderColor: '#ef4444' }}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

