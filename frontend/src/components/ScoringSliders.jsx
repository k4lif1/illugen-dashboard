import React, { useRef, useEffect, useState } from 'react';

export default function ScoringSliders({ scores, onChange, generationError = false, llmError = false }) {
  const genScoreRef = useRef(null);
  const llmScoreRef = useRef(null);
  const [isDragging, setIsDragging] = useState(null); // 'gen' or 'llm' or null
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartValue, setDragStartValue] = useState(0);

  // Add wheel event listeners with passive: false to ensure preventDefault works
  useEffect(() => {
    const handleWheelGen = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const currentValue = scores.audio_quality_score ?? 1; // Default to 1 if null
      const delta = e.deltaY > 0 ? -1 : 1;
      const newValue = Math.max(1, Math.min(10, currentValue + delta));
      onChange({ ...scores, audio_quality_score: newValue });
    };

    const handleWheelLLM = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const currentValue = scores.llm_accuracy_score ?? 1; // Default to 1 if null
      const delta = e.deltaY > 0 ? -1 : 1;
      const newValue = Math.max(1, Math.min(10, currentValue + delta));
      onChange({ ...scores, llm_accuracy_score: newValue });
    };

    const genElement = genScoreRef.current;
    const llmElement = llmScoreRef.current;

    if (genElement) {
      genElement.addEventListener('wheel', handleWheelGen, { passive: false });
    }
    if (llmElement) {
      llmElement.addEventListener('wheel', handleWheelLLM, { passive: false });
    }

    return () => {
      if (genElement) {
        genElement.removeEventListener('wheel', handleWheelGen);
      }
      if (llmElement) {
        llmElement.removeEventListener('wheel', handleWheelLLM);
      }
    };
  }, [scores, onChange]);

  const handleChange = (key, value) => {
    // Handle empty string or null
    if (value === '' || value === null || value === undefined) {
      onChange({ ...scores, [key]: null });
      return;
    }
    // Ensure value is between 1 and 10
    const numValue = Math.max(1, Math.min(10, Number(value) || 1));
    onChange({ ...scores, [key]: numValue });
  };

  const handleMouseDown = (e, key, currentValue) => {
    // Don't start dragging if input is focused (user is typing)
    if (document.activeElement === e.currentTarget.querySelector('input')) {
      return;
    }
    
    setIsDragging(key);
    setDragStartY(e.clientY);
    // Default to 1 if null for dragging
    setDragStartValue(currentValue ?? 1);
    e.preventDefault();
  };

  const handleDoubleClick = (e, ref) => {
    // Double-click to enter text mode
    const input = ref.current?.querySelector('input');
    if (input) {
      input.focus();
      input.select();
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;

      const deltaY = dragStartY - e.clientY; // Inverted: dragging up = increase
      const steps = Math.floor(deltaY / 10); // Every 10px = 1 step
      const newValue = Math.max(1, Math.min(10, dragStartValue + steps));

      if (isDragging === 'gen') {
        onChange({ ...scores, audio_quality_score: newValue });
      } else if (isDragging === 'llm') {
        onChange({ ...scores, llm_accuracy_score: newValue });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(null);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, dragStartY, dragStartValue, scores, onChange]);

  return (
    <div>
      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
        {/* Generation Score */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <label className="label" style={{ margin: 0, fontSize: '12px', marginBottom: '6px' }}>
            Generation
          </label>
          <div 
            ref={genScoreRef}
            className={`scroll-wheel-input-compact ${generationError ? 'flash-error-active' : ''}`}
            onMouseDown={(e) => handleMouseDown(e, 'gen', scores.audio_quality_score ?? 1)}
            onDoubleClick={(e) => handleDoubleClick(e, genScoreRef)}
            style={{ 
              cursor: isDragging === 'gen' ? 'ns-resize' : 'pointer',
              opacity: 1,
              ...(generationError ? {
                borderColor: 'var(--secondary-color)',
                borderWidth: '2px',
                backgroundColor: 'rgba(199, 155, 255, 0.08)'
              } : {})
            }}
          >
            <input
              type="number"
              min="1"
              max="10"
              value={scores.audio_quality_score ?? ''}
              placeholder="-"
              onChange={(e) => handleChange('audio_quality_score', e.target.value)}
              className="score-input-compact score-input-drag-mode"
            />
            <div className="score-label-compact">/10</div>
          </div>
        </div>

        {/* LLM Score */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <label className="label" style={{ margin: 0, fontSize: '12px', marginBottom: '6px' }}>
            LLM
          </label>
          <div 
            ref={llmScoreRef}
            className={`scroll-wheel-input-compact ${llmError ? 'flash-error-active' : ''}`}
            onMouseDown={(e) => handleMouseDown(e, 'llm', scores.llm_accuracy_score ?? 1)}
            onDoubleClick={(e) => handleDoubleClick(e, llmScoreRef)}
            style={{ 
              cursor: isDragging === 'llm' ? 'ns-resize' : 'pointer',
              ...(llmError ? {
                borderColor: 'var(--secondary-color)',
                borderWidth: '2px',
                backgroundColor: 'rgba(199, 155, 255, 0.08)'
              } : {})
            }}
          >
            <input
              type="number"
              min="1"
              max="10"
              value={scores.llm_accuracy_score ?? ''}
              placeholder="-"
              onChange={(e) => handleChange('llm_accuracy_score', e.target.value)}
              className="score-input-compact score-input-drag-mode"
            />
            <div className="score-label-compact">/10</div>
          </div>
        </div>
      </div>
    </div>
  );
}
