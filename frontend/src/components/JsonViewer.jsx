import React from 'react';

export default function JsonViewer({ data }) {
  if (!data) {
    return (
      <div style={{ 
        padding: '16px', 
        background: 'var(--secondary-bg)', 
        borderRadius: '8px',
        color: 'var(--text-secondary)',
        fontStyle: 'italic',
        border: '1px solid var(--border-color)'
      }}>
        No JSON data yet
      </div>
    );
  }

  return (
    <pre style={{ 
      padding: '16px', 
      background: 'var(--secondary-bg)', 
      borderRadius: '8px',
      overflow: 'auto',
      fontSize: '13px',
      lineHeight: '1.6',
      border: '1px solid var(--border-color)',
      color: 'var(--text-primary)',
      fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace"
    }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
