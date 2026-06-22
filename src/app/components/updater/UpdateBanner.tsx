import { Button } from "../ui/button";
import { Download, RefreshCw, AlertTriangle, X } from "lucide-react";
import { UpdateProgress } from "./UpdateProgress";
import type { UseUpdaterState } from "./useUpdater";

type UpdateBannerProps = UseUpdaterState & {
  onInstall: () => void;
  onDismiss: () => void;
};

/**
 * Sticks to the bottom-right of the viewport and only renders when there is
 * something useful to show: a download in progress, a downloaded build ready
 * to install, or an error.
 */
export const UpdateBanner = ({
  phase,
  info,
  progress,
  error,
  dismissed,
  onInstall,
  onDismiss,
}: UpdateBannerProps) => {
  if (dismissed && phase !== "downloaded") return null;

  if (phase === "downloading") {
    return (
      <div className="fixed bottom-4 right-4 z-50 w-[360px] rounded-lg border bg-card p-4 shadow-lg">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Update available</span>
          </div>
          <button
            onClick={onDismiss}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1 mb-3">
          A new version is downloading in the background.
        </p>
        <UpdateProgress progress={progress} version={info?.version ?? null} />
      </div>
    );
  }

  if (phase === "downloaded") {
    return (
      <div className="fixed bottom-4 right-4 z-50 w-[360px] rounded-lg border bg-card p-4 shadow-lg">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Ready to install</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1 mb-3">
          {info?.version
            ? `Version ${info.version} has been downloaded.`
            : "A new version has been downloaded."}{" "}
          Restart now to apply.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Remind later
          </Button>
          <Button size="sm" onClick={onInstall}>
            Restart now
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "error" && error) {
    return (
      <div className="fixed bottom-4 right-4 z-50 w-[360px] rounded-lg border border-destructive/40 bg-card p-4 shadow-lg">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="font-medium text-sm">Update failed</span>
          </div>
          <button
            onClick={onDismiss}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {error}
        </p>
      </div>
    );
  }

  return null;
};
