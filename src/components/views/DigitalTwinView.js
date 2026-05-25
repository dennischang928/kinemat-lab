import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Box } from '@mui/material';
import ControlPanel from '../digitaltwin/ControlPanel';
import PoseControl from '../digitaltwin/PoseControl';
import Programming from '../digitaltwin/Programming';
import URDFSceneViewport from '../digitaltwin/URDFSceneViewport';
import CommandPanel from '../digitaltwin/CommandPanel';
import ConnectionHeader from '../digitaltwin/ConnectionHeader';
import SectionTabBar from '../digitaltwin/SectionTabBar';
import { useSerialConnection } from '../../hooks/useSerialConnection';
import usePanelResize from '../digitaltwin/hooks/usePanelResize';
import useErrorAlert from '../digitaltwin/hooks/useErrorAlert';
import useConnectionManager from '../digitaltwin/hooks/useConnectionManager';
import useTorqueControl from '../digitaltwin/hooks/useTorqueControl';
import useRealtimeJointMirror from '../digitaltwin/hooks/useRealtimeJointMirror';
import { DEFAULT_JOINTS, SPEED_MARKS, FEEDRATE_MIN, clampFeedrate, angleToSteps, CENTEROFFSETDEG, ANGLE_MAX } from '../../constants/robotConstants';


