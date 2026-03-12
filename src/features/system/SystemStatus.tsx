import type { SystemInfo } from '../../../electron/shared/types/system';

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatUptime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (days > 0) return `${days}d ${remainingHours}h`;
  return `${hours}h`;
};

interface SystemStatusProps {
  info: SystemInfo | null;
  isLoading: boolean;
  error: string | null;
}

const SystemStatus = ({ info, isLoading, error }: SystemStatusProps) => {
  if (isLoading) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6 text-sm text-muted">
        Loading system status…
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6 text-sm text-rose-300">
        {error}
      </section>
    );
  }

  if (!info) {
    return null;
  }

  const diskUsed = info.diskTotalBytes - info.diskFreeBytes;
  const diskPercent = info.diskTotalBytes
    ? Math.round((diskUsed / info.diskTotalBytes) * 100)
    : 0;

  const memoryUsed = info.totalMemBytes - info.freeMemBytes;
  const memoryPercent = info.totalMemBytes
    ? Math.round((memoryUsed / info.totalMemBytes) * 100)
    : 0;

  return (
    <section className="grid gap-4 rounded-2xl border border-slate-800 bg-surface/70 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted">System Status</p>
          <h2 className="mt-2 text-2xl font-semibold">Device health snapshot</h2>
          <p className="mt-2 text-sm text-muted">
            {info.hostname} · {info.platform} · {info.arch}
          </p>
        </div>
        <div className="text-right text-xs text-muted">
          <p>CPU: {info.cpuCount} cores</p>
          <p>Uptime: {formatUptime(info.uptimeSeconds)}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">Disk Usage</p>
          <p className="mt-3 text-2xl font-semibold">{diskPercent}%</p>
          <p className="mt-2 text-xs text-muted">
            {formatBytes(diskUsed)} used / {formatBytes(info.diskTotalBytes)} total
          </p>
          <p className="mt-1 text-xs text-muted">Path: {info.diskPath}</p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${diskPercent}%` }} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">Memory Usage</p>
          <p className="mt-3 text-2xl font-semibold">{memoryPercent}%</p>
          <p className="mt-2 text-xs text-muted">
            {formatBytes(memoryUsed)} used / {formatBytes(info.totalMemBytes)} total
          </p>
          <p className="mt-1 text-xs text-muted">Load avg: {info.loadAvg.map((v) => v.toFixed(2)).join(', ')}</p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-accent" style={{ width: `${memoryPercent}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default SystemStatus;
