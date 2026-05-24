import { useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Box, TextField, Paper, Stack, Typography, Slider, Checkbox } from '@mui/material';
import * as THREE from 'three';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import AirplanemodeActiveIcon from '@mui/icons-material/AirplanemodeActive';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import useKinematics from './hooks/useKinematics';
const FEEDRATE_MIN = 10;
const FEEDRATE_MAX = 1000;
const XYZ_MIN = -0.3;
const XYZ_MAX = 0.3;
const Z_MIN = 0;
const Z_MAX = 0.4;
const STEP = 0.001;

const ORIENTATION_MIN = -180;
const ORIENTATION_MAX = 180;
const ORIENTATION_STEP = 1;

const PoseControl = forwardRef(function PoseControl({
  jointTargets,
  setJointTargets,
  connection,
  isTorqueEnabled = true,
  onPlanChange = null,
  kinematicMask = { x: true, y: true, z: true, roll: false, pitch: true, yaw: false },
  onKinematicMaskChange = null,
}, ref) {
  const { getPoseFromJoints, solveJointsFromPose } = useKinematics();
  const [feedrate, setFeedrate] = useState(300);
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
    return getPoseFromJoints(jointTargets);
  }, [jointTargets, getPoseFromJoints]);

  const solvePoseChange = (nextPose, mask, failureMessage) => {
    if (!jointTargets || !setJointTargets) {
      return false;
    }

    const solvedJoints = solveJointsFromPose(nextPose, jointTargets, { mask });
    console.log('Solved joints:', solvedJoints);
    
    if (solvedJoints) {
      setJointTargets((prev) => ({
        ...prev,
        ...solvedJoints,
      }));
      setShowErrorAlert(false);
      setError(null);
      return true;
    } 
    return false;

    setError(failureMessage);
    setShowErrorAlert(true);
    setTimeout(() => setShowErrorAlert(false), 5000);
  };

  const handleSceneTransformation = (scenePose = {}) => {
    const position = scenePose?.position ?? scenePose;
    const quaternion = scenePose?.quaternion;
    const euler = quaternion ? new THREE.Euler().setFromQuaternion(quaternion, 'XYZ') : null;
    const nextPose = {
      ...currentPose, // Start with current pose as base (in order to reach a solution cloest to this pose)
      x: position?.x ?? currentPose.x,
      y: position?.y ?? currentPose.y,
      z: position?.z ?? currentPose.z,
      roll: euler ? euler.x * (180 / Math.PI) : currentPose.roll,
      pitch: euler ? euler.y * (180 / Math.PI) : currentPose.pitch,
      yaw: euler ? euler.z * (180 / Math.PI) : currentPose.yaw,
    };
    console.log("Mask", kinematicMask);
    return solvePoseChange(
      nextPose,
      [kinematicMask.x, kinematicMask.y, kinematicMask.z, kinematicMask.roll, kinematicMask.pitch, kinematicMask.yaw],
      'No solution — pose unreachable',
    );
  };

  const handlePoseChange = (axis, value) => {
    const numeric = parseFloat(value) || 0;
    const nextPose = { ...currentPose, [axis]: numeric };
    solvePoseChange(nextPose, [kinematicMask.x, kinematicMask.y, kinematicMask.z, kinematicMask.roll, kinematicMask.pitch, kinematicMask.yaw], 'No solution — pose unreachable');
  };

  const handleOrientationMaskChange = (axis) => {
    const nextMask = {
      ...kinematicMask,
      [axis]: !kinematicMask[axis],
    };
    if (typeof onKinematicMaskChange === 'function') {
      onKinematicMaskChange(nextMask);
    }
  };

  const handlePositionMaskChange = (axis) => {
    const nextMask = {
      ...kinematicMask,
      [axis]: !kinematicMask[axis],
    };
    if (typeof onKinematicMaskChange === 'function') {
      onKinematicMaskChange(nextMask);
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


  useImperativeHandle(ref, () => ({
    setCurrentStepIndex: () => {},
    
    handleSceneTransformation,
  }), [ handleSceneTransformation]);

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
                        checked={kinematicMask[axis]}
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
                      checked={kinematicMask[axis]}
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