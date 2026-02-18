import React, { useState, useEffect } from 'react';
import api, { API_BASE_URL } from '../services/api';
import AudioPlayer from '../components/AudioPlayer';

export default function LLMFailuresPage() {
  const [failures, setFailures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFailure, setSelectedFailure] = useState(null);
  
  // Filters
  const [drumTypeFilter, setDrumTypeFilter] = useState('all');
  const [versionFilter, setVersionFilter] = useState('all');
  const [viewedFilter, setViewedFilter] = useState('all');
  const [availableDrumTypes, setAvailableDrumTypes] = useState([]);
  const [availableVersions, setAvailableVersions] = useState([]);
  
  useEffect(() => {
    loadFailures();
    loadFilterOptions();
  }, [drumTypeFilter, versionFilter, viewedFilter]);
  
  const loadFilterOptions = async () => {
    try {
      const { data } = await api.get('/api/llm-failures/');
      const drumTypes = [...new Set(data.map(f => f.drum_type || f.free_text_drum_type).filter(Boolean))].sort();
      const versions = [...new Set(data.map(f => f.model_version).filter(Boolean))].sort();
      setAvailableDrumTypes(drumTypes);
      setAvailableVersions(versions);
    } catch (err) {
      console.error('Failed to load filter options:', err);
    }
  };
  
  const loadFailures = async () => {
    setLoading(true);
    try {
      const params = {};
      if (drumTypeFilter !== 'all') params.drum_type = drumTypeFilter;
      if (versionFilter !== 'all') params.model_version = versionFilter;
      if (viewedFilter !== 'all') params.viewed = viewedFilter === 'viewed';
      
      const { data } = await api.get('/api/llm-failures/', { params });
      setFailures(data);
    } catch (err) {
      console.error('Failed to load LLM failures:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const openDetail = async (failure) => {
    setSelectedFailure(failure);
  };
  
  const closeDetail = () => {
    setSelectedFailure(null);
  };
  
  const toggleViewed = async () => {
    if (!selectedFailure) return;
    
    const newViewedStatus = !selectedFailure.viewed;
    
    try {
      await api.put(`/api/llm-failures/${selectedFailure.id}`, { viewed: newViewedStatus });
      // Update local state
      setFailures(prev => prev.map(f => 
        f.id === selectedFailure.id ? { ...f, viewed: newViewedStatus } : f
      ));
      setSelectedFailure({ ...selectedFailure, viewed: newViewedStatus });
    } catch (err) {
      console.error('Failed to update viewed status:', err);
      alert('Failed to update viewed status');
    }
  };
  
  const handleDelete = async () => {
    if (!selectedFailure) return;
    
    const confirmed = window.confirm('Are you sure you want to delete this LLM failure? This action cannot be undone.');
    if (!confirmed) return;
    
    try {
      await api.delete(`/api/llm-failures/${selectedFailure.id}`);
      // Remove from list
      setFailures(prev => prev.filter(f => f.id !== selectedFailure.id));
      // Close modal
      setSelectedFailure(null);
    } catch (err) {
      console.error('Failed to delete LLM failure:', err);
      alert(`Error deleting failure: ${err?.response?.data?.detail || err.message || 'An unexpected error occurred'}`);
    }
  };
  
  // Check if any filters are active
  const hasActiveFilters = () => {
    return drumTypeFilter !== 'all' || 
           versionFilter !== 'all' || 
           viewedFilter !== 'all';
  };
  
  // Reset all filters to default
  const resetFilters = () => {
    setDrumTypeFilter('all');
    setVersionFilter('all');
    setViewedFilter('all');
  };
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  const formatLLMResponse = (response) => {
    try {
      const parsed = JSON.parse(response);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return response;
    }
  };
  
  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div className="loading-spinner" />
        <p style={{ marginTop: '20px', color: 'var(--text-secondary)' }}>Loading LLM failures...</p>
      </div>
    );
  }
  
  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '24px' }}>
        LLM Failures
      </h2>
      
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
            {failures.length} {failures.length === 1 ? 'failure' : 'failures'}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div>
            <label className="label">Drum Type</label>
            <select
              value={drumTypeFilter}
              onChange={(e) => setDrumTypeFilter(e.target.value)}
              className="input"
            >
              <option value="all">All</option>
              {availableDrumTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="label">Model Version</label>
            <select
              value={versionFilter}
              onChange={(e) => setVersionFilter(e.target.value)}
              className="input"
            >
              <option value="all">All</option>
              {availableVersions.map(version => (
                <option key={version} value={version}>{version}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="label">Status</label>
            <select
              value={viewedFilter}
              onChange={(e) => setViewedFilter(e.target.value)}
              className="input"
            >
              <option value="all">All</option>
              <option value="unviewed">Unviewed</option>
              <option value="viewed">Viewed</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Failures List */}
      {failures.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>No LLM failures found.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', background: 'var(--secondary-bg)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Date</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Prompt</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Drum Type</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Version</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {failures.map(failure => (
                <tr
                  key={failure.id}
                  onClick={() => openDetail(failure)}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    transition: 'background 0.2s ease',
                    background: failure.viewed ? 'transparent' : 'rgba(220, 53, 69, 0.05)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--secondary-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = failure.viewed ? 'transparent' : 'rgba(220, 53, 69, 0.05)'}
                >
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                    {formatDate(failure.created_at)}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {failure.prompt_text}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                    {failure.drum_type || failure.free_text_drum_type || '-'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                    {failure.model_version || '-'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: failure.viewed ? 'rgba(34, 197, 94, 0.2)' : 'rgba(220, 53, 69, 0.2)',
                      color: failure.viewed ? '#22c55e' : '#dc3545'
                    }}>
                      {failure.viewed ? 'Viewed' : 'Unviewed'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Detail Modal */}
      {selectedFailure && (
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
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
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
            
            {/* Toggle Viewed/Unviewed button */}
            <button
              onClick={toggleViewed}
              style={{
                position: 'absolute',
                top: '16px',
                right: '90px',
                background: selectedFailure.viewed ? 'rgba(220, 53, 69, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                border: `1px solid ${selectedFailure.viewed ? 'rgba(220, 53, 69, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                color: selectedFailure.viewed ? '#dc3545' : '#22c55e',
                padding: '6px 12px',
                zIndex: 10,
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = selectedFailure.viewed ? 'rgba(220, 53, 69, 0.2)' : 'rgba(34, 197, 94, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = selectedFailure.viewed ? 'rgba(220, 53, 69, 0.1)' : 'rgba(34, 197, 94, 0.1)';
              }}
              title={selectedFailure.viewed ? 'Mark as unviewed' : 'Mark as viewed'}
            >
              {selectedFailure.viewed ? '👁️ Mark Unviewed' : '✓ Mark Viewed'}
            </button>
            
            {/* Delete button */}
            <button
              onClick={handleDelete}
              style={{
                position: 'absolute',
                top: '16px',
                right: '50px',
                background: 'transparent',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
                color: '#dc3545',
                padding: '4px 8px',
                zIndex: 10,
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              onMouseEnter={(e) => {
                e.target.style.color = '#b91c1c';
                e.target.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.target.style.color = '#dc3545';
                e.target.style.transform = 'scale(1)';
              }}
              title="Delete this failure"
            >
              🗑️
            </button>
            
            {/* Scrollable content */}
            <div 
              style={{ 
                overflowY: 'auto', 
                flex: 1, 
                paddingRight: '8px'
              }}
              className="custom-scrollbar"
            >
              <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '20px', paddingRight: '40px' }}>
                LLM Failure Details
              </h3>
              
              {/* Metadata */}
              <div style={{ marginBottom: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Date</div>
                  <div style={{ fontSize: '14px', fontWeight: '600' }}>{formatDate(selectedFailure.created_at)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Drum Type</div>
                  <div style={{ fontSize: '14px', fontWeight: '600' }}>{selectedFailure.drum_type || selectedFailure.free_text_drum_type || '-'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Version</div>
                  <div style={{ fontSize: '14px', fontWeight: '600' }}>{selectedFailure.model_version || '-'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Status</div>
                  <div>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: selectedFailure.viewed ? 'rgba(34, 197, 94, 0.2)' : 'rgba(220, 53, 69, 0.2)',
                      color: selectedFailure.viewed ? '#22c55e' : '#dc3545'
                    }}>
                      {selectedFailure.viewed ? 'Viewed' : 'Unviewed'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Prompt */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
                  Prompt:
                </div>
                <div 
                  className="card"
                  style={{ 
                    padding: '16px', 
                    background: 'var(--secondary-bg)',
                    fontSize: '15px',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}
                >
                  {selectedFailure.prompt_text}
                </div>
              </div>
              
              {/* DrumGen Audio - The main generated audio */}
              {selectedFailure.audio_id && (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>DrumGen Audio:</div>
                  <AudioPlayer src={`${API_BASE_URL}/api/audio/${selectedFailure.audio_id}`} />
                </div>
              )}
              
              {/* Notes Section - if exists */}
              {selectedFailure.notes && selectedFailure.notes.trim() && (
                <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
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
                    Notes from Original Result:
                  </div>
                  <div style={{ fontSize: '15px', lineHeight: '1.6', color: 'var(--text-primary)', marginBottom: selectedFailure.notes_audio_path ? '12px' : '0' }}>
                    {selectedFailure.notes}
                  </div>
                  {selectedFailure.notes_audio_path && (
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Attached audio:</div>
                      <AudioPlayer src={`${API_BASE_URL}${selectedFailure.notes_audio_path}`} />
                      <a
                        href={`${API_BASE_URL}${selectedFailure.notes_audio_path}`}
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
              
              {/* Notes audio only - if no text notes */}
              {!selectedFailure.notes && selectedFailure.notes_audio_path && (
                <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--secondary-bg)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Audio Note from Original Result:</div>
                  <AudioPlayer src={`${API_BASE_URL}${selectedFailure.notes_audio_path}`} />
                  <a
                    href={`${API_BASE_URL}${selectedFailure.notes_audio_path}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '12px', color: 'var(--secondary-color)' }}
                  >
                    Download .wav
                  </a>
                </div>
              )}
              
              {/* LLM Response */}
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
                  LLM Response:
                </div>
                <div 
                  className="card"
                  style={{ 
                    padding: '16px', 
                    background: 'rgba(220, 53, 69, 0.05)',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'monospace',
                    border: '1px solid rgba(220, 53, 69, 0.2)'
                  }}
                >
                  {formatLLMResponse(selectedFailure.llm_response)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

