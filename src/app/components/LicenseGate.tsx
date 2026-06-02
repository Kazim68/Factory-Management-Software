import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { licenseApi, type LicenseStatus } from "../lib/api";
import { auth } from "../lib/auth";
import { ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";

// Polls every 15 minutes per Approch.docx P237–P244.
const VERIFY_INTERVAL_MS = 15 * 60 * 1000;

const LICENSE_KEY_PATTERN = /^LIC-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;

type LicenseGateProps = {
  /** Children only render once the license is valid. */
  children: React.ReactNode;
  /** Called whenever a previously-valid license transitions to invalid. */
  onBlocked?: () => void;
};

const formatExpiry = (iso?: string): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

export function LicenseGate({ children, onBlocked }: LicenseGateProps) {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const lastValidRef = useRef<boolean | null>(null);

  const refresh = useCallback(async (mode: "initial" | "verify" = "initial") => {
    try {
      if (mode === "verify") setVerifying(true);
      const next =
        mode === "verify"
          ? await licenseApi.verifyNow()
          : await licenseApi.getStatus();
      setStatus(next);

      if (lastValidRef.current === true && !next.valid) {
        // Transitioned from valid → invalid: log the user out and notify.
        toast.error(next.reason ?? "License is no longer active.");
        try {
          auth.logout();
        } catch {
          /* ignore */
        }
        onBlocked?.();
      }
      lastValidRef.current = next.valid;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to check license";
      setStatus({
        valid: false,
        hasKey: false,
        reason: message,
      });
    } finally {
      setLoading(false);
      setVerifying(false);
    }
  }, [onBlocked]);

  useEffect(() => {
    refresh("initial");
  }, [refresh]);

  useEffect(() => {
    if (!status?.valid) return undefined;
    const id = window.setInterval(() => {
      refresh("verify");
    }, VERIFY_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [status?.valid, refresh]);

  if (loading || !status) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking license…
        </div>
      </div>
    );
  }

  if (status.valid) {
    return <>{children}</>;
  }

  // Pick screen variant based on what kind of invalid state we're in.
  if (!status.hasKey) {
    return (
      <LicenseActivation
        status={status}
        onActivated={() => refresh("verify")}
      />
    );
  }

  return (
    <LicenseBlocked
      status={status}
      busy={verifying}
      onRecheck={() => refresh("verify")}
    />
  );
}

// ---------- Activation screen (Approch.docx P222–P235) ----------

function LicenseActivation({
  status,
  onActivated,
}: {
  status: LicenseStatus;
  onActivated: () => void;
}) {
  const [licenseKey, setLicenseKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const normalized = licenseKey.trim().toUpperCase();
    if (!LICENSE_KEY_PATTERN.test(normalized)) {
      setError("License key must look like LIC-XXXX-XXXX-XXXX.");
      return;
    }

    setBusy(true);
    try {
      const next = await licenseApi.activate(normalized);
      if (!next.valid) {
        setError(next.reason ?? "Activation failed.");
      } else {
        toast.success("License activated.");
        onActivated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Activate CrossX</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter the license key supplied by your administrator. The key
                binds this installation to your company's account.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="license-key">License key</Label>
              <Input
                id="license-key"
                value={licenseKey}
                onChange={(event) =>
                  setLicenseKey(event.target.value.toUpperCase())
                }
                placeholder="LIC-XXXX-XXXX-XXXX"
                autoFocus
                required
                className="font-mono"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            {status.deviceId && (
              <p className="text-xs text-muted-foreground">
                Device ID: <code className="font-mono">{status.deviceId}</code>
              </p>
            )}
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Activating…
                </>
              ) : (
                "Activate"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Blocked / expired screen (Approch.docx P240–P244) ----------

function LicenseBlocked({
  status,
  busy,
  onRecheck,
}: {
  status: LicenseStatus;
  busy: boolean;
  onRecheck: () => void;
}) {
  // Make absolutely sure the session is cleared while a license is blocked.
  useEffect(() => {
    try {
      auth.logout();
    } catch {
      /* ignore */
    }
  }, []);

  const expires = formatExpiry(status.expiresAt);
  const reason =
    status.reason ??
    (status.licenseStatus === "EXPIRED"
      ? "Your license has expired."
      : status.licenseStatus === "BLOCKED"
        ? "Your license has been blocked."
        : status.companyStatus === "BLOCKED"
          ? "Your company account has been blocked."
          : "License is not active.");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-destructive/10 p-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>CrossX is locked</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <dl className="text-sm space-y-1">
            {status.licenseStatus && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">License status</dt>
                <dd>{status.licenseStatus}</dd>
              </div>
            )}
            {status.companyStatus && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Company status</dt>
                <dd>{status.companyStatus}</dd>
              </div>
            )}
            {expires && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Expires</dt>
                <dd>{expires}</dd>
              </div>
            )}
            {status.deviceId && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Device ID</dt>
                <dd className="font-mono text-xs">{status.deviceId}</dd>
              </div>
            )}
          </dl>
          <p className="text-sm text-muted-foreground">
            Contact your administrator to restore access, then click below to
            re-check.
          </p>
          <Button
            type="button"
            variant="default"
            disabled={busy}
            onClick={onRecheck}
            className="w-full"
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Re-checking…
              </>
            ) : (
              "Re-check license"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
