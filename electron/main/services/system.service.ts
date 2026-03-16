import { exec as execCallback } from 'node:child_process';
import { statfs } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { app } from 'electron';
import type { SystemInfo } from '../../shared/types/system';

type CpuTimes = {
  idle: number;
  total: number;
};

type DiskIoSnapshot = {
  readBytes: number;
  writeBytes: number;
  timestamp: number;
};

type NetIoSnapshot = {
  inBytes: number;
  outBytes: number;
  timestamp: number;
};

type AdapterIoSnapshot = {
  inBytes: number;
  outBytes: number;
};

let lastCpuTimes: CpuTimes | null = null;
let lastDiskIo: DiskIoSnapshot | null = null;
let lastNetIo: NetIoSnapshot | null = null;
let lastAdapterIo = new Map<string, AdapterIoSnapshot>();

const getExecErrorText = (error: unknown) => {
  if (!error || typeof error !== 'object') return '';
  const stdout = 'stdout' in error && typeof error.stdout === 'string' ? error.stdout : '';
  const stderr = 'stderr' in error && typeof error.stderr === 'string' ? error.stderr : '';
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  return [stdout, stderr, message].filter(Boolean).join('\n').trim();
};

const resolveDiskPath = () => {
  const home = os.homedir();
  return home || path.parse(process.cwd()).root;
};

const EMPTY_GPU_INFO: SystemInfo['gpu'] = {
  available: false,
  model: null,
  vendor: null,
  renderer: null,
  driverVersion: null,
  vramMb: null,
  utilizationPercent: null,
  source: null,
  devices: []
};

const getCpuTimes = (): CpuTimes => {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;
  }
  return { idle, total };
};

const getCpuUsagePercent = () => {
  const current = getCpuTimes();
  if (!lastCpuTimes) {
    lastCpuTimes = current;
    return 0;
  }
  const idleDelta = current.idle - lastCpuTimes.idle;
  const totalDelta = current.total - lastCpuTimes.total;
  lastCpuTimes = current;
  if (totalDelta <= 0) return 0;
  return Math.max(0, Math.min(100, ((totalDelta - idleDelta) / totalDelta) * 100));
};

const parseMemorySizeToMb = (value: string | null) => {
  if (!value) return null;
  const match = value.match(/([\d.]+)\s*(mb|gb)/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  return match[2].toLowerCase() === 'gb' ? Math.round(amount * 1024) : Math.round(amount);
};

const parseDiskIoStats = (output: string) => {
  let readBytes = 0;
  let writeBytes = 0;
  const readMatches = output.matchAll(/"BytesRead"\s*=\s*(\d+)/g);
  for (const match of readMatches) {
    readBytes += Number(match[1] ?? 0);
  }
  const writeMatches = output.matchAll(/"BytesWritten"\s*=\s*(\d+)/g);
  for (const match of writeMatches) {
    writeBytes += Number(match[1] ?? 0);
  }
  return { readBytes, writeBytes };
};

const getDiskIoRates = async (exec: (command: string) => Promise<{ stdout: string }>) => {
  if (process.platform !== 'darwin') {
    return { readBytesPerSec: 0, writeBytesPerSec: 0 };
  }
  try {
    const { stdout } = await exec('ioreg -r -c IOBlockStorageDriver -k Statistics');
    const { readBytes, writeBytes } = parseDiskIoStats(stdout);
    const now = Date.now();
    if (!lastDiskIo) {
      lastDiskIo = { readBytes, writeBytes, timestamp: now };
      return { readBytesPerSec: 0, writeBytesPerSec: 0 };
    }
    const elapsedSeconds = (now - lastDiskIo.timestamp) / 1000;
    const readDelta = readBytes - lastDiskIo.readBytes;
    const writeDelta = writeBytes - lastDiskIo.writeBytes;
    lastDiskIo = { readBytes, writeBytes, timestamp: now };
    if (elapsedSeconds <= 0) {
      return { readBytesPerSec: 0, writeBytesPerSec: 0 };
    }
    return {
      readBytesPerSec: Math.max(0, readDelta / elapsedSeconds),
      writeBytesPerSec: Math.max(0, writeDelta / elapsedSeconds)
    };
  } catch {
    return { readBytesPerSec: 0, writeBytesPerSec: 0 };
  }
};

const parseNetstat = (output: string) => {
  const lines = output.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return { inBytes: 0, outBytes: 0 };
  const header = lines[0].split(/\s+/);
  const inIndex = header.findIndex((value) => value.toLowerCase() === 'ibytes');
  const outIndex = header.findIndex((value) => value.toLowerCase() === 'obytes');
  if (inIndex < 0 || outIndex < 0) return { inBytes: 0, outBytes: 0 };
  let inBytes = 0;
  let outBytes = 0;
  for (const line of lines.slice(1)) {
    if (line.startsWith('Name ')) continue;
    const parts = line.split(/\s+/);
    if (parts.length <= Math.max(inIndex, outIndex)) continue;
    const inValue = Number(parts[inIndex] ?? 0);
    const outValue = Number(parts[outIndex] ?? 0);
    if (Number.isFinite(inValue)) inBytes += Math.max(0, inValue);
    if (Number.isFinite(outValue)) outBytes += Math.max(0, outValue);
  }
  return { inBytes, outBytes };
};

const parseMacAdapterStats = (output: string) => {
  const lines = output.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0].split(/\s+/);
  const nameIndex = header.findIndex((value) => value.toLowerCase() === 'name');
  const inIndex = header.findIndex((value) => value.toLowerCase() === 'ibytes');
  const outIndex = header.findIndex((value) => value.toLowerCase() === 'obytes');
  if (nameIndex < 0 || inIndex < 0 || outIndex < 0) return [];
  const map = new Map<string, { inBytesTotal: number; outBytesTotal: number }>();
  for (const line of lines.slice(1)) {
    if (line.startsWith('Name ')) continue;
    const parts = line.split(/\s+/);
    const name = parts[nameIndex];
    const inValue = Number(parts[inIndex] ?? 0);
    const outValue = Number(parts[outIndex] ?? 0);
    if (!name || !Number.isFinite(inValue) || !Number.isFinite(outValue)) continue;
    const current = map.get(name) ?? { inBytesTotal: 0, outBytesTotal: 0 };
    current.inBytesTotal += Math.max(0, inValue);
    current.outBytesTotal += Math.max(0, outValue);
    map.set(name, current);
  }
  return Array.from(map.entries()).map(([name, values]) => ({
    name,
    displayName: name,
    inBytesTotal: values.inBytesTotal,
    outBytesTotal: values.outBytesTotal,
    type: name.startsWith('en') ? 'ethernet/wifi' : null
  }));
};

