import React, { useRef, useEffect } from 'react';

let activeAudioElement = null;

export default function AudioPlayer({ src, loop = true }) {
  const audioRef = useRef(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const handlePlay = () => {
      if (activeAudioElement && activeAudioElement !== el) {
        activeAudioElement.pause();
      }
      activeAudioElement = el;
    };

    el.addEventListener('play', handlePlay);
    return () => {
      el.removeEventListener('play', handlePlay);
      if (activeAudioElement === el) activeAudioElement = null;
    };
  }, []);

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
        No audio generated yet
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '12px', 
      background: 'var(--secondary-bg)', 
      borderRadius: '8px',
      border: '1px solid var(--border-color)'
    }}>
      <audio 
        ref={audioRef}
        controls
        loop={loop}
        src={src}
        style={{ 
          width: '100%',
          height: '40px',
          borderRadius: '4px',
          outline: 'none'
        }}
        onError={(e) => {
          console.error('Audio failed to load:', src);
        }}
      >
        Your browser does not support the audio element.
      </audio>
    </div>
  );
}
