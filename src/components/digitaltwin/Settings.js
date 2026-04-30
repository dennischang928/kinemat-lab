import React from 'react';
import { Box, Paper, Typography, Stack, Switch, FormControlLabel } from '@mui/material';

function Settings() {
  const [settings, setSettings] = React.useState(() => {
    const saved = localStorage.getItem('dtSettings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse settings', e);
      }
    }

    return {
      autoReconnect: true,
      logOutput: false,
    };
  });

  React.useEffect(() => {
    localStorage.setItem('dtSettings', JSON.stringify(settings));
  }, [settings]);

  const handleChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
          Connection Settings
        </Typography>

        <Stack spacing={2}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.autoReconnect}
                onChange={(e) => handleChange('autoReconnect', e.target.checked)}
              />
            }
            label="Auto-reconnect on disconnection"
          />

          <FormControlLabel
            control={
              <Switch
                checked={settings.logOutput}
                onChange={(e) => handleChange('logOutput', e.target.checked)}
              />
            }
            label="Log serial output (for debugging)"
          />
        </Stack>
      </Paper>
    </Box>
  );
}

export default Settings;