const parseWindowsAdapterStats = (raw: string) => {
  if (!raw) return [];
  const parsed = JSON.parse(raw) as Record<string, unknown> | Array<Record<string, unknown>>;
  const entries = Array.isArray(parsed) ? parsed : [parsed];
  return entries
    .map((entry) => ({
      name: typeof entry.Name === 'string' ? entry.Name : '',
      displayName: typeof entry.InterfaceDescription === 'string' ? entry.InterfaceDescription : (typeof entry.Name === 'string' ? entry.Name : ''),
      inBytesTotal: typeof entry.ReceivedBytes === 'number' ? entry.ReceivedBytes : 0,
      outBytesTotal: typeof entry.SentBytes === 'number' ? entry.SentBytes : 0,
      type: typeof entry.MediaType === 'string' ? entry.MediaType : null
    }))
    .filter((entry) => entry.name);
};

const buildAdapterRates = (
  adapters: Array<{
    name: string;
    displayName: string;
    inBytesTotal: number;
    outBytesTotal: number;
    type: string | null;
  }>,
  elapsedSeconds: number
) => {
  return adapters.map((adapter) => {
    const previous = lastAdapterIo.get(adapter.name);
    const inBytesPerSec = previous && elapsedSeconds > 0 ? Math.max(0, (adapter.inBytesTotal - previous.inBytes) / elapsedSeconds) : 0;
    const outBytesPerSec = previous && elapsedSeconds > 0 ? Math.max(0, (adapter.outBytesTotal - previous.outBytes) / elapsedSeconds) : 0;
    lastAdapterIo.set(adapter.name, { inBytes: adapter.inBytesTotal, outBytes: adapter.outBytesTotal });
    return {
      ...adapter,
      inBytesPerSec,
      outBytesPerSec,
      active: inBytesPerSec > 0 || outBytesPerSec > 0 || adapter.inBytesTotal > 0 || adapter.outBytesTotal > 0
    };
  });
};

const getNetworkIoRates = async (exec: (command: string) => Promise<{ stdout: string }>) => {
  const now = Date.now();
  const elapsedSeconds = lastNetIo ? (now - lastNetIo.timestamp) / 1000 : 0;
  if (process.platform === 'win32') {
    try {
      const { stdout } = await exec(
        'powershell -NoProfile -Command "Get-NetAdapterStatistics | Select-Object Name,InterfaceDescription,ReceivedBytes,SentBytes,MediaType | ConvertTo-Json -Compress"'
      );
      const adapters = buildAdapterRates(parseWindowsAdapterStats(stdout.trim()), elapsedSeconds);
      const inBytes = adapters.reduce((sum, item) => sum + item.inBytesTotal, 0);
      const outBytes = adapters.reduce((sum, item) => sum + item.outBytesTotal, 0);
      if (!lastNetIo) {
        lastNetIo = { inBytes, outBytes, timestamp: now };
        return { inBytesPerSec: 0, outBytesPerSec: 0, inBytesTotal: inBytes, outBytesTotal: outBytes, adapters };
      }
      const inDelta = inBytes - lastNetIo.inBytes;
      const outDelta = outBytes - lastNetIo.outBytes;
      lastNetIo = { inBytes, outBytes, timestamp: now };
      return {
        inBytesPerSec: elapsedSeconds > 0 ? Math.max(0, inDelta / elapsedSeconds) : 0,
        outBytesPerSec: elapsedSeconds > 0 ? Math.max(0, outDelta / elapsedSeconds) : 0,
        inBytesTotal: inBytes,
        outBytesTotal: outBytes,
        adapters
      };
    } catch {
      return { inBytesPerSec: 0, outBytesPerSec: 0, inBytesTotal: 0, outBytesTotal: 0, adapters: [] };
    }
  }
  try {
    const { stdout } = await exec('netstat -ib');
    const { inBytes, outBytes } = parseNetstat(stdout);
    const adapters = buildAdapterRates(parseMacAdapterStats(stdout), elapsedSeconds);
    if (!lastNetIo) {
      lastNetIo = { inBytes, outBytes, timestamp: now };
      return { inBytesPerSec: 0, outBytesPerSec: 0, inBytesTotal: inBytes, outBytesTotal: outBytes, adapters };
    }
    const inDelta = inBytes - lastNetIo.inBytes;
    const outDelta = outBytes - lastNetIo.outBytes;
    lastNetIo = { inBytes, outBytes, timestamp: now };
    if (elapsedSeconds <= 0) {
      return { inBytesPerSec: 0, outBytesPerSec: 0, inBytesTotal: inBytes, outBytesTotal: outBytes, adapters };
    }
    return {
      inBytesPerSec: Math.max(0, inDelta / elapsedSeconds),
      outBytesPerSec: Math.max(0, outDelta / elapsedSeconds),
      inBytesTotal: inBytes,
      outBytesTotal: outBytes,
      adapters
    };
  } catch {
    return { inBytesPerSec: 0, outBytesPerSec: 0, inBytesTotal: 0, outBytesTotal: 0, adapters: [] };
  }
};

