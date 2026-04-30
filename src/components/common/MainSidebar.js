import { Box, List, ListItemButton, Tooltip } from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import SmartToyIcon from '@mui/icons-material/SmartToy';

function MainSidebar({ activeView, onViewChange }) {
  const menuItems = [
    { id: 'kinematics', label: '2D Kinematics', icon: TuneIcon },
    { id: 'digitaltwin', label: 'Digital Twin', icon: SmartToyIcon },
  ];

  return (
    <Box
      sx={{
        width: '72px',
        height: '100vh',
        bgcolor: '#1b1b1b',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #2a2a2a',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <Box
        sx={{
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid #2a2a2a',
        }}
      >
        <Box
          component="img"
          src="/favicon.svg"
          alt="Kinematic Lab"
          sx={{ width: 34, height: 34, display: 'block' }}
        />
      </Box>

      {/* Menu Items */}
      <List sx={{ flex: 1, p: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {menuItems.map((item) => (
          <Tooltip key={item.id} title={item.label} placement="right" arrow>
            <ListItemButton
              onClick={() => onViewChange(item.id)}
              selected={activeView === item.id}
              sx={{
                minHeight: 48,
                borderRadius: 2,
                justifyContent: 'center',
                bgcolor: activeView === item.id ? '#2f2f2f' : 'transparent',
                border: activeView === item.id ? '1px solid #444' : '1px solid transparent',
                '&:hover': {
                  bgcolor: '#2a2a2a',
                },
                '&.Mui-selected': {
                  bgcolor: '#2f2f2f',
                },
              }}
            >
              <Box
                component={item.icon}
                sx={{
                  fontSize: 28,
                  color: activeView === item.id ? '#61dafb' : '#d0d0d0',
                }}
              />
            </ListItemButton>
          </Tooltip>
        ))}
      </List>
    </Box>
  );
}

export default MainSidebar;
