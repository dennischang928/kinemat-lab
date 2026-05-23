import { useState, useRef, useCallback } from 'react';

/**
 * Manages the draggable left/right panel divider.
 *
 * Returns `leftPanelWidth` (percentage) and the three mouse-event
 * handlers that the container and divider need.
 *
 * @param {number} initialWidth - starting width in percent (default 30)
 */
export default function usePanelResize(initialWidth = 30) {
  const [leftPanelWidth, setLeftPanelWidth] = useState(initialWidth);
  const isDraggingRef = useRef(false);

  const handleMouseDown = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDraggingRef.current) return;

    const container = e.currentTarget;
    const newWidth = (e.clientX / container.clientWidth) * 100;

    if (newWidth >= 20 && newWidth <= 70) {
      setLeftPanelWidth(newWidth);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  return {
    leftPanelWidth,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}
