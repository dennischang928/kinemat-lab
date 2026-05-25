import { useEffect, useRef } from 'react';
import { Box, TextField, Typography, Alert, Paper, Stack, Slider } from '@mui/material';
import { CENTEROFFSETDEG } from '../../constants/robotConstants';

const JOINT_KEYS = ['J1', 'J2', 'J3', 'J4'];
const STEP_MIN = 0;
const STEP_MAX = 1023;
const DEG_PER_STEP = 0.29;
const ANGLE_MIN = 0;
const ANGLE_MAX = parseFloat((STEP_MAX * DEG_PER_STEP).toFixed(2)); // ~296.67°
const DISPLAY_CENTER = CENTEROFFSETDEG;
const DISPLAY_MIN = -DISPLAY_CENTER;
const DISPLAY_MAX = DISPLAY_CENTER;
const angleToSteps = (deg) => Math.round(Math.max(STEP_MIN, Math.min(STEP_MAX, deg / DEG_PER_STEP)));
const stepsToAngle = (steps) => parseFloat((steps * DEG_PER_STEP).toFixed(2));
const FEEDRATE_MIN = 10;
const FEEDRATE_MAX = 1000;


function ControlPanel({
  jointTargets,
  setJointTargets,
  setJointTargetsFromHardware = setJointTargets,
  connection,
  feedrate = 300,
  setFeedrate = () => { },
  hasSynced = false,
  setHasSynced = () => { },
  isSyncing = false,
  setIsSyncing = () => { },
  isTorqueEnabled = true,
  setIsTorqueEnabled = () => { },
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
  const sliderSx = { width: '90%', ml: 1 };
  const inputSx = { width: '72px', '& input': { textAlign: 'center', py: '4px', fontSize: '12px' } };

  const getDisplayedJointValue = (joint) => parseFloat((jointTargets[joint] - DISPLAY_CENTER).toFixed(2));
  const clampDisplayedAngle = (value) => Math.max(DISPLAY_MIN, Math.min(DISPLAY_MAX, value));

  useEffect(() => {
    if (!isConnected) {
      setHasSynced(false);
      setIsSyncing(false);
      readBufferRef.current = '';
      return;
    }
    // Subscribe to serial text coming from the arm. We're looking for
    // a position report matching `J1:.. J2:.. J3:.. J4:..` which
    // is emitted in response to `M114` (the sync command).
    // This is the readback side of the handshake: send sync in one
    // component, parse the position report here, and then unlock the UI.
    // When we parse a full position line we update `jointTargets`
    // and call `setHasSynced(true)` to signal the rest of the UI that
    // it's safe to enable action controls.
    const unsubscribe = connection.subscribe((text) => {
      readBufferRef.current += text;
      const lines = readBufferRef.current.split(/\r?\n/);
      readBufferRef.current = lines.pop() || '';

      lines.forEach((line) => {
        const errFound = /^ERR\b/.test(line);

        if (errFound) {
          setError(line);
        }

        // Example position line expected from the firmware:
        // "J1:123 J2:456 J3:789 J4:012"
        const match = line.match(/J1:(\d+)\s+J2:(\d+)\s+J3:(\d+)\s+J4:(\d+)/);
        if (match) {
          setJointTargetsFromHardware((prev) => ({
            ...prev,
            J1: stepsToAngle(parseInt(match[1], 10)),
            J2: stepsToAngle(parseInt(match[2], 10)),
            J3: stepsToAngle(parseInt(match[3], 10)),
            J4: stepsToAngle(parseInt(match[4], 10)),
          }));
          // Got a valid position report — mark as synced so other
          // UI parts (buttons, sliders, program controls) can enable.
          setHasSynced(true);
          setIsSyncing(false);
        }
      });
    });

    // ensure the reading loop is started
    connection.startReading();
    return () => unsubscribe();
  }, [isConnected, connection, setJointTargetsFromHardware, setError]);
  
  const clampFeedrateValue = (value) => Math.max(FEEDRATE_MIN, Math.min(FEEDRATE_MAX, value));

  const handleJointChange = (joint, value) => {
    const numeric = clampDisplayedAngle(parseFloat(value) || 0);
    setJointTargets((prev) => ({
      ...prev,
      [joint]: parseFloat((numeric + DISPLAY_CENTER).toFixed(2)),
    }));
  };

  const handleFeedrateChange = (value) => {
    const numeric = clampFeedrateValue(parseInt(value, 10) || 0);
    setFeedrate(numeric);
  };

  const Joints_Min_max = {
    J1: { min: DISPLAY_MIN, max: DISPLAY_MAX },
    J2: { min: -65, max: 65 },
    J3: { min: DISPLAY_MIN, max: DISPLAY_MAX },
    J4: { min: DISPLAY_MIN, max: DISPLAY_MAX },
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
                      min={Joints_Min_max[joint].min}
                      max={Joints_Min_max[joint].max}
                      step={DEG_PER_STEP}
                      value={getDisplayedJointValue(joint)}
                      onChange={(e, val) => handleJointChange(joint, val)}
                      size="small"
                      sx={{ ...sliderSx, flex: 1, ml: 0 }}
                    />
                    <TextField
                      type="number"
                      size="small"
                      inputProps={{ min: DISPLAY_MIN, max: DISPLAY_MAX, step: DEG_PER_STEP }}
                      value={getDisplayedJointValue(joint)}
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
