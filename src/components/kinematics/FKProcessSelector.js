import React, { useState, useEffect } from 'react';
import { Box, Button, Typography, Paper, Chip, LinearProgress } from '@mui/material';
import { calculateForwardKinematics } from './forwardkinematics';
import './fkprocessselector.css';
/**
 * FK Process Step Selector Component
 * Shows step-by-step forward kinematics visualization with interactive step selection
 */
const FKProcessSelector = ({ angles, linkLengths = { L1: 40, L2: 70, L3: 50 }, onStepChange }) => {
  const [selectedStep, setSelectedStep] = useState(4);
  useEffect(() => {
    onStepChange(selectedStep);
  }, [selectedStep]);

  // Calculate FK with canvas center as base
  const fkResult = calculateForwardKinematics(angles, {
    linkLengths,
    scale: 2,
    baseX: 0,
    baseY: 0,
  });

  const { base, joint1, joint2, joint3, angles: cumulativeAngles } = fkResult;

  // Convert radians to degrees for display
  const toDegrees = (rad) => (rad * 180 / Math.PI).toFixed(1);

  // Define steps with positions and descriptions
  const steps = [
    {
      number: 0,
      title: 'Base Frame',
      description: 'Frame₀ at origin — world reference frame',
      formula: 'T₀ = I (identity)',
      joints: ['base'],
      details: `Base frame (X₀, Y₀) at origin\nNo rotation, no translation`,
    },
    {
      number: 1,
      title: 'Joint-1',
      description: `Rotate frame by θ₁ = ${toDegrees(angles.theta1)}° at origin`,
      formula: 'T₀₁ = Rot(θ₁)',
      joints: ['base'],
      details: `Frame₁ at origin, rotated by θ₁\nRotation only — no translation yet`,
    },
    {
      number: 2,
      title: 'Joint-2',
      description: `Translate L₁ = ${linkLengths.L1}mm along X₁, then rotate θ₂ = ${toDegrees(angles.theta2)}°`,
      formula: 'T₁₂ = Trans(L₁, 0) · Rot(θ₂)',
      joints: ['base', 'joint1'],
      details: `Frame₂ at (${joint1.x.toFixed(1)}, ${joint1.y.toFixed(1)}) px\nTranslate L₁ along X₁, then rotate by θ₂`,
    },
    {
      number: 3,
      title: 'Joint-3',
      description: `Translate L₂ = ${linkLengths.L2}mm along X₂, then rotate θ₃ = ${toDegrees(angles.theta3)}°`,
      formula: 'T₂₃ = Trans(L₂, 0) · Rot(θ₃)',
      joints: ['base', 'joint1', 'joint2'],
      details: `Frame₃ at (${joint2.x.toFixed(1)}, ${joint2.y.toFixed(1)}) px\nTranslate L₂ along X₂, then rotate by θ₃`,
    },
    {
      number: 4,
      title: 'End-Effector',
      description: `Animate full DH chain: Base → Frame₁ → Frame₂ → Frame₃`,
      formula: 'T₀₃ = T₀₁ · T₁₂ · T₂₃',
      joints: ['base', 'joint1', 'joint2', 'joint3'],
      details: `End effector at (${joint3.x.toFixed(1)}, ${joint3.y.toFixed(1)}) px\nFull forward kinematics chain`,
    },
  ];

  const currentStep = steps[selectedStep];

  // Notify parent of step selection
  const handleStepSelect = (step) => {
    setSelectedStep(step);
    if (onStepChange) {
      onStepChange(step);
    }
  };

  const jointColorMap = {
    base: { bgcolor: '#000', color: '#fff' },
    joint1: { bgcolor: '#ffebee', color: '#d32f2f', borderColor: '#d32f2f' },
    joint2: { bgcolor: '#e3f2fd', color: '#1976d2', borderColor: '#1976d2' },
    joint3: { bgcolor: '#e8f5e9', color: '#388e3c', borderColor: '#388e3c' },
  };

  return (
    <Box sx={{ bgcolor: '#f9f9f9', borderTop: '1px solid #ddd', p: 2, overflowY: 'auto', height: '100%' }
    } className="fk-process-selector">
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>Forward Kinematics Process</Typography>
      {/* Step Buttons */}
      <Box sx={{ display: 'flex', gap: 1, mb: 1.5, overflowX: 'auto', py: 0.5, justifyContent: 'space-evenly' }}>
        {steps.map((step) => (
          <Button
            key={step.number}
            variant={selectedStep === step.number ? 'contained' : 'outlined'}
            size="small"
            onClick={() => handleStepSelect(step.number)}
            title={step.title}
            sx={{
              flexShrink: 0,
              flexDirection: 'column',
              minWidth: 60,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '11px',
              py: 0.8,
              px: 1.5,
              borderRadius: '8px',
            }}
          >
            <Typography variant="body2" fontWeight={700} lineHeight={1}>{step.number}</Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>{step.title.split(' ')[0]}</Typography>
          </Button>
        ))}
      </Box>

      {/* Current Step Details */}
      <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, borderBottom: '2px solid #f0f0f0', pb: 1 }}>
          <Typography variant="subtitle2" fontWeight={600}>{currentStep.title}</Typography>
          <Chip label={`Step ${currentStep.number}/4`} size="small" color="info" variant="outlined" sx={{ fontWeight: 600, fontSize: '10px' }} />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2, fontSize: '12px' }}>
          {/* Formula */}
          <Box sx={{ borderLeft: '3px solid #1976d2', pl: 1.2, bgcolor: '#f8fbff', p: 1, borderRadius: '4px' }}>
            <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>Formula:</Typography>
            <Typography variant="body2" component="code" sx={{ fontFamily: 'monospace', color: '#d32f2f', fontSize: '11px', wordBreak: 'break-all', lineHeight: 1.4, display: 'block' }}>
              {currentStep.formula}
            </Typography>
          </Box>

          {/* Calculation */}
          <Box sx={{ borderLeft: '3px solid #1976d2', pl: 1.2, bgcolor: '#f8fbff', p: 1, borderRadius: '4px' }}>
            <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>Calculation:</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '11px', lineHeight: 1.4 }}>
              {currentStep.description}
            </Typography>
          </Box>

          {/* Result */}
          <Box sx={{ borderLeft: '3px solid #1976d2', pl: 1.2, bgcolor: '#f8fbff', p: 1, borderRadius: '4px' }}>
            <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.5 }}>Result:</Typography>
            <Box component="pre" sx={{ m: 0, bgcolor: 'white', p: 0.8, borderRadius: '3px', border: '1px solid #ddd', fontFamily: 'monospace', fontSize: '10px', color: '#333', lineHeight: 1.5, overflowX: 'auto' }}>
              {currentStep.details}
            </Box>
          </Box>

          {/* Joint Progression */}
          <Box sx={{ borderLeft: '3px solid #388e3c', pl: 1.2, bgcolor: '#f1f8f4', p: 1, borderRadius: '4px' }}>
            <Typography variant="caption" fontWeight={600} display="block" sx={{ mb: 0.8 }}>Joints shown:</Typography>
            <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
              {currentStep.joints.map((joint, idx) => (
                <Chip
                  key={joint}
                  label={joint === 'base' ? 'Base' : `J${idx}`}
                  size="small"
                  sx={{
                    fontSize: '10px',
                    fontWeight: 600,
                    height: 22,
                    ...(jointColorMap[joint] || {}),
                  }}
                />
              ))}
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Progress indicator */}
      <LinearProgress
        variant="determinate"
        value={(selectedStep / 4) * 100}
        sx={{ height: 4, borderRadius: 1 }}
      />
    </Box>
  );
};

export default FKProcessSelector;
