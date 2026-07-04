import { Box, List, ListItemButton, Tooltip, IconButton } from '@mui/material';
import { useNavigate, useLocation } from 'react-router';
import TuneIcon from '@mui/icons-material/Tune';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import GitHubIcon from '@mui/icons-material/GitHub';

function MainSidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { id: 'kinematics', path: '/kinematics', label: '2D Kinematics', icon: TuneIcon },
    { id: 'digitaltwin', path: '/digitaltwin', label: 'Digital Twin', icon: SmartToyIcon },
  ];

  const isActive = (path) => location.pathname === path || (path === '/kinematics' && location.pathname === '/');

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
          cursor: 'pointer',
        }}
        onClick={() => navigate('/kinematics')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate('/kinematics');
          }
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
              onClick={() => navigate(item.path)}
              selected={isActive(item.path)}
              sx={{
                minHeight: 48,
                borderRadius: 2,
                justifyContent: 'center',
                bgcolor: isActive(item.path) ? '#2f2f2f' : 'transparent',
                border: isActive(item.path) ? '1px solid #444' : '1px solid transparent',
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
                  color: isActive(item.path) ? '#61dafb' : '#d0d0d0',
                }}
              />
            </ListItemButton>
          </Tooltip>
        ))}
      </List>

      <Box sx={{ p: 1.5, borderTop: '1px solid #2a2a2a', display: 'flex', justifyContent: 'center' }}>
        <Tooltip title="Project repository" placement="right" arrow>
          <IconButton
            component="a"
            href="https://github.com/dennischang928/kinemat-firmware"
            target="_blank"
            rel="noreferrer"
            aria-label="Project repository"
            sx={{
              color: '#d0d0d0',
              '&:hover': {
                color: '#ffffff',
                bgcolor: '#2a2a2a',
              },
            }}
          >
            <GitHubIcon fontSize="medium" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

export default MainSidebar;
