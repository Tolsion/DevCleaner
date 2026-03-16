import { useEffect, useMemo, useState } from 'react';
import { useSystemStore } from '../../store/systemStore';
import type { SystemInfo } from '../../../electron/shared/types/system';
import LoadingOverlay from '../../components/LoadingOverlay';

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

const formatRate = (bytesPerSec: number) => {
  if (!bytesPerSec) return '0 B/s';
  return `${formatBytes(bytesPerSec)}/s`;
};

const formatMbps = (bytesPerSec: number) => {
  if (!bytesPerSec) return '0.00 Mbps';
  return `${((bytesPerSec * 8) / (1024 * 1024)).toFixed(2)} Mbps`;
};

const getNetworkPeak = (info: SystemInfo) => {
  return Math.max(info.networkInBytesPerSec, info.networkOutBytesPerSec, 1);
};

const formatPercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return 'Unknown';
  return `${value.toFixed(1)}%`;
};

const formatMinutes = (minutes: number | null) => {
  if (!minutes || minutes <= 0) return 'Unknown';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours <= 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const getHealthPercent = (
  design: number | null,
  full: number | null,
  maximumPercent: number | null
) => {
  if (maximumPercent !== null && maximumPercent > 0) return maximumPercent;
  if (!design || !full) return null;
  if (design <= 0) return null;
  const percent = (full / design) * 100;
  return Math.max(0, Math.min(100, percent));
};

const SystemSection = ({
  title,
  children,
  defaultOpen = true
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <details
      open={isOpen}
      onToggle={(event) => {
        setIsOpen((event.currentTarget as HTMLDetailsElement).open);
      }}
      className="rounded-2xl border border-slate-800 bg-[radial-gradient(circle_at_top,_rgba(30,64,175,0.18),_transparent_60%),radial-gradient(circle_at_bottom,_rgba(16,185,129,0.12),_transparent_55%)] p-6"
    >
      <summary className="cursor-pointer text-sm uppercase tracking-[0.3em] text-muted">{title}</summary>
      <div className="mt-4 grid gap-3 text-sm">{children}</div>
    </details>
  );
};

const Sparkline = ({
  points,
  stroke = '#38bdf8'
}: {
  points: number[];
  stroke?: string;
}) => {
  if (points.length < 2) {
    return <div className="h-9" />;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 160;
  const height = 36;
  const path = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-9 w-full">
      <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
};

const SystemKeyValue = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-muted">{label}</span>
    <span className="text-slate-100">{value}</span>
  </div>
);

const formatProcessName = (command: string) => {
  if (!command) return 'Unknown';
  const parts = command.split('/');
  return parts[parts.length - 1] || command;
};

const renderNetwork = (info: SystemInfo) => {
  const entries = Object.entries(info.networkInterfaces);
  if (entries.length === 0) return <p className="text-xs text-muted">No network interfaces detected.</p>;
  return (
    <div className="space-y-3 text-xs">
      {entries.map(([name, items]) => (
        <div key={name} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">{name}</p>
          <ul className="mt-2 space-y-1 font-mono text-slate-200">
            {items.map((item, index) => (
              <li key={`${name}-${index}`}>
                {item.family} · {item.address} {item.internal ? '(internal)' : ''}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

const SystemPage = () => {
  const { info, isLoading, error, fetchInfo } = useSystemStore();
  const [selectedAdapter, setSelectedAdapter] = useState<string>('all');
  const [portQuery, setPortQuery] = useState('');
  const [portProtocol, setPortProtocol] = useState<'all' | 'TCP' | 'UDP'>('all');
  const [portSortKey, setPortSortKey] = useState<'port' | 'process' | 'pid' | 'protocol'>('port');
  const [portSortDir, setPortSortDir] = useState<'asc' | 'desc'>('asc');
  const [diskUsageSeries, setDiskUsageSeries] = useState<number[]>([]);
  const [diskReadSeries, setDiskReadSeries] = useState<number[]>([]);
  const [diskWriteSeries, setDiskWriteSeries] = useState<number[]>([]);
  const [swapSeries, setSwapSeries] = useState<number[]>([]);
  const [pageoutsSeries, setPageoutsSeries] = useState<number[]>([]);
  const [netInSeries, setNetInSeries] = useState<number[]>([]);
  const [netOutSeries, setNetOutSeries] = useState<number[]>([]);
  const [gpuUsageSeries, setGpuUsageSeries] = useState<number[]>([]);

  useEffect(() => {
    void fetchInfo();
    const interval = window.setInterval(() => {
      void fetchInfo();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [fetchInfo]);

  useEffect(() => {
    if (!info) return;
    const MAX_POINTS = 36;
    const pushPoint = (prev: number[], value: number) => {
      const next = [...prev, value];
      if (next.length > MAX_POINTS) next.shift();
      return next;
    };
    const diskPercent = info.diskTotalBytes
      ? ((info.diskTotalBytes - info.diskFreeBytes) / info.diskTotalBytes) * 100
      : 0;
    const swapPercent = info.swapTotalBytes
      ? (info.swapUsedBytes / info.swapTotalBytes) * 100
      : 0;
    setDiskUsageSeries((prev) => pushPoint(prev, diskPercent));
    setDiskReadSeries((prev) => pushPoint(prev, info.diskReadBytesPerSec));
    setDiskWriteSeries((prev) => pushPoint(prev, info.diskWriteBytesPerSec));
    setSwapSeries((prev) => pushPoint(prev, swapPercent));
    setPageoutsSeries((prev) => pushPoint(prev, info.pageouts));
    setNetInSeries((prev) => pushPoint(prev, info.networkInBytesPerSec));
    setNetOutSeries((prev) => pushPoint(prev, info.networkOutBytesPerSec));
    setGpuUsageSeries((prev) => pushPoint(prev, info.gpu.utilizationPercent ?? 0));
  }, [info]);

  useEffect(() => {
    if (!info) return;
    if (selectedAdapter === 'all') return;
    const exists = info.networkAdapters.some((adapter) => adapter.name === selectedAdapter);
    if (!exists) {
      setSelectedAdapter('all');
    }
  }, [info, selectedAdapter]);

  const activeAdapter = useMemo(() => {
    if (!info) return null;
    if (selectedAdapter === 'all') return null;
    return info.networkAdapters.find((adapter) => adapter.name === selectedAdapter) ?? null;
  }, [info, selectedAdapter]);

  const displayedInboundRate = activeAdapter ? activeAdapter.inBytesPerSec : (info?.networkInBytesPerSec ?? 0);
  const displayedOutboundRate = activeAdapter ? activeAdapter.outBytesPerSec : (info?.networkOutBytesPerSec ?? 0);
  const displayedInboundTotal = activeAdapter ? activeAdapter.inBytesTotal : (info?.networkInBytesTotal ?? 0);
  const displayedOutboundTotal = activeAdapter ? activeAdapter.outBytesTotal : (info?.networkOutBytesTotal ?? 0);

  const filteredPorts = useMemo(() => {
    if (!info) return [];
    const query = portQuery.trim().toLowerCase();
    const filtered = info.openPorts.filter((port) => {
      if (portProtocol !== 'all' && port.protocol !== portProtocol) return false;
      if (!query) return true;
      return (
        port.process.toLowerCase().includes(query) ||
        String(port.pid).includes(query) ||
        String(port.port).includes(query)
      );
    });
    const sorted = [...filtered].sort((a, b) => {
      if (portSortKey === 'protocol') {
        const value = a.protocol.localeCompare(b.protocol);
        return portSortDir === 'asc' ? value : -value;
      }
      if (portSortKey === 'process') {
        const value = a.process.localeCompare(b.process);
        return portSortDir === 'asc' ? value : -value;
      }
      if (portSortKey === 'pid') {
        const value = a.pid - b.pid;
        return portSortDir === 'asc' ? value : -value;
      }
      const value = Number(a.port) - Number(b.port);
      return portSortDir === 'asc' ? value : -value;
    });
    return sorted;
  }, [info, portProtocol, portQuery, portSortKey, portSortDir]);

  return (
    <div className="flex min-h-full flex-col gap-6 px-8 pb-10 pt-6">
      {isLoading && !info ? <LoadingOverlay label="Loading system data" /> : null}
      {isLoading && !info ? (
        <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`system-skeleton-${index}`}
                className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5"
              >
                <div className="h-3 w-24 rounded-full bg-slate-800/80" />
                <div className="mt-3 h-8 w-28 rounded-xl bg-slate-800/80" />
                <div className="mt-2 h-3 w-36 rounded-full bg-slate-800/80" />
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full w-2/3 rounded-full bg-slate-700/80 animate-pulse" />
                </div>
                <div className="mt-2 h-3 w-32 rounded-full bg-slate-800/80" />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {error ? (
        <section className="rounded-2xl border border-slate-800 bg-surface/70 p-6 text-sm text-rose-300">
          {error}
        </section>
      ) : null}

      {info ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-surface/70 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-muted">Disk Usage</p>
              <p className="mt-3 text-3xl font-semibold">
                {formatBytes(info.diskTotalBytes - info.diskFreeBytes)}
              </p>
              <p className="mt-2 text-sm text-muted">Used · {formatBytes(info.diskTotalBytes)} total</p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-emerald-400"
                  style={{
                    width: `${clampPercent(
                      info.diskTotalBytes
                        ? ((info.diskTotalBytes - info.diskFreeBytes) / info.diskTotalBytes) * 100
                        : 0
                    )}%`
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-muted">
                Read {formatRate(info.diskReadBytesPerSec)} · Write {formatRate(info.diskWriteBytesPerSec)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-surface/70 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-muted">Memory Usage</p>
              <p className="mt-3 text-3xl font-semibold">
                {formatBytes(info.totalMemBytes - info.freeMemBytes)}
              </p>
              <p className="mt-2 text-sm text-muted">Used · {formatBytes(info.totalMemBytes)} total</p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{
                    width: `${clampPercent(
                      info.totalMemBytes
                        ? ((info.totalMemBytes - info.freeMemBytes) / info.totalMemBytes) * 100
                        : 0
                    )}%`
                  }}
                />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-surface/70 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-muted">CPU Load</p>
              <p className="mt-3 text-3xl font-semibold">{info.cpuUsagePercent.toFixed(1)}%</p>
              <p className="mt-2 text-sm text-muted">
                {info.cpuCount} cores · {info.cpuModel}
              </p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-amber-400"
                  style={{ width: `${clampPercent(info.cpuUsagePercent)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted">
                Load avg: {info.loadAvg.map((v) => v.toFixed(2)).join(' · ')}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-surface/70 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-muted">Battery</p>
              {(() => {
                const health = getHealthPercent(
                  info.battery.designCapacityMah,
                  info.battery.fullChargeCapacityMah,
                  info.battery.maximumCapacityPercent
                );
                return (
                  <>
              <p className="mt-3 text-3xl font-semibold">
                {info.battery.hasBattery && info.battery.percent !== null
                  ? `${info.battery.percent}%`
                  : '—'}
              </p>
              <p className="mt-2 text-sm text-muted">
                {info.battery.hasBattery
                  ? info.battery.isCharging === null
                    ? 'Status unknown'
                    : info.battery.isCharging
                      ? 'Charging'
                      : 'Discharging'
                  : 'No battery detected'}
              </p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-emerald-400"
                  style={{ width: `${clampPercent(info.battery.percent ?? 0)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted">
                {info.battery.hasBattery
                  ? `Cycles: ${info.battery.cycleCount ?? 'Unknown'} · Condition: ${info.battery.condition ?? 'Unknown'}`
                  : '—'}
              </p>
                    <p className="mt-1 text-xs text-muted">
                      Health: {health !== null ? `${health.toFixed(0)}%` : 'Unknown'}
                    </p>
                  </>
                );
              })()}
            </div>
            <div className="rounded-2xl border border-slate-800 bg-surface/70 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-muted">GPU</p>
              <p className="mt-3 text-3xl font-semibold">
                {info.gpu.utilizationPercent !== null ? `${info.gpu.utilizationPercent.toFixed(1)}%` : '—'}
              </p>
              <p className="mt-2 text-sm text-muted">
                {info.gpu.model ?? 'GPU not detected'}
              </p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-sky-400"
                  style={{ width: `${clampPercent(info.gpu.utilizationPercent ?? 0)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted">
                VRAM: {info.gpu.vramMb ? `${info.gpu.vramMb.toLocaleString()} MB` : 'Unknown'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-surface/70 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-muted">Network</p>
              <p className="mt-3 text-3xl font-semibold">{formatRate(Math.max(displayedInboundRate, displayedOutboundRate, 1))}</p>
              <p className="mt-2 text-sm text-muted">
                Down {formatRate(displayedInboundRate)} · Up {formatRate(displayedOutboundRate)}
              </p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div className="flex h-full w-full">
                  <div
                    className="h-full bg-sky-400"
                    style={{ width: `${(displayedInboundRate / Math.max(displayedInboundRate, displayedOutboundRate, 1)) * 100}%` }}
                  />
                  <div
                    className="h-full bg-fuchsia-400"
                    style={{ width: `${(displayedOutboundRate / Math.max(displayedInboundRate, displayedOutboundRate, 1)) * 100}%` }}
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">
                Total: {formatBytes(displayedInboundTotal + displayedOutboundTotal)}
              </p>
            </div>
          </div>

          <SystemSection title="Hardware" defaultOpen>
            <SystemKeyValue label="Hostname" value={info.hostname} />
            <SystemKeyValue label="Platform" value={`${info.platform} ${info.release}`} />
            <SystemKeyValue label="Architecture" value={info.arch} />
            <SystemKeyValue label="CPU" value={`${info.cpuModel} · ${info.cpuSpeedMHz} MHz`} />
            <SystemKeyValue label="GPU" value={info.gpu.model ?? 'Unknown'} />
            <SystemKeyValue label="Uptime" value={formatUptime(info.uptimeSeconds)} />
          </SystemSection>

          <SystemSection title="GPU" defaultOpen={false}>
            {info.gpu.available ? (
              <>
                <SystemKeyValue label="Model" value={info.gpu.model ?? 'Unknown'} />
                <SystemKeyValue label="Vendor" value={info.gpu.vendor ?? 'Unknown'} />
                <SystemKeyValue label="Renderer" value={info.gpu.renderer ?? 'Unknown'} />
                <SystemKeyValue label="Driver" value={info.gpu.driverVersion ?? 'Unknown'} />
                <SystemKeyValue
                  label="VRAM"
                  value={info.gpu.vramMb !== null ? `${info.gpu.vramMb.toLocaleString()} MB` : 'Unknown'}
                />
                <SystemKeyValue label="Utilization" value={formatPercent(info.gpu.utilizationPercent)} />
                <SystemKeyValue label="Data Source" value={info.gpu.source ?? 'Unknown'} />
                <div className="pt-2 text-xs">
                  <p className="text-muted">GPU usage history</p>
                  <Sparkline points={gpuUsageSeries} stroke="#38bdf8" />
                </div>
                <div className="space-y-3 pt-2 text-xs">
                  {info.gpu.devices.map((device, index) => (
                    <div key={`${device.name}-${index}`} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                      <p className="text-xs uppercase tracking-[0.3em] text-muted">{device.name}</p>
                      <p className="mt-2 text-slate-200">Vendor: {device.vendor ?? 'Unknown'}</p>
                      <p className="mt-1 text-slate-200">
                        VRAM: {device.vramMb !== null ? `${device.vramMb.toLocaleString()} MB` : 'Unknown'}
                      </p>
                      <p className="mt-1 text-slate-200">
                        Active: {device.active === null ? 'Unknown' : device.active ? 'Yes' : 'No'}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-muted">GPU data is not available on this system.</p>
            )}
          </SystemSection>

          <SystemSection title="Storage" defaultOpen={false}>
            <SystemKeyValue label="Disk Path" value={info.diskPath} />
            <SystemKeyValue label="Disk Total" value={formatBytes(info.diskTotalBytes)} />
            <SystemKeyValue label="Disk Free" value={formatBytes(info.diskFreeBytes)} />
            <div className="pt-2 text-xs">
              <p className="text-muted">Disk usage history</p>
              <Sparkline points={diskUsageSeries} stroke="#34d399" />
            </div>
          </SystemSection>

          <SystemSection title="Disk Activity" defaultOpen={false}>
            <SystemKeyValue label="Read Rate" value={formatRate(info.diskReadBytesPerSec)} />
            <SystemKeyValue label="Write Rate" value={formatRate(info.diskWriteBytesPerSec)} />
            <div className="grid gap-3 pt-2 text-xs">
              <div>
                <p className="text-muted">Read history</p>
                <Sparkline points={diskReadSeries} stroke="#38bdf8" />
              </div>
              <div>
                <p className="text-muted">Write history</p>
                <Sparkline points={diskWriteSeries} stroke="#f59e0b" />
              </div>
            </div>
          </SystemSection>

          <SystemSection title="Memory Pressure" defaultOpen={false}>
            <SystemKeyValue label="Swap Used" value={formatBytes(info.swapUsedBytes)} />
            <SystemKeyValue label="Swap Total" value={formatBytes(info.swapTotalBytes)} />
            <SystemKeyValue label="Pageouts" value={info.pageouts.toLocaleString()} />
            <div className="grid gap-3 pt-2 text-xs">
              <div>
                <p className="text-muted">Swap usage history</p>
                <Sparkline points={swapSeries} stroke="#60a5fa" />
              </div>
              <div>
                <p className="text-muted">Pageouts history</p>
                <Sparkline points={pageoutsSeries} stroke="#f472b6" />
              </div>
            </div>
          </SystemSection>

          <SystemSection title="Network Interfaces" defaultOpen={false}>
            {renderNetwork(info)}
          </SystemSection>

          <SystemSection title="Network Activity" defaultOpen={false}>
            <div className="flex flex-wrap items-center gap-2 pb-2">
              <button
                type="button"
                onClick={() => setSelectedAdapter('all')}
                className={`rounded-full border px-3 py-1 text-xs ${
                  selectedAdapter === 'all'
                    ? 'border-slate-700 bg-slate-900/60 text-slate-100'
                    : 'border-slate-800 text-muted hover:border-slate-700'
                }`}
              >
                All Adapters
              </button>
              {info.networkAdapters.map((adapter) => (
                <button
                  key={adapter.name}
                  type="button"
                  onClick={() => setSelectedAdapter(adapter.name)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    selectedAdapter === adapter.name
                      ? 'border-sky-500/40 bg-sky-500/10 text-sky-100'
                      : 'border-slate-800 text-muted hover:border-slate-700'
                  }`}
                >
                  {adapter.displayName}
                </button>
              ))}
            </div>
            <SystemKeyValue label="Inbound Rate" value={formatRate(displayedInboundRate)} />
            <SystemKeyValue label="Inbound Mbps" value={formatMbps(displayedInboundRate)} />
            <SystemKeyValue label="Outbound Rate" value={formatRate(displayedOutboundRate)} />
            <SystemKeyValue label="Outbound Mbps" value={formatMbps(displayedOutboundRate)} />
            <SystemKeyValue label="Inbound Total" value={formatBytes(displayedInboundTotal)} />
            <SystemKeyValue label="Outbound Total" value={formatBytes(displayedOutboundTotal)} />
            {activeAdapter ? (
              <SystemKeyValue label="Adapter Type" value={activeAdapter.type ?? 'Unknown'} />
            ) : null}
            <div className="grid gap-3 pt-2 text-xs">
              <div>
                <p className="text-muted">Inbound history</p>
                <Sparkline points={netInSeries} stroke="#38bdf8" />
              </div>
              <div>
                <p className="text-muted">Outbound history</p>
                <Sparkline points={netOutSeries} stroke="#f472b6" />
              </div>
            </div>
            <div className="pt-2">
              <p className="text-xs uppercase tracking-[0.3em] text-muted">Adapters</p>
              {info.networkAdapters.length === 0 ? (
                <p className="mt-3 text-xs text-muted">No adapter counters available.</p>
              ) : (
                <div className="mt-3 overflow-hidden rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/60 text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-3 py-2">Adapter</th>
                        <th className="px-3 py-2">Down</th>
                        <th className="px-3 py-2">Up</th>
                        <th className="px-3 py-2">Down Mbps</th>
                        <th className="px-3 py-2">Up Mbps</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {info.networkAdapters.map((adapter) => (
                        <tr key={adapter.name}>
                          <td className="px-3 py-2 text-slate-200">
                            {adapter.displayName}
                            <span className="ml-2 text-muted">{adapter.active ? 'active' : 'idle'}</span>
                          </td>
                          <td className="px-3 py-2">{formatRate(adapter.inBytesPerSec)}</td>
                          <td className="px-3 py-2">{formatRate(adapter.outBytesPerSec)}</td>
                          <td className="px-3 py-2">{formatMbps(adapter.inBytesPerSec)}</td>
                          <td className="px-3 py-2">{formatMbps(adapter.outBytesPerSec)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="pt-2">
              <p className="text-xs uppercase tracking-[0.3em] text-muted">Network Active Processes</p>
              {info.networkProcesses.length === 0 ? (
                <p className="mt-3 text-xs text-muted">No process-level network activity available.</p>
              ) : (
                <div className="mt-3 overflow-hidden rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/60 text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-3 py-2">Process</th>
                        <th className="px-3 py-2">PID</th>
                        <th className="px-3 py-2">Proto</th>
                        <th className="px-3 py-2">Connections</th>
                        <th className="px-3 py-2">Established</th>
                        <th className="px-3 py-2">Listening</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {info.networkProcesses.map((process) => (
                        <tr key={`${process.pid}-${process.protocol}-${process.process}`}>
                          <td className="px-3 py-2 text-slate-200">{process.process}</td>
                          <td className="px-3 py-2 text-muted">{process.pid}</td>
                          <td className="px-3 py-2 text-muted">{process.protocol}</td>
                          <td className="px-3 py-2">{process.connections}</td>
                          <td className="px-3 py-2">{process.established}</td>
                          <td className="px-3 py-2">{process.listening}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </SystemSection>

          <SystemSection title="Active Apps" defaultOpen={false}>
            {info.processes.length === 0 ? (
              <p className="text-xs text-muted">No process data available.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-800">
                <div className="grid grid-cols-[1.6fr_0.6fr_0.6fr_0.6fr] gap-3 bg-slate-900/50 px-3 py-2 text-xs uppercase tracking-[0.3em] text-muted">
                  <span>App</span>
                  <span className="text-right">PID</span>
                  <span className="text-right">CPU</span>
                  <span className="text-right">MEM</span>
                </div>
                <div className="divide-y divide-slate-800 text-xs">
                  {info.processes.slice(0, 15).map((process) => (
                    <div
                      key={`${process.pid}-${process.command}`}
                      className="grid grid-cols-[1.6fr_0.6fr_0.6fr_0.6fr] gap-3 px-3 py-2"
                    >
                      <span className="truncate text-slate-100">
                        {formatProcessName(process.command)}
                      </span>
                      <span className="text-right text-slate-200">{process.pid}</span>
                      <span className="text-right text-slate-200">{process.cpu.toFixed(1)}%</span>
                      <span className="text-right text-slate-200">{process.mem.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SystemSection>

          <SystemSection title="Wi‑Fi Details" defaultOpen={false}>
            <SystemKeyValue label="SSID" value={info.wifi.ssid ?? 'Unknown'} />
            <SystemKeyValue label="RSSI" value={info.wifi.rssi ?? 'Unknown'} />
            <SystemKeyValue label="Noise" value={info.wifi.noise ?? 'Unknown'} />
            <SystemKeyValue label="Tx Rate" value={info.wifi.txRate ? `${info.wifi.txRate} Mbps` : 'Unknown'} />
            <SystemKeyValue label="Channel" value={info.wifi.channel ?? 'Unknown'} />
          </SystemSection>

          <SystemSection title={`Bluetooth Devices (${info.bluetoothDevices.length})`} defaultOpen={false}>
            {info.bluetoothDevices.length === 0 ? (
              <p className="text-xs text-muted">No Bluetooth devices detected.</p>
            ) : (
              <div className="space-y-3 text-xs">
                {info.bluetoothDevices.map((device, index) => (
                  <div key={`${device.name}-${index}`} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted">{device.name}</p>
                    <p className="mt-2 text-xs text-slate-200">Address: {device.address ?? 'Unknown'}</p>
                    <p className="mt-1 text-xs text-slate-200">
                      Connected: {device.connected ? 'Yes' : 'No'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </SystemSection>

          <SystemSection title={`Open Ports (${info.openPorts.length})`} defaultOpen={false}>
            {info.openPorts.length === 0 ? (
              <p className="text-xs text-muted">No open ports detected.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={portQuery}
                    onChange={(event) => setPortQuery(event.target.value)}
                    placeholder="Filter by process, PID, or port"
                    className="min-w-[220px] flex-1 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-200 outline-none focus:border-slate-600"
                  />
                  <div className="flex items-center gap-2 text-xs">
                    {(['all', 'TCP', 'UDP'] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setPortProtocol(value)}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          portProtocol === value
                            ? 'border-slate-700 bg-slate-900/60 text-slate-100'
                            : 'border-slate-800 text-muted hover:border-slate-700'
                        }`}
                      >
                        {value.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-muted">{filteredPorts.length} shown</span>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/60 text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (portSortKey === 'protocol') {
                                setPortSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                              } else {
                                setPortSortKey('protocol');
                                setPortSortDir('asc');
                              }
                            }}
                            className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted"
                          >
                            Proto
                            {portSortKey === 'protocol' ? (portSortDir === 'asc' ? '▲' : '▼') : ''}
                          </button>
                        </th>
                        <th className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (portSortKey === 'port') {
                                setPortSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                              } else {
                                setPortSortKey('port');
                                setPortSortDir('asc');
                              }
                            }}
                            className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted"
                          >
                            Port
                            {portSortKey === 'port' ? (portSortDir === 'asc' ? '▲' : '▼') : ''}
                          </button>
                        </th>
                        <th className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (portSortKey === 'process') {
                                setPortSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                              } else {
                                setPortSortKey('process');
                                setPortSortDir('asc');
                              }
                            }}
                            className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted"
                          >
                            Process
                            {portSortKey === 'process' ? (portSortDir === 'asc' ? '▲' : '▼') : ''}
                          </button>
                        </th>
                        <th className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (portSortKey === 'pid') {
                                setPortSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                              } else {
                                setPortSortKey('pid');
                                setPortSortDir('asc');
                              }
                            }}
                            className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted"
                          >
                            PID
                            {portSortKey === 'pid' ? (portSortDir === 'asc' ? '▲' : '▼') : ''}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {filteredPorts.length === 0 ? (
                        <tr>
                          <td className="px-3 py-3 text-xs text-muted" colSpan={4}>
                            No matching ports.
                          </td>
                        </tr>
                      ) : (
                        filteredPorts.map((port, index) => (
                          <tr key={`${port.process}-${port.pid}-${index}`}>
                            <td className="px-3 py-2 text-muted">{port.protocol}</td>
                            <td className="px-3 py-2">{port.port}</td>
                            <td className="px-3 py-2 font-mono text-slate-200">{port.process}</td>
                            <td className="px-3 py-2 text-muted">{port.pid}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </SystemSection>

          <SystemSection title="Running Processes (Top 20)" defaultOpen={false}>
            {info.processes.length === 0 ? (
              <p className="text-xs text-muted">No process data available.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/60 text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-3 py-2">PID</th>
                      <th className="px-3 py-2">Command</th>
                      <th className="px-3 py-2">CPU %</th>
                      <th className="px-3 py-2">Mem %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {info.processes.map((proc) => (
                      <tr key={`${proc.pid}-${proc.command}`}>
                        <td className="px-3 py-2 text-muted">{proc.pid}</td>
                        <td className="px-3 py-2 font-mono text-slate-200">{proc.command}</td>
                        <td className="px-3 py-2">{proc.cpu.toFixed(1)}</td>
                        <td className="px-3 py-2">{proc.mem.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SystemSection>

          <SystemSection title="Battery Health">
            {info.battery.hasBattery ? (
              <>
                <SystemKeyValue label="Charge" value={info.battery.percent !== null ? `${info.battery.percent}%` : 'Unknown'} />
                <SystemKeyValue
                  label="Status"
                  value={
                    info.battery.isCharging === null
                      ? 'Unknown'
                      : info.battery.isCharging
                        ? 'Charging'
                        : 'Discharging'
                  }
                />
                <SystemKeyValue
                  label="Time Remaining"
                  value={formatMinutes(info.battery.timeRemainingMinutes)}
                />
                <SystemKeyValue
                  label="Avg Time To Empty"
                  value={formatMinutes(info.battery.avgTimeToEmptyMinutes)}
                />
                <SystemKeyValue
                  label="Avg Time To Full"
                  value={formatMinutes(info.battery.avgTimeToFullMinutes)}
                />
                <SystemKeyValue
                  label="Cycle Count"
                  value={info.battery.cycleCount ?? 'Unknown'}
                />
                <SystemKeyValue
                  label="Condition"
                  value={info.battery.condition ?? 'Unknown'}
                />
                <SystemKeyValue
                  label="External Power"
                  value={
                    info.battery.externalConnected === null
                      ? 'Unknown'
                      : info.battery.externalConnected
                        ? 'Connected'
                        : 'Not connected'
                  }
                />
                <SystemKeyValue
                  label="Voltage"
                  value={info.battery.voltageMv ? `${info.battery.voltageMv} mV` : 'Unknown'}
                />
                <SystemKeyValue
                  label="Amperage"
                  value={info.battery.amperageMa ? `${info.battery.amperageMa} mA` : 'Unknown'}
                />
                <SystemKeyValue
                  label="Current Capacity"
                  value={
                    info.battery.currentCapacityMah
                      ? `${info.battery.currentCapacityMah} mAh`
                      : 'Unknown'
                  }
                />
                <SystemKeyValue
                  label="Design Capacity"
                  value={info.battery.designCapacityMah ? `${info.battery.designCapacityMah} mAh` : 'Unknown'}
                />
                <SystemKeyValue
                  label="Full Charge Capacity"
                  value={info.battery.fullChargeCapacityMah ? `${info.battery.fullChargeCapacityMah} mAh` : 'Unknown'}
                />
                <SystemKeyValue
                  label="Maximum Capacity"
                  value={
                    info.battery.maximumCapacityPercent !== null
                      ? `${info.battery.maximumCapacityPercent.toFixed(0)}%`
                      : 'Unknown'
                  }
                />
                <SystemKeyValue
                  label="Health %"
                  value={(() => {
                    const health = getHealthPercent(
                      info.battery.designCapacityMah,
                      info.battery.fullChargeCapacityMah,
                      info.battery.maximumCapacityPercent
                    );
                    return health !== null ? `${health.toFixed(0)}%` : 'Unknown';
                  })()}
                />
              </>
            ) : (
              <p className="text-xs text-muted">No battery detected.</p>
            )}
          </SystemSection>

          <SystemSection title="Availability" defaultOpen={false}>
            <SystemKeyValue
              label="Wi-Fi"
              value={info.wifiAvailable ? 'Available' : 'Not available via Node.js in this sandbox'}
            />
            <SystemKeyValue
              label="Bluetooth"
              value={info.bluetoothAvailable ? 'Available' : 'Not available via Node.js in this sandbox'}
            />
            <SystemKeyValue
              label="Open Ports"
              value={info.openPortsAvailable ? 'Available' : 'Requires elevated permissions'}
            />
          </SystemSection>
        </>
      ) : null}
    </div>
  );
};

export default SystemPage;
