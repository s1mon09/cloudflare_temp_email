import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import wasm from "vite-plugin-wasm";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: './dist',
    rollupOptions: {
      output: {
        // 按依赖拆分 vendor，改善缓存命中与并行加载；
        // 仅按已进入依赖图的模块归类，避免把整包（如 naive-ui）强制打入初始包。
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('node_modules/naive-ui/')) return 'vendor-naive'
          if (id.includes('node_modules/@vueuse/')) return 'vendor-vueuse'
          if (id.includes('node_modules/@unhead/')) return 'vendor-unhead'
          if (id.includes('node_modules/@fingerprintjs/')) return 'vendor-fingerprint'
          if (/node_modules\/(vue|vue-router|vue-i18n|pinia|@vue|@intlify)\//.test(id)) {
            return 'vendor-vue'
          }
          return undefined
        },
      },
    },
  },
  plugins: [
    vue(),
    wasm(),
    AutoImport({
      imports: [
        'vue',
        {
          'naive-ui': [
            'useMessage',
            'useNotification',
            'NButton',
            'NPopconfirm',
            'NIcon',
          ]
        }
      ]
    }),
    Components({
      resolvers: [NaiveUiResolver()]
    }),
    VitePWA({
      registerType: null,
      devOptions: {
        enabled: false
      },
      workbox: {
        disableDevLogs: true,
        globPatterns: [],
        runtimeCaching: [],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Temp Email',
        short_name: 'Temp Email',
        description: 'Temp Email - Temporary Email',
        theme_color: '#ffffff',
        icons: [
          {
            src: '/logo.png',
            sizes: '192x192',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: [
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url))
      }
    ]
  },
  define: {
    'import.meta.env.PACKAGE_VERSION': JSON.stringify(process.env.npm_package_version),
  }
})
