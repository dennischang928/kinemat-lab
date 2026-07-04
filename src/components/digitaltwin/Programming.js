import { useState, useMemo, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Box, Button, Paper, Stack, Typography, Slider } from '@mui/material';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import PoseProgram from './PoseProgram';
import useKinematics from './hooks/useKinematics';
import DeferredNumericField from '../common/DeferredNumericField';

// const FEEDRATE_MIN = 10;
const XYZ_MIN = -0.3;
const XYZ_MAX = 0.3;
const Z_MIN = 0;
const Z_MAX = 0.4;
const STEP = 0.001;

const Programming = forwardRef(function Programming({
  jointTargets,
  setJointTargets,
  setJointTargetsForPreview = setJointTargets,
  connection,
  isTorqueEnabled = true,
  onPlanChange = null,
  controlsDisabled = false,
  setProgramButtonLabel,
}, ref) {
  const { getPositionFromJoints, solveJointsFromPosition } = useKinematics();
  const [feedrate, setFeedrate] = useState(300);
  const programRef = useRef(null);

  const currentPos = useMemo(() => {
    return getPositionFromJoints(jointTargets);
  }, [jointTargets, getPositionFromJoints]);

  const handleViewportTransformChange = useCallback((position) => {
    const solvedJoints = solveJointsFromPosition({
      x: position?.x ?? currentPos.x,
      y: position?.y ?? currentPos.y,
      z: position?.z ?? currentPos.z,
    }, jointTargets, {
      mask: [true, true, true, false, false, false],
    });

    if (solvedJoints && setJointTargets) {
      setJointTargets((prev) => ({
        ...prev,
        ...solvedJoints,
      }));
      return true;
    }

    return false;
  }, [currentPos, jointTargets, setJointTargets, solveJointsFromPosition]);

  useImperativeHandle(ref, () => ({
    setCurrentStepIndex: handleSetCurrentStepIndex,
    runProgram: handleRunProgram,
    sendProgram: handleSendProgram,
    getSavedInterpolation: handleGetSavedInterpolation,
    handleViewportTransformChange: (position) => {
      return handleViewportTransformChange(position);
    },
    handleSceneTransformation: (scenePose) => {
      const position = scenePose?.position ?? scenePose;
      return handleViewportTransformChange(position);
    },
  }), [handleViewportTransformChange]);

  const handlePosChange = (axis, value) => {
    const numeric = Number(value) || 0;
    const newPos = { ...currentPos, [axis]: numeric };

    const solvedJoints = solveJointsFromPosition(newPos, jointTargets, {
      mask: [true, true, true, false, false, false],
    });

    if (solvedJoints && setJointTargets) {
      setJointTargets((prev) => ({
        ...prev,
        ...solvedJoints,
      }));
    }
  };

  function handleSendProgram() {
    if (programRef.current && typeof programRef.current.sendProgram === 'function') {
      return programRef.current.sendProgram();
    }
    return null;
  }

  function handleSetCurrentStepIndex(idx) {
    if (programRef.current && typeof programRef.current.setCurrentStepIndex === 'function') {
      programRef.current.setCurrentStepIndex(idx);
    }
  }

  function handleRunProgram() {
    if (programRef.current && typeof programRef.current.runProgram === 'function') {
      return programRef.current.runProgram();
    }
    return null;
  }

  function handleGetSavedInterpolation() {
    if (programRef.current && typeof programRef.current.getSavedInterpolation === 'function') {
      return programRef.current.getSavedInterpolation();
    }
    return [];
  }

  const handleSaveTimeframe = () => {
    if (programRef.current && typeof programRef.current.addFrame === 'function') {
      programRef.current.addFrame();
      return;
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
                      <Typography variant="body2" fontFamily="monospace" textTransform="uppercase">{axis} (m):</Typography>
                      <Slider
                        min={minVal}
                        max={maxVal}
                        step={STEP}
                        value={currentPos[axis]}
                        onChange={(e, val) => handlePosChange(axis, val)}
                        size="small"
                        sx={{ flex: 1, ml: 0 }}
                      />
                      <DeferredNumericField
                        size="small"
                        value={currentPos[axis].toFixed(3)}
                        onCommit={(next) => handlePosChange(axis, next)}
                        formatValue={(next) => Number(next).toFixed(3)}
                        clampValue={(next) => Math.max(minVal, Math.min(maxVal, next))}
                        sx={{ width: '72px', '& input': { textAlign: 'center', py: '4px', fontSize: '12px' } }}
                      />
                    </Box>
                  </Box>
                );
              })}
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button size="small" variant="outlined" startIcon={<SaveAltIcon />} onClick={handleSaveTimeframe} disabled={controlsDisabled}>Add Timeframe</Button>
            </Box>
          </Paper>

          <Box>
            <PoseProgram
              ref={programRef}
              currentPos={currentPos}
              jointTargets={jointTargets}
              feedrate={feedrate}
              setJointTargets={setJointTargetsForPreview}
              setFeedrate={setFeedrate}
              connection={connection}
              isTorqueEnabled={isTorqueEnabled}
              onError={() => {}}
              hideRunButton={false}
              controlsDisabled={controlsDisabled}
              onPlanChange={onPlanChange}
              setProgramButtonLabel={setProgramButtonLabel}
            />
          </Box>
        </Stack>
      </Box>
    </Box>
  );
});

export default Programming;
