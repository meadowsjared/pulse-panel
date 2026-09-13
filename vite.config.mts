import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import components from 'unplugin-vue-components/vite'
import pluginRewriteAll from '@evg3/vite-plugin-rewrite-all'
import autoImport from 'unplugin-auto-import/vite'
import { visualizer } from 'rollup-plugin-visualizer'

const viteEnv: Record<string, string | undefined> = {}
Object.keys(process.env).forEach(key => {
  if (key.startsWith('VITE_')) {
    viteEnv[`import.meta.env.${key}`] = process.env[key]
  }
})

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    components({
      dts: 'src/components.d.ts',
    }),
    pluginRewriteAll(),
    autoImport({
      dts: 'src/auto-imports.d.ts',
      include: [/\.vue$/, /\.vue\?vue/],
      imports: ['vue'],
    }),
    ...(mode === 'analyze' || process.env.ANALYZE === 'true'
      ? [
          visualizer({
            open: true, // Automatically opens stats.html in your browser after build
            filename: 'stats.html',
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
  ],
  base: './',
  server: { port: 3000 },
}))
