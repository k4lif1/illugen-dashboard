import React from 'react';

export default function LoadingOverlay({ isLoading }) {
  if (!isLoading) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(13, 16, 22, 0.95)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        animation: 'fadeIn 0.3s ease-out'
      }}
    >
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

        {/* Inner pulsing circles */}
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

      {/* Loading text */}
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
        Loading...
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes spin {
          from {
            transform: translate(-50%, -50%) rotate(0deg);
          }
          to {
            transform: translate(-50%, -50%) rotate(360deg);
          }
        }

        @keyframes pulse {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.8;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.1);
            opacity: 1;
          }
        }

        @keyframes shimmer {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        @keyframes rotateGradient {
          0% {
            transform: translate(-50%, -50%) rotate(0deg);
          }
          100% {
            transform: translate(-50%, -50%) rotate(360deg);
          }
        }

        @keyframes orbit {
          0% {
            transform: translate(-50%, -50%) rotate(0deg) translateY(-70px);
          }
          100% {
            transform: translate(-50%, -50%) rotate(360deg) translateY(-70px);
          }
        }
      `}</style>
    </div>
  );
}
