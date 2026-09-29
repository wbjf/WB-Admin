import { fileURLToPath, URL } from 'node:url'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import compression from 'vite-plugin-compression'
import { visualizer } from 'rollup-plugin-visualizer'
import { mockServer } from './src/mock/plugin'

/**
 * Element Plus 按需样式的全部入口（118 个，只取真实存在的）。
 *
 * AutoImport / Components 插件生成的 `element-plus/es/components/<name>/style/css`
 * 属于「运行时才被发现」的依赖：不预先声明，dev 期间每访问到一类新组件
 * 就会触发一次重新预构建（整页 reload + 重建 .vite 缓存），既拖慢热更新，
 * 又可能在缓存重建失败时直接让 dev server 退出。
 * 注意不要连 index 一起列：附属组件（如 breadcrumb-item）没有 index.mjs，
 * 列进去 Vite 会报 "Failed to resolve dependency"。
 */
function elementPlusStyleEntries(): string[] {
  const dir = resolvePath(process.cwd(), 'node_modules/element-plus/es/components')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => existsSync(resolvePath(dir, name, 'style/css.mjs')))
    .map((name) => `element-plus/es/components/${name}/style/css`)
}

/**
 * 运行时依赖全部纳入预构建。
 * 这些都是「只在个别页面 import」的重型库（echarts / xlsx / 编辑器 / 导出 / 二维码…），
 * Vite 会在首次访问该页面时才发现它们，同样会触发一次重新预构建。
 */
function runtimeDeps(): string[] {
  try {
    const pkg = JSON.parse(readFileSync(resolvePath(process.cwd(), 'package.json'), 'utf8'))
    return Object.keys(pkg.dependencies ?? {}).filter((name) => name !== 'element-plus')
  } catch {
    return []
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const enableCompress = env.VITE_BUILD_COMPRESS === 'true'
  const enableAnalyze = env.VITE_BUILD_ANALYZE === 'true'

  return {
    base: env.VITE_BASE_URL || '/',
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0')
    },
    plugins: [
      vue(),
      mockServer({ enabled: env.VITE_USE_MOCK === 'true' }),
      AutoImport({
        imports: ['vue', 'vue-router', 'pinia', { 'vue-i18n': ['useI18n'] }],
        resolvers: [ElementPlusResolver()],
        dts: 'types/auto-imports.d.ts',
        eslintrc: { enabled: false }
      }),
      Components({
        resolvers: [ElementPlusResolver()],
        dts: 'types/components.d.ts',
        dirs: ['src/components'],
        deep: true
      }),
      enableCompress &&
        compression({ algorithm: 'gzip', ext: '.gz', threshold: 10240, deleteOriginFile: false }),
      enableAnalyze &&
        visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true, open: false })
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '#': fileURLToPath(new URL('./types', import.meta.url))
      }
    },
    /**
     * 依赖预构建声明。
     * Element Plus 走按需导入时，每个组件的 style/css 是「运行时才发现」的依赖。
     * 不预先声明，dev 期间会不断触发"发现新依赖 → 重新预构建 → 整页 reload"，
     * 既慢又容易在受限环境里因重建缓存失败而让 dev server 崩掉。
     * 一次性声明后，启动时构建完就不再变化。
     */
    optimizeDeps: {
      include: [...runtimeDeps(), 'element-plus/es', ...elementPlusStyleEntries()]
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
          additionalData: `@use "@/styles/variables.scss" as *;`
        }
      }
    },
    server: {
      host: true,
      port: Number(env.VITE_PORT) || 3000,
      open: false,
      proxy: {
        [env.VITE_API_PREFIX || '/api']: {
          target: env.VITE_PROXY_TARGET || 'http://127.0.0.1:8080',
          changeOrigin: true,
          rewrite: (p: string) => p.replace(new RegExp(`^${env.VITE_API_PREFIX || '/api'}`), '')
        }
      }
    },
    build: {
      target: 'es2020',
      chunkSizeWarningLimit: 1500,
      sourcemap: env.VITE_BUILD_SOURCEMAP === 'true',
      rollupOptions: {
        output: {
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
          manualChunks: {
            vue: ['vue', 'vue-router', 'pinia'],
            'element-plus': ['element-plus', '@element-plus/icons-vue'],
            echarts: ['echarts'],
            vendor: ['axios', 'dayjs', '@vueuse/core', 'vue-i18n']
          }
        }
      }
    },
    test: {
      environment: 'jsdom',
      globals: true,
      include: ['test/unit/**/*.spec.ts']
    }
  }
})
