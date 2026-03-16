export type RendererOsFamily = 'windows' | 'macos' | 'linux' | 'unknown';

export const detectRendererOsFamily = (): RendererOsFamily => {
  if (typeof navigator === 'undefined') return 'unknown';
  const source = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
  if (source.includes('win')) return 'windows';
  if (source.includes('mac')) return 'macos';
  if (source.includes('linux')) return 'linux';
  return 'unknown';
};

export const getPlatformDisplayName = (platform: RendererOsFamily) => {
  switch (platform) {
    case 'windows':
      return 'Windows';
    case 'macos':
      return 'macOS';
    case 'linux':
      return 'Linux';
    default:
      return 'your system';
  }
};

export const getFileBrowserName = (platform: RendererOsFamily) => {
  switch (platform) {
    case 'windows':
      return 'Explorer';
    case 'macos':
      return 'Finder';
    default:
      return 'File Manager';
  }
};

export const getTrashLabel = (platform: RendererOsFamily) => {
  return platform === 'windows' ? 'Recycle Bin' : 'Trash';
};
