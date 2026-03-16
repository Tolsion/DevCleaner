export interface SystemInfo {
  hostname: string;
  platform: string;
  arch: string;
  release: string;
  cpuModel: string;
  cpuSpeedMHz: number;
  cpuCount: number;
  loadAvg: number[];
  cpuUsagePercent: number;
  uptimeSeconds: number;
  totalMemBytes: number;
  freeMemBytes: number;
  swapTotalBytes: number;
  swapUsedBytes: number;
  pageouts: number;
  diskTotalBytes: number;
  diskFreeBytes: number;
  diskPath: string;
  diskReadBytesPerSec: number;
  diskWriteBytesPerSec: number;
  networkInBytesPerSec: number;
  networkOutBytesPerSec: number;
  networkInBytesTotal: number;
  networkOutBytesTotal: number;
  networkAdapters: Array<{
    name: string;
    displayName: string;
    inBytesPerSec: number;
    outBytesPerSec: number;
    inBytesTotal: number;
    outBytesTotal: number;
    active: boolean;
    type: string | null;
  }>;
  networkProcesses: Array<{
    pid: number;
    process: string;
    protocol: string;
    connections: number;
    listening: number;
    established: number;
    bandwidthBytesPerSec: number | null;
  }>;
  wifi: {
    ssid: string | null;
    rssi: number | null;
    noise: number | null;
    txRate: number | null;
    channel: string | null;
  };
  bluetoothDevices: Array<{
    name: string;
    address?: string;
    connected?: boolean;
  }>;
  openPorts: Array<{
    protocol: string;
    port: string;
    process: string;
    pid: number;
  }>;
  networkInterfaces: Record<
    string,
    Array<{
      address: string;
      family: string;
      internal: boolean;
      mac?: string;
    }>
  >;
  processes: Array<{
    pid: number;
    command: string;
    cpu: number;
    mem: number;
  }>;
  battery: {
    hasBattery: boolean;
    percent: number | null;
    isCharging: boolean | null;
    cycleCount: number | null;
    condition: string | null;
    timeRemainingMinutes: number | null;
    designCapacityMah: number | null;
    fullChargeCapacityMah: number | null;
    maximumCapacityPercent: number | null;
    currentCapacityMah: number | null;
    voltageMv: number | null;
    amperageMa: number | null;
    externalConnected: boolean | null;
    avgTimeToEmptyMinutes: number | null;
    avgTimeToFullMinutes: number | null;
  };
  gpu: {
    available: boolean;
    model: string | null;
    vendor: string | null;
    renderer: string | null;
    driverVersion: string | null;
    vramMb: number | null;
    utilizationPercent: number | null;
    source: string | null;
    devices: Array<{
      name: string;
      vendor: string | null;
      vramMb: number | null;
      active: boolean | null;
    }>;
  };
  powerSavingEnabled: boolean | null;
  wifiAvailable: boolean;
  bluetoothAvailable: boolean;
  openPortsAvailable: boolean;
}
