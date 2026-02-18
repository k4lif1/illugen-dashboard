import React from 'react';

export default function AudioPlayer({ src }) {
  // Debug logging
  console.log('AudioPlayer received src:', src);
  
  if (!src) {
    return (
      <div style={{ 
        padding: '32px', 
        background: 'var(--secondary-bg)', 
        borderRadius: '8px',
        color: 'var(--text-secondary)',
        fontStyle: 'italic',
        textAlign: 'center',
        border: '1px solid var(--border-color)'
      }}>
        🔇 No audio generated yet
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '20px', 
      background: 'var(--secondary-bg)', 
      borderRadius: '8px',
      border: '1px solid var(--border-color)'
    }}>
      <audio 
        controls 
        src={src}
        style={{ 
          width: '100%',
          height: '40px',
          borderRadius: '4px',
          outline: 'none'
        }}
        onError={(e) => {
          console.error('Audio failed to load:', src);
          console.error('Error details:', e.target.error);
        }}
        onLoadedData={() => {
          console.log('Audio loaded successfully:', src);
        }}
      >
        Your browser does not support the audio element.
      </audio>
      {/* Debug info */}
      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '8px', wordBreak: 'break-all' }}>
        {src}
      </div>
    </div>
  );
}
