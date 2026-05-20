import { useState, useRef, useEffect } from 'react';
import { Box, Paper, Stack, LinearProgress, IconButton, Menu, MenuItem, Tooltip } from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import TuneIcon from '@mui/icons-material/Tune';
import HomeIcon from '@mui/icons-material/Home';
import PowerIcon from '@mui/icons-material/Power';
import PowerOffIcon from '@mui/icons-material/PowerOff';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import AirplanemodeActiveIcon from '@mui/icons-material/AirplanemodeActive';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import ControlPanel from '../digitaltwin/ControlPanel';
import PoseControl from '../digitaltwin/PoseControl';
import Programming from '../digitaltwin/Programming';
import Settings from '../digitaltwin/Settings';
import URDFSceneViewport from '../digitaltwin/URDFSceneViewport';
import CommandPanel from '../digitaltwin/CommandPanel';
import { useSerialConnection } from '../../hooks/useSerialConnection';

const STEP_MAX = 1023;
const DEG_PER_STEP = 0.29;
const ANGLE_MAX = parseFloat((STEP_MAX * DEG_PER_STEP).toFixed(2));
const DEFAULT_JOINTS = { J1: ANGLE_MAX / 2, J2: ANGLE_MAX / 2, J3: ANGLE_MAX / 2, J4: ANGLE_MAX / 2, J5: ANGLE_MAX / 2 };

