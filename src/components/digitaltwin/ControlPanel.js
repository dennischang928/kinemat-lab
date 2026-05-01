import { useState, useEffect, useRef } from 'react';
import { Box, Button, ButtonGroup, TextField, Typography, Alert, Paper, Stack, Chip, Menu, MenuItem, Slider, IconButton, Tooltip, LinearProgress, Fade } from '@mui/material';
import PowerIcon from '@mui/icons-material/Power';
import HomeIcon from '@mui/icons-material/Home';
import PowerOffIcon from '@mui/icons-material/PowerOff';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import TuneIcon from '@mui/icons-material/Tune';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import AirplanemodeActiveIcon from '@mui/icons-material/AirplanemodeActive';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { useSerialConnection } from '../../hooks/useSerialConnection';

const JOINT_KEYS = ['J1', 'J2', 'J3', 'J4', 'J5'];
const STEP_MIN = 0;
const STEP_MAX = 1023;
const DEG_PER_STEP = 0.29;
const ANGLE_MIN = 0;
const ANGLE_MAX = parseFloat((STEP_MAX * DEG_PER_STEP).toFixed(2)); // ~296.67°
const angleToSteps = (deg) => Math.round(Math.max(STEP_MIN, Math.min(STEP_MAX, deg / DEG_PER_STEP)));
const stepsToAngle = (steps) => parseFloat((steps * DEG_PER_STEP).toFixed(2));
const FEEDRATE_MIN = 10;
const FEEDRATE_MAX = 1000;

