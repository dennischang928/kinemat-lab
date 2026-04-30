import { useState, useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import Robot2d from '../robot/robot2d';
import JointController from '../robot/JointController';
import FKProcessSelector from '../kinematics/FKProcessSelector';

const DEFAULT_ANGLES = {
  thetaBase: 0,
  theta1: Math.PI / 4,
  theta2: Math.PI / 6,
  theta3: -Math.PI / 3,
};

const DEFAULT_LINK_LENGTHS = { L1: 40, L2: 70, L3: 50 };

function KinematicsView() {
  const [leftPanelWidth, setLeftPanelWidth] = useState(40); // percentage
  const [jointControllerHeight, setJointControllerHeight] = useState(40); // percentage of left panel
  const isDraggingRef = useRef(false);
  const isDraggingJointDividerRef = useRef(false);

  // Load from localStorage or use defaults
  const [angles, setAngles] = useState(() => {
    const saved = localStorage.getItem('robotAngles');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved angles', e);
      }
    }
    return DEFAULT_ANGLES;
  });

  const [linkLengths, setLinkLengths] = useState(() => {
    const saved = localStorage.getItem('robotLinkLengths');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved link lengths', e);
      }
    }
    return DEFAULT_LINK_LENGTHS;
  });

  const [selectedStep, setSelectedStep] = useState(4); // 0-4, default to show all
  const [selectedJoint, setSelectedJoint] = useState(1); // 1, 2, or 3
  const [showFrameAnimation, setShowFrameAnimation] = useState(false);
  const isPlayAllActive = showFrameAnimation && selectedJoint === 0;

  // Save angles to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('robotAngles', JSON.stringify(angles));
  }, [angles]);

  // Save link lengths to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('robotLinkLengths', JSON.stringify(linkLengths));
  }, [linkLengths]);

  const handleStepChange = (step) => {
    if (step === 'play-all') {
      if (isPlayAllActive) {
        setShowFrameAnimation(false);
        return;
      }

      setSelectedStep(4);
      setSelectedJoint(0);
      setShowFrameAnimation(true);
      return;
    }

    if (isPlayAllActive) {
      return;
    }

    setSelectedStep(step);

    if (step >= 1) {
      const jointForStep = step === 4 ? 4 : step;
      setSelectedJoint(jointForStep);
      setShowFrameAnimation(true);
    } else {
      setShowFrameAnimation(false);
    }
  };

  const handleAngleChange = (joint, value) => {
    setAngles(prev => {
      const updated = {
        ...prev,
        [joint]: value
      };
      localStorage.setItem('robotAngles', JSON.stringify(updated));
      return updated;
    });
  };

  const handleResetAll = () => {
    setAngles(DEFAULT_ANGLES);
    setLinkLengths(DEFAULT_LINK_LENGTHS);
    localStorage.setItem('robotAngles', JSON.stringify(DEFAULT_ANGLES));
    localStorage.setItem('robotLinkLengths', JSON.stringify(DEFAULT_LINK_LENGTHS));
  };

  const handleMouseDown = () => {
    isDraggingRef.current = true;
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    
    const container = e.currentTarget;
    const newWidth = (e.clientX / container.clientWidth) * 100;
    
    if (newWidth >= 20 && newWidth <= 70) {
      setLeftPanelWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    isDraggingJointDividerRef.current = false;
  };

  const handleJointDividerMouseDown = () => {
    isDraggingJointDividerRef.current = true;
  };

  const handleJointDividerMouseMove = (e) => {
    if (!isDraggingJointDividerRef.current) return;
    
    const leftPanel = e.currentTarget;
    const newHeight = (e.clientY / leftPanel.clientHeight) * 100;
    
    if (newHeight >= 25 && newHeight <= 75) {
      setJointControllerHeight(newHeight);
    }
  };

  return (
    <Box 
      sx={{ width: '100%', height: '100%', m: 0, p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'row' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Left Panel */}
      <Box 
        sx={{ width: `${leftPanelWidth}%`, height: '100%', bgcolor: '#f5f5f5', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onMouseMove={handleJointDividerMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <Box sx={{ flex: jointControllerHeight, overflow: 'auto', minHeight: 0 }}>
          <JointController 
            angles={angles} 
            onAngleChange={handleAngleChange} 
            selectedJoint={selectedJoint}
            onJointChange={setSelectedJoint}
            showFrameAnimation={showFrameAnimation}
            onAnimationToggle={setShowFrameAnimation}
            onResetAll={handleResetAll}
          />
        </Box>
        
        {/* Joint Controller / FK Process Divider */}
        <Box
          onMouseDown={handleJointDividerMouseDown}
          sx={{
            height: '6px',
            width: '100%',
            bgcolor: '#ccc',
            cursor: 'row-resize',
            '&:hover': {
              bgcolor: '#999',
              transition: 'background-color 0.2s'
            },
            flexShrink: 0
          }}
        />
        
        <Box sx={{ flex: 100 - jointControllerHeight}}>
          <FKProcessSelector 
            angles={angles} 
            linkLengths={linkLengths}
            onStepChange={handleStepChange}
            isPlayAllActive={isPlayAllActive}
          />
          <Box sx={{ p: 1, borderTop: '1px solid #ddd', fontSize: '12px', color: '#999', textAlign: 'center' }}>
            💾 Settings saved to browser
          </Box>
        </Box>
      </Box>

      {/* Draggable Divider */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          width: '6px',
          height: '100%',
          bgcolor: '#ddd',
          cursor: 'col-resize',
          '&:hover': {
            bgcolor: '#999',
            transition: 'background-color 0.2s'
          },
          flexShrink: 0
        }}
      />

      {/* Right Panel */}
      <Box sx={{ width: `${100 - leftPanelWidth}%`, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <Robot2d 
            angles={angles} 
            onAngleChange={handleAngleChange} 
            linkLengths={linkLengths}
            onLinkLengthsChange={setLinkLengths}
            selectedStep={selectedStep} 
            selectedJoint={selectedJoint}
            showFrameAnimation={showFrameAnimation}
          />
        </Box>
      </Box>
    </Box>
  );
}

export default KinematicsView;
