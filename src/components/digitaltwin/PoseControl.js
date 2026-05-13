import { useState, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { Box, Button, TextField, Paper, Stack, Typography, Alert, Fade, Slider, FormControlLabel, Switch } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SyncIcon from '@mui/icons-material/Sync';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import AirplanemodeActiveIcon from '@mui/icons-material/AirplanemodeActive';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { calculateForwardKinematicsMatrixDegrees } from '../helper/kinematics/fk';
// import { calculateInverseKinematicsMatrixDegrees } from '../helper/kinematics/ik';
import { calculateInverseKinematicsMatrixDegrees } from '../helper/kinematics/ik';

import PoseProgram from './PoseProgram';

const FEEDRATE_MIN = 10;
const FEEDRATE_MAX = 1000;
const XYZ_MIN = -0.3;
const XYZ_MAX = 0.3;
const Z_MIN = 0;
const Z_MAX = 0.4;
const STEP = 0.001;
const STEP_MAX = 1023;
const DEG_PER_STEP = 0.29;
const angleToSteps = (deg) => Math.round(Math.max(0, Math.min(STEP_MAX, deg / DEG_PER_STEP)));

const PoseControl = forwardRef(function PoseControl({ jointTargets, setJointTargets, connection, onPlanChange = null }, ref) {
  const [feedrate, setFeedrate] = useState(300);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [error, setError] = useState(null);
  const [enableProgramming, setEnableProgramming] = useState(false);
  const programRef = useRef(null);

  useImperativeHandle(ref, () => ({
    setCurrentStepIndex: (idx) => {
      if (programRef.current && typeof programRef.current.setCurrentStepIndex === 'function') {
        programRef.current.setCurrentStepIndex(idx);
      }
    }
  }), []);

  const speedMarks = [
    { value: 100, label: <DirectionsWalkIcon fontSize="small" /> },
    { value: 300, label: <DirectionsRunIcon fontSize="small" /> },
    { value: 500, label: <DirectionsBikeIcon fontSize="small" /> },
    { value: 700, label: <AirplanemodeActiveIcon fontSize="small" /> },
    { value: 900, label: <RocketLaunchIcon fontSize="small" /> },
  ];

  const currentPos = useMemo(() => {
    if (!jointTargets) return { x: 0.062, y: 0, z: 0.142 };
    const centerOffsetDeg = 148.335;
    const q1 = (jointTargets.J1 || 0) - centerOffsetDeg;
    const q2 = (jointTargets.J2 || 0) - centerOffsetDeg;
    const q3 = (jointTargets.J3 || 0) - centerOffsetDeg;
    const q4 = (jointTargets.J4 || 0) - centerOffsetDeg;
    const q5 = (jointTargets.J5 || 0) - centerOffsetDeg;

    const T = calculateForwardKinematicsMatrixDegrees({ q1, q2, q3, q4, q5 });
    return {
      x: T[0][3],
      y: T[1][3],
      z: T[2][3],
    };
  }, [jointTargets]);

  const handlePosChange = (axis, value) => {
    const numeric = parseFloat(value) || 0;
    const newPos = { ...currentPos, [axis]: numeric };

    const targetMatrix = [
      [1, 0, 0, newPos.x],
      [0, 1, 0, newPos.y],
      [0, 0, 1, newPos.z],
      [0, 0, 0, 1],
    ];

    const centerOffsetDeg = 148.335;
    const seedQ1 = ((jointTargets.J1 || 0) - centerOffsetDeg) * (Math.PI / 180);
    const seedQ2 = ((jointTargets.J2 || 0) - centerOffsetDeg) * (Math.PI / 180);
    const seedQ3 = ((jointTargets.J3 || 0) - centerOffsetDeg) * (Math.PI / 180);
    const seedQ4 = ((jointTargets.J4 || 0) - centerOffsetDeg) * (Math.PI / 180);
    const seedQ5 = ((jointTargets.J5 || 0) - centerOffsetDeg) * (Math.PI / 180);

    let solution = calculateInverseKinematicsMatrixDegrees(targetMatrix, {
      mask: [true, true, true, false, false, false],
      initialGuess: [seedQ1, seedQ2, seedQ3, seedQ4, seedQ5],
    });

    if (!solution || !solution.converged) {
      solution = calculateInverseKinematicsMatrixDegrees(targetMatrix, {
        mask: [true, true, true, false, false, false],
      });
    }

    if (solution && solution.converged && setJointTargets) {
      setJointTargets({
        J1: solution.q1 + centerOffsetDeg,
        J2: solution.q2 + centerOffsetDeg,
        J3: solution.q3 + centerOffsetDeg,
        J4: solution.q4 + centerOffsetDeg,
        J5: solution.q5 + centerOffsetDeg,
      });
      setShowErrorAlert(false);
      setError(null);
    } else {
      setError('No solution — position unreachable');
      setShowErrorAlert(true);
      setTimeout(() => setShowErrorAlert(false), 5000);
    }
  };

  const handleFeedrateChange = (value) => {
    setFeedrate(Math.max(FEEDRATE_MIN, Math.min(FEEDRATE_MAX, parseInt(value, 10) || FEEDRATE_MIN)));
  };

  const showError = (message, timeoutMs = 3000) => {
    setError(message);
    setShowErrorAlert(true);
    setTimeout(() => setShowErrorAlert(false), timeoutMs);
  };

  const handleSyncFromArm = () => {
    showError('Sync feature coming soon');
  };

  const handleSendSliders = async () => {
    if (!connection?.isConnected) {
      showError('Connect to a serial port first.');
      return;
    }

    const command = `G1 J1:${angleToSteps(jointTargets.J1)} J2:${angleToSteps(jointTargets.J2)} J3:${angleToSteps(jointTargets.J3)} J4:${angleToSteps(jointTargets.J4)} J5:${angleToSteps(jointTargets.J5)} F${feedrate}\n`;
    const ok = await connection.sendCommandWithTimeout(command);
    if (!ok) {
      showError('No OK received from arm.');
    }
  };

  const handleSendProgram = () => {
    if (programRef.current && typeof programRef.current.runProgram === 'function') {
      programRef.current.runProgram();
    }
  };

  const handleSaveTimeframe = () => {
    if (programRef.current && typeof programRef.current.addFrame === 'function') {
      programRef.current.addFrame();
      return;
    }

    showError('Pose Program is not ready yet.');
  };

  const sliderSx = { width: '90%', ml: 1 };
  const inputSx = { width: '72px', '& input': { textAlign: 'center', py: '4px', fontSize: '12px' } };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Scrollable content area */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        <Stack spacing={2}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="subtitle2">
                Position Sliders
              </Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={enableProgramming}
                      onChange={(e) => setEnableProgramming(e.target.checked)}
                    />
                  }
                  label={<Typography variant="caption">Enable Programming</Typography>}
                  sx={{ m: 0 }}
                />
              </Stack>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {['x', 'y', 'z'].map((axis, index) => {
                const minVal = axis === 'z' ? Z_MIN : XYZ_MIN;
                const maxVal = axis === 'z' ? Z_MAX : XYZ_MAX;
                return (
                  <Box
                    key={axis}
                    sx={{ pt: index === 0 ? 0 : 1, borderTop: index === 0 ? 'none' : '1px solid #eee' }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontFamily="monospace" textTransform="uppercase">
                        {axis} (m):
                      </Typography>
                      <Slider
                        min={minVal}
                        max={maxVal}
                        step={STEP}

                        value={currentPos[axis]}
                        onChange={(e, val) => handlePosChange(axis, val)}
                        size="small"
                        sx={{ ...sliderSx, flex: 1, ml: 0 }}
                      />
                      <TextField
                        type="number"
                        size="small"
                        inputProps={{ min: minVal, max: maxVal, step: STEP }}
                        value={currentPos[axis].toFixed(3)}
                        onChange={(e) => handlePosChange(axis, e.target.value)}
                        sx={inputSx}
                      />
                    </Box>
                  </Box>
                );
              })}
            </Box>
            {enableProgramming && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<SaveAltIcon />}
                  onClick={handleSaveTimeframe}
                >
                  Add Timeframe
                </Button>
              </Box>
            )}
          </Paper>

          <Fade in={enableProgramming} timeout={300}>
            <Box>
              <PoseProgram
                ref={programRef}
                currentPos={currentPos}
                jointTargets={jointTargets}
                feedrate={feedrate}
                setJointTargets={setJointTargets}
                setFeedrate={setFeedrate}
                connection={connection}
                onError={showError}
                hideRunButton={true}
                onPlanChange={onPlanChange}
              />
            </Box>
          </Fade>
        </Stack>
      </Box>

      {/* Bottom quick actions panel */}
      <Box sx={{ p: 3, pt: 2 }}>
        <Fade appear in={showErrorAlert} timeout={150} unmountOnExit>
          <Box sx={{ mb: 2 }}>
            {error && (
              <Alert variant="filled" severity="warning" sx={{ boxShadow: 3 }}>
                {error}
              </Alert>
            )}
          </Box>
        </Fade>

        <Paper sx={{ p: 2, boxShadow: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            Speed (F): {feedrate}
          </Typography>
          <Slider
            value={feedrate}
            onChange={(e, val) => handleFeedrateChange(val)}
            min={0}
            max={1000}
            step={null}
            marks={speedMarks}
            valueLabelDisplay="auto"
            sx={{ mb: 4 }}
          />

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Button
              variant="outlined"
              onClick={handleSyncFromArm}
              size="large"
              startIcon={<SyncIcon />}
            >
              Sync
            </Button>
            {!enableProgramming && (
              <Button
                variant="contained"
                onClick={handleSendSliders}
                fullWidth
                size="large"
                endIcon={<SendIcon />}
              >
                Send to Arm
              </Button>
            )}
            {enableProgramming && (
              <Button
                variant="contained"
                onClick={handleSendProgram}
                color="secondary"
                fullWidth
                size="large"
                endIcon={<SendIcon />}
              >
                Send Program
              </Button>
            )}
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
});

export default PoseControl;