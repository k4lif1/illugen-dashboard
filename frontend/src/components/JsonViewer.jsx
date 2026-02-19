import React, { useState } from 'react';

export default function JsonViewer({ data, defaultCollapsed = true }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

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
    <div>
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: '13px',
          padding: '4px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: collapsed ? 0 : '8px',
          userSelect: 'none',
        }}
      >
        <span style={{
          display: 'inline-block',
          transition: 'transform 150ms ease',
          transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
          fontSize: '11px',
        }}>&#9654;</span>
        {collapsed ? 'Show JSON' : 'Hide JSON'}
      </button>

      {!collapsed && (
        <pre style={{ 
          padding: '16px', 
          background: 'var(--secondary-bg)', 
          borderRadius: '8px',
          overflow: 'auto',
          fontSize: '13px',
          lineHeight: '1.6',
          border: '1px solid var(--border-color)',
          color: 'var(--text-primary)',
          fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
          maxHeight: '400px',
          margin: 0,
        }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
