import type { ScanResults } from '../../shared/types/scan';
import { scannerService } from './scanner.service';
import { storageService } from './storage.service';
import { getIsScanning, setLastResults } from '../ipc/scan.handlers';

let intervalId: NodeJS.Timeout | null = null;
let scheduledRunning = false;

const minutesToMs = (minutes: number) => minutes * 60 * 1000;

const runScheduledScan = async () => {
  if (scheduledRunning || getIsScanning()) return;
  const schedule = await storageService.getScanSchedule();
  if (!schedule.enabled) return;
  const config = await storageService.getScanConfig();
  if (!config.roots.length) return;
  const lastScanAt = await storageService.getLastScanAt();
  const lastTime = lastScanAt ? new Date(lastScanAt).getTime() : 0;
  const dueMs = minutesToMs(schedule.intervalMinutes);
  const now = Date.now();
  if (lastTime && now - lastTime < dueMs) return;

  scheduledRunning = true;
  try {
    const results: ScanResults = await scannerService.scan(
      config,
      undefined,
      () => false,
      () => false
    );
    setLastResults(results);
    await storageService.setLastScanAt(results.scannedAt);
  } catch {
    // ignore scheduler failures
  } finally {
    scheduledRunning = false;
  }
};

export const startScanScheduler = () => {
  if (intervalId) return;
  intervalId = setInterval(() => {
    void runScheduledScan();
  }, 60 * 1000);
  void runScheduledScan();
};

