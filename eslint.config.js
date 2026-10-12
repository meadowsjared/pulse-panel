const globals = require('globals')
const typescriptParser = require('@typescript-eslint/parser')
const typescriptPlugin = require('@typescript-eslint/eslint-plugin')
const vueParser = require('vue-eslint-parser')
const vuePlugin = require('eslint-plugin-vue')

const sharedRules = {
  // StandardJS — The Rules
  indent: ['off', 2], // 2 spaces – for indentation
  'max-len': ['error', { code: 120 }],
  'no-console': 'off',
  'arrow-parens': ['error', 'as-needed'],
  'import/no-extraneous-dependencies': 'off',
  'vue/multi-word-component-names': 'off',
  'space-before-function-paren': 'off',
  'vue/html-self-closing': 'off',
  'require-await': 0,
  quotes: ['error', 'single'],
  'comma-dangle': [
    'error',
    {
      arrays: 'always-multiline',
      objects: 'always-multiline',
      imports: 'always-multiline',
      exports: 'always-multiline',
      functions: 'ignore',
    },
  ],
  'global-require': 0,
  'import/no-unresolved': 0,
  'import/newline-after-import': 0,
  'no-underscore-dangle': 0,
  'no-debugger': process.env.NODE_ENV === 'production' ? 2 : 0,
  'vue/max-attributes-per-line': 'off',
  'vue/singleline-html-element-content-newline': 0,
  '@typescript-eslint/consistent-type-assertions': [
    'error',
    {
      assertionStyle: 'never',
    },
  ],
}

module.exports = [
  {
    ignores: ['src/components.d.ts', 'src/auto-imports.d.ts', 'dist/*', 'release/*'],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      parser: typescriptParser,
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      '@typescript-eslint': typescriptPlugin,
      vue: vuePlugin,
    },
    rules: sharedRules,
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: typescriptParser,
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      '@typescript-eslint': typescriptPlugin,
      vue: vuePlugin,
    },
    rules: sharedRules,
  },
]
