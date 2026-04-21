import React, { useState, useEffect } from 'react';
import { Box, Button, Typography, Paper, LinearProgress } from '@mui/material';
import { BlockMath, InlineMath } from 'react-katex';
import fkProcessSteps from './fkProcessSteps';
import 'katex/dist/katex.min.css';
import './fkprocessselector.css';
/**
 * FK Process Step Selector Component
 * Shows step-by-step forward kinematics visualization with interactive step selection
 */
const FKProcessSelector = ({ onStepChange, isPlayAllActive = false }) => {
  const [selectedStep, setSelectedStep] = useState(4);

  useEffect(() => {
    if (onStepChange) {
      onStepChange(selectedStep);
    }
  }, [selectedStep, onStepChange]);

  const renderInlineParts = (parts = [], keyPrefix = 'part') => (
    <Typography
      variant="body2"
      sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5, lineHeight: 1.7 }}
    >
      {parts.map((part, index) => {
        if (typeof part === 'string') {
          return <span key={`${keyPrefix}-text-${index}`}>{part}</span>;
        }

        if (part.type === 'inlineMath') {
          return (
            <InlineMath
              key={`${keyPrefix}-inline-${index}`}
              math={part.value}
            />
          );
        }

        return null;
      })}
    </Typography>
  );

  const renderStepContent = (step) => {
    if (!Array.isArray(step.content) || step.content.length === 0) {
      return (
        <Box
          sx={{
            bgcolor: '#ffffff',
            border: '1px solid #e8dfbe',
            borderRadius: '6px',
            p: 1,
            overflowX: 'auto',
          }}
        >
          <BlockMath math={step.latexMath || ''} />
        </Box>
      );
    }

    return step.content.map((item, index) => {
      if (typeof item === 'string') {
        return (
          <Typography key={`item-text-${index}`} variant="body2" sx={{ lineHeight: 1.7 }}>
            {item}
          </Typography>
        );
      }

      if (item.type === 'line') {
        return <Box key={`item-line-${index}`}>{renderInlineParts(item.parts, `line-${index}`)}</Box>;
      }

      if (item.type === 'text') {
        return (
          <Typography key={`item-p-${index}`} variant="body2" sx={{ lineHeight: 1.7 }}>
            {item.value}
          </Typography>
        );
      }

      if (item.type === 'inlineMath') {
        return (
          <Typography key={`item-inline-${index}`} variant="body2" sx={{ lineHeight: 1.7 }}>
            <InlineMath math={item.value} />
          </Typography>
        );
      }

      if (item.type === 'blockMath') {
        return (
          <Box
            key={`item-block-${index}`}
            sx={{
              bgcolor: '#ffffff',
              border: '1px solid #e8dfbe',
              borderRadius: '6px',
              p: 1,
              overflowX: 'auto',
            }}
          >
            <BlockMath math={item.value} />
          </Box>
        );
      }

      if (item.type === 'spacer') {
        return <Box key={`item-space-${index}`} sx={{ height: item.size || 8 }} />;
      }

      return null;
    });
  };

  const currentStep = fkProcessSteps[selectedStep];

  // Notify parent of step selection
  const handleStepSelect = (step) => {
    setSelectedStep(step);
    if (onStepChange) {
      onStepChange(step);
    }
  };

  const handlePlayAll = () => {
    if (onStepChange) {
      onStepChange('play-all');
    }
  };

  return (
    <Box sx={{ bgcolor: '#f9f9f9', borderTop: '1px solid #ddd', p: 2, overflowY: 'auto', height: '100%' }
    } className="fk-process-selector">
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>Forward Kinematics Process</Typography>
      {/* Step Buttons */}
      <Box sx={{ display: 'flex', gap: 1, mb: 1.5, overflowX: 'auto', py: 0.5, justifyContent: 'space-evenly' }}>
        {fkProcessSteps.map((step) => (
          <Button
            key={step.number}
            variant={selectedStep === step.number ? 'contained' : 'outlined'}
            size="small"
            onClick={() => handleStepSelect(step.number)}
            disabled={isPlayAllActive}
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
        <Button
          variant={isPlayAllActive ? 'contained' : 'outlined'}
          color="secondary"
          size="small"
          onClick={handlePlayAll}
          title={isPlayAllActive ? 'Stop full transform sequence' : 'Play full transform sequence'}
          sx={{
            flexShrink: 0,
            minWidth: 88,
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '11px',
            py: 0.8,
            px: 1.6,
            borderRadius: '8px',
          }}
        >
          {isPlayAllActive ? 'Stop' : 'Play All'}
        </Button>
      </Box>

      <Paper
        variant="outlined"
        sx={{
          p: 1.2,
          mb: 1.5,
          bgcolor: '#fffef8',
          borderColor: '#e0d9b7',
        }}
      >
        <Typography variant="caption" fontWeight={700} display="block" sx={{ mb: 0.8, color: '#6a5d1a' }}>
          {currentStep.title}
        </Typography>
        {renderStepContent(currentStep)}
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