function DigitalTwinView({ activeSection = 'control', onSectionChange = () => { } }) {
  // This view owns the shared digital-twin state and only delegates
  // section-specific UI/commands to the child panels below.
  const [leftPanelWidth, setLeftPanelWidth] = useState(30); // percentage
  const [jointTargets, setJointTargets] = useState(DEFAULT_JOINTS);
  const [interpolationPlan, setInterpolationPlan] = useState([]);
  const [isLinearInterpolationEnabled, setIsLinearInterpolationEnabled] = useState(false);
  const [feedrate, setFeedrate] = useState(300);
  const [hasSynced, setHasSynced] = useState(false);
  const [isTorqueEnabled, setIsTorqueEnabled] = useState(true);
  const [areActionButtonsLocked, setAreActionButtonsLocked] = useState(false);
  // `hasSynced` indicates whether we've received a full position report
  // from the arm (via `M114`). Until `hasSynced` is true, user-facing
  // action controls must remain disabled to avoid sending potentially
  // unsafe commands to an unknown arm state.
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [programButtonLabel, setProgramButtonLabel] = useState('Send Program');
  const isDraggingRef = useRef(false);
  const poseControlRef = useRef(null);
  const programmingRef = useRef(null);
  const connection = useSerialConnection();
  const [baudRate, setBaudRate] = useState(115200);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [baudMenuAnchorEl, setBaudMenuAnchorEl] = useState(null);
  const [autoSyncTrigger, setAutoSyncTrigger] = useState(0);
  // Shared syncing state used by ControlPanel and CommandPanel so both
  // components reflect when a sync is in-progress.
  const [isSyncing, setIsSyncing] = useState(false);
  const errorDismissTimerRef = useRef(null);
  const errorClearTimerRef = useRef(null);
  const torqueUnlockTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (torqueUnlockTimerRef.current) {
        clearTimeout(torqueUnlockTimerRef.current);
      }
    };
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const port = await connection.requestPort();
      if (port) {
        const success = await connection.connect(port, baudRate);
        if (success) {
          connection.setSelectedPort(port);
          // On initial successful connect:
          // 1) Reset sync state so UI remains conservative.
          // 2) Lock action buttons to prevent any actions until the
          //    arm reports its positions back (via M114).
          // 3) Trigger an immediate auto-sync. `ControlPanel` and
          //    `CommandPanel` listen for `autoSyncTrigger` and will
          //    issue the `M114` command to query positions.
          // The digital twin should never assume the arm is already in a
          // known pose after connect, so it waits for the first report.
          setHasSynced(false);
          setAreActionButtonsLocked(true);
          setAutoSyncTrigger((c) => c + 1);
          console.log("Auto-sync triggered on connect");
        }
      }
    } catch (err) {
      connection.setError(`Connection failed: ${err.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await connection.disconnect();
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleOpenBaudMenu = (event) => {
    setBaudMenuAnchorEl(event.currentTarget);
  };

  const handleCloseBaudMenu = () => {
    setBaudMenuAnchorEl(null);
  };

  const handleSelectBaudRate = (rate) => {
    setBaudRate(rate);
    handleCloseBaudMenu();
  };

  const isConnectionProgressLoading = isConnecting || isDisconnecting;

  const lockActionButtons = () => {
    if (torqueUnlockTimerRef.current) {
      clearTimeout(torqueUnlockTimerRef.current);
      torqueUnlockTimerRef.current = null;
    }
    setAreActionButtonsLocked(true);
  };

  const unlockActionButtonsAfterTorqueOn = () => {
    if (torqueUnlockTimerRef.current) {
      clearTimeout(torqueUnlockTimerRef.current);
    }

    // Torque-on is treated like a state reset: hold buttons briefly,
    // then auto-sync so the UI can safely reflect the arm again.
    setAreActionButtonsLocked(true);
    torqueUnlockTimerRef.current = setTimeout(() => {
      setAreActionButtonsLocked(false);
      setAutoSyncTrigger((current) => current + 1);
      torqueUnlockTimerRef.current = null;
    }, 500);
  };

  const handleTorqueOn = async () => {
    if (!connection.isConnected) {
      connection.setError('Connect to a serial port before sending commands.');
      return;
    }

    const ok = await connection.sendCommandWithTimeout('M17\n');
    if (!ok) {
      return;
    }

    setIsTorqueEnabled(true);
    setHasSynced(false);
    unlockActionButtonsAfterTorqueOn();
  };

  const handleTorqueOff = async () => {
    if (!connection.isConnected) {
      connection.setError('Connect to a serial port before sending commands.');
      return;
    }

    // Immediately mark torque disabled locally so running programs
    // observe the change and abort as soon as possible. If the
    // command fails we roll the state back.
    setIsTorqueEnabled(false);
    setHasSynced(false);
    lockActionButtons();

    const ok = await connection.sendCommandWithTimeout('M18\n');
    if (!ok) {
      // rollback optimistic update
      setIsTorqueEnabled(true);
      connection.setError('Failed to disable torque on the device.');
      return;
    }
  };

  // Global Space key handler: trigger torque-off when Space is pressed.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code !== 'Space') return;
      if (!connection?.isConnected) return;
      if (!isTorqueEnabled) return;
      if (areActionButtonsLocked) return;
      e.preventDefault();
      handleTorqueOff();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [connection && connection.isConnected, isTorqueEnabled, areActionButtonsLocked]);

  // useEffect(() => {
  //   if (!connection) return;
  //   let t = null;
  //   if (connection.isConnected) {
  //     t = setTimeout(() => setAutoSyncTrigger((c) => c + 1), 7000);
  //   }
  //   return () => {
  //     if (t) clearTimeout(t);
  //   };
  // }, [connection && connection.isConnected]);

  useEffect(() => {
    if (!connection.error) {
      setShowErrorAlert(false);
      return;
    }

    setShowErrorAlert(true);

    if (errorDismissTimerRef.current) {
      clearTimeout(errorDismissTimerRef.current);
    }
    if (errorClearTimerRef.current) {
      clearTimeout(errorClearTimerRef.current);
    }

    errorDismissTimerRef.current = setTimeout(() => {
      setShowErrorAlert(false);
      errorClearTimerRef.current = setTimeout(() => {
        connection.setError(null);
      }, 350);
    }, 3000);

    return () => {
      if (errorDismissTimerRef.current) {
        clearTimeout(errorDismissTimerRef.current);
      }
      if (errorClearTimerRef.current) {
        clearTimeout(errorClearTimerRef.current);
      }
    };
  }, [connection.error]);

  // When a successful sync occurs, allow action buttons again
  useEffect(() => {
    if (hasSynced) {
      setAreActionButtonsLocked(false);
    }
  }, [hasSynced]);

  const handleMouseDown = () => {
    isDraggingRef.current = true;
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;

    const container = e.currentTarget;
    const newWidth = (e.clientX / container.clientWidth) * 100;

    if (newWidth >= 20 && newWidth <= 70) {
      setLeftPanelWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Speed marks for the CommandPanel slider
  const speedMarks = [
    { value: 100, label: <DirectionsWalkIcon fontSize="small" /> },
    { value: 300, label: <DirectionsRunIcon fontSize="small" /> },
    { value: 500, label: <DirectionsBikeIcon fontSize="small" /> },
    { value: 700, label: <AirplanemodeActiveIcon fontSize="small" /> },
    { value: 900, label: <RocketLaunchIcon fontSize="small" /> },
  ];

  const FEEDRATE_MIN = 10;
  const FEEDRATE_MAX = 1000;

  const clampFeedrate = (value) => Math.max(FEEDRATE_MIN, Math.min(FEEDRATE_MAX, value));
  const angleToSteps = (deg) => Math.round(Math.max(0, Math.min(STEP_MAX, deg / DEG_PER_STEP)));

  const handleFeedrateChange = (value) => {
    const numeric = clampFeedrate(parseInt(value, 10) || FEEDRATE_MIN);
    setFeedrate(numeric);
  };

  const buildSendCommandForJoints = () => {
    // Shared joint command used by the control and pose panels.
    return `G1 J1:${angleToSteps(jointTargets.J1)} J2:${angleToSteps(jointTargets.J2)} J3:${angleToSteps(jointTargets.J3)} J4:${angleToSteps(jointTargets.J4)} J5:${angleToSteps(jointTargets.J5)} F${feedrate}\n`;
  };

  const getCommandPanelProps = () => {
    // The footer panel is reused, but each section supplies a different
    // send action: direct joint move, pose move, or program playback.
    switch (activeSection) {
      case 'control':
        return {
          connection,
          isTorqueEnabled,
          isActionButtonsLocked: areActionButtonsLocked,
          hasSynced,
          autoSyncTrigger: autoSyncTrigger,
          feedrate,
          onFeedrateChange: handleFeedrateChange,
          marks: speedMarks,
          showSpeedSlider: true,
          buildSendCommand: () => {
            if (!hasSynced) {
              connection.setError('Sync from the arm before sending slider values.');
              return null;
            }
            return buildSendCommandForJoints();
          },
          sendLabel: 'Send to Arm',
        };
      case 'pose':
        return {
          connection,
          isTorqueEnabled,
          isActionButtonsLocked: areActionButtonsLocked,
          hasSynced,
          autoSyncTrigger: autoSyncTrigger,
          feedrate,
          onFeedrateChange: handleFeedrateChange,
          marks: speedMarks,
          showSpeedSlider: true,
          buildSendCommand: buildSendCommandForJoints,
          sendLabel: 'Send to Arm',
        };
      case 'programming':
        return {
          connection,
          isTorqueEnabled,
          isActionButtonsLocked: areActionButtonsLocked,
          hasSynced,
          autoSyncTrigger: autoSyncTrigger,
          feedrate,
          onFeedrateChange: handleFeedrateChange,
          marks: speedMarks,
          showSpeedSlider: !isLinearInterpolationEnabled,
          onSendAction: () => {
            // The footer Send button should trigger the actual program send
            // (serial I/O). The preview/play button is handled inside the
            // program component and only updates the visualization.
            if (programmingRef.current && typeof programmingRef.current.sendProgram === 'function') {
              programmingRef.current.sendProgram();
            }
          },
          sendLabel: programButtonLabel,
        };
      default:
        return {
          connection,
          isTorqueEnabled,
          isActionButtonsLocked: areActionButtonsLocked,
          hasSynced,
          autoSyncTrigger: autoSyncTrigger,
          feedrate,
          onFeedrateChange: handleFeedrateChange,
          marks: speedMarks,
          showSpeedSlider: false,
          sendLabel: 'Send',
        };
    }
  };

  return (
    <Box
      sx={{ width: '100%', height: '100%', m: 0, p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'row' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Left Panel */}
      <Box
        sx={{ width: `${leftPanelWidth}%`, height: '100%', bgcolor: '#f5f5f5', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <Paper
          sx={{
            m: 2,
            mb: 1,
            p: 1.5,
            bgcolor: connection.isConnected ? '#e8f5e9' : '#ffebee',
            border: `1px solid ${connection.isConnected ? '#4caf50' : '#f44336'}`,
            borderRadius: 2,
            flexShrink: 0,
          }}
        >
          <Stack spacing={1.25}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LinearProgress
                variant={isConnectionProgressLoading ? 'indeterminate' : 'determinate'}
                value={isConnectionProgressLoading ? undefined : 100}
                sx={{
                  flex: 1,
                  height: 10,
                  borderRadius: 999,
                  backgroundColor: isConnectionProgressLoading
                    ? '#e0e0e0'
                    : connection.isConnected
                      ? '#c8e6c9'
                      : '#ffcdd2',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 999,
                    backgroundColor: isConnectionProgressLoading
                      ? '#1976d2'
                      : connection.isConnected
                        ? '#4caf50'
                        : '#f44336',
                  },
                }}
              />
              <IconButton
                onClick={handleConnect}
                disabled={connection.isConnected || isConnecting || isDisconnecting}
                sx={{ color: '#4caf50' }}
                size="large"
                aria-label="connect"
              >
                <LinkIcon />
              </IconButton>
              <IconButton
                onClick={handleDisconnect}
                disabled={!connection.isConnected || isConnecting || isDisconnecting}
                sx={{ color: '#f44336' }}
                size="large"
                aria-label="disconnect"
              >
                <LinkOffIcon />
              </IconButton>
              <IconButton
                onClick={handleOpenBaudMenu}
                disabled={isConnecting || isDisconnecting}
                size="large"
                aria-label="baud-rate-settings"
              >
                <TuneIcon />
              </IconButton>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
              <Tooltip title="Homing sequence" arrow>
                <IconButton
                  onClick={async () => { if (!connection.isConnected) return connection.setError('Connect to a serial port before sending commands.'); await connection.sendCommandWithTimeout('M140\n'); }}
                  size="large"
                  color="primary"
                  aria-label="home"
                  disabled={!connection.isConnected || !isTorqueEnabled || areActionButtonsLocked || !hasSynced}
                >
                  <HomeIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Torque on" arrow>
                <IconButton
                  onClick={handleTorqueOn}
                  size="large"
                  color="primary"
                  aria-label="power-on"
                  disabled={!connection.isConnected}
                >
                  <PowerIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Torque off" arrow>
                <IconButton
                  onClick={handleTorqueOff}
                  size="large"
                  aria-label="power-off"
                  disabled={!connection.isConnected || !isTorqueEnabled || areActionButtonsLocked || !hasSynced}
                  sx={{ color: '#f44336' }}
                >
                  <PowerOffIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Stack>
        </Paper>
        <Menu
          anchorEl={baudMenuAnchorEl}
          open={Boolean(baudMenuAnchorEl)}
          onClose={handleCloseBaudMenu}
        >
          {[9600, 14400, 19200, 38400, 57600, 115200, 230400, 460800, 921600].map((rate) => (
            <MenuItem
              key={rate}
              selected={baudRate === rate}
              onClick={() => handleSelectBaudRate(rate)}
            >
              {rate}
            </MenuItem>
          ))}
        </Menu>

        <Box sx={{ p: 2, borderBottom: '1px solid #ddd', flexShrink: 0 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Box
              onClick={() => onSectionChange('control')}
              sx={{
                flex: 1,
                p: 1,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: activeSection === 'control' ? '#282c34' : '#f0f0f0',
                color: activeSection === 'control' ? 'white' : '#333',
                borderRadius: '4px',
                fontWeight: activeSection === 'control' ? 600 : 400,
                fontSize: '0.9rem',
              }}
            >
              Control
            </Box>
            <Box
              onClick={() => onSectionChange('pose')}
              sx={{
                flex: 1,
                p: 1,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: activeSection === 'pose' ? '#282c34' : '#f0f0f0',
                color: activeSection === 'pose' ? 'white' : '#333',
                borderRadius: '4px',
                fontWeight: activeSection === 'pose' ? 600 : 400,
                fontSize: '0.9rem',
              }}
            >
              Pose Control
            </Box>
            <Box
              onClick={() => onSectionChange('programming')}
              sx={{
                flex: 1,
                p: 1,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: activeSection === 'programming' ? '#282c34' : '#f0f0f0',
                color: activeSection === 'programming' ? 'white' : '#333',
                borderRadius: '4px',
                fontWeight: activeSection === 'programming' ? 600 : 400,
                fontSize: '0.9rem',
              }}
            >
              Programming
            </Box>
            <Box
              onClick={() => onSectionChange('settings')}
              sx={{
                flex: 1,
                p: 1,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: activeSection === 'settings' ? '#282c34' : '#f0f0f0',
                color: activeSection === 'settings' ? 'white' : '#333',
                borderRadius: '4px',
                fontWeight: activeSection === 'settings' ? 600 : 400,
                fontSize: '0.9rem',
              }}
            >
              Settings
            </Box>
          </Box>
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <Box sx={{ display: activeSection === 'control' ? 'block' : 'none', height: '100%' }}>
            <ControlPanel
              jointTargets={jointTargets}
              setJointTargets={setJointTargets}
              connection={connection}
              feedrate={feedrate}
              setFeedrate={setFeedrate}
              hasSynced={hasSynced}
              setHasSynced={setHasSynced}
              isTorqueEnabled={isTorqueEnabled}
              setIsTorqueEnabled={setIsTorqueEnabled}
              isSyncing={isSyncing}
              setIsSyncing={setIsSyncing}
            />
          </Box>
          <Box sx={{ display: activeSection === 'pose' ? 'block' : 'none', height: '100%' }}>
            <PoseControl
              ref={poseControlRef}
              jointTargets={jointTargets}
              setJointTargets={setJointTargets}
              connection={connection}
              isTorqueEnabled={isTorqueEnabled}
              onPlanChange={(plan) => setInterpolationPlan(plan || [])}
            />
          </Box>
          <Box sx={{ display: activeSection === 'programming' ? 'block' : 'none', height: '100%' }}>
            <Programming
              ref={programmingRef}
              jointTargets={jointTargets}
              setJointTargets={setJointTargets}
              connection={connection}
              isTorqueEnabled={isTorqueEnabled}
              controlsDisabled={areActionButtonsLocked || !hasSynced}
              onPlanChange={(plan, fallback, isInterpolationEnabled) => {
                setInterpolationPlan(plan || []);
                setIsLinearInterpolationEnabled(!!isInterpolationEnabled);
              }}
              setProgramButtonLabel={setProgramButtonLabel}
            />
          </Box>
          <Box sx={{ display: activeSection === 'settings' ? 'block' : 'none', height: '100%' }}>
            <Settings />
          </Box>
        </Box>

        {/* Unified Command Panel */}
        <CommandPanel
          {...getCommandPanelProps()}
          isSyncing={isSyncing}
          setIsSyncing={setIsSyncing}
          showErrorAlert={showErrorAlert}
          error={connection.error}
        />
      </Box>

      {/* Draggable Divider */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          width: '6px',
          height: '100%',
          bgcolor: '#ddd',
          cursor: 'col-resize',
          '&:hover': {
            bgcolor: '#999',
            transition: 'background-color 0.2s'
          },
          flexShrink: 0
        }}
      />

      {/* Right Panel */}
      <Box
        sx={{
          width: `${100 - leftPanelWidth}%`,
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          bgcolor: 'white',
        }}
      >
        <URDFSceneViewport
          jointTargets={jointTargets}
          setJointTargets={setJointTargets}
          showTransformControls={activeSection === 'pose' || activeSection === 'programming'}
          interpolationPlan={interpolationPlan}
          onWaypointClick={(idx) => {
            if (programmingRef.current && typeof programmingRef.current.setCurrentStepIndex === 'function') {
              programmingRef.current.setCurrentStepIndex(idx);
              return;
            }
            if (poseControlRef.current && typeof poseControlRef.current.setCurrentStepIndex === 'function') {
              poseControlRef.current.setCurrentStepIndex(idx);
            }
          }}
        />
      </Box>
    </Box>
  );
}

export default DigitalTwinView;
