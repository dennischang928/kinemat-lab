import { useState, useCallback } from 'react';

/**
 * Manages serial-port connect/disconnect workflow and baud-rate selection.
 *
 * On successful connect the hook:
 *   1. Resets sync state via `onResetSync`.
 *   2. Locks action buttons via `onLockActions`.
 *   3. Triggers an auto-sync via `onAutoSync`.
 *
 * @param {object}   connection   - the serial connection object from useSerialConnection
 * @param {object}   callbacks    - lifecycle callbacks
 * @param {Function} callbacks.onResetSync   - called to reset hasSynced
 * @param {Function} callbacks.onLockActions - called to lock action buttons
 * @param {Function} callbacks.onAutoSync    - called to trigger M114 auto-sync
 */
export default function useConnectionManager(connection, { onResetSync, onLockActions, onAutoSync }) {
  const [baudRate, setBaudRate] = useState(115200);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [baudMenuAnchorEl, setBaudMenuAnchorEl] = useState(null);

  const isLoading = isConnecting || isDisconnecting;

  const handleConnect = useCallback(async () => {
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
          onResetSync();
          onLockActions();
          onAutoSync();
          console.log("Auto-sync triggered on connect");
        }
      }
    } catch (err) {
      connection.setError(`Connection failed: ${err.message}`);
    } finally {
      setIsConnecting(false);
    }
  }, [connection, baudRate, onResetSync, onLockActions, onAutoSync]);

  const handleDisconnect = useCallback(async () => {
    setIsDisconnecting(true);
    try {
      await connection.disconnect();
    } finally {
      setIsDisconnecting(false);
    }
  }, [connection]);

  const handleOpenBaudMenu = useCallback((event) => {
    setBaudMenuAnchorEl(event.currentTarget);
  }, []);

  const handleCloseBaudMenu = useCallback(() => {
    setBaudMenuAnchorEl(null);
  }, []);

  const handleSelectBaudRate = useCallback((rate) => {
    setBaudRate(rate);
    setBaudMenuAnchorEl(null);
  }, []);

  return {
    baudRate,
    isConnecting,
    isDisconnecting,
    isLoading,
    baudMenuAnchorEl,
    handleConnect,
    handleDisconnect,
    handleOpenBaudMenu,
    handleCloseBaudMenu,
    handleSelectBaudRate,
  };
}
