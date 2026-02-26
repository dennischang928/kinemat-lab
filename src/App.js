import { useState, useRef } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import Robot2d from './components/robot/robot2d';
import Robot3d from './components/robot/Robot3d';
import JointController from './components/robot/JointController';
import FKProcessSelector from './components/kinematics/FKProcessSelector';

function App() {
  const [viewMode, setViewMode] = useState('2D'); // '2D' or '3D'
  const [leftPanelWidth, setLeftPanelWidth] = useState(30); // percentage
  const [jointControllerHeight, setJointControllerHeight] = useState(40); // percentage of left panel
  const isDraggingRef = useRef(false);
  const isDraggingJointDividerRef = useRef(false);

  // Joint angles (in radians)
  const [angles, setAngles] = useState({
    thetaBase: 0,
    theta1: Math.PI / 4,
    theta2: Math.PI / 6,
    theta3: -Math.PI / 3
  });

  const [selectedStep, setSelectedStep] = useState(4); // 0-4, default to show all
  const [selectedJoint, setSelectedJoint] = useState(1); // 1, 2, or 3
  const [showFrameAnimation, setShowFrameAnimation] = useState(false);

  const handleStepChange = (step) => {
    setSelectedStep(step);
    if (step === 4) {
      setSelectedJoint(0); // 0 indicates "Play All"
      setShowFrameAnimation(true);
    } else if (step >= 1) {
      setSelectedJoint(step);
      setShowFrameAnimation(true);
    } else {
      setShowFrameAnimation(false);
    }
  };

  const handleAngleChange = (joint, value) => {
    setAngles(prev => ({
      ...prev,
      [joint]: value
    }));
  };

  const handleMouseDown = () => {
    isDraggingRef.current = true;
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    
    const container = e.currentTarget;
    const newWidth = (e.clientX / container.clientWidth) * 100;
    
    // Constrain width between 20% and 70%
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
    
    const leftPanel = e.currentTarget; // This will be the left panel
    const newHeight = (e.clientY / leftPanel.clientHeight) * 100;
    
    // Constrain height between 25% and 75%
    if (newHeight >= 25 && newHeight <= 75) {
      setJointControllerHeight(newHeight);
    }
  };

  return (
    <Box 
      sx={{ width: '100%', height: '100vh', m: 0, p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'row' }}
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
            viewMode={viewMode}
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
            linkLengths={{ L1: 40, L2: 70, L3: 50 }}
            onStepChange={handleStepChange}
          />
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
        <Box sx={{ bgcolor: '#282c34', px: '10px', pt: '10px' }}>
          <Tabs
            value={viewMode}
            onChange={(e, val) => setViewMode(val)}sa 
            sx={{
              minHeight: 0,
              '& .MuiTabs-indicator': { display: 'none' },
            }}
          >
            <Tab
              label="2D View"
              value="2D"
              sx={{
                minHeight: 0,
                py: '10px', px: '20px',
                borderTopLeftRadius: '8px',
                borderTopRightRadius: '8px',
                color: '#ccc',
                fontWeight: 'bold',
                textTransform: 'none',
                bgcolor: viewMode === '2D' ? 'white' : '#3a3f4a',
                '&.Mui-selected': { color: '#282c34' },
                '&:hover': { bgcolor: viewMode === '2D' ? 'white' : '#4a505e', color: viewMode === '2D' ? '#282c34' : 'white' },
                mr: '5px',
              }}
            />
            <Tab
              label="3D View"
              value="3D"
              sx={{
                minHeight: 0,
                py: '10px', px: '20px',
                borderTopLeftRadius: '8px',
                borderTopRightRadius: '8px',
                color: '#ccc',
                fontWeight: 'bold',
                textTransform: 'none',
                bgcolor: viewMode === '3D' ? 'white' : '#3a3f4a',
                '&.Mui-selected': { color: '#282c34' },
                '&:hover': { bgcolor: viewMode === '3D' ? 'white' : '#4a505e', color: viewMode === '3D' ? '#282c34' : 'white' },
              }}
            />
          </Tabs>
        </Box>
        <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {viewMode === '2D' ? (
            <Robot2d 
              angles={angles} 
              onAngleChange={handleAngleChange} 
              selectedStep={selectedStep} 
              selectedJoint={selectedJoint}
              showFrameAnimation={showFrameAnimation}
            />
          ) : (
            <Robot3d 
              angles={angles} 
              selectedStep={selectedStep} 
              selectedJoint={selectedJoint}
              showFrameAnimation={showFrameAnimation}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default App;
