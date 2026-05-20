import { useState, useMemo, forwardRef } from 'react';
import { Box, TextField, Paper, Stack, Typography, Slider, Checkbox } from '@mui/material';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import AirplanemodeActiveIcon from '@mui/icons-material/AirplanemodeActive';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { calculateForwardKinematicsMatrixDegrees } from '../helper/kinematics/fk';
// import { calculateInverseKinematicsMatrixDegrees } from '../helper/kinematics/ik_symbolic';
import { calculateInverseKinematicsMatrixDegrees } from '../helper/kinematics/ik';
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
const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

const matrixToPose = (T) => {
  const x = T?.[0]?.[3] ?? 0;
  const y = T?.[1]?.[3] ?? 0;
  const z = T?.[2]?.[3] ?? 0;

  const pitch = Math.atan2(-T[2][0], Math.sqrt(T[2][1]**2 + T[2][2]**2));
  const roll  = Math.atan2(T[2][1], T[2][2]);
  const yaw   = Math.atan2(T[1][0], T[0][0]);
  return { x, y, z, roll: roll * RAD_TO_DEG, pitch: pitch * RAD_TO_DEG, yaw: yaw * RAD_TO_DEG };
};

const poseToMatrix = ({ x = 0, y = 0, z = 0, roll = 0, pitch = 0, yaw = 0 }) => {
  const r = roll * DEG_TO_RAD;
  const p = pitch * DEG_TO_RAD;
  const yRad = yaw * DEG_TO_RAD;

  const cr = Math.cos(r);
  const sr = Math.sin(r);
  const cp = Math.cos(p);
  const sp = Math.sin(p);
  const cy = Math.cos(yRad);
  const sy = Math.sin(yRad);

  return [
    [cy * cp, cy * sp * sr - sy * cr, cy * sp * cr + sy * sr, x],
    [sy * cp, sy * sp * sr + cy * cr, sy * sp * cr - cy * sr, y],
    [-sp, cp * sr, cp * cr, z],
    [0, 0, 0, 1],
  ];
};

const ORIENTATION_MIN = -180;
const ORIENTATION_MAX = 180;
const ORIENTATION_STEP = 1;

