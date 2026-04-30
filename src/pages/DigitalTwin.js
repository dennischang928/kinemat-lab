import { useState } from 'react';
import { Box } from '@mui/material';
import Sidebar from '../components/common/Sidebar';
import ControlPanel from '../components/digitaltwin/ControlPanel';
import Settings from '../components/digitaltwin/Settings';
import Robot2d from '../components/robot/robot2d';

const DEFAULT_ANGLES = {
  thetaBase: 0,
  theta1: Math.PI / 4,
  theta2: Math.PI / 6,
  theta3: -Math.PI / 3,
};

const DEFAULT_LINK_LENGTHS = { L1: 40, L2: 70, L3: 50 };

function DigitalTwin() {
  const [activeSection, setActiveSection] = useState('control');
  const [angles, setAngles] = useState(DEFAULT_ANGLES);
  const [linkLengths, setLinkLengths] = useState(DEFAULT_LINK_LENGTHS);

  const handleAngleChange = (joint, value) => {
    setAngles(prev => ({
      ...prev,
      [joint]: value
    }));
  };

  return (
    <Box sx={{ display: 'flex', width: '100%', height: '100vh', bgcolor: '#f5f5f5' }}>
      {/* Fixed Left Sidebar */}
      <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />

      {/* Main Content Area */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Control Panel / Settings */}
        <Box
          sx={{
            width: '350px',
            height: '100%',
            overflow: 'auto',
            bgcolor: 'white',
            borderRight: '1px solid #ddd',
            flexShrink: 0,
          }}
        >
          <Box sx={{ display: activeSection === 'control' ? 'block' : 'none', height: '100%' }}>
            <ControlPanel />
          </Box>
          <Box sx={{ display: activeSection === 'settings' ? 'block' : 'none', height: '100%' }}>
            <Settings />
          </Box>
        </Box>

        {/* Digital Twin Visualization */}
        <Box
          sx={{
            flex: 1,
            height: '100%',
            position: 'relative',
            overflow: 'hidden',
            bgcolor: 'white',
          }}
        >
          <Robot2d
            angles={angles}
            onAngleChange={handleAngleChange}
            linkLengths={linkLengths}
            onLinkLengthsChange={setLinkLengths}
            selectedStep={4}
            selectedJoint={0}
            showFrameAnimation={false}
          />
        </Box>
      </Box>
    </Box>
  );
}

export default DigitalTwin;
