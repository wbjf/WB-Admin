import js from '@eslint/js'
import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'
import prettierPlugin from 'eslint-plugin-prettier'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'generated/**',
      'coverage/**',
      'docs/**',
      'types/auto-imports.d.ts',
      'types/components.d.ts',
      'code-generator/**',
      // 构建期脚本（Node 侧执行、要往控制台打日志），与 code-generator 同类
      'scripts/**',
      // 本地临时排查脚本（_*.cjs 等，已在 .gitignore 里，不进版本控制）。
      // 不排除的话 `eslint .` 会多出几十个 no-undef —— 它们用的是 CJS 的
      // require/__dirname/process，而 flat config 里的 node globals 只配置给了
      // **/*.{ts,js,vue}。本地的假红会盖住真正的回归（CI 上这些文件根本不存在）。
      '_*.cjs',
      '_*.mjs',
      '_*.js'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    files: ['**/*.{ts,js,vue}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue']
      }
    },
    plugins: { prettier: prettierPlugin },
    rules: {
      ...prettierConfig.rules,
      'prettier/prettier': 'warn',
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
      'vue/require-default-prop': 'off',
      'vue/attributes-order': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }]
    }
  },
  {
    files: ['test/**/*.ts', 'src/mock/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
)
