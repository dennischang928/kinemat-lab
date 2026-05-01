import { useState } from 'react';
import { Box } from '@mui/material';
import Sidebar from '../components/common/Sidebar';
import ControlPanel from '../components/digitaltwin/ControlPanel';
import Settings from '../components/digitaltwin/Settings';
import URDFSceneViewport from '../components/digitaltwin/URDFSceneViewport';

function DigitalTwin() {
  const [activeSection, setActiveSection] = useState('control');

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
          <URDFSceneViewport />
        </Box>
      </Box>
    </Box>
  );
}

export default DigitalTwin;