const getNetworkProcesses = async (exec: (command: string) => Promise<{ stdout: string }>) => {
  if (process.platform === 'win32') {
    try {
      const { stdout } = await exec('netstat -ano');
      const { stdout: tasksOut } = await exec('tasklist /FO CSV /NH');
      const taskMap = new Map<number, string>();
      for (const line of tasksOut.split('\n').map((entry) => entry.trim()).filter(Boolean)) {
        const parts = line.replace(/^"|"$/g, '').split('","');
        const pid = Number(parts[1] ?? 0);
        const name = parts[0] ?? 'unknown';
        if (Number.isFinite(pid) && pid > 0) taskMap.set(pid, name);
      }
      const grouped = new Map<string, SystemInfo['networkProcesses'][number]>();
      for (const line of stdout.split('\n').map((entry) => entry.trim()).filter(Boolean)) {
        if (!/^(TCP|UDP)\s+/i.test(line)) continue;
        const parts = line.split(/\s+/);
        const protocol = (parts[0] ?? '').toUpperCase();
        const state = protocol === 'UDP' ? '' : (parts[3] ?? '').toUpperCase();
        const pid = Number(protocol === 'UDP' ? parts[3] ?? 0 : parts[4] ?? 0);
        if (!Number.isFinite(pid) || pid <= 0) continue;
        const process = taskMap.get(pid) ?? `pid:${pid}`;
        const key = `${pid}:${protocol}`;
        const current = grouped.get(key) ?? {
          pid,
          process,
          protocol,
          connections: 0,
          listening: 0,
          established: 0,
          bandwidthBytesPerSec: null
        };
        current.connections += 1;
        if (state === 'LISTENING') current.listening += 1;
        if (state === 'ESTABLISHED') current.established += 1;
        grouped.set(key, current);
      }
      return Array.from(grouped.values())
        .sort((a, b) => b.established - a.established || b.connections - a.connections)
        .slice(0, 20);
    } catch {
      return [];
    }
  }

  try {
    const { stdout } = await exec('lsof -i -P -n');
    const grouped = new Map<string, SystemInfo['networkProcesses'][number]>();
    const lines = stdout.split('\n').slice(1).filter(Boolean);
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 9) continue;
      const process = parts[0] ?? 'unknown';
      const pid = Number(parts[1] ?? 0);
      const protocol = (parts[7] ?? '').replace(/\d+$/, '').toUpperCase() || 'TCP';
      const stateText = line.toUpperCase();
      if (!Number.isFinite(pid) || pid <= 0) continue;
      const key = `${pid}:${protocol}`;
      const current = grouped.get(key) ?? {
        pid,
        process,
        protocol,
        connections: 0,
        listening: 0,
        established: 0,
        bandwidthBytesPerSec: null
      };
      current.connections += 1;
      if (stateText.includes('(LISTEN)')) current.listening += 1;
      if (stateText.includes('ESTABLISHED')) current.established += 1;
      grouped.set(key, current);
    }
    return Array.from(grouped.values())
      .sort((a, b) => b.established - a.established || b.connections - a.connections)
      .slice(0, 20);
  } catch {
    return [];
  }
};

const getSwapInfo = async (exec: (command: string) => Promise<{ stdout: string }>) => {
  if (process.platform !== 'darwin') {
    return { swapTotalBytes: 0, swapUsedBytes: 0, pageouts: 0 };
  }
  try {
    const { stdout } = await exec('vm_stat');
    const pageSizeMatch = stdout.match(/page size of (\\d+) bytes/i);
    const pageSize = pageSizeMatch ? Number(pageSizeMatch[1]) : 4096;
    const extract = (label: string) => {
      const match = stdout.match(new RegExp(`${label}:\\s*(\\d+)`, 'i'));
      return match ? Number(match[1]) : 0;
    };
    const swapins = extract('Pageins');
    const pageouts = extract('Pageouts');
    const anonPages = extract('Pages occupied by anonymous memory');
    const swapUsedBytes = Math.max(0, (pageouts - swapins)) * pageSize;
    const { stdout: sysctlOut } = await exec('sysctl -n vm.swapusage');
    const swapMatch = sysctlOut.match(/total = ([0-9.]+)M\\s+used = ([0-9.]+)M/i);
    const swapTotalBytes = swapMatch ? Number(swapMatch[1]) * 1024 * 1024 : anonPages * pageSize;
    const swapUsed = swapMatch ? Number(swapMatch[2]) * 1024 * 1024 : swapUsedBytes;
    return {
      swapTotalBytes: Number.isFinite(swapTotalBytes) ? swapTotalBytes : 0,
      swapUsedBytes: Number.isFinite(swapUsed) ? swapUsed : 0,
      pageouts
    };
  } catch {
    return { swapTotalBytes: 0, swapUsedBytes: 0, pageouts: 0 };
  }
};

