import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  main: {
    build: {
      lib: {
        entry: 'electron/main/index.ts'
      },
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: 'index.cjs'
        }
      },
      outDir: 'dist/main'
    }
  },
  preload: {
    build: {
      lib: {
        entry: path.join(__dirname, 'electron/preload/index.ts')
      },
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: 'index.cjs'
        }
      },
      outDir: 'dist/preload'
    }
  },
  renderer: {
    root: '.',
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.join(__dirname, 'src')
      }
    },
    build: {
      rollupOptions: {
        input: path.join(__dirname, 'index.html')
      },
      outDir: 'dist/renderer'
    }
  }
});
