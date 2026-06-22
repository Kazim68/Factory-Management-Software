import { useEffect, useRef, useState, useCallback } from "react";
import type {
  UpdateInfo,
  UpdateProgressPayload,
  UpdaterPhase,
} from "./types";

export type UseUpdaterState = {
  phase: UpdaterPhase;
  info: UpdateInfo | null;
  progress: UpdateProgressPayload | null;
  error: string | null;
  dismissed: boolean;
};

const initialState: UseUpdaterState = {
  phase: "idle",
  info: null,
  progress: null,
  error: null,
  dismissed: false,
};

/**
 * Centralizes the updater subscriptions in one hook so the banner, the modal,
 * and the progress widget all observe the same state machine.
 *
 * If window.updater is undefined (browser preview, unit test) the hook is a
 * no-op and reports idle forever.
 */
export const useUpdater = () => {
  const [state, setState] = useState<UseUpdaterState>(initialState);
  const dismissedRef = useRef(false);

  useEffect(() => {
    const bridge = window.updater;
    if (!bridge) return;

    const unsubs = [
      bridge.onChecking(() =>
        setState((prev) => ({ ...prev, phase: "checking", error: null })),
      ),
      bridge.onAvailable((info) =>
        setState((prev) => ({
          ...prev,
          phase: "downloading",
          info,
          error: null,
          dismissed: dismissedRef.current && prev.info?.version === info.version,
        })),
      ),
      bridge.onNotAvailable((info) =>
        setState((prev) => ({
          ...prev,
          phase: "not-available",
          info,
          error: null,
        })),
      ),
      bridge.onProgress((progress) =>
        setState((prev) => ({
          ...prev,
          phase: "downloading",
          progress,
        })),
      ),
      bridge.onDownloaded((info) =>
        setState((prev) => ({
          ...prev,
          phase: "downloaded",
          info,
          // Surface the completion banner again even if the user dismissed the
          // "downloading" notification: restart-required is too important to
          // hide.
          dismissed: false,
        })),
      ),
      bridge.onError((payload) =>
        setState((prev) => ({
          ...prev,
          phase: "error",
          error: payload?.message ?? "Unknown updater error",
        })),
      ),
    ];

    return () => {
      unsubs.forEach((unsub) => {
        try {
          unsub();
        } catch {
          // ignore - cleanup is best effort
        }
      });
    };
  }, []);

  const checkNow = useCallback(async () => {
    if (!window.updater) return;
    try {
      await window.updater.checkForUpdates();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to check for updates";
      setState((prev) => ({ ...prev, phase: "error", error: message }));
    }
  }, []);

  const installNow = useCallback(async () => {
    if (!window.updater) return;
    try {
      await window.updater.installUpdate();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to install update";
      setState((prev) => ({ ...prev, phase: "error", error: message }));
    }
  }, []);

  const dismiss = useCallback(() => {
    dismissedRef.current = true;
    setState((prev) => ({ ...prev, dismissed: true }));
  }, []);

  const reset = useCallback(() => {
    dismissedRef.current = false;
    setState(initialState);
  }, []);

  return { ...state, checkNow, installNow, dismiss, reset };
};