const parseAirportInfo = (output: string) => {
  const findValue = (label: string) => {
    const match = output.match(new RegExp(`${label}:\\s*(.+)`));
    return match ? match[1].trim() : null;
  };
  const toNumber = (value: string | null) => (value ? Number(value) : null);
  return {
    ssid: findValue('SSID'),
    rssi: toNumber(findValue('agrCtlRSSI')),
    noise: toNumber(findValue('agrCtlNoise')),
    txRate: toNumber(findValue('lastTxRate')),
    channel: findValue('channel')
  };
};

const parseWifiProfile = (output: string) => {
  const toNumber = (value: string | null) => (value ? Number(value) : null);
  const currentMatch = output.match(/Current Network Information:([\s\S]*?)(?:\n\s{2}\S|$)/i);
  const currentBlock = currentMatch ? currentMatch[1] : '';
  const ssidMatch = currentBlock.match(/\n\s{10}(.+):\n/);
  const signalNoiseMatch = currentBlock.match(/Signal\s*\/\s*Noise:\s*(-?\d+)\s*dBm\s*\/\s*(-?\d+)/i);
  const txMatch = currentBlock.match(/Transmit Rate:\s*(\d+)/i);
  const channelMatch = currentBlock.match(/Channel:\s*([^\n]+)/i);
  return {
    ssid: ssidMatch ? ssidMatch[1].trim() : null,
    rssi: signalNoiseMatch ? toNumber(signalNoiseMatch[1]) : null,
    noise: signalNoiseMatch ? toNumber(signalNoiseMatch[2]) : null,
    txRate: txMatch ? toNumber(txMatch[1]) : null,
    channel: channelMatch ? channelMatch[1].trim() : null
  };
};

const getWifiInfo = async (exec: (command: string) => Promise<{ stdout: string }>) => {
  if (process.platform === 'win32') {
    try {
      const { stdout } = await exec('netsh wlan show interfaces');
      const findValue = (label: string) => {
        const match = stdout.match(new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, 'im'));
        return match ? match[1].trim() : null;
      };
      const signalText = findValue('Signal');
      const signalPercent = signalText?.match(/(\d+)%/)?.[1] ? Number(signalText.match(/(\d+)%/)?.[1]) : null;
      const transmitRate = findValue('Transmit rate \\(Mbps\\)');
      const receiveRate = findValue('Receive rate \\(Mbps\\)');
      return {
        ssid: findValue('SSID'),
        rssi: signalPercent !== null ? Math.round(signalPercent / 2 - 100) : null,
        noise: null,
        txRate: transmitRate ? Number(transmitRate) : receiveRate ? Number(receiveRate) : null,
        channel: findValue('Channel')
      };
    } catch {
      return { ssid: null, rssi: null, noise: null, txRate: null, channel: null };
    }
  }

  try {
    const { stdout } = await exec(
      '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I'
    );
    const parsed = parseAirportInfo(stdout);
    if (parsed.ssid || parsed.rssi !== null || parsed.txRate !== null) {
      return parsed;
    }
    throw new Error('Empty airport info');
  } catch {
    try {
      const { stdout } = await exec('system_profiler SPAirPortDataType');
      return parseWifiProfile(stdout);
    } catch {
      return { ssid: null, rssi: null, noise: null, txRate: null, channel: null };
    }
  }
};

const parseBluetoothDevices = (output: string) => {
  const devices: SystemInfo['bluetoothDevices'] = [];
  const lines = output.split('\n');
  let current: { name: string; address?: string; connected?: boolean } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.endsWith(':') && !line.includes('Bluetooth') && !line.includes('Services')) {
      if (current) devices.push(current);
      current = { name: line.replace(':', '') };
      continue;
    }
    if (!current) continue;
    if (line.startsWith('Address:')) {
      current.address = line.replace('Address:', '').trim();
    }
    if (line.startsWith('Connected:')) {
      current.connected = line.replace('Connected:', '').trim().toLowerCase() === 'yes';
    }
  }
  if (current) devices.push(current);
  return devices;
};

const getBluetoothDevices = async (exec: (command: string) => Promise<{ stdout: string }>) => {
  try {
    const { stdout } = await exec('system_profiler SPBluetoothDataType');
    return parseBluetoothDevices(stdout);
  } catch {
    return [];
  }
};

const getWindowsGpuUtilization = async (exec: (command: string) => Promise<{ stdout: string }>) => {
  try {
    const { stdout } = await exec(
      'powershell -NoProfile -Command "(Get-Counter \'\\GPU Engine(*)\\Utilization Percentage\').CounterSamples | Where-Object { $_.InstanceName -match \'engtype_3D\' } | Measure-Object -Property CookedValue -Average | Select-Object -ExpandProperty Average"'
    );
    const value = Number(stdout.trim());
    if (!Number.isFinite(value)) return null;
    return Math.max(0, Math.min(100, value));
  } catch {
    return null;
  }
};

