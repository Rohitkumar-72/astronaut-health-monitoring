import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), '')

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: env.ASTRA_API_PROXY_TARGET || 'http://127.0.0.1:5000',
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyRequest) => proxyRequest.removeHeader('origin'))
          },
        },
      },
    },
  }
})
