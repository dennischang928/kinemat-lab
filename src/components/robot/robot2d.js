import React, { useState, useEffect, useRef } from "react";
import { Stage, Layer, Circle, Line, Text, Group, Arrow } from 'react-konva';
import { Box, Paper, FormControlLabel, Checkbox, Typography } from '@mui/material';
import { calculateForwardKinematics } from '../kinematics/forwardkinematics';

const Robot2d = ({ angles, onAngleChange, selectedStep = 4, selectedJoint = 1, showFrameAnimation = false }) => {
  // Link lengths in mm
  const L1 = 40;  // mm
  const L2 = 70;  // mm
  const L3 = 50;  // mm

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
  const [showProjections, setShowProjections] = useState(false);
  const animationRef = useRef(null);

  useEffect(() => {
    let startTime;
    // 4 seconds per joint, so 12 seconds for the full sequence if selectedJoint === 0
    const DURATION = selectedJoint === 0 ? 12000 : 4000; 

    const animate = (time) => {
      if (!startTime) startTime = time;
      const elapsed = time - startTime;
      
      if (selectedJoint === 0) {
        // Full sequence: 0 to 6 total progress
        const totalProgress = (elapsed % DURATION) / (DURATION / 6);
        setAnimProgress(totalProgress);
      } else {
        // Calculate progress from 0 to 2 for single joint
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
      if (stageRef.current) {
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

  // Generate grid lines and labels
  const generateGrid = () => {
    const gridLines = [];
    const gridLabels = [];
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    // Vertical grid lines and labels
    for (let x = 0; x < dimensions.width; x += GRID_SIZE_PX) {
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
      if (x % (GRID_SIZE_PX * 2) === 0 && mmDistance !== -4) {
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
    for (let y = 0; y < dimensions.height; y += GRID_SIZE_PX) {
      const isOriginLine = Math.abs(y - centerY) < 0.5;
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
      if (y % (GRID_SIZE_PX * 2) === 0 && mmDistance !== -4) {
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
        strokeWidth={1.3  }
        dash={[10, 10]}
      />
    );
    gridLines.push(
      <Line
        key="y-axis"
        points={[centerX, 0, centerX, dimensions.height]}
        stroke="#000"
        strokeWidth={1.3  }
        dash={[10, 10]}
      />
    );

    return [...gridLines, ...gridLabels];
  };

  const renderAnimatedFrame = () => {
    if (!showFrameAnimation) return null;

    let activeJoint = selectedJoint;
    let localProgress = animProgress;

    // Sub-divide the progress if playing all
    if (selectedJoint === 0) {
      if (animProgress <= 2) {
        activeJoint = 1;
        localProgress = animProgress; // 0 to 2
      } else if (animProgress <= 4) {
        activeJoint = 2;
        localProgress = animProgress - 2; // 0 to 2
      } else {
        activeJoint = 3;
        localProgress = animProgress - 4; // 0 to 2
      }
    }

    let startPos, startAngle, targetAngle, targetLength;

    if (activeJoint === 1 && showLink1) {
      startPos = positions.base;
      startAngle = 0;
      targetAngle = fkResult.angles.absolute1;
      targetLength = L1 * SCALE;
    } else if (activeJoint === 2 && showLink2) {
      startPos = positions.joint1;
      startAngle = fkResult.angles.absolute1;
      targetAngle = fkResult.angles.absolute2;
      targetLength = L2 * SCALE;
    } else if (activeJoint === 3 && showLink3) {
      startPos = positions.joint2;
      startAngle = fkResult.angles.absolute2;
      targetAngle = fkResult.angles.absolute3;
      targetLength = L3 * SCALE;
    } else {
      return null;
    }

    // Progress calculation
    let currentAngle = startAngle;
    let currentDist = 0;

    if (localProgress <= 1) {
      // Rotation phase: interpolate angle
      currentAngle = startAngle + (targetAngle - startAngle) * localProgress;
    } else {
      // Translation phase: rotate fully, translate along X
      currentAngle = targetAngle;
      const translateProgress = localProgress - 1;
      currentDist = targetLength * translateProgress;
    }

    // Calculate current absolute position
    const currentX = startPos.x + currentDist * Math.cos(currentAngle);
    const currentY = startPos.y - currentDist * Math.sin(currentAngle);

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
        <Text text="X" x={axisLength + 5} y={-8} fill="red" fontSize={14} fontFamily="monospace" fontStyle="bold" />
        
        {/* Y axis (j-hat) */}
        <Arrow 
          points={[0, 0, 0, -axisLength]} 
          stroke="rgb(50, 200, 50)" 
          fill="rgb(50, 200, 50)"
          strokeWidth={3} 
          pointerLength={5}
          pointerWidth={5}
        />
        <Text text="Y" x={-8} y={-axisLength - 20} fill="green" fontSize={14} fontFamily="monospace" fontStyle="bold" />
      </Group>
    );
  };

  const renderMatrixOverlay = () => {
    if (!showFrameAnimation) return null;

    let activeJoint = selectedJoint;
    let localProgress = animProgress;

    if (selectedJoint === 0) {
      if (animProgress <= 2) {
        activeJoint = 1;
        localProgress = animProgress;
      } else if (animProgress <= 4) {
        activeJoint = 2;
        localProgress = animProgress - 2;
      } else {
        activeJoint = 3;
        localProgress = animProgress - 4;
      }
    }

    const isRotationPhase = localProgress <= 1;
    const isTranslationPhase = localProgress > 1;

    let targetLength, theta_n;
    if (activeJoint === 1 && showLink1) {
      targetLength = L1;
      theta_n = angles.theta1;
    } else if (activeJoint === 2 && showLink2) {
      targetLength = L2;
      theta_n = angles.theta2;
    } else if (activeJoint === 3 && showLink3) {
      targetLength = L3;
      theta_n = angles.theta3;
    } else {
      return null;
    }

    const formatNegZero = (val) => (Math.abs(val) < 0.001 ? "0.00" : val.toFixed(2));

    const deg = (theta_n * 180 / Math.PI).toFixed(1);
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
      <Stage 
        ref={stageRef}
        draggable={true}
        width={dimensions.width} 
        height={dimensions.height}
        scaleX={zoom}
        scaleY={zoom}
        offsetX={(dimensions.width / 2) * (1 - 1/zoom) - position.x / zoom}
        offsetY={(dimensions.height / 2) * (1 - 1/zoom) - position.y / zoom}
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

            {/* Draw links */}
            {/* Link 1 */}
            {showLink1 && (
              <>
                <Line
                  points={[
                    positions.base.x, positions.base.y,
                    positions.joint1.x, positions.joint1.y
                  ]}
                  stroke="black"
                  strokeWidth={2}
                />
                {/* Link 1 - Dashed projections */}
                {showProjections && (
                  <>
                    <Line
                      points={[
                        positions.base.x, positions.base.y,
                        positions.joint1.x, positions.base.y
                      ]}
                      stroke="blue"
                      strokeWidth={1}
                      dash={[5, 5]}
                    />
                    <Line
                      points={[
                        positions.joint1.x, positions.base.y,
                        positions.joint1.x, positions.joint1.y
                      ]}
                      stroke="blue"
                      strokeWidth={1}
                      dash={[5, 5]}
                    />
                  </>
                )}
                {/* Link 1 angle marker */}
                <Text
                  text={`θ1: ${(angles.theta1 * 180 / Math.PI).toFixed(1)}°`}
                  x={positions.base.x + 20}
                  y={positions.base.y - 20}
                  fontSize={11}
                  fill="blue"
                />
                <Text
                  text={`L1: ${L1}mm`}
                  x={(positions.base.x + positions.joint1.x) / 2}
                  y={(positions.base.y + positions.joint1.y) / 2}
                  offsetX={25}
                  offsetY={15}
                  rotation={-fkResult.angles.absolute1 * 180 / Math.PI}
                  fontSize={12}
                  fill="darkblue"
                />
              </>
            )}
            {/* Link 2 */}
            {showLink2 && (
              <>
                <Line
                  points={[
                    positions.joint1.x, positions.joint1.y,
                    positions.joint2.x, positions.joint2.y
                  ]}
                  stroke="black"
                  strokeWidth={2}
                />
                {/* Link 2 - Dashed projections */}
                {showProjections && (
                  <>
                    <Line
                      points={[
                        positions.joint1.x, positions.joint1.y,
                        positions.joint2.x, positions.joint1.y
                      ]}
                      stroke="green"
                      strokeWidth={1}
                      dash={[5, 5]}
                    />
                    <Line
                      points={[
                        positions.joint2.x, positions.joint1.y,
                        positions.joint2.x, positions.joint2.y
                      ]}
                      stroke="green"
                      strokeWidth={1}
                      dash={[5, 5]}
                    />
                  </>
                )}
                {/* Link 2 angle marker */}
                <Text
                  text={`θ2: ${(angles.theta2 * 180 / Math.PI).toFixed(1)}°`}
                  x={positions.joint1.x + 20}
                  y={positions.joint1.y - 20}
                  fontSize={11}
                  fill="green"
                />
                <Text
                  text={`L2: ${L2}mm`}
                  x={(positions.joint1.x + positions.joint2.x) / 2}
                  y={(positions.joint1.y + positions.joint2.y) / 2}
                  offsetX={25}
                  offsetY={15}
                  rotation={-fkResult.angles.absolute2 * 180 / Math.PI}
                  fontSize={12}
                  fill="darkblue"
                />
              </>
            )}
            {/* Link 3 */}
            {showLink3 && (
              <>
                <Line
                  points={[
                    positions.joint2.x, positions.joint2.y,
                    positions.joint3.x, positions.joint3.y
                  ]}
                  stroke="black"
                  strokeWidth={2}
                />
                {/* Link 3 - Dashed projections */}
                {showProjections && (
                  <>
                    <Line
                      points={[
                        positions.joint2.x, positions.joint2.y,
                        positions.joint3.x, positions.joint2.y
                      ]}
                      stroke="red"
                      strokeWidth={1}
                      dash={[5, 5]}
                    />
                    <Line
                      points={[
                        positions.joint3.x, positions.joint2.y,
                        positions.joint3.x, positions.joint3.y
                      ]}
                      stroke="red"
                      strokeWidth={1}
                      dash={[5, 5]}
                    />
                  </>
                )}
                {/* Link 3 angle marker */}
                <Text
                  text={`θ3: ${(angles.theta3 * 180 / Math.PI).toFixed(1)}°`}
                  x={positions.joint2.x + 20}
                  y={positions.joint2.y - 20}
                  fontSize={11}
                  fill="red"
                />
                <Text
                  text={`L3: ${L3}mm`}
                  x={(positions.joint2.x + positions.joint3.x) / 2}
                  y={(positions.joint2.y + positions.joint3.y) / 2}
                  offsetX={25}
                  offsetY={15}
                  rotation={-fkResult.angles.absolute3 * 180 / Math.PI}
                  fontSize={12}
                  fill="darkblue"
                />
              </>
            )}

            {/* Draw joints */}
            <Circle x={positions.base.x} y={positions.base.y} radius={8} fill="blue" />
            {showLink1 && <Circle x={positions.joint1.x} y={positions.joint1.y} radius={7} fill="red" />}
            {showLink2 && <Circle x={positions.joint2.x} y={positions.joint2.y} radius={7} fill="red" />}
            {showLink3 && <Circle x={positions.joint3.x} y={positions.joint3.y} radius={7} fill="green" />}
            
            {/* Draw Animated Frame */}
            {renderAnimatedFrame()}
          </Layer>
        </Stage>
        {renderMatrixOverlay()}

        {/* Grid Toggle Control */}
        <Paper sx={{ position: 'absolute', bottom: 20, right: 20, bgcolor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(10px)', p: '10px 15px', borderRadius: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, fontSize: 14 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <FormControlLabel
              control={<Checkbox size="small" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />}
              label={<Typography variant="body2">Show Grid Lines</Typography>}
            />
            <FormControlLabel
              control={<Checkbox size="small" checked={showProjections} onChange={(e) => setShowProjections(e.target.checked)} />}
              label={<Typography variant="body2">Show Joint Projections</Typography>}
            />
          </Box>
        </Paper>
      </Box>
    );
};

export default Robot2d;