const getGpuInfo = async (exec: (command: string) => Promise<{ stdout: string }>): Promise<SystemInfo['gpu']> => {
  if (process.platform === 'win32') {
    try {
      const { stdout } = await exec(
        'powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterCompatibility,AdapterRAM,DriverVersion,VideoProcessor | ConvertTo-Json -Compress"'
      );
      const raw = stdout.trim();
      if (!raw) return EMPTY_GPU_INFO;
      const parsed = JSON.parse(raw) as Record<string, unknown> | Array<Record<string, unknown>>;
      const entries = Array.isArray(parsed) ? parsed : [parsed];
      const devices = entries.map((entry, index) => ({
        name: typeof entry.Name === 'string' ? entry.Name : `GPU ${index + 1}`,
        vendor: typeof entry.AdapterCompatibility === 'string' ? entry.AdapterCompatibility : null,
        vramMb:
          typeof entry.AdapterRAM === 'number' && Number.isFinite(entry.AdapterRAM)
            ? Math.round(entry.AdapterRAM / (1024 * 1024))
            : null,
        active: index === 0 ? true : null
      }));
      const primary = devices[0] ?? null;
      const utilizationPercent = await getWindowsGpuUtilization(exec);
      return {
        available: devices.length > 0,
        model: primary?.name ?? null,
        vendor: primary?.vendor ?? null,
        renderer: typeof entries[0]?.VideoProcessor === 'string' ? entries[0].VideoProcessor : primary?.name ?? null,
        driverVersion: typeof entries[0]?.DriverVersion === 'string' ? entries[0].DriverVersion : null,
        vramMb: primary?.vramMb ?? null,
        utilizationPercent,
        source: utilizationPercent === null ? 'Win32_VideoController' : 'Win32_VideoController + GPU Engine Counters',
        devices
      };
    } catch {
      return EMPTY_GPU_INFO;
    }
  }

  if (process.platform === 'darwin') {
    try {
      const { stdout } = await exec('system_profiler SPDisplaysDataType');
      const model =
        stdout.match(/Chipset Model:\s*(.+)/i)?.[1]?.trim() ??
        stdout.match(/Graphics:\s*(.+)/i)?.[1]?.trim() ??
        null;
      const vendor = stdout.match(/Vendor:\s*(.+)/i)?.[1]?.trim() ?? null;
      const vramMb =
        parseMemorySizeToMb(stdout.match(/VRAM \(?:Dynamic, Max\):\s*(.+)/i)?.[1]?.trim() ?? null) ??
        parseMemorySizeToMb(stdout.match(/VRAM \(Total\):\s*(.+)/i)?.[1]?.trim() ?? null);
      const metal = stdout.match(/Metal(?: Family| Support)?:\s*(.+)/i)?.[1]?.trim() ?? null;
      const devices = model
        ? [
            {
              name: model,
              vendor,
              vramMb,
              active: true
            }
          ]
        : [];
      return {
        available: devices.length > 0,
        model,
        vendor,
        renderer: metal ?? model,
        driverVersion: null,
        vramMb,
        utilizationPercent: null,
        source: 'system_profiler',
        devices
      };
    } catch {
      return EMPTY_GPU_INFO;
    }
  }

  try {
    const gpuInfo = await app.getGPUInfo('basic');
    const devicesRaw = Array.isArray((gpuInfo as { gpuDevice?: unknown[] }).gpuDevice)
      ? ((gpuInfo as { gpuDevice?: Array<Record<string, unknown>> }).gpuDevice ?? [])
      : [];
    const devices = devicesRaw.map((entry, index) => ({
      name: typeof entry.deviceString === 'string' ? entry.deviceString : `GPU ${index + 1}`,
      vendor: typeof entry.vendorString === 'string' ? entry.vendorString : null,
      vramMb: typeof entry.memorySize === 'number' ? entry.memorySize : null,
      active: typeof entry.active === 'boolean' ? entry.active : null
    }));
    const primary = devices.find((entry) => entry.active) ?? devices[0] ?? null;
    return {
      available: devices.length > 0,
      model: primary?.name ?? null,
      vendor: primary?.vendor ?? null,
      renderer: primary?.name ?? null,
      driverVersion: null,
      vramMb: primary?.vramMb ?? null,
      utilizationPercent: null,
      source: 'electron',
      devices
    };
  } catch {
    return EMPTY_GPU_INFO;
  }
};

const parseOpenPorts = (output: string) => {
  const ports: SystemInfo['openPorts'] = [];
  const lines = output.split('\n').filter(Boolean);
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const process = parts[0] ?? 'unknown';
    const pid = Number(parts[1] ?? 0);
    const proto = parts.find((value) => value.startsWith('TCP') || value.startsWith('UDP')) ?? '';
    const name = parts[parts.length - 1] ?? '';
    const protocol = proto.startsWith('UDP') ? 'UDP' : 'TCP';
    const portMatch = name.match(/:(\d+)(->|\s|$)/);
    const port = portMatch ? portMatch[1] : 'unknown';
    ports.push({ protocol, port, process, pid });
  }
  return ports;
};

