import React, { useState, useEffect, useRef } from "react";
import { Stage, Layer, Circle, Line, Text, Group, Arrow } from 'react-konva';
import { Box, Paper, FormControlLabel, Checkbox, Typography, IconButton, TextField, Button } from '@mui/material';
import { calculateForwardKinematics } from '../kinematics/forwardkinematics';
import SettingsIcon from '@mui/icons-material/Settings';

const DEFAULT_ANGLES = {
  thetaBase: 0,
  theta1: Math.PI / 4,
  theta2: Math.PI / 6,
  theta3: -Math.PI / 3,
};

const DEFAULT_LINK_LENGTHS = { L1: 40, L2: 70, L3: 50 };

const Robot2d = ({ angles, onAngleChange, selectedStep = 4, selectedJoint = 1, showFrameAnimation = false, linkLengths = { L1: 40, L2: 70, L3: 50 }, onLinkLengthsChange }) => {
  // Link lengths in mm (configurable)
  const { L1, L2, L3 } = linkLengths;

  // Scale factor: pixels per mm
  const SCALE = 2; // 2 pixels per mm
  const GRID_SIZE_MM = 50; // Grid lines every 10mm
  const GRID_SIZE_PX = GRID_SIZE_MM * SCALE;

  const [dimensions, setDimensions] = useState({
    width: window.innerWidth * 0.6 - 40,
    height: window.innerHeight - 40
  });

  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const stageRef = useRef(null);

  const [animProgress, setAnimProgress] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [draftLinkLengths, setDraftLinkLengths] = useState(linkLengths);
  const animationRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    setDraftLinkLengths(linkLengths);
  }, [linkLengths]);

  useEffect(() => {
    let startTime;
    // Step 1: rotation only (1 unit), Steps 2-3: translate+rotate (2 units each), Step 4: translation only (1 unit)
    // Play all: 1 + 2 + 2 + 1 = 6 units over 18 seconds
    const DURATION = selectedJoint === 0 ? 18000 : 4000;

    const animate = (time) => {
      if (!startTime) startTime = time;
      const elapsed = time - startTime;

      if (selectedJoint === 0) {
        // Full sequence: 0 to 6 total progress
        const totalProgress = (elapsed % DURATION) / (DURATION / 6);
        setAnimProgress(totalProgress);
      } else if (selectedJoint === 1) {
        // Rotation only: progress 0 to 1
        const progress = (elapsed % DURATION) / DURATION;
        setAnimProgress(progress);
      } else if (selectedJoint === 4) {
        // Final translation only: progress 0 to 1
        const progress = (elapsed % DURATION) / DURATION;
        setAnimProgress(progress);
      } else {
        // Translate then rotate: progress 0 to 2
        const progress = (elapsed % DURATION) / (DURATION / 2);
        setAnimProgress(progress);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    if (showFrameAnimation) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      setAnimProgress(0);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [showFrameAnimation, selectedJoint, angles]);

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth * 0.6 - 40,
        height: window.innerHeight - 40
      });
    };

    const handleWheel = (e) => {
      if (containerRef.current && containerRef.current.contains(e.target)) {
        e.preventDefault();
        const scaleBy = 1.1;
        const newZoom = e.deltaY < 0 ? zoom * scaleBy : zoom / scaleBy;
        setZoom(Math.max(0.5, Math.min(5, newZoom)));
      }
    };

    const handleMouseDown = (e) => {
      if (e.button === 2 || e.ctrlKey) { // Right click or Ctrl+left click to pan
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      }
    };

    const handleMouseMove = (e) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('contextmenu', (e) => e.preventDefault());
    };
  }, [zoom, position, isDragging, dragStart]);

  const calculateJointPositions = () => {
    // Angles are already in radians from JointController
    // Use FK calculator with canvas-centered coordinates
    const result = calculateForwardKinematics(angles, {
      linkLengths: { L1, L2, L3 },
      scale: SCALE,
      baseX: dimensions.width / 2,
      baseY: dimensions.height / 2,
    });

    return result;
  };

  const fkResult = calculateJointPositions();
  const positions = {
    base: fkResult.base,
    joint1: fkResult.joint1,
    joint2: fkResult.joint2,
    joint3: fkResult.joint3,
  };

  // Determine which links to show based on selected step
  const showLink1 = selectedStep >= 2;
  const showLink2 = selectedStep >= 3;
  const showLink3 = selectedStep >= 4;

  const normalizeAngleDiff = (angleDiff) => {
    let normalized = angleDiff;
    while (normalized > Math.PI) normalized -= 2 * Math.PI;
    while (normalized < -Math.PI) normalized += 2 * Math.PI;
    return normalized;
  };

  const getArcMidAngle = (startAngle, endAngle) => {
    const angleDiff = normalizeAngleDiff(endAngle - startAngle);
    return startAngle + angleDiff / 2;
  };

  const getLinkLabelPosition = (from, to, linkAngle, arcMidAngle) => {
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;

    const normalA = { x: -uy, y: ux };
    const normalB = { x: uy, y: -ux };
    const arcDirection = { x: Math.cos(arcMidAngle), y: -Math.sin(arcMidAngle) };

    const dotA = normalA.x * arcDirection.x + normalA.y * arcDirection.y;
    const dotB = normalB.x * arcDirection.x + normalB.y * arcDirection.y;
    const chosenNormal = dotA < dotB ? normalA : normalB;

    const offsetDistance = 18;
    return {
      x: midX + chosenNormal.x * offsetDistance,
      y: midY + chosenNormal.y * offsetDistance,
      rotation: -(linkAngle * 180) / Math.PI,
    };
  };

  const handleResetDefaults = () => {
    if (onAngleChange) {
      Object.entries(DEFAULT_ANGLES).forEach(([joint, value]) => {
        if (joint === 'thetaBase' || Object.prototype.hasOwnProperty.call(angles, joint)) {
          onAngleChange(joint, value);
        }
      });
    }

    setDraftLinkLengths(DEFAULT_LINK_LENGTHS);
    if (onLinkLengthsChange) {
      onLinkLengthsChange(DEFAULT_LINK_LENGTHS);
    }
  };

  // Helper function to render coordinate frames
  const renderCoordinateFrame = (x, y, angle, label_x, label_y, axisLength = 60) => {
    const rotationRad = angle;
    // X-axis direction (red)
    const xAxisEndX = x + axisLength * Math.cos(rotationRad);
    const xAxisEndY = y - axisLength * Math.sin(rotationRad);
    // Y-axis direction (green) - perpendicular to X-axis
    const yAxisEndX = x - axisLength * Math.sin(rotationRad);
    const yAxisEndY = y - axisLength * Math.cos(rotationRad);

    const xAxisLabel = `${label_x}`;
    const yAxisLabel = `${label_y}`;

    return (
      <Group key={`frame-${label_x}-${label_y}`}>
        {/* X-axis (red) */}
        <Arrow
          points={[x, y, xAxisEndX, xAxisEndY]}
          stroke="red"
          strokeWidth={2}
          fill="red"
          dashEnabled={true}
          dash={[5, 1]}
          pointerWidth={5}
          pointerLength={5}
        />
        {/* X-axis label */}
        <Text
          text={xAxisLabel}
          x={xAxisEndX + 5}
          y={xAxisEndY - 10}
          fontSize={10}
          fill="red"
          fontStyle="bold"
        />
        {/* Y-axis (green) */}
        <Arrow
          points={[x, y, yAxisEndX, yAxisEndY]}
          stroke="green"
          strokeWidth={2}
          fill="green"
          dashEnabled={true}
          dash={[5, 1]}
          pointerWidth={5}
          pointerLength={5}
        />
        {/* Y-axis label */}
        <Text
          text={yAxisLabel}
          x={yAxisEndX - 15}
          y={yAxisEndY - 10}
          fontSize={10}
          fill="green"
          fontStyle="bold"

        />
        {/* Frame origin dot */}
        <Circle
          x={x}
          y={y}
          radius={2}
          fill="black"
        />
      </Group>
    );
  };

  // Generate grid lines and labels
  const generateGrid = () => {
    const gridLines = [];
    const gridLabels = [];
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    // Anchor grid spacing to the world origin at canvas center.
    const startX = centerX - Math.ceil(centerX / GRID_SIZE_PX) * GRID_SIZE_PX;
    const startY = centerY - Math.ceil(centerY / GRID_SIZE_PX) * GRID_SIZE_PX;

    // Vertical grid lines and labels
    for (let x = startX; x < dimensions.width; x += GRID_SIZE_PX) {
      gridLines.push(
        <Line
          key={`v-line-${x}`}
          points={[x, 0, x, dimensions.height]}
          stroke={"#e0e0e0"}
          strokeWidth={1}
          opacity={0.5}
        />
      );

      // Add label every other grid line
      const mmDistance = Math.round((x - centerX) / SCALE);
      const gridIndex = Math.round((x - centerX) / GRID_SIZE_PX);
      if (gridIndex % 2 === 0 && mmDistance !== -4) {
        gridLabels.push(
          <Text
            key={`v-label-${x}`}
            text={`${mmDistance}mm`}
            x={x - 15}
            y={dimensions.height - 20}
            fontSize={10}
            fill="#999"
          />
        );
      }
    }

    // Horizontal grid lines and labels
    for (let y = startY; y < dimensions.height; y += GRID_SIZE_PX) {
      gridLines.push(
        <Line
          key={`h-line-${y}`}
          points={[0, y, dimensions.width, y]}
          stroke={"#e0e0e0"}
          strokeWidth={1}
          opacity={0.5}
        />
      );

      // Add label every other grid line
      const mmDistance = Math.round((centerY - y) / SCALE);
      const gridIndex = Math.round((centerY - y) / GRID_SIZE_PX);
      if (gridIndex % 2 === 0 && mmDistance !== -4) {
        gridLabels.push(
          <Text
            key={`h-label-${y}`}
            text={`${mmDistance}mm`}
            x={10}
            y={y - 8}
            fontSize={10}
            fill="#999"
          />
        );
      }
    }

    // Ensure origin axes are drawn with maximum priority
    gridLines.push(
      <Line
        key="x-axis"
        points={[0, centerY, dimensions.width, centerY]}
        stroke="#000"
        strokeWidth={1.3}
        dash={[10, 10]}
      />
    );
    gridLines.push(
      <Line
        key="y-axis"
        points={[centerX, 0, centerX, dimensions.height]}
        stroke="#000"
        strokeWidth={1.3}
        dash={[10, 10]}
      />
    );

    return [...gridLines, ...gridLabels];
  };

  // Helper function to render an angle arc with dashed extension
  const renderAngleArc = (centerX, centerY, startAngle, endAngle, arcRadius = 40, angleValue, label) => {
    const elements = [];
    const extensionLength = 60;
    const arcStartX = centerX + extensionLength * Math.cos(startAngle);
    const arcStartY = centerY - extensionLength * Math.sin(startAngle);

    // Dashed extension line
    elements.push(
      <Line
        key={`ext-${label}`}
        points={[centerX, centerY, arcStartX, arcStartY]}
        stroke="#999"
        strokeWidth={1}
        dash={[4, 4]}
        opacity={0.6}
      />
    );

    // Arc segments with gap for text
    const angle1Rad = startAngle;
    const angle2Rad = endAngle;
    const angleDiff = normalizeAngleDiff(angle2Rad - angle1Rad);

    // Skip rendering entirely if angle is less than 20 degrees
    const minAngleRad = (20 * Math.PI) / 180;
    if (Math.abs(angleDiff) < minAngleRad) {
      return elements; // Return empty, don't show arc for small angles
    }

    const segments = 30; // Number of line segments for arc
    const gapAngle = 0.4; // Gap size in radians for text
    const midAngle = getArcMidAngle(angle1Rad, angle2Rad);
    const gapStart = midAngle - gapAngle / 2;
    const gapEnd = midAngle + gapAngle / 2;

    // Draw arc in two parts (before and after gap)
    // Part 1: from start to gap start
    if (Math.abs(angle1Rad - gapStart) > 0.05) {
      const arcPoints1 = [];
      const steps1 = Math.max(1, Math.ceil(segments * Math.abs(gapStart - angle1Rad) / Math.abs(angleDiff)));
      for (let i = 0; i <= steps1; i++) {
        const t = i / steps1;
        const ang = angle1Rad + t * (gapStart - angle1Rad);
        arcPoints1.push(centerX + arcRadius * Math.cos(ang));
        arcPoints1.push(centerY - arcRadius * Math.sin(ang));
      }
      if (arcPoints1.length > 2) {
        elements.push(
          <Line
            key={`arc1-${label}`}
            points={arcPoints1}
            stroke="#666"
            strokeWidth={1.5}
            fill={null}
          />
        );
      }
    }

    // Part 2: from gap end to end angle
    if (Math.abs(angle2Rad - gapEnd) > 0.05) {
      const arcPoints2 = [];
      const steps2 = Math.max(1, Math.ceil(segments * Math.abs(angle2Rad - gapEnd) / Math.abs(angleDiff)));
      for (let i = 0; i <= steps2; i++) {
        const t = i / steps2;
        const ang = gapEnd + t * (angle2Rad - gapEnd);
        arcPoints2.push(centerX + arcRadius * Math.cos(ang));
        arcPoints2.push(centerY - arcRadius * Math.sin(ang));
      }
      if (arcPoints2.length > 2) {
        elements.push(
          <Line
            key={`arc2-${label}`}
            points={arcPoints2}
            stroke="#666"
            strokeWidth={1.5}
            fill={null}
          />
        );
      }
    }

    // Angle text at midpoint
    const textX = centerX + (arcRadius + 15) * Math.cos(midAngle);
    const textY = centerY - (arcRadius + 15) * Math.sin(midAngle);
    const textAngleDeg = -(midAngle * 180 / Math.PI);

    elements.push(
      <Text
        key={`angle-text-${label}`}
        text={`${angleValue}°`}
        x={textX}
        y={textY}
        fontSize={11}
        fill="#333"
        fontStyle="bold"
        offsetX={12}
        offsetY={5}
        rotation={textAngleDeg}
      />
    );

    return elements;
  };

  const renderAnimatedFrame = () => {
    if (!showFrameAnimation) return null;

    let activeJoint = selectedJoint;
    let localProgress = animProgress;

    // Sub-divide the progress if playing all
    if (selectedJoint === 0) {
      if (animProgress <= 1) {
        activeJoint = 1;
        localProgress = animProgress; // 0 to 1 (rotation only)
      } else if (animProgress <= 3) {
        activeJoint = 2;
        localProgress = animProgress - 1; // 0 to 2 (translate + rotate)
      } else if (animProgress <= 5) {
        activeJoint = 3;
        localProgress = animProgress - 3; // 0 to 2 (translate + rotate)
      } else {
        activeJoint = 4;
        localProgress = animProgress - 5; // 0 to 1 (translate only)
      }
    }

    let startPos, startAngle, targetAngle, translateLength, frameLabel;
    let rotationOnly = false;

    if (activeJoint === 1) {
      // Step 1: Rotation only at origin by θ₁
      startPos = positions.base;
      startAngle = 0;
      targetAngle = fkResult.angles.absolute1;
      translateLength = 0;
      rotationOnly = true;
      frameLabel = '₁';
    } else if (activeJoint === 2) {
      // Step 2: Translate L₁ from base along θ₁, then rotate by θ₂
      startPos = positions.base;
      startAngle = fkResult.angles.absolute1;
      targetAngle = fkResult.angles.absolute2;
      translateLength = L1 * SCALE;
      frameLabel = '₂';
    } else if (activeJoint === 3) {
      // Step 3: Translate L₂ from joint1 along θ₁+θ₂, then rotate by θ₃
      startPos = positions.joint1;
      startAngle = fkResult.angles.absolute2;
      targetAngle = fkResult.angles.absolute3;
      translateLength = L2 * SCALE;
      frameLabel = '₃';
    } else if (activeJoint === 4) {
      // Step 4: Translate L₃ from joint2 along θ₁+θ₂+θ₃ (no additional rotation)
      startPos = positions.joint2;
      startAngle = fkResult.angles.absolute3;
      targetAngle = fkResult.angles.absolute3;
      translateLength = L3 * SCALE;
      frameLabel = '₄';
      rotationOnly = true;
    } else {
      return null;
    }

    let currentX, currentY, currentAngle;

    if (activeJoint === 4) {
      // Translation-only final segment
      currentAngle = startAngle;
      const dist = translateLength * Math.min(localProgress, 1);
      currentX = startPos.x + dist * Math.cos(startAngle);
      currentY = startPos.y - dist * Math.sin(startAngle);
    } else if (rotationOnly) {
      // Only rotation phase, no translation
      currentX = startPos.x;
      currentY = startPos.y;
      currentAngle = startAngle + (targetAngle - startAngle) * Math.min(localProgress, 1);
    } else {
      // Phase 1: Translation (0→1), Phase 2: Rotation (1→2)
      if (localProgress <= 1) {
        // Translation phase: move along startAngle direction
        currentAngle = startAngle;
        const dist = translateLength * localProgress;
        currentX = startPos.x + dist * Math.cos(startAngle);
        currentY = startPos.y - dist * Math.sin(startAngle);
      } else {
        // Rotation phase: at destination, rotate
        const rotProgress = Math.min(localProgress - 1, 1);
        currentX = startPos.x + translateLength * Math.cos(startAngle);
        currentY = startPos.y - translateLength * Math.sin(startAngle);
        currentAngle = startAngle + (targetAngle - startAngle) * rotProgress;
      }
    }

    // Konva rotation is clockwise in degrees, and 0 is +X.
    // Our math angles are CCW positive, so Konva rotation = -angle * 180 / PI
    const rotationDeg = -currentAngle * 180 / Math.PI;

    const axisLength = 40;

    return (
      <Group x={currentX} y={currentY} rotation={rotationDeg}>
        {/* X axis (i-hat) */}
        <Arrow
          points={[0, 0, axisLength, 0]}
          stroke="rgb(255, 50, 50)"
          fill="rgb(255, 50, 50)"
          strokeWidth={3}
          pointerLength={5}
          pointerWidth={5}
        />
        <Text
          text={`X${frameLabel}`}
          x={axisLength + 5}
          y={-8}
          fontSize={10}
          fill="red"
          fontStyle="bold"
        />

        {/* Y axis (j-hat) */}
        <Arrow
          points={[0, 0, 0, -axisLength]}
          stroke="rgb(50, 200, 50)"
          fill="rgb(50, 200, 50)"
          strokeWidth={3}
          pointerLength={5}
          pointerWidth={5}
        />

        <Text
          text={`Y${frameLabel}`}
          x={-8} y={-axisLength - 20}
          fontSize={10}
          fill="red"
          fontStyle="bold"
        />

      </Group>
    );
  };

  const renderMatrixOverlay = () => {
    if (!showFrameAnimation) return null;

    let activeJoint = selectedJoint;
    let localProgress = animProgress;

    if (selectedJoint === 0) {
      if (animProgress <= 1) {
        activeJoint = 1;
        localProgress = animProgress;
      } else if (animProgress <= 3) {
        activeJoint = 2;
        localProgress = animProgress - 1;
      } else if (animProgress <= 5) {
        activeJoint = 3;
        localProgress = animProgress - 3;
      } else {
        activeJoint = 4;
        localProgress = animProgress - 5;
      }
    }

    const isRotationPhase = activeJoint === 1
      ? localProgress <= 1
      : (activeJoint === 4 ? false : localProgress > 1);
    const isTranslationPhase = activeJoint === 1
      ? false
      : (activeJoint === 4 ? true : localProgress <= 1);

    let targetLength, theta_n;
    if (activeJoint === 1) {
      targetLength = L1;
      theta_n = angles.theta1;
    } else if (activeJoint === 2) {
      targetLength = L2;
      theta_n = angles.theta2;
    } else if (activeJoint === 3) {
      targetLength = L3;
      theta_n = angles.theta3;
    } else if (activeJoint === 4) {
      targetLength = L3;
      theta_n = 0;
    } else {
      return null;
    }

    const formatNegZero = (val) => (Math.abs(val) < 0.001 ? "0.00" : val.toFixed(2));

    const cosVal = formatNegZero(Math.cos(theta_n));
    const sinVal = formatNegZero(Math.sin(theta_n));
    const negSinValCalc = -Math.sin(theta_n);
    const negSinVal = formatNegZero(negSinValCalc);
    // Explicitly handle JS negative zero stringification edge cases
    const finalNegSinVal = negSinVal === "-0.00" || negSinVal === "0.00" ? "0.00" : negSinVal;

    const thetaLabel = `θ${activeJoint}`;
    const LLabel = `L${activeJoint}`;

    // Define highlight styles based on the active phase
    const rotationStyle = isRotationPhase
      ? { color: '#0055ff', fontWeight: 'bold', background: 'rgba(0, 85, 255, 0.1)', borderRadius: '4px' }
      : { color: '#999' };

    const translationStyle = isTranslationPhase
      ? { color: '#ff3300', fontWeight: 'bold', background: 'rgba(255, 51, 0, 0.1)', borderRadius: '4px' }
      : { color: '#999' };

    const constantStyle = { color: '#bbb' };

    return (
      <Paper sx={{ position: 'absolute', top: 20, right: 20, bgcolor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(10px)', borderRadius: 3, p: 2.5, boxShadow: '0 8px 32px rgba(0,0,0,0.1)', fontFamily: 'monospace', fontSize: 16, color: '#333', pointerEvents: 'none', zIndex: 10, minWidth: 250 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.2 }}>
          <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', letterSpacing: 1, color: '#666', mb: 1 }}>Homogeneous Transformation Matrix</Typography>

          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2.5, alignItems: 'center' }}>
            <Typography sx={{ fontSize: 60, fontWeight: 300, lineHeight: 1, color: '#999' }}>[</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2, justifyContent: 'center' }}>
              <Box sx={{ display: 'flex', gap: 2.5, justifyContent: 'center' }}>
                <Typography sx={{ width: 80, textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', ...rotationStyle }}>cos({thetaLabel})</Typography>
                <Typography sx={{ width: 80, textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', ...rotationStyle }}>-sin({thetaLabel})</Typography>
                <Typography sx={{ width: 40, textAlign: 'center', fontWeight: 'bold', fontFamily: 'monospace', ...translationStyle }}>{LLabel}</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2.5, justifyContent: 'center' }}>
                <Typography sx={{ width: 80, textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', ...rotationStyle }}>sin({thetaLabel})</Typography>
                <Typography sx={{ width: 80, textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', ...rotationStyle }}>cos({thetaLabel})</Typography>
                <Typography sx={{ width: 40, textAlign: 'center', fontWeight: 'bold', fontFamily: 'monospace', ...translationStyle }}>0</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2.5, justifyContent: 'center' }}>
                <Typography sx={{ width: 80, textAlign: 'center', fontWeight: 'bold', fontFamily: 'monospace', ...constantStyle }}>0</Typography>
                <Typography sx={{ width: 80, textAlign: 'center', fontWeight: 'bold', fontFamily: 'monospace', ...constantStyle }}>0</Typography>
                <Typography sx={{ width: 40, textAlign: 'center', fontWeight: 'bold', fontFamily: 'monospace', ...constantStyle }}>1</Typography>
              </Box>
            </Box>
            <Typography sx={{ fontSize: 60, fontWeight: 300, lineHeight: 1, color: '#999' }}>]</Typography>

            <Typography sx={{ mx: 1.2, fontSize: 20 }}>=</Typography>

            <Typography sx={{ fontSize: 60, fontWeight: 300, lineHeight: 1, color: '#999' }}>[</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2, justifyContent: 'center' }}>
              <Box sx={{ display: 'flex', gap: 2.5, justifyContent: 'center' }}>
                <Typography sx={{ width: 70, textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', ...rotationStyle }}>{cosVal}</Typography>
                <Typography sx={{ width: 70, textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', ...rotationStyle }}>{finalNegSinVal}</Typography>
                <Typography sx={{ width: 50, fontWeight: 'bold', fontFamily: 'monospace', ...translationStyle }}>{targetLength}</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2.5, justifyContent: 'center' }}>
                <Typography sx={{ width: 70, textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', ...rotationStyle }}>{sinVal}</Typography>
                <Typography sx={{ width: 70, textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', ...rotationStyle }}>{cosVal}</Typography>
                <Typography sx={{ width: 50, fontWeight: 'bold', fontFamily: 'monospace', ...translationStyle }}>0</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2.5, justifyContent: 'center' }}>
                <Typography sx={{ width: 70, textAlign: 'center', fontWeight: 'bold', fontFamily: 'monospace', ...constantStyle }}>0</Typography>
                <Typography sx={{ width: 70, textAlign: 'center', fontWeight: 'bold', fontFamily: 'monospace', ...constantStyle }}>0</Typography>
                <Typography sx={{ width: 50, textAlign: 'center', fontWeight: 'bold', fontFamily: 'monospace', ...constantStyle }}>1</Typography>
              </Box>
            </Box>
            <Typography sx={{ fontSize: 60, fontWeight: 300, lineHeight: 1, color: '#999' }}>]</Typography>
          </Box>
        </Box>
      </Paper>
    );
  };

  return (
    <Box sx={{ width: '100%', height: '100%', boxSizing: 'border-box', p: 2.5, overflow: 'hidden', position: 'relative' }}>
      <Box ref={containerRef} sx={{ width: '100%', height: '100%' }}>
        <Stage
          ref={stageRef}
          draggable={true}
          width={dimensions.width}
          height={dimensions.height}
          scaleX={zoom}
          scaleY={zoom}
          offsetX={(dimensions.width / 2) * (1 - 1 / zoom) - position.x / zoom}
          offsetY={(dimensions.height / 2) * (1 - 1 / zoom) - position.y / zoom}
        >
          <Layer>
            {/* Draw grid */}
            {showGrid && generateGrid()}

            {/* Draw origin marker */}
            <Circle
              x={dimensions.width / 2}
              y={dimensions.height / 2}
              radius={6}
              fill="black"
            />

            {/* Draw Coordinate Frames */}
            {/* Base Frame (X₀, Y₀) - at origin, never moves */}
            {renderCoordinateFrame(positions.base.x, positions.base.y, 0, 'X₀', 'Y₀')}

            {/* Frame 1 (X₁, Y₁) - at origin, rotated by θ₁ (shown when step 1 is completed) */}
            {selectedStep >= 2 && renderCoordinateFrame(positions.base.x, positions.base.y, fkResult.angles.absolute1, 'X₁', 'Y₁')}

            {/* Frame 2 (X₂, Y₂) - at joint1 position, rotated by θ₁+θ₂ (shown when step 2 is completed) */}
            {selectedStep >= 3 && renderCoordinateFrame(positions.joint1.x, positions.joint1.y, fkResult.angles.absolute2, 'X₂', 'Y₂')}

            {/* Frame 3 (X₃, Y₃) - at joint2 position, rotated by θ₁+θ₂+θ₃ (shown when step 3 is completed) */}
            {selectedStep >= 4 && renderCoordinateFrame(positions.joint2.x, positions.joint2.y, fkResult.angles.absolute3, 'X₃', 'Y₃')}

            {/* Draw links */}
            {/* Link 1 */}
            {showLink1 && (
              <>
                {(() => {
                  const theta1MidAngle = getArcMidAngle(0, fkResult.angles.absolute1);
                  const labelPos1 = getLinkLabelPosition(
                    positions.base,
                    positions.joint1,
                    fkResult.angles.absolute1,
                    theta1MidAngle
                  );

                  return (
                    <Text
                      text={`${L1}mm`}
                      x={labelPos1.x}
                      y={labelPos1.y}
                      offsetX={20}
                      offsetY={8}
                      rotation={labelPos1.rotation}
                      fontSize={12}
                      fill="black"
                    />
                  );
                })()}
                <Line
                  points={[
                    positions.base.x, positions.base.y,
                    positions.joint1.x, positions.joint1.y
                  ]}
                  stroke="black"
                  strokeWidth={2}
                />
                {/* Angle arc for θ1 (at base, from 0 to absolute1) */}
                {renderAngleArc(
                  positions.base.x, positions.base.y,
                  0,
                  fkResult.angles.absolute1,
                  40,
                  (angles.theta1 * 180 / Math.PI).toFixed(1),
                  'theta1'
                )}
              </>
            )}
            {/* Link 2 */}
            {showLink2 && (
              <>
                {(() => {
                  const theta2MidAngle = getArcMidAngle(fkResult.angles.absolute1, fkResult.angles.absolute2);
                  const labelPos2 = getLinkLabelPosition(
                    positions.joint1,
                    positions.joint2,
                    fkResult.angles.absolute2,
                    theta2MidAngle
                  );

                  return (
                    <Text
                      text={`${L2}mm`}
                      x={labelPos2.x}
                      y={labelPos2.y}
                      offsetX={20}
                      offsetY={8}
                      rotation={labelPos2.rotation}
                      fontSize={12}
                      fill="black"
                    />
                  );
                })()}
                <Line
                  points={[
                    positions.joint1.x, positions.joint1.y,
                    positions.joint2.x, positions.joint2.y
                  ]}
                  stroke="black"
                  strokeWidth={2}
                />
                {/* Angle arc for θ2 (at joint1, from absolute1 to absolute2) */}
                {renderAngleArc(
                  positions.joint1.x, positions.joint1.y,
                  fkResult.angles.absolute1,
                  fkResult.angles.absolute2,
                  40,
                  (angles.theta2 * 180 / Math.PI).toFixed(1),
                  'theta2'
                )}
              </>
            )}
            {/* Link 3 */}
            {showLink3 && (
              <>
                {(() => {
                  const theta3MidAngle = getArcMidAngle(fkResult.angles.absolute2, fkResult.angles.absolute3);
                  const labelPos3 = getLinkLabelPosition(
                    positions.joint2,
                    positions.joint3,
                    fkResult.angles.absolute3,
                    theta3MidAngle
                  );

                  return (
                    <Text
                      text={`${L3}mm`}
                      x={labelPos3.x}
                      y={labelPos3.y}
                      offsetX={20}
                      offsetY={8}
                      rotation={labelPos3.rotation}
                      fontSize={12}
                      fill="black"
                    />
                  );
                })()}
                <Line
                  points={[
                    positions.joint2.x, positions.joint2.y,
                    positions.joint3.x, positions.joint3.y
                  ]}
                  stroke="black"
                  strokeWidth={2}
                />
                {/* Angle arc for θ3 (at joint2, from absolute2 to absolute3) */}
                {renderAngleArc(
                  positions.joint2.x, positions.joint2.y,
                  fkResult.angles.absolute2,
                  fkResult.angles.absolute3,
                  40,
                  (angles.theta3 * 180 / Math.PI).toFixed(1),
                  'theta3'
                )}
              </>
            )}

            {/* Draw joints */}
            <Circle x={positions.base.x} y={positions.base.y} radius={4} fill="black" stroke="black" strokeWidth={2} />
            {showLink1 && <Circle x={positions.joint1.x} y={positions.joint1.y} radius={4} fill="black" stroke="black" strokeWidth={2} />}
            {showLink2 && <Circle x={positions.joint2.x} y={positions.joint2.y} radius={4} fill="black" stroke="black" strokeWidth={2} />}
            {showLink3 && <Circle x={positions.joint3.x} y={positions.joint3.y} radius={4} fill="black" stroke="black" strokeWidth={2} />}

            {/* Draw Animated Frame */}
            {renderAnimatedFrame()}
          </Layer>
        </Stage>
      </Box>
      {renderMatrixOverlay()}

      {/* Grid Toggle Control */}
      <Paper sx={{ position: 'absolute', bottom: 20, right: 20, bgcolor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(10px)', p: '10px 15px', borderRadius: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, fontSize: 14 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <FormControlLabel
            control={<Checkbox size="small" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />}
            label={<Typography variant="body2">Show Grid Lines</Typography>}
          />
        </Box>
      </Paper>

      {showSettings && (
        <Paper sx={{ position: 'absolute', left: 20, bottom: 72, p: 1.5, borderRadius: 2, zIndex: 12, minWidth: 180, bgcolor: 'rgba(255,255,255,0.95)', boxShadow: '0 6px 18px rgba(0,0,0,0.16)' }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Link Lengths (mm)</Typography>
          <Box sx={{ display: 'grid', gap:2 }}>
            {['L1', 'L2', 'L3'].map((key) => (
              <TextField
                key={key}
                size="small"
                type="number"
                label={key}
                inputProps={{ min: 1, step: 1 }}
                value={draftLinkLengths[key]}
                onChange={(e) => {
                  const raw = Number(e.target.value);
                  setDraftLinkLengths((prev) => ({
                    ...prev,
                    [key]: Number.isFinite(raw) ? raw : prev[key],
                  }));
                }}
              />
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mt: 1.2 }}>
            <Button
              size="small"
              variant="contained"
              onClick={() => {
                const sanitized = {
                  L1: Math.max(1, Number(draftLinkLengths.L1) || L1),
                  L2: Math.max(1, Number(draftLinkLengths.L2) || L2),
                  L3: Math.max(1, Number(draftLinkLengths.L3) || L3),
                };
                if (onLinkLengthsChange) {
                  onLinkLengthsChange(sanitized);
                }
                setShowSettings(false);
              }}
            >
              Apply
            </Button>
            <Button size="small" variant="outlined" color="warning" onClick={handleResetDefaults}>
              Reset Defaults
            </Button>
            <Button size="small" variant="outlined" onClick={() => setShowSettings(false)}>
              Close
            </Button>
          </Box>
        </Paper>
      )}

      <IconButton
        aria-label="settings"
        sx={{
          position: 'absolute',
          left: 20,
          bottom: 20,
          zIndex: 11,
          bgcolor: 'rgba(255,255,255,0.9)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          '&:hover': {
            bgcolor: '#ffffff',
          },
        }}
        onClick={() => setShowSettings((prev) => !prev)}
      >
        <SettingsIcon />
      </IconButton>
    </Box>
  );
};

export default Robot2d;