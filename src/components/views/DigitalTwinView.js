import { useState, useRef } from 'react';
import { Box } from '@mui/material';
import ControlPanel from '../digitaltwin/ControlPanel';
import Settings from '../digitaltwin/Settings';
import Robot2d from '../robot/robot2d';

const DEFAULT_ANGLES = {
  thetaBase: 0,
  theta1: Math.PI / 4,
  theta2: Math.PI / 6,
  theta3: -Math.PI / 3,
};

const DEFAULT_LINK_LENGTHS = { L1: 40, L2: 70, L3: 50 };

function DigitalTwinView({ activeSection = 'control', onSectionChange = () => {} }) {
  const [leftPanelWidth, setLeftPanelWidth] = useState(25); // percentage
  const isDraggingRef = useRef(false);
  const [angles, setAngles] = useState(DEFAULT_ANGLES);
  const [linkLengths, setLinkLengths] = useState(DEFAULT_LINK_LENGTHS);

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
    
    if (newWidth >= 20 && newWidth <= 70) {
      setLeftPanelWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
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
      >
        <Box sx={{ p: 2, borderBottom: '1px solid #ddd', flexShrink: 0 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Box
              onClick={() => onSectionChange('control')}
              sx={{
                flex: 1,
                p: 1,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: activeSection === 'control' ? '#282c34' : '#f0f0f0',
                color: activeSection === 'control' ? 'white' : '#333',
                borderRadius: '4px',
                fontWeight: activeSection === 'control' ? 600 : 400,
                fontSize: '0.9rem',
              }}
            >
              Control
            </Box>
            <Box
              onClick={() => onSectionChange('settings')}
              sx={{
                flex: 1,
                p: 1,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: activeSection === 'settings' ? '#282c34' : '#f0f0f0',
                color: activeSection === 'settings' ? 'white' : '#333',
                borderRadius: '4px',
                fontWeight: activeSection === 'settings' ? 600 : 400,
                fontSize: '0.9rem',
              }}
            >
              Settings
            </Box>
          </Box>
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <Box sx={{ display: activeSection === 'control' ? 'block' : 'none', height: '100%' }}>
            <ControlPanel />
          </Box>
          <Box sx={{ display: activeSection === 'settings' ? 'block' : 'none', height: '100%' }}>
            <Settings />
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
      <Box
        sx={{
          width: `${100 - leftPanelWidth}%`,
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
  );
}

export default DigitalTwinView;
