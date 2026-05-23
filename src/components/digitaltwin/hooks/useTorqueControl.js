import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Manages torque on/off, action-button locking, the auto-sync trigger
 * counter, and the Space-bar emergency-stop shortcut.
 *
 * @param {object}   connection  - serial connection from useSerialConnection
 * @param {boolean}  hasSynced   - whether the arm has reported its position
 * @param {Function} setHasSynced
 */
export default function useTorqueControl(connection, hasSynced, setHasSynced) {
  const [isTorqueEnabled, setIsTorqueEnabled] = useState(true);
  const [areActionButtonsLocked, setAreActionButtonsLocked] = useState(false);
  const [autoSyncTrigger, setAutoSyncTrigger] = useState(0);
  const torqueUnlockTimerRef = useRef(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (torqueUnlockTimerRef.current) {
        clearTimeout(torqueUnlockTimerRef.current);
      }
    };
  }, []);

  // When a successful sync occurs, allow action buttons again
  useEffect(() => {
    if (hasSynced) {
      setAreActionButtonsLocked(false);
    }
  }, [hasSynced]);

  const lockActionButtons = useCallback(() => {
    if (torqueUnlockTimerRef.current) {
      clearTimeout(torqueUnlockTimerRef.current);
      torqueUnlockTimerRef.current = null;
    }

    setAreActionButtonsLocked(true);
  }, []);

  const unlockActionButtonsAfterTorqueOn = useCallback(() => {
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
  }, []);

  const triggerAutoSync = useCallback(() => {
    setAutoSyncTrigger((c) => c + 1);
  }, []);

  const resetSyncState = useCallback(() => {
    setHasSynced(false);
  }, [setHasSynced]);

  const handleTorqueOn = useCallback(async () => {
    if (!connection.isConnected) {
      connection.setError('Connect to a serial port before sending commands.');
      return false;
    }

    const ok = await connection.sendCommandWithTimeout('M17\n');
    if (!ok) {
      return false;
    }

    setIsTorqueEnabled(true);
    setHasSynced(false);
    unlockActionButtonsAfterTorqueOn();
    return true;
  }, [connection, setHasSynced, unlockActionButtonsAfterTorqueOn]);

  const handleTorqueOff = useCallback(async () => {
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
  }, [connection, setHasSynced, lockActionButtons]);

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
  }, [connection?.isConnected, isTorqueEnabled, areActionButtonsLocked, handleTorqueOff]);

  return {
    isTorqueEnabled,
    areActionButtonsLocked,
    autoSyncTrigger,
    handleTorqueOn,
    handleTorqueOff,
    lockActionButtons,
    triggerAutoSync,
    resetSyncState,
  };
}
