import { useState, useRef, useEffect } from 'react';
import { Box, Paper, Stack, LinearProgress, IconButton, Menu, MenuItem, Tooltip } from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import TuneIcon from '@mui/icons-material/Tune';
import HomeIcon from '@mui/icons-material/Home';
import PowerIcon from '@mui/icons-material/Power';
import PowerOffIcon from '@mui/icons-material/PowerOff';
import ControlPanel from '../digitaltwin/ControlPanel';
import PoseControl from '../digitaltwin/PoseControl';
import Settings from '../digitaltwin/Settings';
import URDFSceneViewport from '../digitaltwin/URDFSceneViewport';
import { useSerialConnection } from '../../hooks/useSerialConnection';

const STEP_MAX = 1023;
const DEG_PER_STEP = 0.29;
const ANGLE_MAX = parseFloat((STEP_MAX * DEG_PER_STEP).toFixed(2));
const DEFAULT_JOINTS = { J1: ANGLE_MAX / 2, J2: ANGLE_MAX / 2, J3: ANGLE_MAX / 2, J4: ANGLE_MAX / 2, J5: ANGLE_MAX / 2 };

function DigitalTwinView({ activeSection = 'control', onSectionChange = () => { } }) {
  const [leftPanelWidth, setLeftPanelWidth] = useState(30); // percentage
  const [jointTargets, setJointTargets] = useState(DEFAULT_JOINTS);
  const [interpolationPlan, setInterpolationPlan] = useState([]);
  const isDraggingRef = useRef(false);
  const poseControlRef = useRef(null);
  const connection = useSerialConnection();
  const [baudRate, setBaudRate] = useState(115200);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [baudMenuAnchorEl, setBaudMenuAnchorEl] = useState(null);
  const [autoSyncTrigger, setAutoSyncTrigger] = useState(0);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const port = await connection.requestPort();
      if (port) {
        const success = await connection.connect(port, baudRate);
        if (success) {
          connection.setSelectedPort(port);
        }
      }
    } catch (err) {
      connection.setError(`Connection failed: ${err.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await connection.disconnect();
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleOpenBaudMenu = (event) => {
    setBaudMenuAnchorEl(event.currentTarget);
  };

  const handleCloseBaudMenu = () => {
    setBaudMenuAnchorEl(null);
  };

  const handleSelectBaudRate = (rate) => {
    setBaudRate(rate);
    handleCloseBaudMenu();
  };

  const isConnectionProgressLoading = isConnecting || isDisconnecting;

  useEffect(() => {
    if (!connection) return;
    let t = null;
    if (connection.isConnected) {
      t = setTimeout(() => setAutoSyncTrigger((c) => c + 1), 7000);
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [connection && connection.isConnected]);

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
        <Paper
          sx={{
            m: 2,
            mb: 1,
            p: 1.5,
            bgcolor: connection.isConnected ? '#e8f5e9' : '#ffebee',
            border: `1px solid ${connection.isConnected ? '#4caf50' : '#f44336'}`,
            borderRadius: 2,
            flexShrink: 0,
          }}
        >
          <Stack spacing={1.25}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LinearProgress
                variant={isConnectionProgressLoading ? 'indeterminate' : 'determinate'}
                value={isConnectionProgressLoading ? undefined : 100}
                sx={{
                  flex: 1,
                  height: 10,
                  borderRadius: 999,
                  backgroundColor: isConnectionProgressLoading
                    ? '#e0e0e0'
                    : connection.isConnected
                      ? '#c8e6c9'
                      : '#ffcdd2',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 999,
                    backgroundColor: isConnectionProgressLoading
                      ? '#1976d2'
                      : connection.isConnected
                        ? '#4caf50'
                        : '#f44336',
                  },
                }}
              />
              <IconButton
                onClick={handleConnect}
                disabled={connection.isConnected || isConnecting || isDisconnecting}
                sx={{ color: '#4caf50' }}
                size="large"
                aria-label="connect"
              >
                <LinkIcon />
              </IconButton>
              <IconButton
                onClick={handleDisconnect}
                disabled={!connection.isConnected || isConnecting || isDisconnecting}
                sx={{ color: '#f44336' }}
                size="large"
                aria-label="disconnect"
              >
                <LinkOffIcon />
              </IconButton>
              <IconButton
                onClick={handleOpenBaudMenu}
                disabled={isConnecting || isDisconnecting}
                size="large"
                aria-label="baud-rate-settings"
              >
                <TuneIcon />
              </IconButton>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
              <Tooltip title="Homing sequence" arrow>
                <IconButton
                  onClick={async () => { if (!connection.isConnected) return connection.setError('Connect to a serial port before sending commands.'); await connection.sendCommandWithTimeout('M140\n'); }}
                  size="large"
                  color="primary"
                  aria-label="home"
                  disabled={!connection.isConnected}
                >
                  <HomeIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Torque on" arrow>
                <IconButton
                  onClick={async () => { if (!connection.isConnected) return connection.setError('Connect to a serial port before sending commands.'); const ok = await connection.sendCommandWithTimeout('M17\n'); if (ok) connection.setIsTorqueEnabled && connection.setIsTorqueEnabled(true); }}
                  size="large"
                  color="primary"
                  aria-label="power-on"
                  disabled={!connection.isConnected}
                >
                  <PowerIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Torque off" arrow>
                <IconButton
                  onClick={async () => { if (!connection.isConnected) return connection.setError('Connect to a serial port before sending commands.'); const ok = await connection.sendCommandWithTimeout('M18\n'); if (ok) connection.setIsTorqueEnabled && connection.setIsTorqueEnabled(false); }}
                  size="large"
                  aria-label="power-off"
                  disabled={!connection.isConnected}
                  sx={{ color: '#f44336' }}
                >
                  <PowerOffIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Stack>
        </Paper>
        <Menu
          anchorEl={baudMenuAnchorEl}
          open={Boolean(baudMenuAnchorEl)}
          onClose={handleCloseBaudMenu}
        >
          {[9600, 14400, 19200, 38400, 57600, 115200, 230400, 460800, 921600].map((rate) => (
            <MenuItem
              key={rate}
              selected={baudRate === rate}
              onClick={() => handleSelectBaudRate(rate)}
            >
              {rate}
            </MenuItem>
          ))}
        </Menu>

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
              onClick={() => onSectionChange('pose')}
              sx={{
                flex: 1,
                p: 1,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: activeSection === 'pose' ? '#282c34' : '#f0f0f0',
                color: activeSection === 'pose' ? 'white' : '#333',
                borderRadius: '4px',
                fontWeight: activeSection === 'pose' ? 600 : 400,
                fontSize: '0.9rem',
              }}
            >
              Pose Control
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
            <ControlPanel
              jointTargets={jointTargets}
              setJointTargets={setJointTargets}
              connection={connection}
              autoSyncTrigger={autoSyncTrigger}
            />
          </Box>
          <Box sx={{ display: activeSection === 'pose' ? 'block' : 'none', height: '100%' }}>
            <PoseControl ref={poseControlRef} jointTargets={jointTargets} setJointTargets={setJointTargets} connection={connection} onPlanChange={(plan) => setInterpolationPlan(plan || [])} />
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
        <URDFSceneViewport jointTargets={jointTargets} setJointTargets={setJointTargets} showTransformControls={activeSection === 'pose'} interpolationPlan={interpolationPlan} onWaypointClick={(idx) => { if (poseControlRef.current && typeof poseControlRef.current.setCurrentStepIndex === 'function') { poseControlRef.current.setCurrentStepIndex(idx); } }} />
      </Box>
    </Box>
  );
}

export default DigitalTwinView;
