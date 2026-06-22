import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { UpdateProgress } from "./UpdateProgress";
import type { UseUpdaterState } from "./useUpdater";

type UpdateModalProps = UseUpdaterState & {
  open: boolean;
  onClose: () => void;
  onInstall: () => void;
};

/**
 * Lightweight blocking dialog the user can open from anywhere (e.g. a
 * "Check for updates" menu item) to see the current updater state and act
 * on a ready-to-install build.
 */
export const UpdateModal = ({
  open,
  phase,
  info,
  progress,
  error,
  onClose,
  onInstall,
}: UpdateModalProps) => {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Application updates</DialogTitle>
          <DialogDescription>
            {phase === "checking" && "Checking for updates…"}
            {phase === "downloading" && "Downloading the latest version…"}
            {phase === "downloaded" &&
              `Version ${info?.version ?? ""} is ready to install.`}
            {phase === "not-available" && "You are running the latest version."}
            {phase === "error" && "Something went wrong while checking."}
            {phase === "idle" && "No update activity yet."}
            {phase === "available" && "An update is available."}
          </DialogDescription>
        </DialogHeader>

        {phase === "downloading" && (
          <UpdateProgress progress={progress} version={info?.version ?? null} />
        )}

        {phase === "error" && error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {info?.releaseNotes && typeof info.releaseNotes === "string" && (
          <div className="mt-2 max-h-48 overflow-auto rounded border bg-muted/30 p-3 text-xs">
            <pre className="whitespace-pre-wrap">{info.releaseNotes}</pre>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {phase === "downloaded" && (
            <Button onClick={onInstall}>Restart and install</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
