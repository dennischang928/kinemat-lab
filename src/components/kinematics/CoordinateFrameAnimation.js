import React, { useState, useEffect } from 'react';

/**
 * useCoordinateFrameAnimation Hook
 * Animates a 2D coordinate frame (i-hat, j-hat) through rotation and translation
 * @param {number} theta - Rotation angle in radians
 * @param {number} linkLength - Length of link in mm
 * @param {number} scale - Scale factor (pixels per mm)
 * @param {boolean} isAnimating - Whether animation is playing
 * @param {number} duration - Animation duration in ms (default 2000)
 * @returns {Object} Animation state with rotation, translation, and progress
 */
export const useCoordinateFrameAnimation = (theta, linkLength, scale, isAnimating, duration = 4000) => {
  const [progress, setProgress] = useState(0);
  const [animationTime, setAnimationTime] = useState(0);

  useEffect(() => {
    if (!isAnimating) {
      setProgress(0);
      setAnimationTime(0);
      return;
    }

    let startTime = Date.now();
    let animationId;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const normalizedProgress = (elapsed % duration) / duration;
      
      setAnimationTime(elapsed);
      setProgress(normalizedProgress);
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationId);
  }, [isAnimating, duration]);

  // Split animation into two phases: 0-0.5 = rotation, 0.5-1.0 = translation
  const rotationPhase = Math.min(progress * 2, 1); // 0 to 1 over first half
  const translationPhase = Math.max((progress - 0.5) * 2, 0); // 0 to 1 over second half

  // Current rotation (animate from 0 to theta)
  const currentTheta = theta * rotationPhase;

  // Current translation (animate from 0 to link length)
  const translationDistance = linkLength * scale * translationPhase;
  const translationX = Math.cos(currentTheta) * translationDistance;
  const translationY = -Math.sin(currentTheta) * translationDistance;

  // i-hat and j-hat vectors (unit length = 30px for visibility)
  const frameSize = 30;
  const iHat = {
    x: Math.cos(currentTheta) * frameSize,
    y: -Math.sin(currentTheta) * frameSize,
  };

  const jHat = {
    x: Math.cos(currentTheta + Math.PI / 2) * frameSize,
    y: -Math.sin(currentTheta + Math.PI / 2) * frameSize,
  };

  return {
    progress,
    rotationPhase,
    translationPhase,
    currentTheta,
    translationX,
    translationY,
    iHat,
    jHat,
    frameSize,
  };
};

/**
 * CoordinateFrameAnimation Component
 * Renders animated i-hat and j-hat coordinate frames
 */
const CoordinateFrameAnimation = ({ 
  startX, 
  startY, 
  theta, 
  linkLength, 
  scale, 
  isAnimating,
  jointName = "Joint",
  showLabel = true
}) => {
  const animState = useCoordinateFrameAnimation(theta, linkLength, scale, isAnimating);
  const { iHat, jHat, translationX, translationY, progress, rotationPhase, translationPhase } = animState;

  // Current frame origin
  const frameX = startX + translationX;
  const frameY = startY + translationY;

  return (
    <g key="coordinate-frame-animation" opacity={isAnimating ? 1 : 0}>
      {/* Origin point of frame */}
      <circle
        cx={frameX}
        cy={frameY}
        r={4}
        fill="black"
        stroke="white"
        strokeWidth={1}
      />

      {/* i-hat (red) - points in rotated x direction */}
      <line
        x1={frameX}
        y1={frameY}
        x2={frameX + iHat.x}
        y2={frameY + iHat.y}
        stroke="#d32f2f"
        strokeWidth={3}
        strokeLinecap="round"
      />
      
      {/* i-hat arrowhead */}
      <polygon
        points={`${frameX + iHat.x},${frameY + iHat.y} ${frameX + iHat.x - 4},${frameY + iHat.y - 4} ${frameX + iHat.x - 4},${frameY + iHat.y + 4}`}
        fill="#d32f2f"
      />

      {/* j-hat (green) - points in rotated y direction */}
      <line
        x1={frameX}
        y1={frameY}
        x2={frameX + jHat.x}
        y2={frameY + jHat.y}
        stroke="#388e3c"
        strokeWidth={3}
        strokeLinecap="round"
      />

      {/* j-hat arrowhead */}
      <polygon
        points={`${frameX + jHat.x},${frameY + jHat.y} ${frameX + jHat.x + 4},${frameY + jHat.y - 4} ${frameX + jHat.x - 4},${frameY + jHat.y - 4}`}
        fill="#388e3c"
      />

      {/* Labels */}
      {showLabel && (
        <>
          <text
            x={frameX + iHat.x + 8}
            y={frameY + iHat.y - 5}
            fontSize={11}
            fill="#d32f2f"
            fontWeight="bold"
            fontFamily="Arial"
          >
            î
          </text>
          <text
            x={frameX + jHat.x + 8}
            y={frameY + jHat.y - 5}
            fontSize={11}
            fill="#388e3c"
            fontWeight="bold"
            fontFamily="Arial"
          >
            ĵ
          </text>
        </>
      )}

      {/* Animation phase indicator */}
      {isAnimating && (
        <text
          x={frameX}
          y={frameY - 25}
          fontSize={10}
          fill="#666"
          textAnchor="middle"
          fontFamily="Arial"
        >
          {rotationPhase < 1 
            ? `Rotate θ (${(rotationPhase * 100).toFixed(0)}%)`
            : `Translate L (${(translationPhase * 100).toFixed(0)}%)`
          }
        </text>
      )}

      {/* Progress bar background */}
      <rect
        x={frameX - 40}
        y={frameY + 35}
        width={80}
        height={6}
        fill="#e0e0e0"
        rx={3}
        opacity={isAnimating ? 0.7 : 0}
      />

      {/* Progress bar fill */}
      <rect
        x={frameX - 40}
        y={frameY + 35}
        width={80 * progress}
        height={6}
        fill="#1976d2"
        rx={3}
        opacity={isAnimating ? 0.9 : 0}
      />
    </g>
  );
};

export default CoordinateFrameAnimation;
