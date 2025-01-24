//import { defineConfig } from 'vite'
//import react from '@vitejs/plugin-react'

// https://vite.dev/config/
//export default defineConfig({
//  plugins: [react()],
//})

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/qr-code-app/',
  plugins: [
    react(),
    VitePWA({
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
      },
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'qr-code-app',
        short_name: 'qr-app',
        description: 'A QR Code scanner powered by a neural network.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
    display: 'standalone',
        icons: [
          {
            src: 'public/icons/icon.jpg',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
 build: {
 outDir: 'dist',
 }
});

