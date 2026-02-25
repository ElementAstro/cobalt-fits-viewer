/**
 * Shared hook for connection test logic used by SFTP/WebDAV config sheets.
 * Manages testing state, result display, and auto-close on success.
 */

import { useState, useCallback, useRef } from "react";

const AUTO_CLOSE_DELAY_MS = 1000;

interface UseConnectionTestOptions {
  onClose: () => void;
  autoCloseDelayMs?: number;
}

interface UseConnectionTestReturn {
  testing: boolean;
  testResult: boolean | null;
  runTest: (asyncFn: () => Promise<boolean>) => Promise<void>;
  resetTest: () => void;
  handleClose: (resetFields: () => void) => void;
}

export function useConnectionTest({
  onClose,
  autoCloseDelayMs = AUTO_CLOSE_DELAY_MS,
}: UseConnectionTestOptions): UseConnectionTestReturn {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runTest = useCallback(
    async (asyncFn: () => Promise<boolean>) => {
      setTesting(true);
      setTestResult(null);

      try {
        const success = await asyncFn();
        setTestResult(success);
        if (success) {
          timerRef.current = setTimeout(onClose, autoCloseDelayMs);
        }
      } catch {
        setTestResult(false);
      } finally {
        setTesting(false);
      }
    },
    [onClose, autoCloseDelayMs],
  );

  const resetTest = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setTestResult(null);
  }, []);

  const handleClose = useCallback(
    (resetFields: () => void) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      resetFields();
      setTestResult(null);
      onClose();
    },
    [onClose],
  );

  return { testing, testResult, runTest, resetTest, handleClose };
}