const PoseControl = forwardRef(function PoseControl({ jointTargets, setJointTargets, connection, isTorqueEnabled = true, onPlanChange = null }, ref) {
  const [feedrate, setFeedrate] = useState(300);
  const [positionMask, setPositionMask] = useState({ x: true, y: true, z: true });
  const [orientationMask, setOrientationMask] = useState({ roll: false, pitch: false, yaw: false });
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [error, setError] = useState(null);

  const speedMarks = [
    { value: 100, label: <DirectionsWalkIcon fontSize="small" /> },
    { value: 300, label: <DirectionsRunIcon fontSize="small" /> },
    { value: 500, label: <DirectionsBikeIcon fontSize="small" /> },
    { value: 700, label: <AirplanemodeActiveIcon fontSize="small" /> },
    { value: 900, label: <RocketLaunchIcon fontSize="small" /> },
  ];

  const currentPose = useMemo(() => {
    if (!jointTargets) return { x: 0.062, y: 0, z: 0.142, roll: 0, pitch: 0, yaw: 0 };
    const centerOffsetDeg = 148.335;
    const q1 = (jointTargets.J1 || 0) - centerOffsetDeg;
    const q2 = (jointTargets.J2 || 0) - centerOffsetDeg;
    const q3 = (jointTargets.J3 || 0) - centerOffsetDeg;
    const q4 = (jointTargets.J4 || 0) - centerOffsetDeg;
    const q5 = (jointTargets.J5 || 0) - centerOffsetDeg;

    const T = calculateForwardKinematicsMatrixDegrees({ q1, q2, q3, q4, q5 });

    return matrixToPose(T);
  }, [jointTargets]);

  const solvePoseChange = (nextPose, mask, failureMessage) => {
    if (!jointTargets || !setJointTargets) {
      return;
    }

    const targetMatrix = poseToMatrix(nextPose);
    const centerOffsetDeg = 148.335;
    const seedQ1 = ((jointTargets.J1 || 0) - centerOffsetDeg) * DEG_TO_RAD;
    const seedQ2 = ((jointTargets.J2 || 0) - centerOffsetDeg) * DEG_TO_RAD;
    const seedQ3 = ((jointTargets.J3 || 0) - centerOffsetDeg) * DEG_TO_RAD;
    const seedQ4 = ((jointTargets.J4 || 0) - centerOffsetDeg) * DEG_TO_RAD;
    const seedQ5 = ((jointTargets.J5 || 0) - centerOffsetDeg) * DEG_TO_RAD;

    let solution = calculateInverseKinematicsMatrixDegrees(targetMatrix, {
      mask,
      initialGuess: [seedQ1, seedQ2, seedQ3, seedQ4, seedQ5],
      optimizeToGuess: [seedQ1, seedQ2, seedQ3, seedQ4, seedQ5],
    });

    if (!solution || !solution.converged) {
      solution = calculateInverseKinematicsMatrixDegrees(targetMatrix, { mask });
    }

    if (solution && solution.converged) {
      setJointTargets({
        J1: solution.q1 + centerOffsetDeg,
        J2: solution.q2 + centerOffsetDeg,
        J3: solution.q3 + centerOffsetDeg,
        J4: solution.q4 + centerOffsetDeg,
        J5: solution.q5 + centerOffsetDeg,
      });
      setShowErrorAlert(false);
      setError(null);
      return;
    }

    setError(failureMessage);
    setShowErrorAlert(true);
    setTimeout(() => setShowErrorAlert(false), 5000);
  };

  const handlePoseChange = (axis, value) => {
    const numeric = parseFloat(value) || 0;
    const nextPose = { ...currentPose, [axis]: numeric };
    solvePoseChange(nextPose, [positionMask.x, positionMask.y, positionMask.z, orientationMask.roll, orientationMask.pitch, orientationMask.yaw], 'No solution — pose unreachable');
  };

  // const handleOrientationChange = (axis, value) => {
  //   const numeric = parseFloat(value) || 0;
  //   const nextPose = { ...currentPose, [axis]: numeric };
  //   solvePoseChange(nextPose, [false, false, false,
  // };

  const handleOrientationMaskChange = (axis) => {
    setOrientationMask((prev) => ({ ...prev, [axis]: !prev[axis] }));
  };

  const handlePositionMaskChange = (axis) => {
    setPositionMask((prev) => ({ ...prev, [axis]: !prev[axis] }));
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

    if (!isTorqueEnabled) {
      showError('Turn torque on before sending.');
      return;
    }

    const command = `G1 J1:${angleToSteps(jointTargets.J1)} J2:${angleToSteps(jointTargets.J2)} J3:${angleToSteps(jointTargets.J3)} J4:${angleToSteps(jointTargets.J4)} J5:${angleToSteps(jointTargets.J5)} F${feedrate}\n`;
    const ok = await connection.sendCommandWithTimeout(command);
    if (!ok) {
      showError('No OK received from arm.');
    }
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
              <Typography variant="subtitle2">Position Sliders</Typography>
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
                      <Checkbox
                        size="small"
                        checked={positionMask[axis]}
                        onChange={() => handlePositionMaskChange(axis)}
                        inputProps={{ 'aria-label': `${axis} position mask` }}
                        sx={{ p: 0.25 }}
                      />
                      <Typography variant="body2" fontFamily="monospace" textTransform="uppercase">
                        {axis} (m):
                      </Typography>
                      <Slider
                        min={minVal}
                        max={maxVal}
                        step={STEP}

                        value={currentPose[axis]}
                        onChange={(e, val) => handlePoseChange(axis, val)}
                        size="small"
                        sx={{ ...sliderSx, flex: 1, ml: 0 }}
                      />
                      <TextField
                        type="number"
                        size="small"
                        inputProps={{ min: minVal, max: maxVal, step: STEP }}
                        value={currentPose[axis].toFixed(3)}
                        onChange={(e) => handlePoseChange(axis, e.target.value)}
                        sx={inputSx}
                      />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="subtitle2">Orientation Sliders</Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {['roll', 'pitch', 'yaw'].map((axis, index) => (
                <Box
                  key={axis}
                  sx={{ pt: index === 0 ? 0 : 1, borderTop: index === 0 ? 'none' : '1px solid #eee' }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>

                    <Checkbox
                      size="small"
                      checked={orientationMask[axis]}
                      onChange={() => handleOrientationMaskChange(axis)}
                      inputProps={{ 'aria-label': `${axis} orientation mask` }}
                      sx={{ p: 0.25 }}
                    />
                    <Typography variant="body2" fontFamily="monospace" textTransform="uppercase" sx={{ minWidth: '28px' }}>
                      {axis[0]}
                    </Typography>
                    <Slider
                      min={ORIENTATION_MIN}
                      max={ORIENTATION_MAX}
                      step={ORIENTATION_STEP}
                      value={currentPose[axis]}
                      onChange={(e, val) => handlePoseChange(axis, val)}
                      size="small"
                      sx={{ ...sliderSx, flex: 1, ml: 0 }}
                    />
                    <TextField
                      type="number"
                      size="small"
                      inputProps={{ min: ORIENTATION_MIN, max: ORIENTATION_MAX, step: ORIENTATION_STEP }}
                      value={currentPose[axis].toFixed(1)}
                      onChange={(e) => handlePoseChange(axis, e.target.value)}
                      sx={inputSx}
                    />
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        </Stack>
      </Box>
    </Box>
  );
});

export default PoseControl;