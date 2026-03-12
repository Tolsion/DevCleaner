export const IPC_CHANNELS = {
  scan: {
    start: 'scan:start',
    getResults: 'scan:getResults',
    progress: 'scan:progress',
    cancel: 'scan:cancel',
    pause: 'scan:pause',
    resume: 'scan:resume'
  },
  system: {
    get: 'system:get',
    getPowerSaving: 'system:getPowerSaving',
    setPowerSaving: 'system:setPowerSaving'
  },
  macCleaner: {
    junkScan: 'macCleaner:junkScan',
    junkClean: 'macCleaner:junkClean',
    largeFilesScan: 'macCleaner:largeFilesScan',
    largeFilesDelete: 'macCleaner:largeFilesDelete',
    undoTrash: 'macCleaner:undoTrash',
    startupList: 'macCleaner:startupList',
    memoryList: 'macCleaner:memoryList',
    memoryTerminate: 'macCleaner:memoryTerminate'
  },
  folders: {
    pick: 'folders:pick',
    delete: 'folders:delete'
  },
  apps: {
    list: 'apps:list',
    uninstall: 'apps:uninstall',
    showInFinder: 'apps:showInFinder'
  },
  devtools: {
    get: 'devtools:get'
  },
  app: {
    showMain: 'app:showMain',
    hideTray: 'app:hideTray',
    navigate: 'app:navigate',
    quit: 'app:quit',
    setTrayVisible: 'app:setTrayVisible'
  },
  storage: {
    getCleanupTotals: 'storage:getCleanupTotals',
    setCleanupTotals: 'storage:setCleanupTotals',
    resetCleanupTotals: 'storage:resetCleanupTotals',
    getScanSchedule: 'storage:getScanSchedule',
    setScanSchedule: 'storage:setScanSchedule',
    getScanConfig: 'storage:getScanConfig',
    setScanConfig: 'storage:setScanConfig',
    getLastScanAt: 'storage:getLastScanAt',
    setLastScanAt: 'storage:setLastScanAt',
    getTraySettings: 'storage:getTraySettings',
    setTraySettings: 'storage:setTraySettings'
  }
} as const;