const getOpenPorts = async (exec: (command: string) => Promise<{ stdout: string }>) => {
  if (process.platform === 'win32') {
    try {
      const { stdout } = await exec('netstat -ano -p tcp');
      const ports: SystemInfo['openPorts'] = stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => /^TCP\s+/i.test(line) && /\sLISTENING\s/i.test(line))
        .map((line) => {
          const parts = line.split(/\s+/);
          const local = parts[1] ?? '';
          const pid = Number(parts[4] ?? 0);
          const portMatch = local.match(/:(\d+)$/);
          return {
            protocol: 'TCP',
            port: portMatch?.[1] ?? 'unknown',
            process: `pid:${pid || 'unknown'}`,
            pid
          };
        });
      return ports;
    } catch {
      return [];
    }
  }

  try {
    const { stdout } = await exec('lsof -i -P -n | grep LISTEN');
    return parseOpenPorts(stdout);
  } catch {
    return [];
  }
};

const parsePmsetBattery = (output: string) => {
  const percentMatch = output.match(/(\d+)%/);
  const chargingMatch = output.match(/;\s*(charging|discharging|charged);/i);
  const timeMatch = output.match(/(\d+):(\d+)\s+remaining/i);
  const percent = percentMatch ? Number(percentMatch[1]) : null;
  const status = chargingMatch?.[1]?.toLowerCase() ?? null;
  const isCharging = status ? status === 'charging' : null;
  const timeRemainingMinutes = timeMatch
    ? Number(timeMatch[1]) * 60 + Number(timeMatch[2])
    : null;
  return { percent, isCharging, timeRemainingMinutes };
};

const parseBatteryProfile = (output: string) => {
  const numberFrom = (label: string) => {
    const match = output.match(new RegExp(`${label}:\\s*(\\d+)`, 'i'));
    return match ? Number(match[1]) : null;
  };
  const stringFrom = (label: string) => {
    const match = output.match(new RegExp(`${label}:\\s*([^\\n]+)`, 'i'));
    return match ? match[1].trim() : null;
  };
  const sectionMatch = output.match(/(?:Health Information|Battery Information):([\\s\\S]*?)(?:\\n\\S|$)/i);
  const section = sectionMatch ? sectionMatch[1] : output;
  return {
    cycleCount: numberFrom('Cycle Count'),
    condition: stringFrom('Condition'),
    maximumCapacityPercent: section.match(/Maximum Capacity:\s*%?(\d+)/i)?.[1]
      ? Number(section.match(/Maximum Capacity:\s*%?(\d+)/i)?.[1])
      : null,
    designCapacityMah:
      numberFrom('Design Capacity') ??
      (section.match(/Design Capacity.*?\\b(\\d+)\\s*mAh/i)?.[1]
        ? Number(section.match(/Design Capacity.*?\\b(\\d+)\\s*mAh/i)?.[1])
        : null),
    fullChargeCapacityMah:
      numberFrom('Full Charge Capacity') ??
      (section.match(/Full Charge Capacity.*?\\b(\\d+)\\s*mAh/i)?.[1]
        ? Number(section.match(/Full Charge Capacity.*?\\b(\\d+)\\s*mAh/i)?.[1])
        : null)
  };
};

const parseIoregBattery = (output: string) => {
  const numberFrom = (label: string) => {
    const match = output.match(new RegExp(`"${label}"\\s*=\\s*(\\d+)`, 'i'));
    return match ? Number(match[1]) : null;
  };
  const boolFrom = (label: string) => {
    const match = output.match(new RegExp(`"${label}"\\s*=\\s*(Yes|No)`, 'i'));
    if (!match) return null;
    return match[1].toLowerCase() === 'yes';
  };
  return {
    designCapacityMah: numberFrom('DesignCapacity'),
    fullChargeCapacityMah: numberFrom('MaxCapacity'),
    currentCapacityMah: numberFrom('CurrentCapacity'),
    voltageMv: numberFrom('Voltage'),
    amperageMa: numberFrom('Amperage'),
    externalConnected: boolFrom('ExternalConnected'),
    avgTimeToEmptyMinutes: numberFrom('AvgTimeToEmpty'),
    avgTimeToFullMinutes: numberFrom('AvgTimeToFull')
  };
};

