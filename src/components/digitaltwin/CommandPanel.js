import { useEffect, useRef, useState } from 'react';
import { Box, Paper, Stack, Slider, Button, Fade, Alert, Popper, Grow } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import SendIcon from '@mui/icons-material/Send';
import FrontHandIcon from '@mui/icons-material/FrontHand';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import { CENTEROFFSETDEG } from '../../constants/robotConstants';

const GRIPPER_MIN_DEG = 0;
const GRIPPER_MAX_DEG = CENTEROFFSETDEG;
const GRIPPER_STEP_DEG = ((GRIPPER_MAX_DEG-GRIPPER_MIN_DEG)/7).toPrecision(1);

function GripperControl({
  disabled,
  targetDeg,
  onTargetChange,
}) {
  const buttonRef = useRef(null);
  const closeTimerRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [draftValue, setDraftValue] = useState(targetDeg);

  const open = hovered || pinnedOpen;

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const closeIfNeeded = () => {
    clearCloseTimer();
    if (pinnedOpen) return;

    closeTimerRef.current = setTimeout(() => setHovered(false), 90);
  };

  useEffect(() => {
    setDraftValue(targetDeg);
  }, [targetDeg]);

  useEffect(() => {
    if (!open) {
      setDraftValue(targetDeg);
    }
  }, [open, targetDeg]);

  useEffect(() => () => clearCloseTimer(), []);

  useEffect(() => {
    if (disabled) {
      clearCloseTimer();
      setHovered(false);
      setPinnedOpen(false);
    }
  }, [disabled]);

  const handleCommit = (_, value) => {
    const nextValue = Array.isArray(value) ? value[0] : value;
    setDraftValue(nextValue);
    onTargetChange(nextValue);
  };

  const jumpToValue = (value) => {
    setDraftValue(value);
    onTargetChange(value);
  };

  return (
    <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <Button
        ref={buttonRef}
        onMouseEnter={() => !disabled && (clearCloseTimer(), setHovered(true))}
        onMouseLeave={closeIfNeeded}
        onClick={() => !disabled && setPinnedOpen((prev) => !prev)}
        disabled={disabled}
        size="large"
        variant="contained"
        aria-label="Gripper scale"
        title="Gripper scale"
        sx={{
          width: 44,
          height: 44,
          minWidth: 44,
          px: 0,
          // border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1.5,
          boxShadow: 1,
        }}
      >
        <FrontHandIcon />
      </Button>
      <Popper
        open={open}
        anchorEl={buttonRef.current}
        placement="top"
        transition
        modifiers={[{ name: 'offset', options: { offset: [0, 4] } }]}
        sx={{ zIndex: 1400 }}
      >
        {({ TransitionProps }) => (
          <Grow {...TransitionProps} style={{ transformOrigin: 'center bottom' }}>
            <Paper
              elevation={6}
              onMouseEnter={() => !disabled && (clearCloseTimer(), setHovered(true))}
              onMouseLeave={closeIfNeeded}
              sx={{
                width: 44,
                pt: 2,
                pb: 2,
                borderRadius: '14px 14px 8px 8px',
                overflow: 'visible',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Button
                type="button"
                onClick={() => jumpToValue(GRIPPER_MAX_DEG)}
                disabled={disabled}
                aria-label={`Set gripper to ${GRIPPER_MAX_DEG}`}
                sx={{ minWidth: 0, p: 0, lineHeight: 0, color: 'text.secondary' }}
              >
                <OpenInFullIcon fontSize="small" />
              </Button>
              <Slider
                orientation="vertical"
                value={draftValue}
                onChange={(_, value) => setDraftValue(Array.isArray(value) ? value[0] : value)}
                onChangeCommitted={handleCommit}
                valueLabelDisplay="auto"
                marks
                disabled={disabled}
                step={GRIPPER_STEP_DEG}
                min={GRIPPER_MIN_DEG}
                max={GRIPPER_MAX_DEG}
                sx={{
                  height: 130,
                  width: 44,
                  mx: 0,
                  '& .MuiSlider-rail, & .MuiSlider-track': {
                    width: 6,
                  },
                  '& .MuiSlider-thumb': {
                    width: 16,
                    height: 16,
                  },
                }}
              />
              <Button
                type="button"
                onClick={() => jumpToValue(GRIPPER_MIN_DEG)}
                disabled={disabled}
                aria-label={`Set gripper to ${GRIPPER_MIN_DEG}`}
                sx={{ minWidth: 0, p: 0, lineHeight: 0, color: 'text.secondary' }}
              >
                <CloseFullscreenIcon fontSize="small" />
              </Button>
            </Paper>
          </Grow>
        )}
      </Popper>
    </Box>
  );
}

export default function CommandPanel({
  connection,
  isTorqueEnabled = true,
  isActionButtonsLocked = false,
  hasSynced = false,
  autoSyncTrigger = 0,
  feedrate = 300,
  onFeedrateChange = () => { },
  marks = [],
  showSpeedSlider = true,
  gripperTargetDeg = CENTEROFFSETDEG,
  buildSendCommand = null,
  onSendAction = null,
  onGripperAction = () => { },
  sendLabel = 'Send',
  showErrorAlert = false,
  error = null,
  // lifted syncing state from parent
  isSyncing = false,
  setIsSyncing = () => { },
}) {
  const SYNC_RETRY_MS = 500;
  const SYNC_TIMEOUT_MS = 7000;
  const actionDisabled = !connection.isConnected || !isTorqueEnabled || isActionButtonsLocked || !hasSynced || isSyncing;
  const sendDisabled = actionDisabled || (!buildSendCommand && !onSendAction);

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

  return (
    <Box sx={{ p: 3, pt: 2 }}>
      <Paper sx={{ p: 2, boxShadow: 3 }}>
        {showSpeedSlider && (
          <>
            <Slider
              value={feedrate}
              onChange={(e, val) => onFeedrateChange(val)}
              min={0}
              max={1000}
              step={null}
              marks={marks}
              valueLabelDisplay="on"
              sx={{ mb: 4 }}
            />
          </>
        )}
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'nowrap' }}>
          <Button
            variant="outlined"
            onClick={handleSync}
            disabled={actionDisabled}
            size="large"
            aria-label="Sync"
            title="Sync"
            sx={{ minWidth: 44, width: 100, height: 44, px: 0 }}
          >
            <SyncIcon />
            sync
          </Button>
          <GripperControl disabled={actionDisabled} targetDeg={gripperTargetDeg} onTargetChange={onGripperAction} />
          <Button
            variant="contained"
            onClick={handleSend}
            disabled={sendDisabled}
            size="large"
            endIcon={<SendIcon />}
            sx={{ flex: 1, minWidth: 0, height: 44 }}
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
