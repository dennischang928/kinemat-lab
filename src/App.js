import { useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import Robot2d from './components/robot/robot2d';
import Robot3d from './components/robot/Robot3d';
import JointController from './components/robot/JointController';
import FKProcessSelector from './components/kinematics/FKProcessSelector';

function App() {
  const [viewMode, setViewMode] = useState('2D'); // '2D' or '3D'

  // Joint angles (in radians)
  const [angles, setAngles] = useState({
    thetaBase: 0,
    theta1: Math.PI / 4,
    theta2: Math.PI / 6,
    theta3: -Math.PI / 3
  });

  const [selectedStep, setSelectedStep] = useState(5); // 1-4, default to show all
  const [selectedJoint, setSelectedJoint] = useState(1); // 1, 2, or 3
  const [showFrameAnimation, setShowFrameAnimation] = useState(false);

  const handleStepChange = (step) => {
    setSelectedStep(step);
    if (step === 5) {
      setSelectedJoint(0); // 0 indicates "Play All"
      setShowFrameAnimation(true);
    } else if (step > 1) {
      setSelectedJoint(step - 1);
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

  return (
    <Box sx={{ width: '100%', height: '100vh', m: 0, p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'row' }}>
      {/* Left Panel */}
      <Box sx={{ width: '40%', height: '100%', bgcolor: '#f5f5f5', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <JointController 
          angles={angles} 
          onAngleChange={handleAngleChange} 
          selectedJoint={selectedJoint}
          onJointChange={setSelectedJoint}
          showFrameAnimation={showFrameAnimation}
          onAnimationToggle={setShowFrameAnimation}
          viewMode={viewMode}
        />
        <FKProcessSelector 
          angles={angles} 
          linkLengths={{ L1: 40, L2: 70, L3: 50 }}
          onStepChange={handleStepChange}
        />
      </Box>
      {/* Right Panel */}
      <Box sx={{ width: '60%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ bgcolor: '#282c34', px: '10px', pt: '10px' }}>
          <Tabs
            value={viewMode}
            onChange={(e, val) => setViewMode(val)}
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
