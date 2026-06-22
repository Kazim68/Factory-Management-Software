// Shared types for the updater bridge that the preload script exposes on
// window.updater. Kept in one place so renderer code references a single
// canonical definition.

export type UpdateInfo = {
  version: string | null;
  releaseDate?: string | null;
  releaseName?: string | null;
  releaseNotes?: string | null;
};

export type UpdateProgressPayload = {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
};

export type UpdateErrorPayload = {
  message: string;
};

export type Unsubscribe = () => void;

export type UpdaterBridge = {
  checkForUpdates: () => Promise<unknown>;
  installUpdate: () => Promise<unknown>;
  getInfo: () => Promise<{
    currentVersion: string;
    isPackaged: boolean;
    feedURL: string | null;
  }>;
  onChecking: (handler: () => void) => Unsubscribe;
  onAvailable: (handler: (info: UpdateInfo) => void) => Unsubscribe;
  onNotAvailable: (handler: (info: UpdateInfo) => void) => Unsubscribe;
  onProgress: (handler: (info: UpdateProgressPayload) => void) => Unsubscribe;
  onDownloaded: (handler: (info: UpdateInfo) => void) => Unsubscribe;
  onError: (handler: (info: UpdateErrorPayload) => void) => Unsubscribe;
};

declare global {
  interface Window {
    updater?: UpdaterBridge;
  }
}

export type UpdaterPhase =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "not-available"
  | "error";
