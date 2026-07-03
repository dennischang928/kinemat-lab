import React from 'react';
import { Box, Typography, Slider } from '@mui/material';
import DeferredNumericField from '../common/DeferredNumericField';

const JointController = ({ 
  angles, 
  onAngleChange,
  selectedJoint,
  onJointChange,
  showFrameAnimation,
  onAnimationToggle,
  viewMode
}) => {
  const handleAngleChange = (joint, value) => {
    onAngleChange(joint, value);
  };

  const handleNumberInput = (joint, degValue) => {
    const clamped = Math.max(-180, Math.min(180, degValue));
    onAngleChange(joint, clamped * Math.PI / 180);
  };

  const sliderSx = { width: '90%', ml: 1 };
  const inputSx = { width: '60px', '& input': { textAlign: 'center', py: '4px', fontSize: '12px' } };
  const getDegreeValue = (joint) => (angles[joint] * 180) / Math.PI;
  const getRadianValue = (joint) => angles[joint];
  const renderAngleReadout = (joint) => `${getRadianValue(joint).toFixed(3)} rad`;

  return (
    <Box sx={{ flex: '0 0 auto', bgcolor: '#f5f5f5', overflowY: 'auto', px: 2.5, py: 1.5 }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>Joint Controls</Typography>

      {/* Base Yaw (3D only) */}
      {viewMode === '3D' && (
        <Box sx={{ mb: 2, pb: 2, borderBottom: '1px solid #ccc' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" fontFamily="monospace">θ0:</Typography>
            <DeferredNumericField
              size="small"
              value={Math.round(getDegreeValue('thetaBase'))}
              onCommit={(next) => handleNumberInput('thetaBase', next)}
              formatValue={(next) => String(Math.round(Number(next) || 0))}
              sx={inputSx}
            />
            <Typography variant="body2">°</Typography>
            <Typography variant="body2" sx={{ minWidth: '84px', fontFamily: 'monospace', color: 'text.secondary' }}>
              {renderAngleReadout('thetaBase')}
            </Typography>
          </Box>
          <Slider
            min={-180}
            max={180}
            value={getDegreeValue('thetaBase')}
            onChange={(e, val) => handleAngleChange('thetaBase', val * Math.PI / 180)}
            size="small"
            sx={sliderSx}
          />
        </Box>
      )}

      {/* θ1 */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" fontFamily="monospace">θ1:</Typography>
          <DeferredNumericField
            size="small"
            value={Math.round(getDegreeValue('theta1'))}
            onCommit={(next) => handleNumberInput('theta1', next)}
            formatValue={(next) => String(Math.round(Number(next) || 0))}
            sx={inputSx}
          />
          <Typography variant="body2">°</Typography>
          <Typography variant="body2" sx={{ minWidth: '84px', fontFamily: 'monospace', color: 'text.secondary' }}>
            {renderAngleReadout('theta1')}
          </Typography>
        </Box>
        <Slider
          min={-180}
          max={180}
          value={getDegreeValue('theta1')}
          onChange={(e, val) => handleAngleChange('theta1', val * Math.PI / 180)}
          size="small"
          sx={sliderSx}
        />
      </Box>

      {/* θ2 */}
      <Box sx={{ mt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" fontFamily="monospace">θ2:</Typography>
          <DeferredNumericField
            size="small"
            value={Math.round(getDegreeValue('theta2'))}
            onCommit={(next) => handleNumberInput('theta2', next)}
            formatValue={(next) => String(Math.round(Number(next) || 0))}
            sx={inputSx}
          />
          <Typography variant="body2">°</Typography>
          <Typography variant="body2" sx={{ minWidth: '84px', fontFamily: 'monospace', color: 'text.secondary' }}>
            {renderAngleReadout('theta2')}
          </Typography>
        </Box>
        <Slider
          min={-180}
          max={180}
          value={getDegreeValue('theta2')}
          onChange={(e, val) => handleAngleChange('theta2', val * Math.PI / 180)}
          size="small"
          sx={sliderSx}
        />
      </Box>

      {/* θ3 */}
      <Box sx={{ mt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" fontFamily="monospace">θ3:</Typography>
          <DeferredNumericField
            size="small"
            value={Math.round(getDegreeValue('theta3'))}
            onCommit={(next) => handleNumberInput('theta3', next)}
            formatValue={(next) => String(Math.round(Number(next) || 0))}
            sx={inputSx}
          />
          <Typography variant="body2">°</Typography>
          <Typography variant="body2" sx={{ minWidth: '84px', fontFamily: 'monospace', color: 'text.secondary' }}>
            {renderAngleReadout('theta3')}
          </Typography>
        </Box>
        <Slider
          min={-180}
          max={180}
          value={getDegreeValue('theta3')}
          onChange={(e, val) => handleAngleChange('theta3', val * Math.PI / 180)}
          size="small"
          sx={sliderSx}
        />
      </Box>
    </Box>
  );
};

export default JointController;
