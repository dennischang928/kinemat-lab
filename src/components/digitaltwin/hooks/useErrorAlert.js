import { useState, useEffect, useRef } from 'react';

/**
 * Manages the timed error-alert banner.
 *
 * When `error` transitions to a truthy value, `showErrorAlert` becomes
 * `true` for 3 seconds, then fades out.  After a 350 ms grace period
 * (matching the `<Fade>` transition), the error is cleared via
 * `clearError`.
 *
 * @param {string|null} error      - current error string
 * @param {Function}    clearError - callback to set the error to null
 * @returns {{ showErrorAlert: boolean }}
 */
export default function useErrorAlert(error, clearError) {
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const errorDismissTimerRef = useRef(null);
  const errorClearTimerRef = useRef(null);

  useEffect(() => {
    if (!error) {
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
        clearError(null);
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
  }, [error, clearError]);

  return { showErrorAlert };
}
