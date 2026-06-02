import { licenseService } from "../../license/index.js";

// All endpoints here are local-only — they're served by the Electron-internal
// Express on 127.0.0.1:4001 and proxied to the renderer through the IPC bridge.
// The real authority lives at the remote license server; these handlers just
// expose `licenseService` to the renderer.

export const getStatus = async (_req, res) => {
  const status = await licenseService.getStatus();
  res.json(status);
};

export const activate = async (req, res) => {
  const { licenseKey } = req.body ?? {};
  if (!licenseKey || typeof licenseKey !== "string") {
    return res.status(400).json({ error: "License key is required" });
  }
  try {
    const status = await licenseService.activate(licenseKey);
    res.json(status);
  } catch (err) {
    res
      .status(err?.status && err.status >= 400 && err.status < 600 ? err.status : 400)
      .json({ error: err?.message ?? "Activation failed" });
  }
};

export const verifyNow = async (_req, res) => {
  const status = await licenseService.verifyNow();
  res.json(status);
};

export const deactivate = async (_req, res) => {
  const status = licenseService.deactivate();
  res.json(status);
};
