import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import path from 'path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': path.resolve(__dirname, 'src/shared'),
        '@main': path.resolve(__dirname, 'src/main'),
        '@scanner': path.resolve(__dirname, 'src/scanner'),
        '@sites': path.resolve(__dirname, 'src/sites')
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'src/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': path.resolve(__dirname, 'src/shared'),
        '@sites': path.resolve(__dirname, 'src/sites'),
        '@preload': path.resolve(__dirname, 'src/preload')
      }
    },
    build: {
      rollupOptions: {
        input: {
          web: path.resolve(__dirname, 'src/preload/web.ts'),
          dashboard: path.resolve(__dirname, 'src/preload/dashboard.ts')
        }
      }
    }
  },
  renderer: {
    base: './',
    resolve: {
      alias: {
        '@shared': path.resolve(__dirname, 'src/shared'),
        '@renderer': path.resolve(__dirname, 'src/renderer')
      }
    },
    build: {
      rollupOptions: {
        input: {
          shell: path.resolve(__dirname, 'src/renderer/shell/index.html'),
          dashboard: path.resolve(__dirname, 'src/renderer/dashboard/index.html'),
          settings: path.resolve(__dirname, 'src/renderer/settings/index.html')
        }
      }
    }
  }
});
