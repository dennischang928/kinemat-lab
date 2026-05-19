import { useState, useEffect, useRef } from 'react';
import { Box, TextField, Typography, Alert, Paper, Stack, Slider } from '@mui/material';



import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import AirplanemodeActiveIcon from '@mui/icons-material/AirplanemodeActive';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';

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

function ControlPanel({ 
  jointTargets, 
  setJointTargets, 
  connection, 
  autoSyncTrigger = 0,
  feedrate = 300,
  setFeedrate = () => {},
  hasSynced = false,
  setHasSynced = () => {},
  isSyncing = false,
  setIsSyncing = () => {},
  isTorqueEnabled = true,
  setIsTorqueEnabled = () => {},
}) {
  const {
    isConnected,
    error,
    isSerialAvailable,
    setError,
  } = connection;

  const readBufferRef = useRef('');
  const errorDismissTimerRef = useRef(null);
  const errorClearTimerRef = useRef(null);
  const speedMarks = [
    { value: 100, label: <DirectionsWalkIcon fontSize="small" /> },
    { value: 300, label: <DirectionsRunIcon fontSize="small" /> },
    { value: 500, label: <DirectionsBikeIcon fontSize="small" /> },
    { value: 700, label: <AirplanemodeActiveIcon fontSize="small" /> },
    { value: 900, label: <RocketLaunchIcon fontSize="small" /> },
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

    const unsubscribe = connection.subscribe((text) => {
      readBufferRef.current += text;
      const lines = readBufferRef.current.split(/\r?\n/);
      readBufferRef.current = lines.pop() || '';

      lines.forEach((line) => {
        const errFound = /^ERR\b/.test(line);

        if (errFound) {
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

    // ensure the reading loop is started
    connection.startReading();
    return () => unsubscribe();
  }, [isConnected, connection, setJointTargets, setError]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isConnected) return;
      if (event.code !== 'Space') return;
      event.preventDefault();
      handleQuickCommand('M18');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConnected]);

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

    const writeOk = await connection.sendCommandWithTimeout(command, { waitForOk });
    if (!writeOk) {
      setError('No OK received from command.');
      return false;
    }
    return true;
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

  // Auto-sync when the parent signals a trigger (increments)
  useEffect(() => {
    if (!autoSyncTrigger) return;
    if (!connection?.isConnected) return;
    // fire-and-forget; handleSyncFromArm manages its own state
    handleSyncFromArm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSyncTrigger]);

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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Scrollable content area */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {/* Serial API Support Check */}
        {!isSerialAvailable() && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.
          </Alert>
        )}

        <Paper sx={{ p: 2, mb: 3 }}>
          <Stack spacing={2}>
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
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}

export default ControlPanel;
