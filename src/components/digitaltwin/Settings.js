import React from 'react';
import { Box, Paper, Typography, Stack, Switch, FormControlLabel, Divider } from '@mui/material';

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
      autoReconnect: false,
      logOutput: false,
      useWorldTranslation: true,
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
                checked={settings.useWorldTranslation || false}
                onChange={(e) => handleChange('useWorldTranslation', e.target.checked)}
              />
            }
            label="Use world-space translation
          />

          <Divider />

          <FormControlLabel
            control={
              <Switch
                checked={settings.showGrid || false}
                onChange={(e) => handleChange('showGrid', e.target.checked)}
              />
            }
            label="Show grid lines"
          />

          <FormControlLabel
            control={
              <Switch
                checked={settings.showAxes || false}
                onChange={(e) => handleChange('showAxes', e.target.checked)}
              />
            }
            label="Show axis"
          />

          <Divider />

          <FormControlLabel
            control={
              <Switch
                checked={settings.autoReconnect}
                onChange={(e) => handleChange('autoReconnect', e.target.checked)}
              />
            }
            label="Auto reconnect on this connection"
          />

          <FormControlLabel
            control={
              <Switch
                checked={settings.logOutput}
                onChange={(e) => handleChange('logOutput', e.target.checked)}
              />
            }
            label="Lock serial output"
          />
        </Stack>
      </Paper>
    </Box>
  );
}

export default Settings;
