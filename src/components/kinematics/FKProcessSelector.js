import React, { useState, useEffect } from 'react';
import { Box, Button, Typography, Paper, Chip, LinearProgress } from '@mui/material';
import { calculateForwardKinematics } from './forwardkinematics';

/**
 * FK Process Step Selector Component
 * Shows step-by-step forward kinematics visualization with interactive step selection
 */
const FKProcessSelector = ({ angles, linkLengths = { L1: 40, L2: 70, L3: 50 }, onStepChange }) => {
  const [selectedStep, setSelectedStep] = useState(5);
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
      number: 1,
      title: 'Base Position',
      description: 'P₀ = (0, 0)',
      formula: 'Starting point at origin',
      joints: ['base'],
      details: `Base located at canvas center`,
    },
    {
      number: 2,
      title: 'Joint 1 Calculation',
      description: `Using θ₁ = ${toDegrees(angles.theta1)}°`,
      formula: 'P₁ = P₀ + L₁ × [cos(θ₁), -sin(θ₁)]',
      joints: ['base', 'joint1'],
      details: `P₁ = (${joint1.x.toFixed(1)}, ${joint1.y.toFixed(1)}) px\nLink 1 length: ${linkLengths.L1}mm`,
    },
    {
      number: 3,
      title: 'Joint 2 Calculation',
      description: `Using θ₁ + θ₂ = ${toDegrees(cumulativeAngles.absolute2)}°`,
      formula: 'P₂ = P₁ + L₂ × [cos(θ₁+θ₂), -sin(θ₁+θ₂)]',
      joints: ['base', 'joint1', 'joint2'],
      details: `P₂ = (${joint2.x.toFixed(1)}, ${joint2.y.toFixed(1)}) px\nLink 2 length: ${linkLengths.L2}mm`,
    },
    {
      number: 4,
      title: 'End Effector (Joint 3)',
      description: `Using θ₁ + θ₂ + θ₃ = ${toDegrees(cumulativeAngles.absolute3)}°`,
      formula: 'P₃ = P₂ + L₃ × [cos(θ₁+θ₂+θ₃), -sin(θ₁+θ₂+θ₃)]',
      joints: ['base', 'joint1', 'joint2', 'joint3'],
      details: `P₃ = (${joint3.x.toFixed(1)}, ${joint3.y.toFixed(1)}) px\nLink 3 length: ${linkLengths.L3}mm\nTotal Reach: ${Math.hypot(joint3.x, joint3.y).toFixed(1)} px`,
    },
    {
      number: 5,
      title: 'Play All Animations',
      description: `Animate the full sequence from base to end effector.`,
      formula: 'Sequence: Base -> J1 -> J2 -> J3',
      joints: ['base', 'joint1', 'joint2', 'joint3'],
      details: `Full forward kinematics structural sequence.`,
    },
  ];

  const currentStep = steps[selectedStep - 1];

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
    <Box sx={{ bgcolor: '#f9f9f9', borderTop: '1px solid #ddd', p: 2, overflowY: 'auto', maxHeight: 400 }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>Forward Kinematics Process</Typography>

      {/* Step Buttons */}
      <Box sx={{ display: 'flex', gap: 1, mb: 1.5, overflowX: 'auto', py: 0.5 }}>
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
          <Chip label={`Step ${currentStep.number}/5`} size="small" color="info" variant="outlined" sx={{ fontWeight: 600, fontSize: '10px' }} />
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
        value={(selectedStep / 5) * 100}
        sx={{ height: 4, borderRadius: 1 }}
      />
    </Box>
  );
};

export default FKProcessSelector;