const getBatteryInfo = async (exec: (command: string) => Promise<{ stdout: string }>) => {
  if (process.platform === 'win32') {
    try {
      const { stdout } = await exec(
        'powershell -NoProfile -Command "Get-CimInstance Win32_Battery | Select-Object EstimatedChargeRemaining,BatteryStatus,EstimatedRunTime,DesignVoltage | ConvertTo-Json -Compress"'
      );
      const raw = stdout.trim();
      if (!raw) {
        throw new Error('Battery not found');
      }
      const parsed = JSON.parse(raw) as Record<string, unknown> | Array<Record<string, unknown>>;
      const battery = Array.isArray(parsed) ? parsed[0] : parsed;
      const batteryStatus = typeof battery.BatteryStatus === 'number' ? battery.BatteryStatus : null;
      const percent =
        typeof battery.EstimatedChargeRemaining === 'number' ? battery.EstimatedChargeRemaining : null;
      const timeRemainingMinutes =
        typeof battery.EstimatedRunTime === 'number' &&
        Number.isFinite(battery.EstimatedRunTime) &&
        battery.EstimatedRunTime > 0 &&
        battery.EstimatedRunTime < 1000000
          ? battery.EstimatedRunTime
          : null;
      return {
        hasBattery: true,
        percent,
        isCharging: batteryStatus === null ? null : [6, 7, 8, 9].includes(batteryStatus),
        cycleCount: null,
        condition: null,
        timeRemainingMinutes,
        designCapacityMah: null,
        fullChargeCapacityMah: null,
        maximumCapacityPercent: null,
        currentCapacityMah: null,
        voltageMv: typeof battery.DesignVoltage === 'number' ? battery.DesignVoltage : null,
        amperageMa: null,
        externalConnected: batteryStatus === null ? null : [3, 6, 7, 8, 9, 11].includes(batteryStatus),
        avgTimeToEmptyMinutes: null,
        avgTimeToFullMinutes: null
      };
    } catch {
      return {
        hasBattery: false,
        percent: null,
        isCharging: null,
        cycleCount: null,
        condition: null,
        timeRemainingMinutes: null,
        designCapacityMah: null,
        fullChargeCapacityMah: null,
        maximumCapacityPercent: null,
        currentCapacityMah: null,
        voltageMv: null,
        amperageMa: null,
        externalConnected: null,
        avgTimeToEmptyMinutes: null,
        avgTimeToFullMinutes: null
      };
    }
  }

  if (process.platform !== 'darwin') {
    return {
      hasBattery: false,
      percent: null,
      isCharging: null,
      cycleCount: null,
      condition: null,
      timeRemainingMinutes: null,
      designCapacityMah: null,
      fullChargeCapacityMah: null
    };
  }

  try {
    const { stdout: pmsetOut } = await exec('pmset -g batt');
    const hasBattery = !pmsetOut.toLowerCase().includes('no batteries');
    const pmset = parsePmsetBattery(pmsetOut);
    const { stdout: profileOut } = await exec('system_profiler SPPowerDataType');
    const profile = parseBatteryProfile(profileOut);
    let designCapacityMah = profile.designCapacityMah;
    let fullChargeCapacityMah = profile.fullChargeCapacityMah;
    let maximumCapacityPercent = profile.maximumCapacityPercent;
    let currentCapacityMah: number | null = null;
    let voltageMv: number | null = null;
    let amperageMa: number | null = null;
    let externalConnected: boolean | null = null;
    let avgTimeToEmptyMinutes: number | null = null;
    let avgTimeToFullMinutes: number | null = null;
    if (!designCapacityMah || !fullChargeCapacityMah) {
      try {
        const { stdout: ioregOut } = await exec('ioreg -r -c AppleSmartBattery');
        const ioreg = parseIoregBattery(ioregOut);
        designCapacityMah = designCapacityMah ?? ioreg.designCapacityMah;
        fullChargeCapacityMah = fullChargeCapacityMah ?? ioreg.fullChargeCapacityMah;
        currentCapacityMah = ioreg.currentCapacityMah;
        voltageMv = ioreg.voltageMv;
        amperageMa = ioreg.amperageMa;
        externalConnected = ioreg.externalConnected;
        avgTimeToEmptyMinutes = ioreg.avgTimeToEmptyMinutes;
        avgTimeToFullMinutes = ioreg.avgTimeToFullMinutes;
        if (maximumCapacityPercent === null && ioreg.designCapacityMah && ioreg.fullChargeCapacityMah) {
          maximumCapacityPercent = Math.round((ioreg.fullChargeCapacityMah / ioreg.designCapacityMah) * 100);
        }
      } catch {
        // ignore
      }
    }
    return {
      hasBattery,
      percent: pmset.percent,
      isCharging: pmset.isCharging,
      cycleCount: profile.cycleCount,
      condition: profile.condition,
      timeRemainingMinutes: pmset.timeRemainingMinutes,
      designCapacityMah,
      fullChargeCapacityMah,
      maximumCapacityPercent,
      currentCapacityMah,
      voltageMv,
      amperageMa,
      externalConnected,
      avgTimeToEmptyMinutes,
      avgTimeToFullMinutes
    };
  } catch {
    return {
      hasBattery: false,
      percent: null,
      isCharging: null,
      cycleCount: null,
      condition: null,
      timeRemainingMinutes: null,
      designCapacityMah: null,
      fullChargeCapacityMah: null,
      maximumCapacityPercent: null,
      currentCapacityMah: null,
      voltageMv: null,
      amperageMa: null,
      externalConnected: null,
      avgTimeToEmptyMinutes: null,
      avgTimeToFullMinutes: null
    };
  }
};

const getPowerSavingMode = async (exec: (command: string) => Promise<{ stdout: string }>) => {
  if (process.platform === 'win32') {
    try {
      const { stdout } = await exec('powercfg /getactivescheme');
      const normalized = stdout.toLowerCase();
      if (!normalized.trim()) return null;
      return normalized.includes('power saver') || normalized.includes('a1841308-3541-4fab-bc81-f71556f20b4a');
    } catch {
      return null;
    }
  }
  if (process.platform !== 'darwin') {
    return null;
  }
  try {
    const { stdout } = await exec('pmset -g | grep lowpowermode');
    const match = stdout.match(/lowpowermode\\s+(\\d)/i);
    if (!match) return null;
    return match[1] === '1';
  } catch {
    return null;
  }
};

