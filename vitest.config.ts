import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './src/shared'),
      '@main': path.resolve(__dirname, './src/main'),
      '@scanner': path.resolve(__dirname, './src/scanner'),
      '@preload': path.resolve(__dirname, './src/preload'),
      '@sites': path.resolve(__dirname, './src/sites'),
      '@renderer': path.resolve(__dirname, './src/renderer')
    }
  }
});
