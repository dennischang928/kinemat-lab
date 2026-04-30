import { Box, List, ListItemButton, ListItemText, Divider, Typography } from '@mui/material';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import SettingsIcon from '@mui/icons-material/Settings';

function Sidebar({ activeSection, onSectionChange }) {
  const menuItems = [
    { id: 'control', label: 'Control Panel', icon: SignalCellularAltIcon },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <Box
      sx={{
        width: '250px',
        height: '100vh',
        bgcolor: '#282c34',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #3a3f4a',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid #3a3f4a' }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
          Digital Twin
        </Typography>
        <Typography variant="caption" sx={{ color: '#aaa' }}>
          Robot Control Interface
        </Typography>
      </Box>

      {/* Menu Items */}
      <List sx={{ flex: 1, p: 0 }}>
        {menuItems.map((item) => (
          <ListItemButton
            key={item.id}
            onClick={() => onSectionChange(item.id)}
            selected={activeSection === item.id}
            sx={{
              bgcolor: activeSection === item.id ? '#3a3f4a' : 'transparent',
              borderLeft: activeSection === item.id ? '4px solid #61dafb' : 'none',
              pl: activeSection === item.id ? '16px' : '20px',
              '&:hover': {
                bgcolor: '#3a3f4a',
              },
            }}
          >
            <ListItemText 
              primary={item.label}
              primaryTypographyProps={{
                sx: {
                  fontSize: '0.95rem',
                  fontWeight: activeSection === item.id ? 600 : 400,
                }
              }}
            />
          </ListItemButton>
        ))}
      </List>

      <Divider sx={{ bgcolor: '#3a3f4a' }} />

      <Box sx={{ p: 2, color: '#888', fontSize: '0.8rem', textAlign: 'center' }}>
        Digital Twin
      </Box>
    </Box>
  );
}

export default Sidebar;