const setPowerSavingMode = async (
  exec: (command: string) => Promise<{ stdout: string }>,
  enabled: boolean
) => {
  if (process.platform === 'win32') {
    await exec(`powercfg /setactive ${enabled ? 'SCHEME_MIN' : 'SCHEME_BALANCED'}`);
    return;
  }
  if (process.platform !== 'darwin') {
    throw new Error('Power saving is only supported on macOS.');
  }
  const value = enabled ? 1 : 0;
  try {
    await exec(`pmset -b lowpowermode ${value}`);
    return;
  } catch {
    const command = `osascript -e 'do shell script "pmset -a lowpowermode ${value}" with administrator privileges'`;
    try {
      await exec(command);
    } catch (error) {
      const details = getExecErrorText(error).toLowerCase();
      if (details.includes('user canceled') || details.includes('cancelled') || details.includes('not authorized')) {
        throw new Error(
          'macOS admin izni verilmedi. Ana pencereyi acik tutup tekrar deneyin ve sifre penceresinde izin verin. Alternatif yol: System Settings > Battery > Low Power Mode.'
        );
      }
      throw new Error(
        'Low Power Mode degistirilemedi. macOS sifre penceresi gelirse onaylayin; gelmiyorsa ana pencereyi one alip tekrar deneyin. Alternatif yol: System Settings > Battery > Low Power Mode.'
      );
    }
  }
};

export const getSystemInfo = async (): Promise<SystemInfo> => {
  const exec = promisify(execCallback);
  const diskPath = resolveDiskPath();
  let diskTotalBytes = 0;
  let diskFreeBytes = 0;

  try {
    const stats = await statfs(diskPath);
    diskTotalBytes = stats.bsize * stats.blocks;
    diskFreeBytes = stats.bsize * stats.bavail;
  } catch {
    diskTotalBytes = 0;
    diskFreeBytes = 0;
  }

  let processes: SystemInfo['processes'] = [];
  if (process.platform === 'win32') {
    try {
      const { stdout } = await exec(
        'powershell -NoProfile -Command "Get-Process | Sort-Object WS -Descending | Select-Object -First 20 Id,ProcessName,CPU,WS | ConvertTo-Json -Compress"'
      );
      const raw = stdout.trim();
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown> | Array<Record<string, unknown>>) : [];
      const entries = Array.isArray(parsed) ? parsed : [parsed];
      processes = entries.map((entry) => ({
        pid: typeof entry.Id === 'number' ? entry.Id : 0,
        command: typeof entry.ProcessName === 'string' ? entry.ProcessName : 'unknown',
        cpu: typeof entry.CPU === 'number' && Number.isFinite(entry.CPU) ? entry.CPU : 0,
        mem:
          typeof entry.WS === 'number' && Number.isFinite(entry.WS)
            ? (entry.WS / Math.max(1, os.totalmem())) * 100
            : 0
      }));
    } catch {
      processes = [];
    }
  } else {
    try {
      const { stdout } = await exec('ps -ax -o pid,comm,pcpu,pmem');
      const lines = stdout.split('\n').slice(1).filter(Boolean).slice(0, 20);
      processes = lines.map((line) => {
        const parts = line.trim().split(/\s+/);
        const pid = Number(parts.shift() ?? 0);
        const cpu = Number(parts.shift() ?? 0);
        const mem = Number(parts.shift() ?? 0);
        const command = parts.join(' ');
        return { pid, command, cpu, mem };
      });
    } catch {
      processes = [];
    }
  }

  const cpuInfo = os.cpus();
  const cpuModel = cpuInfo[0]?.model ?? 'Unknown';
  const cpuSpeedMHz = cpuInfo[0]?.speed ?? 0;
  const cpuUsagePercent = getCpuUsagePercent();
  const { readBytesPerSec, writeBytesPerSec } = await getDiskIoRates(exec);
  const { inBytesPerSec, outBytesPerSec, inBytesTotal, outBytesTotal, adapters } = await getNetworkIoRates(exec);
  const networkProcesses = await getNetworkProcesses(exec);
  const wifi = await getWifiInfo(exec);
  const bluetoothDevices = await getBluetoothDevices(exec);
  const openPorts = await getOpenPorts(exec);
  const battery = await getBatteryInfo(exec);
  const gpu = await getGpuInfo(exec);
  const swap = await getSwapInfo(exec);
  const powerSavingEnabled = await getPowerSavingMode(exec);

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    cpuModel,
    cpuSpeedMHz,
    cpuCount: os.cpus().length,
    loadAvg: os.loadavg(),
    cpuUsagePercent,
    uptimeSeconds: os.uptime(),
    totalMemBytes: os.totalmem(),
    freeMemBytes: os.freemem(),
    swapTotalBytes: swap.swapTotalBytes,
    swapUsedBytes: swap.swapUsedBytes,
    pageouts: swap.pageouts,
    diskTotalBytes,
    diskFreeBytes,
    diskPath,
    diskReadBytesPerSec: readBytesPerSec,
    diskWriteBytesPerSec: writeBytesPerSec,
    networkInBytesPerSec: inBytesPerSec,
    networkOutBytesPerSec: outBytesPerSec,
    networkInBytesTotal: inBytesTotal,
    networkOutBytesTotal: outBytesTotal,
    networkAdapters: adapters,
    networkProcesses,
    wifi,
    bluetoothDevices,
    openPorts,
    networkInterfaces: os.networkInterfaces(),
    processes,
    battery,
    gpu,
    powerSavingEnabled,
    wifiAvailable: Boolean(wifi.ssid || wifi.rssi !== null || wifi.txRate !== null),
    bluetoothAvailable: bluetoothDevices.length > 0,
    openPortsAvailable: openPorts.length > 0
  };
};

export const updatePowerSavingMode = async (enabled: boolean) => {
  const exec = promisify(execCallback);
  await setPowerSavingMode(exec, enabled);
  return enabled;
};

export const readPowerSavingMode = async () => {
  const exec = promisify(execCallback);
  return getPowerSavingMode(exec);
};
