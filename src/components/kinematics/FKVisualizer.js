import React from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { calculateForwardKinematics } from './forwardkinematics';

/**
 * FK Visualizer Component
 * Displays forward kinematics calculation results and process visualization
 */
const FKVisualizer = ({ angles, linkLengths = { L1: 40, L2: 70, L3: 50 }, scale = 2 }) => {
  const fkResult = calculateForwardKinematics(angles, {
    linkLengths,
    scale,
    baseX: 0,
    baseY: 0,
  });

  const { base, joint1, joint2, joint3, angles: cumulativeAngles, linkLengths: calculatedLengths, reach } = fkResult;

  const toDegrees = (rad) => (rad * 180 / Math.PI).toFixed(2);
  const toDistance = (px) => (px / scale).toFixed(2);

  const cellSx = { fontFamily: 'monospace', fontSize: '12px', py: 0.8, px: 1.2 };
  const headerSx = { fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: '#555', py: 0.8, px: 1.2 };

  return (
    <Box sx={{ bgcolor: '#f5f5f5', borderRadius: 2, p: 1.5, fontSize: '12px' }}>
      {/* Joint Positions */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, borderBottom: '2px solid #ddd', pb: 0.8 }}>Joint Positions (in pixels)</Typography>
        <TableContainer component={Paper} variant="outlined" sx={{ boxShadow: 'none' }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f0f0f0' }}>
              <TableRow>
                <TableCell sx={headerSx}>Joint</TableCell>
                <TableCell sx={headerSx}>X (px)</TableCell>
                <TableCell sx={headerSx}>Y (px)</TableCell>
                <TableCell sx={headerSx}>Distance from Base (mm)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell sx={{ ...cellSx, color: '#000', fontWeight: 600 }}>Base</TableCell>
                <TableCell sx={cellSx}>{base.x.toFixed(1)}</TableCell>
                <TableCell sx={cellSx}>{base.y.toFixed(1)}</TableCell>
                <TableCell sx={cellSx}>0.00</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ ...cellSx, color: '#d32f2f', fontWeight: 600 }}>Joint 1</TableCell>
                <TableCell sx={cellSx}>{joint1.x.toFixed(1)}</TableCell>
                <TableCell sx={cellSx}>{joint1.y.toFixed(1)}</TableCell>
                <TableCell sx={cellSx}>{toDistance(calculatedLengths.link1)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ ...cellSx, color: '#1976d2', fontWeight: 600 }}>Joint 2</TableCell>
                <TableCell sx={cellSx}>{joint2.x.toFixed(1)}</TableCell>
                <TableCell sx={cellSx}>{joint2.y.toFixed(1)}</TableCell>
                <TableCell sx={cellSx}>{toDistance(Math.hypot(joint2.x - base.x, joint2.y - base.y))}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ ...cellSx, color: '#388e3c', fontWeight: 600 }}>End Effector</TableCell>
                <TableCell sx={cellSx}>{joint3.x.toFixed(1)}</TableCell>
                <TableCell sx={cellSx}>{joint3.y.toFixed(1)}</TableCell>
                <TableCell sx={cellSx}>{toDistance(reach)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Absolute Angles */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, borderBottom: '2px solid #ddd', pb: 0.8 }}>Absolute Angles (degrees)</Typography>
        <TableContainer component={Paper} variant="outlined" sx={{ boxShadow: 'none' }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f0f0f0' }}>
              <TableRow>
                <TableCell sx={headerSx}>Joint</TableCell>
                <TableCell sx={headerSx}>Cumulative Angle</TableCell>
                <TableCell sx={headerSx}>Description</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow sx={{ bgcolor: '#ffebee' }}>
                <TableCell sx={cellSx}>θ₁</TableCell>
                <TableCell sx={cellSx}>{toDegrees(cumulativeAngles.absolute1)}°</TableCell>
                <TableCell sx={cellSx}>Base rotation</TableCell>
              </TableRow>
              <TableRow sx={{ bgcolor: '#e3f2fd' }}>
                <TableCell sx={cellSx}>θ₁ + θ₂</TableCell>
                <TableCell sx={cellSx}>{toDegrees(cumulativeAngles.absolute2)}°</TableCell>
                <TableCell sx={cellSx}>Joint 1 orientation</TableCell>
              </TableRow>
              <TableRow sx={{ bgcolor: '#e8f5e9' }}>
                <TableCell sx={cellSx}>θ₁ + θ₂ + θ₃</TableCell>
                <TableCell sx={cellSx}>{toDegrees(cumulativeAngles.absolute3)}°</TableCell>
                <TableCell sx={cellSx}>End effector orientation</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Link Information */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, borderBottom: '2px solid #ddd', pb: 0.8 }}>Link Information</Typography>
        <TableContainer component={Paper} variant="outlined" sx={{ boxShadow: 'none' }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f0f0f0' }}>
              <TableRow>
                <TableCell sx={headerSx}>Link</TableCell>
                <TableCell sx={headerSx}>Length (mm)</TableCell>
                <TableCell sx={headerSx}>Rendered Length (px)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow sx={{ bgcolor: '#fff3e0' }}>
                <TableCell sx={cellSx}>Link 1 (Base → Joint 1)</TableCell>
                <TableCell sx={cellSx}>{linkLengths.L1}</TableCell>
                <TableCell sx={cellSx}>{calculatedLengths.link1.toFixed(1)}</TableCell>
              </TableRow>
              <TableRow sx={{ bgcolor: '#f3e5f5' }}>
                <TableCell sx={cellSx}>Link 2 (Joint 1 → Joint 2)</TableCell>
                <TableCell sx={cellSx}>{linkLengths.L2}</TableCell>
                <TableCell sx={cellSx}>{calculatedLengths.link2.toFixed(1)}</TableCell>
              </TableRow>
              <TableRow sx={{ bgcolor: '#e0f2f1' }}>
                <TableCell sx={cellSx}>Link 3 (Joint 2 → End Effector)</TableCell>
                <TableCell sx={cellSx}>{linkLengths.L3}</TableCell>
                <TableCell sx={cellSx}>{calculatedLengths.link3.toFixed(1)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Workspace */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, borderBottom: '2px solid #ddd', pb: 0.8 }}>Workspace</Typography>
        <Box sx={{ display: 'grid', gap: 1, mt: 1 }}>
          {[
            { label: 'Total Reach', value: `${toDistance(reach)} mm (${reach.toFixed(1)} px)` },
            { label: 'Max Reach', value: `${(linkLengths.L1 + linkLengths.L2 + linkLengths.L3).toFixed(2)} mm` },
            { label: 'Min Reach', value: `${Math.abs(linkLengths.L1 + linkLengths.L2 - linkLengths.L3).toFixed(2)} mm` },
          ].map((stat) => (
            <Paper key={stat.label} variant="outlined" sx={{ p: 1, borderLeft: '4px solid #1976d2' }}>
              <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, color: '#666' }}>{stat.label}</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, color: '#1976d2' }}>{stat.value}</Typography>
            </Paper>
          ))}
        </Box>
      </Box>

      {/* FK Process (Step-by-Step) */}
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1, borderBottom: '2px solid #ddd', pb: 0.8 }}>FK Process (Step-by-Step)</Typography>
        <Paper variant="outlined" sx={{ display: 'flex', alignItems: 'center', gap: 0.8, p: 1.2, overflowX: 'auto', fontSize: '10px' }}>
          {[ 
            { num: 1, title: 'Base Position', lines: ['P₀ = (0, 0)'] },
            { num: 2, title: 'Joint 1', lines: [`Using angle θ₁ = ${toDegrees(angles.theta1)}°`, 'P₁ = P₀ + L₁ × [cos(θ₁), -sin(θ₁)]', `P₁ = (${joint1.x.toFixed(1)}, ${joint1.y.toFixed(1)})`] },
            { num: 3, title: 'Joint 2', lines: [`Using angle θ₁ + θ₂ = ${toDegrees(cumulativeAngles.absolute2)}°`, 'P₂ = P₁ + L₂ × [cos(θ₁+θ₂), -sin(θ₁+θ₂)]', `P₂ = (${joint2.x.toFixed(1)}, ${joint2.y.toFixed(1)})`] },
            { num: 4, title: 'End Effector', lines: [`Using angle θ₁ + θ₂ + θ₃ = ${toDegrees(cumulativeAngles.absolute3)}°`, 'P₃ = P₂ + L₃ × [cos(θ₁+θ₂+θ₃), -sin(θ₁+θ₂+θ₃)]', `P₃ = (${joint3.x.toFixed(1)}, ${joint3.y.toFixed(1)})`] },
          ].map((step, i) => (
            <React.Fragment key={step.num}>
              {i > 0 && <Typography sx={{ color: '#1976d2', fontWeight: 'bold', fontSize: 14, flexShrink: 0 }}>→</Typography>}
              <Paper elevation={0} sx={{ display: 'flex', gap: 1, flexShrink: 0, minWidth: 140, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', p: '8px 10px', border: '1px solid #ddd' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, bgcolor: '#1976d2', color: 'white', borderRadius: '50%', fontWeight: 700, flexShrink: 0, fontSize: 11 }}>
                  {step.num}
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px', color: '#333' }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 'bold', color: '#000' }}>{step.title}</Typography>
                  {step.lines.map((line, j) => (
                    <Typography key={j} sx={{ fontSize: 9, color: '#666', fontFamily: 'monospace', lineHeight: 1.3, m: 0 }}>{line}</Typography>
                  ))}
                </Box>
              </Paper>
            </React.Fragment>
          ))}
        </Paper>
      </Box>
    </Box>
  );
};

export default FKVisualizer;