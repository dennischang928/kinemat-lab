import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Text } from '@react-three/drei';
import * as THREE from 'three';
import { calculateForwardKinematics } from '../kinematics/forwardkinematics';
import './robot3d.css';

const Link3D = ({ start, end, radius = 0.2, color = "black" }) => {
  const { position, quaternion, length } = useMemo(() => {
    const startVec = new THREE.Vector3(...start);
    const endVec = new THREE.Vector3(...end);
    const dst = startVec.distanceTo(endVec);
    const pos = startVec.clone().lerp(endVec, 0.5);
    
    // Default cylinder points up (Y axis). We rotate it to point from start to end.
    const direction = endVec.clone().sub(startVec).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    
    return { position: pos, quaternion: quat, length: dst };
  }, [start, end]);

  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 16]} />
      <meshStandardMaterial color={color} roughness={0.3} metalness={0.8} />
    </mesh>
  );
};

const Joint3D = ({ position, radius = 0.35, color = "blue" }) => {
  return (
    <mesh position={position}>
      <sphereGeometry args={[radius, 32, 32]} />
      <meshStandardMaterial color={color} roughness={0.2} metalness={0.9} />
    </mesh>
  );
};

const Arrow3D = ({ dir, length = 1.5, color = "white", label }) => {
  const direction = new THREE.Vector3(...dir).normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const labelPos = direction.clone().multiplyScalar(length + 0.3);

  return (
    <group>
      <group quaternion={quaternion}>
        <mesh position={[0, length/2, 0]}>
          <cylinderGeometry args={[0.03, 0.03, length, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>
        <mesh position={[0, length, 0]}>
          <coneGeometry args={[0.1, 0.25, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>
      {label && (
        <Text position={labelPos.toArray()} fontSize={0.6} color={color} outlineWidth={0.05} outlineColor="black">
          {label}
        </Text>
      )}
    </group>
  );
};

const Robot3d = ({ angles, selectedStep = 4, selectedJoint = 1, showFrameAnimation = false }) => {
  const [animProgress, setAnimProgress] = useState(0);
  const animationRef = useRef(null);

  // 4 joints in 3D Play All: base yaw + 3 planar joints = 8 progress units (2 per joint)
  // Single joint: 2 progress units
  useEffect(() => {
    let startTime;
    const DURATION = selectedJoint === 0 ? 16000 : 4000; 
    const TOTAL_PROGRESS = selectedJoint === 0 ? 8 : 2;

    const animate = (time) => {
      if (!startTime) startTime = time;
      const elapsed = time - startTime;
      
      const progress = (elapsed % DURATION) / (DURATION / TOTAL_PROGRESS);
      setAnimProgress(progress);
      
      animationRef.current = requestAnimationFrame(animate);
    };

    if (showFrameAnimation) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      setAnimProgress(0);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [showFrameAnimation, selectedJoint, angles]);

  // Derive active joint and local progress for Play All mode
  const getActiveJointAndProgress = () => {
    if (selectedJoint !== 0) return { activeJoint: selectedJoint, localProgress: animProgress };
    // Play All: 0=base yaw, 1=J1, 2=J2, 3=J3
    if (animProgress <= 2) return { activeJoint: -1, localProgress: animProgress }; // base yaw
    if (animProgress <= 4) return { activeJoint: 1, localProgress: animProgress - 2 };
    if (animProgress <= 6) return { activeJoint: 2, localProgress: animProgress - 4 };
    return { activeJoint: 3, localProgress: animProgress - 6 };
  };

  // The arm always stays at the current thetaBase; only the arrows animate.
  const getAnimatedBaseYaw = () => {
    return angles.thetaBase || 0;
  };
  // Use scale 0.1 to convert mm (40, 70, 50) into 3D world units (4, 7, 5)
  const fkResult = calculateForwardKinematics(angles, {
    linkLengths: { L1: 40, L2: 70, L3: 50 },
    scale: 0.1,
    baseX: 0,
    baseY: 0,
  });

  // Convert 2D canvas coordinates (y is down) to 3D coordinates (Y is up, Z is 0)
  const to3D = (pos2d) => [pos2d.x, -pos2d.y, 0];

  const posBase = to3D(fkResult.base);
  const posJ1 = to3D(fkResult.joint1);
  const posJ2 = to3D(fkResult.joint2);
  const posJ3 = to3D(fkResult.joint3);

  const showLink1 = selectedStep >= 2;
  const showLink2 = selectedStep >= 3;
  const showLink3 = selectedStep >= 4;

  // Base yaw frame: rendered OUTSIDE the arm rotation group
  const renderBaseYawFrame = () => {
    if (!showFrameAnimation) return null;
    const { activeJoint, localProgress } = getActiveJointAndProgress();
    if (activeJoint !== -1) return null;

    const yawAngle = localProgress <= 1 
      ? (angles.thetaBase || 0) * localProgress 
      : (angles.thetaBase || 0);
    return (
      <group position={[0, 0, 0]} rotation={[0, yawAngle, 0]}>
        <Arrow3D dir={[1, 0, 0]} length={2.5} color="rgb(255, 50, 50)" label="X" />
        <Arrow3D dir={[0, 1, 0]} length={2.5} color="rgb(50, 200, 50)" label="Y" />
        <Arrow3D dir={[0, 0, 1]} length={2.5} color="rgb(50, 100, 255)" label="Z" />
      </group>
    );
  };

  // Planar joint frames: rendered INSIDE the arm rotation group
  const renderAnimatedFrame3D = () => {
    if (!showFrameAnimation) return null;

    const { activeJoint, localProgress } = getActiveJointAndProgress();

    // Skip base yaw phase (handled separately outside the group)
    if (activeJoint === -1) return null;

    let startPos, startAngle, targetAngle, targetLength;

    if (activeJoint === 1 && showLink1) {
      startPos = posBase; 
      startAngle = 0; 
      targetAngle = fkResult.angles.absolute1; 
      targetLength = 4;
    } else if (activeJoint === 2 && showLink2) {
      startPos = posJ1; 
      startAngle = fkResult.angles.absolute1; 
      targetAngle = fkResult.angles.absolute2; 
      targetLength = 7;
    } else if (activeJoint === 3 && showLink3) {
      startPos = posJ2; 
      startAngle = fkResult.angles.absolute2; 
      targetAngle = fkResult.angles.absolute3; 
      targetLength = 5;
    } else {
      return null;
    }

    let currentAngle = startAngle;
    let currentDist = 0;

    if (localProgress <= 1) {
      currentAngle = startAngle + (targetAngle - startAngle) * localProgress;
    } else {
      currentAngle = targetAngle;
      const translateProgress = localProgress - 1;
      currentDist = targetLength * translateProgress;
    }

    const currentX = startPos[0] + currentDist * Math.cos(currentAngle);
    const currentY = startPos[1] + currentDist * Math.sin(currentAngle);
    const currentZ = 0;

    return (
      <group position={[currentX, currentY, currentZ]} rotation={[0, 0, currentAngle]}>
        <Arrow3D dir={[1, 0, 0]} length={2.5} color="rgb(255, 50, 50)" label="X" />
        <Arrow3D dir={[0, 1, 0]} length={2.5} color="rgb(50, 200, 50)" label="Y" />
        <Arrow3D dir={[0, 0, 1]} length={2.5} color="rgb(50, 100, 255)" label="Z" />
      </group>
    );
  };

  const renderMatrixOverlay = () => {
    if (!showFrameAnimation) return null;

    const { activeJoint, localProgress } = getActiveJointAndProgress();

    // Base yaw phase: show a simple label instead of the full homogeneous matrix
    if (activeJoint === -1) {
      const isRotationPhase = localProgress <= 1;
      const yawDeg = ((angles.thetaBase || 0) * 180 / Math.PI).toFixed(1);
      return (
        <div className="matrix-overlay">
          <div className="matrix-content">
            <h4>Base Yaw Rotation (Y-Axis)</h4>
            <p style={{ color: isRotationPhase ? '#0055ff' : '#999', fontWeight: isRotationPhase ? 'bold' : 'normal', fontSize: '16px' }}>
              θ<sub>0</sub> = {yawDeg}°
            </p>
            <p style={{ color: '#aaa', fontSize: '12px' }}>Rotating entire arm around Y-axis</p>
          </div>
        </div>
      );
    }

    const isRotationPhase = localProgress <= 1;
    const isTranslationPhase = localProgress > 1;

    let targetLength, theta_n;
    if (activeJoint === 1 && showLink1) {
      targetLength = 40;
      theta_n = angles.theta1;
    } else if (activeJoint === 2 && showLink2) {
      targetLength = 70;
      theta_n = angles.theta2;
    } else if (activeJoint === 3 && showLink3) {
      targetLength = 50;
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
      <div className="matrix-overlay">
        <div className="matrix-content">
          <h4>Homogeneous Transformation Matrix</h4>
          
          <div className="matrix-row" style={{ alignItems: 'center' }}>
            {/* Symbolic Matrix */}
            <span className="matrix-bracket" style={{ fontSize: '60px' }}>[</span>
            <div className="matrix-values">
              <div className="matrix-value-row">
                <span className="matrix-value" style={{ width: '80px', ...rotationStyle }}>cos({thetaLabel})</span>
                <span className="matrix-value" style={{ width: '80px', ...rotationStyle }}>-sin({thetaLabel})</span>
                <span className="matrix-value" style={{ width: '40px', textAlign: 'center', ...translationStyle }}>{LLabel}</span>
              </div>
              <div className="matrix-value-row">
                <span className="matrix-value" style={{ width: '80px', ...rotationStyle }}>sin({thetaLabel})</span>
                <span className="matrix-value" style={{ width: '80px', ...rotationStyle }}>cos({thetaLabel})</span>
                <span className="matrix-value" style={{ width: '40px', textAlign: 'center', ...translationStyle }}>0</span>
              </div>
              <div className="matrix-value-row">
                <span className="matrix-value" style={{ width: '80px', ...constantStyle, textAlign: 'center' }}>0</span>
                <span className="matrix-value" style={{ width: '80px', ...constantStyle, textAlign: 'center' }}>0</span>
                <span className="matrix-value" style={{ width: '40px', textAlign: 'center', ...constantStyle }}>1</span>
              </div>
            </div>
            <span className="matrix-bracket" style={{ fontSize: '60px' }}>]</span>
            
            <span style={{ margin: '0 10px', fontSize: '20px' }}>=</span>

            {/* Evaluated Matrix */}
            <span className="matrix-bracket" style={{ fontSize: '60px' }}>[</span>
            <div className="matrix-values">
              <div className="matrix-value-row">
                <span className="matrix-value" style={{ width: '70px', ...rotationStyle }}>{cosVal}</span>
                <span className="matrix-value" style={{ width: '70px', ...rotationStyle }}>{finalNegSinVal}</span>
                <span className="matrix-value" style={{ width: '50px', ...translationStyle }}>{targetLength}</span>
              </div>
              <div className="matrix-value-row">
                <span className="matrix-value" style={{ width: '70px', ...rotationStyle }}>{sinVal}</span>
                <span className="matrix-value" style={{ width: '70px', ...rotationStyle }}>{cosVal}</span>
                <span className="matrix-value" style={{ width: '50px', ...translationStyle }}>0</span>
              </div>
              <div className="matrix-value-row">
                <span className="matrix-value" style={{ width: '70px', ...constantStyle, textAlign: 'center' }}>0</span>
                <span className="matrix-value" style={{ width: '70px', ...constantStyle, textAlign: 'center' }}>0</span>
                <span className="matrix-value" style={{ width: '50px', textAlign: 'center', ...constantStyle }}>1</span>
              </div>
            </div>
            <span className="matrix-bracket" style={{ fontSize: '60px' }}>]</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="robot3d-container">
      <Canvas camera={{ position: [0, 0, 20], fov: 45 }}>
        {/* Environment */}
        <color attach="background" args={['#FFFFFF']} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 20, 15]} intensity={1} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        
        <Grid 
          infiniteGrid 
          fadeDistance={50} 
          sectionColor="#333333" 
          cellColor="#222222" 
          position={[0, -2, 0]} // Drop grid slightly below origin
          rotation={[Math.PI / 2, 0, 0]}
        />
        <axesHelper args={[5]} />
        <OrbitControls makeDefault />

        <group rotation={[0, getAnimatedBaseYaw(), 0]}>
          {/* Base Joint - Highlighted Blue */}
          <Joint3D position={posBase} color="#2196f3" />
          
          {/* Base Pedestal */}
          <mesh position={[0, -1, 0]}>
            <cylinderGeometry args={[1, 1.2, 2, 32]} />
            <meshStandardMaterial color="#333333" roughness={0.5} />
          </mesh>

          {/* Link 1 & Joint 1 */}
          {showLink1 && (
            <group>
              <Link3D start={posBase} end={posJ1} color="#ffffff" />
              <Joint3D position={posJ1} color="#ffffff" />
              <Text position={[posJ1[0], posJ1[1] + 1, posJ1[2]]} fontSize={0.8} color="white">J1</Text>
            </group>
          )}

          {/* Link 2 & Joint 2 */}
          {showLink2 && (
            <group>
              <Link3D start={posJ1} end={posJ2} color="#ffffff" />
              <Joint3D position={posJ2} color="#ffffff" />
              <Text position={[posJ2[0], posJ2[1] + 1, posJ2[2]]} fontSize={0.8} color="white">J2</Text>
            </group>
          )}

          {/* Link 3 & Joint 3 */}
          {showLink3 && (
            <group>
              <Link3D start={posJ2} end={posJ3} color="#ffffff" />
              <Joint3D position={posJ3} color="#ffffff" />
              <Text position={[posJ3[0], posJ3[1] + 1, posJ3[2]]} fontSize={0.8} color="white">End</Text>
            </group>
          )}

          {/* Animated Coordinate Frame (planar joints) */}
          {renderAnimatedFrame3D()}
        </group>

        {/* Base Yaw Coordinate Frame (outside rotation group) */}
        {renderBaseYawFrame()}
      </Canvas>
      
      {/* Absolute Overlays */}
      {renderMatrixOverlay()}
    </div>
  );
};

export default Robot3d;
