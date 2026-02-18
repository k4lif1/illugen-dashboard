import React from 'react';

export default function PromptDisplay({ prompt, difficulty }) {
  return (
    <div style={{ border: '1px solid #ddd', padding: '12px', borderRadius: '8px', marginBottom: '12px' }}>
      <div style={{ fontWeight: '600' }}>Prompt</div>
      <div style={{ marginTop: '6px' }}>{prompt || 'No prompt loaded yet.'}</div>
      {difficulty ? <div style={{ marginTop: '6px', color: '#666' }}>Difficulty: {difficulty}</div> : null}
    </div>
  );
}

