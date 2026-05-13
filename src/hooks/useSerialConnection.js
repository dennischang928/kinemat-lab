import { useState, useCallback, useEffect, useRef } from 'react';

export const useSerialConnection = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [ports, setPorts] = useState([]);
  const [selectedPort, setSelectedPort] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('disconnected');
  const readerRef = useRef(null);
  const writerRef = useRef(null);
  const keepReadingRef = useRef(false);
  const lineListenersRef = useRef(new Set());
  const pendingResponseRef = useRef(null);
  const pendingTimeoutRef = useRef(null);
  const [isTorqueEnabled, setIsTorqueEnabled] = useState(true);

  // Check if Web Serial API is available
  const isSerialAvailable = useCallback(() => {
    return 'serial' in navigator;
  }, []);

  // Get available ports
  const getPorts = useCallback(async () => {
    try {
      if (!isSerialAvailable()) {
        return [];
      }
      
      const availablePorts = await navigator.serial.getPorts();
      setPorts(availablePorts);
      return availablePorts;
    } catch (err) {
      setError(`Failed to get ports: ${err.message}`);
      return [];
    }
  }, [isSerialAvailable]);

  // Request port access
  const requestPort = useCallback(async () => {
    try {
      if (!isSerialAvailable()) {
        return null;
      }

      const port = await navigator.serial.requestPort();
      setPorts(prev => [...prev, port]);
      return port;
    } catch (err) {
      if (err.name !== 'NotFoundError') {
        setError(`Failed to request port: ${err.message}`);
      }
      return null;
    }
  }, [isSerialAvailable]);

  // Connect to port
  const connect = useCallback(async (port, baudRate = 115200) => {
    try {
      if (!port) {
        setError('No port selected');
        return false;
      }

      await port.open({ baudRate });
      setSelectedPort(port);
      setIsConnected(true);
      setStatus('connected');
      setError(null);
      return true;
    } catch (err) {
      setError(`Failed to connect: ${err.message}`);
      setStatus('error');
      return false;
    }
  }, []);

  // Disconnect from port
  const disconnect = useCallback(async () => {
    try {
      if (selectedPort) {
        keepReadingRef.current = false;

        if (readerRef.current) {
          try {
            await readerRef.current.cancel();
          } catch (cancelErr) {
            // Ignore cancel errors during disconnect.
          }

          try {
            readerRef.current.releaseLock();
          } catch (releaseErr) {
            // Ignore lock-release errors during disconnect.
          }

          readerRef.current = null;
        }

        if (writerRef.current) {
          try {
            await writerRef.current.abort();
          } catch (abortErr) {
            // Ignore abort errors during disconnect.
          }

          try {
            writerRef.current.releaseLock();
          } catch (releaseErr) {
            // Ignore lock-release errors during disconnect.
          }

          writerRef.current = null;
        }

        await selectedPort.close();
        setSelectedPort(null);
        setIsConnected(false);
        setStatus('disconnected');
        setError(null);
      }
    } catch (err) {
      setError(`Failed to disconnect: ${err.message}`);
    }
  }, [selectedPort]);

  // Send data
  const sendData = useCallback(async (data) => {
    try {
      if (!selectedPort || !isConnected) {
        setError('Not connected to serial port');
        return false;
      }

      const writer = selectedPort.writable.getWriter();
      writerRef.current = writer;
      const encoder = new TextEncoder();
      const encoded = encoder.encode(typeof data === 'string' ? data : JSON.stringify(data));
      await writer.write(encoded);
      writer.releaseLock();
      writerRef.current = null;
      return true;
    } catch (err) {
      setError(`Failed to send data: ${err.message}`);
      return false;
    } finally {
      if (writerRef.current) {
        try {
          writerRef.current.releaseLock();
        } catch (releaseErr) {
          // Ignore lock-release errors.
        }
        writerRef.current = null;
      }
    }
  }, [selectedPort, isConnected]);

  // Send command and wait for OK/ERR within timeout
  const sendCommandWithTimeout = useCallback(async (command, { waitForOk = true, timeout = 5000 } = {}) => {
    if (!selectedPort || !isConnected) {
      setError('Not connected to serial port');
      return false;
    }

    // Cancel any existing pending
    if (pendingResponseRef.current) {
      pendingResponseRef.current.resolve(false);
      pendingResponseRef.current = null;
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
      }
    }

    const okWrite = await sendData(command);
    if (!okWrite) return false;

    if (!waitForOk) return true;

    return new Promise((resolve) => {
      pendingResponseRef.current = { resolve };
      pendingTimeoutRef.current = setTimeout(() => {
        if (pendingResponseRef.current) {
          pendingResponseRef.current.resolve(false);
          pendingResponseRef.current = null;
        }
        pendingTimeoutRef.current = null;
      }, timeout);
    });
  }, [selectedPort, isConnected, sendData]);

  // Receive data and broadcast to subscribers
  const startReading = useCallback(async () => {
    try {
      if (!selectedPort || !isConnected) {
        setError('Not connected to serial port');
        return;
      }

      if (readerRef.current) {
        return;
      }

      keepReadingRef.current = true;
      const reader = selectedPort.readable.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();

      try {
        while (keepReadingRef.current) {
          const { value, done } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);

          // notify all listeners
          lineListenersRef.current.forEach((cb) => {
            try { cb(text); } catch (e) { /* ignore listener errors */ }
          });

          // simple OK/ERR handling for pending command
          const lines = text.split(/\r?\n/);
          lines.forEach((line) => {
            if (!line) return;
            const okFound = /\bOK\b/.test(line);
            const errFound = /^ERR\b/.test(line);
            if ((okFound || errFound) && pendingResponseRef.current) {
              pendingResponseRef.current.resolve(okFound && !errFound);
              pendingResponseRef.current = null;
              if (pendingTimeoutRef.current) {
                clearTimeout(pendingTimeoutRef.current);
                pendingTimeoutRef.current = null;
              }
            }
          });
        }
      } finally {
        keepReadingRef.current = false;
        readerRef.current = null;
        reader.releaseLock();
      }
    } catch (err) {
      if (keepReadingRef.current) {
        setError(`Failed to read data: ${err.message}`);
      }
    }
  }, [selectedPort, isConnected]);

  const subscribe = useCallback((cb) => {
    lineListenersRef.current.add(cb);
    return () => lineListenersRef.current.delete(cb);
  }, []);

  // Check connection status on mount
  useEffect(() => {
    getPorts();
  }, [getPorts]);

  return {
    isConnected,
    ports,
    selectedPort,
    error,
    status,
    isTorqueEnabled,
    isSerialAvailable,
    getPorts,
    requestPort,
    connect,
    disconnect,
    sendData,
    startReading,
    subscribe,
    sendCommandWithTimeout,
    setSelectedPort,
    setError,
  };
};
