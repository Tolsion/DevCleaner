import { exec as execCallback } from 'node:child_process';
import { statfs } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
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

let lastCpuTimes: CpuTimes | null = null;
let lastDiskIo: DiskIoSnapshot | null = null;
let lastNetIo: NetIoSnapshot | null = null;

const resolveDiskPath = () => {
  const home = os.homedir();
  return home || path.parse(process.cwd()).root;
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

const getNetworkIoRates = async (exec: (command: string) => Promise<{ stdout: string }>) => {
  try {
    const { stdout } = await exec('netstat -ib');
    const { inBytes, outBytes } = parseNetstat(stdout);
    const now = Date.now();
    if (!lastNetIo) {
      lastNetIo = { inBytes, outBytes, timestamp: now };
      return { inBytesPerSec: 0, outBytesPerSec: 0, inBytesTotal: inBytes, outBytesTotal: outBytes };
    }
    const elapsedSeconds = (now - lastNetIo.timestamp) / 1000;
    const inDelta = inBytes - lastNetIo.inBytes;
    const outDelta = outBytes - lastNetIo.outBytes;
    lastNetIo = { inBytes, outBytes, timestamp: now };
    if (elapsedSeconds <= 0) {
      return { inBytesPerSec: 0, outBytesPerSec: 0, inBytesTotal: inBytes, outBytesTotal: outBytes };
    }
    return {
      inBytesPerSec: Math.max(0, inDelta / elapsedSeconds),
      outBytesPerSec: Math.max(0, outDelta / elapsedSeconds),
      inBytesTotal: inBytes,
      outBytesTotal: outBytes
    };
  } catch {
    return { inBytesPerSec: 0, outBytesPerSec: 0, inBytesTotal: 0, outBytesTotal: 0 };
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
  if (process.platform !== 'darwin') {
    throw new Error('Power saving is only supported on macOS.');
  }
  const value = enabled ? 1 : 0;
  await exec(`pmset -a lowpowermode ${value}`);
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

  const cpuInfo = os.cpus();
  const cpuModel = cpuInfo[0]?.model ?? 'Unknown';
  const cpuSpeedMHz = cpuInfo[0]?.speed ?? 0;
  const cpuUsagePercent = getCpuUsagePercent();
  const { readBytesPerSec, writeBytesPerSec } = await getDiskIoRates(exec);
  const { inBytesPerSec, outBytesPerSec, inBytesTotal, outBytesTotal } = await getNetworkIoRates(exec);
  const wifi = await getWifiInfo(exec);
  const bluetoothDevices = await getBluetoothDevices(exec);
  const openPorts = await getOpenPorts(exec);
  const battery = await getBatteryInfo(exec);
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
    wifi,
    bluetoothDevices,
    openPorts,
    networkInterfaces: os.networkInterfaces(),
    processes,
    battery,
    powerSavingEnabled,
    wifiAvailable: Boolean(wifi.ssid || wifi.rssi !== null || wifi.txRate !== null),
    bluetoothAvailable: false,
    openPortsAvailable: false
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
