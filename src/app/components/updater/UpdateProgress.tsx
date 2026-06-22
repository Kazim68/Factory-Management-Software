import { Progress } from "../ui/progress";
import type { UpdateProgressPayload } from "./types";

type UpdateProgressProps = {
  progress: UpdateProgressPayload | null;
  version?: string | null;
};

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

export const UpdateProgress = ({ progress, version }: UpdateProgressProps) => {
  const percent = progress ? Math.min(100, Math.max(0, progress.percent)) : 0;
  const transferred = progress?.transferred ?? 0;
  const total = progress?.total ?? 0;
  const speed = progress?.bytesPerSecond ?? 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {version ? `Downloading v${version}` : "Downloading update"}
        </span>
        <span className="font-medium">{percent.toFixed(0)}%</span>
      </div>
      <Progress value={percent} />
      {total > 0 ? (
        <p className="text-xs text-muted-foreground">
          {formatBytes(transferred)} / {formatBytes(total)}
          {speed > 0 ? ` • ${formatBytes(speed)}/s` : ""}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Preparing download…</p>
      )}
    </div>
  );
};
