import React, { useRef, useEffect, useState } from 'react';

export default function DifficultySlider({ value, onChange, showError = false }) {
  const difficultyRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartValue, setDragStartValue] = useState(0);

  // Add wheel event listeners with passive: false to ensure preventDefault works
  useEffect(() => {
    const handleWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const currentValue = value ?? 1; // Default to 1 if null
      const delta = e.deltaY > 0 ? -1 : 1;
      const newValue = Math.max(1, Math.min(10, currentValue + delta));
      onChange(newValue);
    };

    const element = difficultyRef.current;
    if (element) {
      element.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (element) {
        element.removeEventListener('wheel', handleWheel);
      }
    };
  }, [value, onChange]);

  const handleChange = (newValue) => {
    // Handle empty string or null
    if (newValue === '' || newValue === null || newValue === undefined) {
      onChange(null);
      return;
    }
    // Ensure value is between 1 and 10
    const numValue = Math.max(1, Math.min(10, Number(newValue) || 1));
    onChange(numValue);
  };

  const handleMouseDown = (e) => {
    // Don't start dragging if input is focused (user is typing)
    if (document.activeElement === e.currentTarget.querySelector('input')) {
      return;
    }
    
    setIsDragging(true);
    setDragStartY(e.clientY);
    // Default to 1 if null for dragging
    setDragStartValue(value ?? 1);
    e.preventDefault();
  };

  const handleDoubleClick = (e) => {
    // Double-click to enter text mode
    const input = difficultyRef.current?.querySelector('input');
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
      onChange(newValue);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
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
  }, [isDragging, dragStartY, dragStartValue, onChange]);

  return (
    <div 
      ref={difficultyRef}
      className={`scroll-wheel-input-compact ${showError ? 'flash-error-active' : ''}`}
      onMouseDown={(e) => handleMouseDown(e)}
      onDoubleClick={(e) => handleDoubleClick(e)}
      style={{ 
        cursor: isDragging ? 'ns-resize' : 'pointer',
        width: '100%',
        ...(showError ? {
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
        value={value ?? ''}
        placeholder="-"
        onChange={(e) => handleChange(e.target.value)}
        className="score-input-compact score-input-drag-mode"
        style={{ width: '100%' }}
      />
      <div className="score-label-compact">/10</div>
    </div>
  );
}

