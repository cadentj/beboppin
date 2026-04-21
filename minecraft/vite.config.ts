import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  root: '.',
  base: command === 'build' ? '/beboppin/minecraft/' : '/',
  build: {
    outDir: 'dist-demo',
    emptyOutDir: true,
  },
}))