function DigitalTwinView({ activeSection = 'control', onSectionChange = () => { } }) {
  // ── Core arm state ────────────────────────────────────────────────
  const [jointTargets, setJointTargets] = useState(DEFAULT_JOINTS);
  const [interpolationPlan, setInterpolationPlan] = useState([]);
  const [isLinearInterpolationEnabled, setIsLinearInterpolationEnabled] = useState(false);
  const [feedrate, setFeedrate] = useState(300);
  const [hasSynced, setHasSynced] = useState(false);
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(false);
  const [kinematicMask, setKinematicMask] = useState({
    x: true,
    y: true,
    z: true,
    roll: false,
    pitch: false,
    yaw: false,
  });
  // `hasSynced` indicates whether we've received a full position report
  // from the arm (via `M114`). Until `hasSynced` is true, user-facing
  // action controls must remain disabled to avoid sending potentially
  // unsafe commands to an unknown arm state.

  // Shared syncing state used by ControlPanel and CommandPanel so both
  // components reflect when a sync is in-progress.
  const [isSyncing, setIsSyncing] = useState(false);
  const [programButtonLabel, setProgramButtonLabel] = useState('Send Program');
  const [isHomeRecoveryActive, setIsHomeRecoveryActive] = useState(false);

  // ── Refs for imperative child access ──────────────────────────────
  const poseControlRef = useRef(null);
  const programmingRef = useRef(null);
  const homeSyncStartTimerRef = useRef(null);
  const homeSyncRetryIntervalRef = useRef(null);
  const hasSyncedRef = useRef(hasSynced);
  const jointTargetsRef = useRef(jointTargets);

  // ── Serial connection ─────────────────────────────────────────────
  const connection = useSerialConnection();

  // ── Extracted hooks ───────────────────────────────────────────────
  const { leftPanelWidth, handleMouseDown, handleMouseMove, handleMouseUp } =
    usePanelResize(30);

  const { showErrorAlert } = useErrorAlert(connection.error, connection.setError);

  const {
    isTorqueEnabled,
    areActionButtonsLocked,
    autoSyncTrigger,
    handleTorqueOn,
    handleTorqueOff,
    triggerAutoSync,
    resetSyncState,
    lockActionButtons,
  } = useTorqueControl(connection, hasSynced, setHasSynced);

  const { queueRealtimeMirror } = useRealtimeJointMirror({
    connection,
    isTorqueEnabled,
    enabled: isRealTimeEnabled,
  });

  const {
    baudRate,
    isLoading: isConnectionLoading,
    baudMenuAnchorEl,
    handleConnect,
    handleDisconnect,
    handleOpenBaudMenu,
    handleCloseBaudMenu,
    handleSelectBaudRate,
  } = useConnectionManager(connection, {
    onResetSync: resetSyncState,
    onLockActions: lockActionButtons,
    onAutoSync: triggerAutoSync,
  });

  // ── Derived helpers ───────────────────────────────────────────────
  const handleFeedrateChange = useCallback((value) => {
    const numeric = clampFeedrate(parseInt(value, 10) || FEEDRATE_MIN);
    setFeedrate(numeric);
  }, []);

  useEffect(() => {
    jointTargetsRef.current = jointTargets;
  }, [jointTargets]);

  const commitJointTargets = useCallback((updater, { mirrorRealtime = false } = {}) => {
    const nextTargets = typeof updater === 'function'
      ? updater(jointTargetsRef.current)
      : updater;

    jointTargetsRef.current = nextTargets;
    setJointTargets(nextTargets);

    if (mirrorRealtime) {
      queueRealtimeMirror(nextTargets);
    }
  }, [queueRealtimeMirror]);

  const commitUserJointTargets = useCallback((updater) => {
    commitJointTargets(updater, { mirrorRealtime: true });
  }, [commitJointTargets]);

  const commitExternalJointTargets = useCallback((updater) => {
    commitJointTargets(updater, { mirrorRealtime: false });
  }, [commitJointTargets]);

  const buildSendCommandForJoints = useCallback(() => {
    return `G1 J1:${angleToSteps(jointTargets.J1)} J2:${angleToSteps(jointTargets.J2)} J3:${angleToSteps(jointTargets.J3)} J4:${angleToSteps(jointTargets.J4)} F${feedrate}\n`;
  }, [jointTargets, feedrate]);

  const buildGripperCommand = useCallback((targetDeg) => {
    const numericTarget = Math.max(0, Math.min(CENTEROFFSETDEG, Number(targetDeg) || 0));
    return {
      targetDeg: numericTarget,
      command: `G1 J5:${angleToSteps(numericTarget)}\n`,
    };
  }, []);

  const handleGripperAction = useCallback(async (targetDeg) => {
    if (!connection.isConnected) {
      connection.setError('Connect to a serial port before sending commands.');
      return;
    }

    if (!isTorqueEnabled || areActionButtonsLocked) {
      connection.setError('Turn torque on before sending.');
      return;
    }

    const { targetDeg: resolvedTargetDeg, command } = buildGripperCommand(targetDeg);
    const ok = await connection.sendCommandWithTimeout(command);
    if (!ok) {
      connection.setError('No OK received from arm.');
      return;
    }

    commitExternalJointTargets((prev) => ({
      ...prev,
      J5: resolvedTargetDeg,
    }));
  }, [areActionButtonsLocked, buildGripperCommand, commitExternalJointTargets, connection, isTorqueEnabled]);

  const clearHomeRecoveryTimers = useCallback(() => {
    if (homeSyncStartTimerRef.current) {
      clearTimeout(homeSyncStartTimerRef.current);
      homeSyncStartTimerRef.current = null;
    }

    if (homeSyncRetryIntervalRef.current) {
      clearInterval(homeSyncRetryIntervalRef.current);
      homeSyncRetryIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    hasSyncedRef.current = hasSynced;
    if (hasSynced && isHomeRecoveryActive) {
      clearHomeRecoveryTimers();
      setIsHomeRecoveryActive(false);
    }
  }, [clearHomeRecoveryTimers, hasSynced, isHomeRecoveryActive]);

  useEffect(() => () => clearHomeRecoveryTimers(), [clearHomeRecoveryTimers]);

  const handleHome = useCallback(async () => {
    if (!connection.isConnected) {
      connection.setError('Connect to a serial port before sending commands.');
      return;
    }

    // Reuse the existing lock/sync pipeline used by torque-on.
    if (!isTorqueEnabled) {
      const torqueOk = await handleTorqueOn();
      if (!torqueOk) {
        return;
      }
    }

    lockActionButtons();
    resetSyncState();
    clearHomeRecoveryTimers();
    setIsHomeRecoveryActive(true);

    const homeOk = await connection.sendCommandWithTimeout('M140\n');
    if (!homeOk) {
      connection.setError('Failed to send homing command.');
    }

    homeSyncStartTimerRef.current = setTimeout(() => {
      if (!connection.isConnected || hasSyncedRef.current) {
        return;
      }

      triggerAutoSync();
      homeSyncRetryIntervalRef.current = setInterval(() => {
        if (!connection.isConnected || hasSyncedRef.current || isSyncing) {
          return;
        }
        triggerAutoSync();
      }, 1500);
    }, 8000);
  }, [
    clearHomeRecoveryTimers,
    connection,
    handleTorqueOn,
    isTorqueEnabled,
    isSyncing,
    lockActionButtons,
    resetSyncState,
    triggerAutoSync,
  ]);

  // ── CommandPanel props (de-duplicated) ────────────────────────────
  const commandPanelProps = useMemo(() => {
    const base = {
      connection,
      isTorqueEnabled,
      isActionButtonsLocked: areActionButtonsLocked || isHomeRecoveryActive,
      hasSynced,
      autoSyncTrigger,
      feedrate,
      onFeedrateChange: handleFeedrateChange,
      marks: SPEED_MARKS,
      onGripperAction: handleGripperAction,
      gripperTargetDeg: jointTargets.J5,
    };

    switch (activeSection) {
      case 'control':
        return {
          ...base,
          showSpeedSlider: true,
          buildSendCommand: () => {
            if (!hasSynced) {
              connection.setError('Sync from the arm before sending slider values.');
              return null;
            }
            return buildSendCommandForJoints();
          },
          sendLabel: 'Send',
        };
      case 'pose':
        return {
          ...base,
          showSpeedSlider: true,
          buildSendCommand: buildSendCommandForJoints,
          sendLabel: 'Send',
        };
      case 'programming':
        return {
          ...base,
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
          ...base,
          showSpeedSlider: false,
          sendLabel: 'Send',
        };
    }
  }, [
    activeSection, connection, isTorqueEnabled, areActionButtonsLocked, isHomeRecoveryActive,
    hasSynced, autoSyncTrigger, feedrate, handleFeedrateChange,
    buildSendCommandForJoints, handleGripperAction, isLinearInterpolationEnabled, programButtonLabel,
  ]);

  // ── Waypoint click handler for 3D viewport ────────────────────────
  const handleWaypointClick = useCallback((idx) => {
    if (programmingRef.current && typeof programmingRef.current.setCurrentStepIndex === 'function') {
      programmingRef.current.setCurrentStepIndex(idx);
      
    }
    if (poseControlRef.current && typeof poseControlRef.current.setCurrentStepIndex === 'function') {
       poseControlRef.current.setCurrentStepIndex(idx);
    }
  }, []);

  const handleSceneTransformation = useCallback((scenePose) => {
    if (activeSection === 'pose' && poseControlRef.current && typeof poseControlRef.current.handleSceneTransformation === 'function') {
      return poseControlRef.current.handleSceneTransformation(scenePose);
      // console.log('Scene transformation received in pose:', scenePose);
    }

    if (activeSection === 'programming' && programmingRef.current && typeof programmingRef.current.handleSceneTransformation === 'function') {
      return programmingRef.current.handleSceneTransformation(scenePose);
      // console.log('Scene transformation received in program:', scenePose);
    }
  }, [activeSection]);

  const handleKinematicMaskChange = useCallback((nextMask) => {
    setKinematicMask((prev) => ({
      ...prev,
      ...nextMask,
    }));
  }, []);

  // ── Render ────────────────────────────────────────────────────────
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
        <ConnectionHeader
          isConnected={connection.isConnected}
          isLoading={isConnectionLoading}
          isTorqueEnabled={isTorqueEnabled}
          areActionButtonsLocked={areActionButtonsLocked || isHomeRecoveryActive}
          hasSynced={hasSynced}
          baudRate={baudRate}
          baudMenuAnchorEl={baudMenuAnchorEl}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onOpenBaudMenu={handleOpenBaudMenu}
          onCloseBaudMenu={handleCloseBaudMenu}
          onSelectBaudRate={handleSelectBaudRate}
          onHome={handleHome}
          onTorqueOn={handleTorqueOn}
          onTorqueOff={handleTorqueOff}
        />

        <SectionTabBar activeSection={activeSection} onSectionChange={onSectionChange} />

        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <Box sx={{ display: activeSection === 'control' ? 'block' : 'none', height: '100%' }}>
            <ControlPanel
              
              jointTargets={jointTargets}
              setJointTargets={commitUserJointTargets}
              setJointTargetsFromHardware={commitExternalJointTargets}
              connection={connection}
              feedrate={feedrate}
              setFeedrate={setFeedrate}
              hasSynced={hasSynced}
              setHasSynced={setHasSynced}
              isTorqueEnabled={isTorqueEnabled}
              setIsTorqueEnabled={() => { }}
              isSyncing={isSyncing}
              setIsSyncing={setIsSyncing}
            />
          </Box>
          <Box sx={{ display: activeSection === 'pose' ? 'block' : 'none', height: '100%' }}>
            <PoseControl
              ref={poseControlRef}
              jointTargets={jointTargets}
              setJointTargets={commitUserJointTargets}
              connection={connection}
              isTorqueEnabled={isTorqueEnabled}
              onPlanChange={(plan) => setInterpolationPlan(plan || [])}
              kinematicMask={kinematicMask}
              onKinematicMaskChange={handleKinematicMaskChange}
            />
          </Box>
          <Box sx={{ display: activeSection === 'programming' ? 'block' : 'none', height: '100%' }}>
            <Programming
              ref={programmingRef}
              jointTargets={jointTargets}
              setJointTargets={commitUserJointTargets}
              setJointTargetsForPreview={commitExternalJointTargets}
              connection={connection}
              isTorqueEnabled={isTorqueEnabled}
              controlsDisabled={areActionButtonsLocked || isHomeRecoveryActive || !hasSynced}
              onPlanChange={(plan, fallback, isInterpolationEnabled) => {
                setInterpolationPlan(plan || []);
                setIsLinearInterpolationEnabled(!!isInterpolationEnabled);
              }}
              setProgramButtonLabel={setProgramButtonLabel}
            />
          </Box>
        </Box>

        {/* Unified Command Panel */}
        <CommandPanel
          {...commandPanelProps}
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
          setJointTargets={commitUserJointTargets}
          showTransformControls={activeSection === 'pose' || activeSection === 'programming'}
          interpolationPlan={interpolationPlan}
          onWaypointClick={handleWaypointClick}
          onSceneTransformation={handleSceneTransformation}
          kinematicMask={activeSection === 'pose' ? kinematicMask : { x: true, y: true, z: true, roll: false, pitch: true, yaw: false }}
          onRealTimeChange={setIsRealTimeEnabled}
        />
      </Box>
    </Box>
  );
}

export default DigitalTwinView;