function ControlPanel({ jointTargets, setJointTargets }) {
  const {
    isConnected,
    error,
    isSerialAvailable,
    requestPort,
    connect,
    disconnect,
    sendData,
    setSelectedPort,
    setError,
    startReading,
  } = useSerialConnection();

  const [baudRate, setBaudRate] = useState(115200);
  const [feedrate, setFeedrate] = useState(100);
  const [hasSynced, setHasSynced] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isAwaitingOk, setIsAwaitingOk] = useState(false);
  const [isTorqueEnabled, setIsTorqueEnabled] = useState(true);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [baudMenuAnchorEl, setBaudMenuAnchorEl] = useState(null);
  const readBufferRef = useRef('');
  const responseResolverRef = useRef(null);
  const responseTimeoutRef = useRef(null);
  const errorDismissTimerRef = useRef(null);
  const errorClearTimerRef = useRef(null);
  const speedPresets = [
    { value: 50, label: '50', icon: DirectionsWalkIcon },
    { value: 100, label: '100', icon: DirectionsRunIcon },
    { value: 200, label: '200', icon: DirectionsBikeIcon },
    { value: 600, label: '600', icon: AirplanemodeActiveIcon },
    { value: 800, label: '800', icon: RocketLaunchIcon },
  ];

  const sliderSx = { width: '90%', ml: 1 };
  const inputSx = { width: '72px', '& input': { textAlign: 'center', py: '4px', fontSize: '12px' } };

  useEffect(() => {
    if (!isConnected) {
      setHasSynced(false);
      setIsSyncing(false);
      readBufferRef.current = '';
      return;
    }

    let isActive = true;
    startReading((text) => {
      if (!isActive) return;
      readBufferRef.current += text;
      const lines = readBufferRef.current.split(/\r?\n/);
      readBufferRef.current = lines.pop() || '';

      lines.forEach((line) => {
        const okFound = /\bOK\b/.test(line);
        const errFound = /^ERR\b/.test(line);

        if (okFound && responseResolverRef.current) {
          responseResolverRef.current(true);
          responseResolverRef.current = null;
          clearTimeout(responseTimeoutRef.current);
          responseTimeoutRef.current = null;
        }

        if (errFound && responseResolverRef.current) {
          responseResolverRef.current(false);
          responseResolverRef.current = null;
          clearTimeout(responseTimeoutRef.current);
          responseTimeoutRef.current = null;
          setError(line);
        }

        const match = line.match(/J1:(\d+)\s+J2:(\d+)\s+J3:(\d+)\s+J4:(\d+)\s+J5:(\d+)/);
        if (match) {
          setJointTargets({
            J1: stepsToAngle(parseInt(match[1], 10)),
            J2: stepsToAngle(parseInt(match[2], 10)),
            J3: stepsToAngle(parseInt(match[3], 10)),
            J4: stepsToAngle(parseInt(match[4], 10)),
            J5: stepsToAngle(parseInt(match[5], 10)),
          });
          setHasSynced(true);
          setIsSyncing(false);
        }
      });
    });

    return () => {
      isActive = false;
    };
  }, [isConnected, startReading]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isConnected) return;
      if (event.code !== 'Space') return;

    //   const target = event.target;
    //   const tagName = target?.tagName?.toLowerCase();
    //   if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || tagName === 'button') {
    //     return;
    //   }
    console.log('Space key pressed');
      event.preventDefault();
      handleQuickCommand('M18');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConnected]);

  useEffect(() => {
    if (!error) {
      setShowErrorAlert(false);
      return;
    }

    setShowErrorAlert(true);

    if (errorDismissTimerRef.current) {
      clearTimeout(errorDismissTimerRef.current);
    }
    if (errorClearTimerRef.current) {
      clearTimeout(errorClearTimerRef.current);
    }

    errorDismissTimerRef.current = setTimeout(() => {
      setShowErrorAlert(false);
      errorClearTimerRef.current = setTimeout(() => {
        setError(null);
      }, 350);
    }, 3000);

    return () => {
      if (errorDismissTimerRef.current) {
        clearTimeout(errorDismissTimerRef.current);
      }
      if (errorClearTimerRef.current) {
        clearTimeout(errorClearTimerRef.current);
      }
    };
  }, [error, setError]);

  const clampAngle = (value) => Math.max(ANGLE_MIN, Math.min(ANGLE_MAX, value));
  const clampFeedrateValue = (value) => Math.max(FEEDRATE_MIN, Math.min(FEEDRATE_MAX, value));

  const handleJointChange = (joint, value) => {
    const numeric = clampAngle(parseFloat(value) || 0);
    setJointTargets((prev) => ({
      ...prev,
      [joint]: parseFloat(numeric.toFixed(2)),
    }));
  };

  const handleFeedrateChange = (value) => {
    const numeric = clampFeedrateValue(parseInt(value, 10) || 0);
    setFeedrate(numeric);
  };

  const sendCommandWithTimeout = async (command, { waitForOk = true } = {}) => {
    if (!isConnected) {
      setError('Connect to a serial port before sending commands.');
      return false;
    }

    if (responseResolverRef.current) {
      responseResolverRef.current(false);
      responseResolverRef.current = null;
      clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
      setIsAwaitingOk(false);
    }

    const writeOk = await sendData(command);
    if (!writeOk) {
      setError('Failed to write command to serial port.');
      return false;
    }

    if (!waitForOk) {
      return true;
    }

    setIsAwaitingOk(true);
    return new Promise((resolve) => {
      responseResolverRef.current = (result) => {
        setIsAwaitingOk(false);
        resolve(result);
      };
      responseTimeoutRef.current = window.setTimeout(() => {
        responseResolverRef.current = null;
        responseTimeoutRef.current = null;
        setIsAwaitingOk(false);
        setError('No OK received within 5 seconds.');
        resolve(false);
      }, 5000);
    });
  };

  const handleSyncFromArm = async () => {
    if (!isConnected) {
      setError('Connect to a serial port before syncing.');
      return;
    }

    if (!isTorqueEnabled) {
      setError('Turn torque on before syncing.');
      return;
    }

    setIsSyncing(true);
    const ok = await sendCommandWithTimeout('M114\n');
    if (!ok) {
      setIsSyncing(false);
    }
  };

  const handleSendSliders = async () => {
    if (!isConnected) {
      setError('Connect to a serial port before sending.');
      return;
    }

    if (!isTorqueEnabled) {
      setError('Turn torque on before sending moves.');
      return;
    }

    if (!hasSynced) {
      setError('Sync from the arm before sending slider values.');
      return;
    }

    const command = `G1 J1:${angleToSteps(jointTargets.J1)} J2:${angleToSteps(jointTargets.J2)} J3:${angleToSteps(jointTargets.J3)} J4:${angleToSteps(jointTargets.J4)} J5:${angleToSteps(jointTargets.J5)} F${feedrate}\n`;
    const ok = await sendCommandWithTimeout(command);
    if (!ok) {
      setError('No OK received from command.');
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const port = await requestPort();
      if (port) {
        const success = await connect(port, baudRate);
        if (success) {
          setSelectedPort(port);
        }
      }
    } catch (err) {
      setError(`Connection failed: ${err.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await disconnect();
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

  const handleQuickCommand = async (command) => {
    if (!isConnected) {
      setError('Connect to a serial port before sending commands.');
      return;
    }

    if (!isTorqueEnabled && command !== 'M17') {
      setError('Turn torque on before using this control.');
      return;
    }

    const ok = await sendCommandWithTimeout(`${command}\n`, { waitForOk: command !== 'M18' });
    if (!ok) {
      setError('No OK received within 5 seconds.');
      return;
    }

    if (command === 'M17') {
      setIsTorqueEnabled(true);
    }

    if (command === 'M18') {
      setIsTorqueEnabled(false);
    }

    if (command === 'M17' || command === 'M18' || command === 'M140') {
      setHasSynced(false);
      setIsSyncing(false);
    }
  };

  const isConnectionProgressLoading = isConnecting || isDisconnecting || isAwaitingOk;

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>

      {/* Serial API Support Check */}
      {!isSerialAvailable() && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.
        </Alert>
      )}

      {/* Connection Bar */}
      <Paper
        sx={{
          p: 1,
          mb: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: isConnected ? '#e8f5e9' : '#ffebee',
          border: `1px solid ${isConnected ? '#4caf50' : '#f44336'}`,
          borderRadius: 2,
        }}
      >
        <LinearProgress
          variant={isConnectionProgressLoading ? 'indeterminate' : 'determinate'}
          value={isConnectionProgressLoading ? undefined : 100}
          sx={{
            flex: 1,
            height: 10,
            borderRadius: 999,
            backgroundColor: isConnectionProgressLoading
              ? '#e0e0e0'
              : isConnected
                ? '#c8e6c9'
                : '#ffcdd2',
            '& .MuiLinearProgress-bar': {
              borderRadius: 999,
              backgroundColor: isConnectionProgressLoading
                ? '#1976d2'
                : isConnected
                  ? '#4caf50'
                  : '#f44336',
            },
          }}
        />
        <IconButton
          onClick={handleConnect}
          disabled={isConnected || isConnecting || isDisconnecting}
          sx={{ color: '#4caf50' }}
          size="large"
          aria-label="connect"
        >
          <LinkIcon />
        </IconButton>
        <IconButton
          onClick={handleDisconnect}
          disabled={!isConnected || isConnecting || isDisconnecting}
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

      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Tooltip title="Homing sequence" arrow>
              <IconButton
                onClick={() => handleQuickCommand('M140')}
                size="large"
                color="primary"
                aria-label="home"
                disabled={!isConnected || !isTorqueEnabled}
              >
                <HomeIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Torque on" arrow>
              <IconButton
                onClick={() => handleQuickCommand('M17')}
                size="large"
                color="primary"
                aria-label="power-on"
                disabled={!isConnected}
              >
                <PowerIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Torque off" arrow>
              <IconButton
                onClick={() => handleQuickCommand('M18')}
                size="large"
                aria-label="power-off"
                disabled={!isConnected || !isTorqueEnabled}
                sx={{ color: '#f44336' }}
              >
                <PowerOffIcon />
              </IconButton>
            </Tooltip>
          </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {JOINT_KEYS.map((joint, index) => (
                <Box
                  key={joint}
                  sx={{ pt: index === 0 ? 0 : 1, borderTop: index === 0 ? 'none' : '1px solid #eee' }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" fontFamily="monospace">{joint}:</Typography>
                    <Slider
                      min={ANGLE_MIN}
                      max={ANGLE_MAX}
                      step={DEG_PER_STEP}
                      value={jointTargets[joint]}
                      onChange={(e, val) => handleJointChange(joint, val)}
                      size="small"
                      sx={{ ...sliderSx, flex: 1, ml: 0 }}
                    />
                    <TextField
                      type="number"
                      size="small"
                      inputProps={{ min: ANGLE_MIN, max: ANGLE_MAX, step: DEG_PER_STEP }}
                      value={jointTargets[joint]}
                      onChange={(e) => handleJointChange(joint, e.target.value)}
                      sx={inputSx}
                    />
                  </Box>
                </Box>
              ))}
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Speed (F): {feedrate}
              </Typography>
              <ButtonGroup fullWidth>
                {speedPresets.map((preset) => {
                  const Icon = preset.icon;
                  return (
                    <Button
                      key={preset.value}
                      variant={feedrate === preset.value ? 'contained' : 'outlined'}
                      onClick={() => handleFeedrateChange(preset.value)}
                      disabled={!isTorqueEnabled}
                      startIcon={<Icon fontSize="small" />}
                    >
                      {preset.label}
                    </Button>
                  );
                })}
              </ButtonGroup>
            </Box>

            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                onClick={handleSyncFromArm}
                disabled={!isConnected || isSyncing || !isTorqueEnabled}
                fullWidth
              >
                {isSyncing ? 'Syncing...' : 'Sync from Arm'}
              </Button>
              <Button
                variant="contained"
                onClick={handleSendSliders}
                disabled={!isConnected || !hasSynced || !isTorqueEnabled}
                fullWidth
              >
                Send to Arm
              </Button>
            </Stack>
          </Stack>
        </Paper>

      <Box sx={{ position: 'sticky', bottom: 0, mt: 2, zIndex: 2 }}>
        <Fade in={showErrorAlert} timeout={350}>
          <Box>
            {error && (
              <Alert variant="filled" severity="error" sx={{ boxShadow: 3 }}>
                {error}
              </Alert>
            )}
          </Box>
        </Fade>
      </Box>
    </Box>
  );
}

export default ControlPanel;
