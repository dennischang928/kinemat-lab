import React from 'react';
import { Box, Typography, Slider, TextField, Select, MenuItem, FormControlLabel, Checkbox } from '@mui/material';

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

  return (
    <Box sx={{ flex: '0 0 auto', bgcolor: '#f5f5f5', overflowY: 'auto', px: 2.5, py: 1.5 }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>Joint Controls</Typography>

      {/* Base Yaw (3D only) */}
      {viewMode === '3D' && (
        <Box sx={{ mb: 2, pb: 2, borderBottom: '1px solid #ccc' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" fontFamily="monospace">θ0:</Typography>
            <TextField
              type="number"
              size="small"
              inputProps={{ min: -180, max: 180, step: 1 }}
              value={Math.round(angles.thetaBase * 180 / Math.PI)}
              onChange={(e) => handleNumberInput('thetaBase', parseFloat(e.target.value) || 0)}
              sx={inputSx}
            />
            <Typography variant="body2">°</Typography>
          </Box>
          <Slider
            min={-180}
            max={180}
            value={angles.thetaBase * 180 / Math.PI}
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
          <TextField
            type="number"
            size="small"
            inputProps={{ min: -180, max: 180, step: 1 }}
            value={Math.round(angles.theta1 * 180 / Math.PI)}
            onChange={(e) => handleNumberInput('theta1', parseFloat(e.target.value) || 0)}
            sx={inputSx}
          />
          <Typography variant="body2">°</Typography>
        </Box>
        <Slider
          min={-180}
          max={180}
          value={angles.theta1 * 180 / Math.PI}
          onChange={(e, val) => handleAngleChange('theta1', val * Math.PI / 180)}
          size="small"
          sx={sliderSx}
        />
      </Box>

      {/* θ2 */}
      <Box sx={{ mt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" fontFamily="monospace">θ2:</Typography>
          <TextField
            type="number"
            size="small"
            inputProps={{ min: -180, max: 180, step: 1 }}
            value={Math.round(angles.theta2 * 180 / Math.PI)}
            onChange={(e) => handleNumberInput('theta2', parseFloat(e.target.value) || 0)}
            sx={inputSx}
          />
          <Typography variant="body2">°</Typography>
        </Box>
        <Slider
          min={-180}
          max={180}
          value={angles.theta2 * 180 / Math.PI}
          onChange={(e, val) => handleAngleChange('theta2', val * Math.PI / 180)}
          size="small"
          sx={sliderSx}
        />
      </Box>

      {/* θ3 */}
      <Box sx={{ mt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" fontFamily="monospace">θ3:</Typography>
          <TextField
            type="number"
            size="small"
            inputProps={{ min: -180, max: 180, step: 1 }}
            value={Math.round(angles.theta3 * 180 / Math.PI)}
            onChange={(e) => handleNumberInput('theta3', parseFloat(e.target.value) || 0)}
            sx={inputSx}
          />
          <Typography variant="body2">°</Typography>
        </Box>
        <Slider
          min={-180}
          max={180}
          value={angles.theta3 * 180 / Math.PI}
          onChange={(e, val) => handleAngleChange('theta3', val * Math.PI / 180)}
          size="small"
          sx={sliderSx}
        />
      </Box>
    </Box>
  );
};

export default JointController;
