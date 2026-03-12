import type { DevCleanerApi } from '../electron/shared/types/api';

declare global {
  interface Window {
    devCleaner: DevCleanerApi;
  }
}

export {};
