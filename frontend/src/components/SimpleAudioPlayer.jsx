import React, { useRef, useState } from 'react';

export default function SimpleAudioPlayer({ src }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
  };

  if (!src) {
    return (
      <div style={{ 
        padding: '12px', 
        background: 'var(--secondary-bg)', 
        borderRadius: '6px',
        color: 'var(--text-secondary)',
        fontSize: '13px',
        textAlign: 'center',
        border: '1px solid var(--border-color)'
      }}>
        No audio
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px', 
      background: 'var(--secondary-bg)', 
      borderRadius: '6px',
      border: '1px solid var(--border-color)'
    }}>
      <button
        onClick={togglePlay}
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          border: '2px solid var(--primary-color)',
          background: isPlaying ? 'var(--primary-color)' : 'transparent',
          color: isPlaying ? '#fff' : 'var(--primary-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: '14px',
          flexShrink: 0,
          transition: 'all 0.2s ease'
        }}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <audio 
        ref={audioRef}
        src={src}
        onEnded={handleEnded}
        style={{ display: 'none' }}
      />
    </div>
  );
}

