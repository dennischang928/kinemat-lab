import { useEffect } from 'react';
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
  // lifted syncing state from parent
  isSyncing = false,
  setIsSyncing = () => {},
}) {
  const SYNC_RETRY_MS = 500;
  const SYNC_TIMEOUT_MS = 7000;

  useEffect(() => {
    if (!autoSyncTrigger) return;
    if (!connection.isConnected) return;
    // Parent triggered an auto-sync (e.g. after connect or torque-on).
    // `handleSync` issues `M114` and `ControlPanel` parses the returned
    // position report to mark the UI as synced.
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

    // Mark UI as syncing while we wait for the arm to reply. The
    // read loop (subscribers) is responsible for parsing the reply
    // and calling `setHasSynced(true)` in `ControlPanel`.
    setIsSyncing(true);
    try {
      const startedAt = Date.now();
      while (Date.now() - startedAt < SYNC_TIMEOUT_MS) {
        console.log('Attempting to sync...');
        const ok = await connection.sendCommandWithTimeout('M114\n', { timeout: SYNC_RETRY_MS });
        if (ok) {
          return;
        }
      }

      connection.setError('Oh no, command not received.');
      setIsSyncing(false);
    } catch (e) {
      // Ensure syncing state is cleared on unexpected errors
      setIsSyncing(false);
      throw e;
    }
  };

  const handleSend = async () => {
    if (!isTorqueEnabled || isActionButtonsLocked) {
      connection.setError('Turn torque on before sending.');
      return;
    }

    // Program mode injects its own action here, so the footer can still
    // use the same button while the actual behavior changes by section.
    if (onSendAction) {
      onSendAction();
      return;
    }

    // Otherwise build the section-specific G-code/command string and send it.
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

  // Disable sending when:
  // - no serial connection
  // - torque is off
  // - actions are explicitly locked (e.g., while connecting or after torque change)
  // - we haven't synced (no position report received yet)
  // - and there is no configured send action
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
