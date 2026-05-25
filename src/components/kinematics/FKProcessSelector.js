import React, { useState, useEffect } from 'react';
import { Box, Button, Typography, Paper, LinearProgress } from '@mui/material';
import { BlockMath, InlineMath } from 'react-katex';
import fkProcessSteps from './fkProcessSteps';
import 'katex/dist/katex.min.css';
import './fkprocessselector.css';

const PANEL_SX = {
  bgcolor: '#ffffff',
  border: '1px solid #e8dfbe',
  borderRadius: '6px',
};

const MathCard = ({ children, sx = {} }) => (
  <Box sx={{ ...PANEL_SX, p: 1, overflowX: 'auto', ...sx }}>{children}</Box>
);


/**
 * FK Process Step Selector Component
 * Shows step-by-step forward kinematics visualization with interactive step selection
 */
const FKProcessSelector = ({
  onStepChange,
  isPlayAllActive = false,
  angles = { theta1: 0, theta2: 0, theta3: 0 },
  linkLengths = { L1: 40, L2: 70, L3: 50 },
}) => {
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
        <MathCard>
          <BlockMath math={step.latexMath || ''} />
        </MathCard>
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
          <MathCard key={`item-block-${index}`} sx={{ height: 'auto' }}>
            <BlockMath math={item.value} />
          </MathCard>
        );
      }

      if (item.type === 'spacer') {
        return <Box key={`item-space-${index}`} sx={{ height: item.size || 8 }} />;
      }

      return null;
    });
  };

  const formatLatexNumber = (value) => {
    if (!Number.isFinite(value)) {
      return '0';
    }

    const rounded = Number(value.toFixed(3));
    return Object.is(rounded, -0) ? '0' : `${rounded}`;
  };

  const renderPluggingInParameters = (stepNumber) => {
    const theta1 = Number(angles.theta1) || 0;
    const theta2 = Number(angles.theta2) || 0;
    const theta3 = Number(angles.theta3) || 0;
    const { L1, L2, L3 } = linkLengths;

    const absolute1 = theta1;
    const absolute2 = theta1 + theta2;
    const absolute3 = theta1 + theta2 + theta3;

    const angle1Text = formatLatexNumber(absolute1);
    const angle2Text = formatLatexNumber(absolute2);
    const angle3Text = formatLatexNumber(absolute3);

    const substitutedByStep = {
      1: String.raw`^0T_1 = \begin{bmatrix}
\cos(${angle1Text}) & -\sin(${angle1Text}) & 0 & 0 \\
\sin(${angle1Text}) & \cos(${angle1Text}) & 0 & 0 \\
0 & 0 & 1 & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}`,
      2: String.raw`^0T_2 = \begin{bmatrix}
\cos(${angle2Text}) & -\sin(${angle2Text}) & 0 & ${formatLatexNumber(L1)}\cos(${angle1Text}) \\
\sin(${angle2Text}) & \cos(${angle2Text}) & 0 & ${formatLatexNumber(L1)}\sin(${angle1Text}) \\
0 & 0 & 1 & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}`,
      3: String.raw`^0T_3 = \begin{bmatrix}
\cos(${angle3Text}) & -\sin(${angle3Text}) & 0 & ${formatLatexNumber(L1)}\cos(${angle1Text}) + ${formatLatexNumber(L2)}\cos(${angle2Text}) \\
\sin(${angle3Text}) & \cos(${angle3Text}) & 0 & ${formatLatexNumber(L1)}\sin(${angle1Text}) + ${formatLatexNumber(L2)}\sin(${angle2Text}) \\
0 & 0 & 1 & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}`,
      4: String.raw`^0T_4 = \begin{bmatrix}
\cos(${angle3Text}) & -\sin(${angle3Text}) & 0 & ${formatLatexNumber(L1)}\cos(${angle1Text}) + ${formatLatexNumber(L2)}\cos(${angle2Text}) + ${formatLatexNumber(L3)}\cos(${angle3Text}) \\
\sin(${angle3Text}) & \cos(${angle3Text}) & 0 & ${formatLatexNumber(L1)}\sin(${angle1Text}) + ${formatLatexNumber(L2)}\sin(${angle2Text}) + ${formatLatexNumber(L3)}\sin(${angle3Text}) \\
0 & 0 & 1 & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}`,
    };

    const evaluatedByStep = {
      1: String.raw`^0T_1 \approx \begin{bmatrix}
${formatLatexNumber(Math.cos(absolute1))} & ${formatLatexNumber(-Math.sin(absolute1))} & 0 & 0 \\
${formatLatexNumber(Math.sin(absolute1))} & ${formatLatexNumber(Math.cos(absolute1))} & 0 & 0 \\
0 & 0 & 1 & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}`,
      2: String.raw`^0T_2 \approx \begin{bmatrix}
${formatLatexNumber(Math.cos(absolute2))} & ${formatLatexNumber(-Math.sin(absolute2))} & 0 & ${formatLatexNumber(L1 * Math.cos(absolute1))} \\
${formatLatexNumber(Math.sin(absolute2))} & ${formatLatexNumber(Math.cos(absolute2))} & 0 & ${formatLatexNumber(L1 * Math.sin(absolute1))} \\
0 & 0 & 1 & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}`,
      3: String.raw`^0T_3 \approx \begin{bmatrix}
${formatLatexNumber(Math.cos(absolute3))} & ${formatLatexNumber(-Math.sin(absolute3))} & 0 & ${formatLatexNumber(L1 * Math.cos(absolute1) + L2 * Math.cos(absolute2))} \\
${formatLatexNumber(Math.sin(absolute3))} & ${formatLatexNumber(Math.cos(absolute3))} & 0 & ${formatLatexNumber(L1 * Math.sin(absolute1) + L2 * Math.sin(absolute2))} \\
0 & 0 & 1 & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}`,
      4: String.raw`^0T_4 \approx \begin{bmatrix}
${formatLatexNumber(Math.cos(absolute3))} & ${formatLatexNumber(-Math.sin(absolute3))} & 0 & ${formatLatexNumber(L1 * Math.cos(absolute1) + L2 * Math.cos(absolute2) + L3 * Math.cos(absolute3))} \\
${formatLatexNumber(Math.sin(absolute3))} & ${formatLatexNumber(Math.cos(absolute3))} & 0 & ${formatLatexNumber(L1 * Math.sin(absolute1) + L2 * Math.sin(absolute2) + L3 * Math.sin(absolute3))} \\
0 & 0 & 1 & 0 \\
0 & 0 & 0 & 1
\end{bmatrix}`,
    };

    return (
      <Box sx={{ display: 'grid', gap: 1, pr: 0.5 }}>
          <MathCard sx={{ p: 0.75 }}>
            <BlockMath math={substitutedByStep[stepNumber] || ''} />
          </MathCard>

          <MathCard sx={{ p: 0.75 }}>
            <BlockMath math={evaluatedByStep[stepNumber] || ''} />
          </MathCard>
      </Box>
    );
  };

  const currentStep = fkProcessSteps[selectedStep];

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
    <Box
      className="fk-process-selector"
      sx={{
        bgcolor: '#f9f9f9',
        borderTop: '1px solid #ddd',
        p: 2,
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
        Forward Kinematics Process
      </Typography>

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
            <Typography variant="body2" fontWeight={700} lineHeight={1}>
              {step.number}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              {step.title.split(' ')[0]}
            </Typography>
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
          minHeight: 0,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        <Box sx={{ minHeight: 0, flex: 1, pr: 0.5 }}>
          <Typography variant="caption" fontWeight={700} display="block" sx={{ mb: 0.8, color: '#6a5d1a' }}>
            {currentStep.title}
          </Typography>
          {renderStepContent(currentStep)}
          <Typography variant="caption" fontWeight={700} display="block" sx={{ mt: 1.2, mb: 0.8, color: '#6a5d1a' }}>
            Plugging in the parameters:
          </Typography>
          {renderPluggingInParameters(currentStep.number)}
        </Box>
      </Paper>

      <LinearProgress
        variant="determinate"
        value={(selectedStep / 4) * 100}
        sx={{ height: 4, borderRadius: 1 }}
      />
    </Box>
  );
};

export default FKProcessSelector;
