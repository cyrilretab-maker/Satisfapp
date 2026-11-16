import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// base './' : l'app fonctionne quelle que soit l'adresse (GitHub Pages aujourd'hui,
// site de La Compagnie du Rétablissement plus tard).
export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icones/*.png'],
      manifest: {
        name: 'Satisfapp',
        short_name: 'Satisfapp',
        description: 'Faire monter une tension, puis la libérer.',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#141010',
        theme_color: '#141010',
        icons: [
          { src: 'icones/icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icones/icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icones/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,json}'],
      },
    }),
  ],
});
