import { useState } from "react";
import { UpdateBanner } from "./UpdateBanner";
import { UpdateModal } from "./UpdateModal";
import { useUpdater } from "./useUpdater";

/**
 * Single-instance integration point: mounts the toast-style banner and an
 * on-demand modal driven by the same updater state machine. Drop into the
 * root tree (next to <Toaster />) and it manages itself.
 */
export const UpdaterRoot = () => {
  const updater = useUpdater();
  const [modalOpen, setModalOpen] = useState(false);

  // Detect the absence of the preload bridge (e.g. when serving the UI in a
  // plain browser tab). Rendering nothing avoids dead UI in that case.
  if (typeof window === "undefined" || !window.updater) return null;

  return (
    <>
      <UpdateBanner
        {...updater}
        onInstall={updater.installNow}
        onDismiss={updater.dismiss}
      />
      <UpdateModal
        {...updater}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onInstall={updater.installNow}
      />
    </>
  );
};

export { useUpdater } from "./useUpdater";
export { UpdateBanner } from "./UpdateBanner";
export { UpdateModal } from "./UpdateModal";
export { UpdateProgress } from "./UpdateProgress";
