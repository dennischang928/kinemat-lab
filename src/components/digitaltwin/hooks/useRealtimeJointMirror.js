import { useCallback, useEffect, useRef, useState } from 'react';
import { angleToSteps } from '../../../constants/robotConstants';

export const buildRealtimeG0Command = (jointTargets = {}) => {
  const j1 = angleToSteps(jointTargets?.J1 ?? 0);
  const j2 = angleToSteps(jointTargets?.J2 ?? 0);
  const j3 = angleToSteps(jointTargets?.J3 ?? 0);
  const j4 = angleToSteps(jointTargets?.J4 ?? 0);

  return `G0 ${j1},${j2},${j3},${j4}\n`;
};

export default function useRealtimeJointMirror({
  connection,
  isTorqueEnabled,
  enabled = false,
} = {}) {
  const queuedTargetsRef = useRef(null);
  const [queuedRevision, setQueuedRevision] = useState(0);

  const queueRealtimeMirror = useCallback((nextJointTargets) => {
    queuedTargetsRef.current = nextJointTargets;
    setQueuedRevision((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      queuedTargetsRef.current = null;
      return undefined;
    }

    const nextJointTargets = queuedTargetsRef.current;
    if (!nextJointTargets) {
      return undefined;
    }

    queuedTargetsRef.current = null;

    if (!connection?.isConnected || !isTorqueEnabled) {
      return undefined;
    }

    const command = buildRealtimeG0Command(nextJointTargets);
    let cancelled = false;

    (async () => {
      const ok = await connection.sendRaw(command);
      if (!cancelled && !ok) {
        connection.setError('Failed to send real-time G0 command.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [connection, enabled, isTorqueEnabled, queuedRevision]);

  return {
    queueRealtimeMirror,
    buildRealtimeG0Command,
  };
}