import { useMemo, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Box, Paper, Stack, Typography, Slider, Checkbox } from '@mui/material';
import * as THREE from 'three';
import useKinematics from './hooks/useKinematics';
import DeferredNumericField from '../common/DeferredNumericField';
const XYZ_MIN = -0.3;
const XYZ_MAX = 0.3;
const Y_MIN = 0;
const Y_MAX = 0.4;
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

  const currentPose = useMemo(() => {
    return getPoseFromJoints(jointTargets);
  }, [jointTargets, getPoseFromJoints]);

  const solvePoseChange = useCallback((nextPose, mask, failureMessage) => {
    if (!jointTargets || !setJointTargets) {
      return false;
    }

    const solvedJoints = solveJointsFromPose(nextPose, jointTargets, { mask });
    // console.log('Solved joints:', solvedJoints);
    
    if (solvedJoints) {
      setJointTargets((prev) => ({
        ...prev,
        ...solvedJoints,
      }));
      return true;
    } 
    console.warn(failureMessage);
    return false;
  }, [jointTargets, setJointTargets, solveJointsFromPose]);

  const handleSceneTransformation = useCallback((scenePose = {}) => {
    const position = scenePose?.position;
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
    // console.log("Mask", kinematicMask);
    return solvePoseChange(
      nextPose,
      [kinematicMask.x, kinematicMask.y, kinematicMask.z, kinematicMask.roll, kinematicMask.pitch, kinematicMask.yaw],
      'No solution — pose unreachable',
    );
  }, [currentPose, kinematicMask, solvePoseChange]);

  const handlePoseChange = (axis, value) => {
    const numeric = Number(value) || 0;
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

  useImperativeHandle(ref, () => ({
    setCurrentStepIndex: () => {},
    handleSceneTransformation,
  }), [handleSceneTransformation]);

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
                const minVal = axis === 'y' ? Y_MIN : XYZ_MIN;
                const maxVal = axis === 'y' ? Y_MAX : XYZ_MAX;
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
                      <DeferredNumericField
                        size="small"
                        value={currentPose[axis].toFixed(3)}
                        onCommit={(next) => handlePoseChange(axis, next)}
                        formatValue={(next) => Number(next).toFixed(3)}
                        clampValue={(next) => Math.max(minVal, Math.min(maxVal, next))}
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
                    <Typography
                      variant="body2"
                      fontFamily="monospace"
                      textTransform="uppercase"
                      sx={{ minWidth: '60px', color: axis === 'yaw' ? '#0800ff' : axis === 'pitch' ? '#43a047' : '#d32f2f', fontWeight: 'bold' }}
                    >
                      {axis}
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
                    <DeferredNumericField
                      size="small"
                      value={currentPose[axis].toFixed(1)}
                      onCommit={(next) => handlePoseChange(axis, next)}
                      formatValue={(next) => Number(next).toFixed(1)}
                      clampValue={(next) => Math.max(ORIENTATION_MIN, Math.min(ORIENTATION_MAX, next))}
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
