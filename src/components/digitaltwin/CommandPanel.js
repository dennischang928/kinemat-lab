import { useState, useEffect } from 'react';
import { Box, Paper, Stack, Typography, Slider, Button, Fade, Alert } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import SendIcon from '@mui/icons-material/Send';

export default function CommandPanel({
  connection,
  isTorqueEnabled = true,
  isActionButtonsLocked = false,
  hasSynced = false,
  autoSyncTrigger = 0,
  feedrate = 300,
  onFeedrateChange = () => {},
  marks = [],
  showSpeedSlider = true,
  buildSendCommand = null,
  onSendAction = null,
  sendLabel = 'Send',
  showErrorAlert = false,
  error = null,
}) {
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (!autoSyncTrigger) return;
    if (!connection.isConnected) return;
    handleSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSyncTrigger]);

  const handleSync = async () => {
    if (!connection.isConnected) {
      connection.setError('Connect to a serial port before syncing.');
      return;
    }

    if (!isTorqueEnabled) {
      connection.setError('Turn torque on before syncing.');
      return;
    }

    setIsSyncing(true);
    try {
      const ok = await connection.sendCommandWithTimeout('M114\n');
      if (!ok) {
        connection.setError('No OK received from arm.');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSend = async () => {
    if (!isTorqueEnabled || isActionButtonsLocked) {
      connection.setError('Turn torque on before sending.');
      return;
    }

    // If onSendAction provided (e.g., for program), call it instead of serial send
    if (onSendAction) {
      onSendAction();
      return;
    }

    // Otherwise, build and send serial command
    if (!buildSendCommand) {
      connection.setError('No send action configured.');
      return;
    }

    if (!connection.isConnected) {
      connection.setError('Connect to a serial port before sending.');
      return;
    }

    const command = buildSendCommand();
    if (!command) {
      connection.setError('Failed to build send command.');
      return;
    }

    const ok = await connection.sendCommandWithTimeout(command);
    if (!ok) {
      connection.setError('No OK received from arm.');
    }
  };

  const sendDisabled = !connection.isConnected || !isTorqueEnabled || isActionButtonsLocked || !hasSynced || (!buildSendCommand && !onSendAction);

  return (
    <Box sx={{ p: 3, pt: 2 }}>
      <Paper sx={{ p: 2, boxShadow: 3 }}>
        {showSpeedSlider && (
          <>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Speed (F): {feedrate}
            </Typography>
            <Slider
              value={feedrate}
              onChange={(e, val) => onFeedrateChange(val)}
              min={0}
              max={1000}
              step={null}
              marks={marks}
              valueLabelDisplay="auto"
              sx={{ mb: 4 }}
            />
          </>
        )}
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Button
            variant="outlined"
            onClick={handleSync}
            disabled={!connection.isConnected || isSyncing || !isTorqueEnabled || isActionButtonsLocked}
            size="large"
            startIcon={<SyncIcon />}
          >
            {isSyncing ? 'Syncing...' : 'Sync'}
          </Button>
          <Button
            variant="contained"
            onClick={handleSend}
            disabled={sendDisabled}
            fullWidth
            size="large"
            endIcon={<SendIcon />}
          >
            {sendLabel}
          </Button>
        </Stack>
      </Paper>

      <Fade in={showErrorAlert} timeout={350}>
        <Box sx={{ mt: 2 }}>
          {error && (
            <Alert variant="filled" severity="error" sx={{ boxShadow: 3 }}>
              {error}
            </Alert>
          )}
        </Box>
      </Fade>
    </Box>
  );
}
