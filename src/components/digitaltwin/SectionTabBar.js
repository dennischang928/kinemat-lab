import { Box } from '@mui/material';

const SECTIONS = [
  { key: 'control', label: 'Control' },
  { key: 'pose', label: 'Pose Control' },
  { key: 'programming', label: 'Programming' },
  { key: 'settings', label: 'Settings' },
];

/**
 * Horizontal tab bar for switching between digital-twin sections.
 *
 * Pure presentational — the active section and the change handler are
 * provided by the parent.
 */
export default function SectionTabBar({ activeSection, onSectionChange }) {
  return (
    <Box sx={{ p: 2, borderBottom: '1px solid #ddd', flexShrink: 0 }}>
      <Box sx={{ display: 'flex', gap: 1 }}>
        {SECTIONS.map(({ key, label }) => (
          <Box
            key={key}
            onClick={() => onSectionChange(key)}
            sx={{
              flex: 1,
              p: 1,
              textAlign: 'center',
              cursor: 'pointer',
              bgcolor: activeSection === key ? '#282c34' : '#f0f0f0',
              color: activeSection === key ? 'white' : '#333',
              borderRadius: '4px',
              fontWeight: activeSection === key ? 600 : 400,
              fontSize: '0.9rem',
            }}
          >
            {label}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
