import js from '@eslint/js'
import ts from 'typescript-eslint'
import svelte from 'eslint-plugin-svelte'
import svelteParser from 'svelte-eslint-parser'
import globals from 'globals'

export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: ts.parser,
      },
    },
  },
  // .svelte.ts files use Svelte 5 runes ($state, etc.); parse as TypeScript so runes are valid identifiers
  {
    files: ['**/*.svelte.ts'],
    languageOptions: {
      parser: ts.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'svelte/prefer-svelte-reactivity': 'off',
      'svelte/require-each-key': 'off',
      'svelte/prefer-writable-derived': 'off',
      '@typescript-eslint/no-unused-expressions': [
        'error',
        { allowShortCircuit: true, allowTernary: true },
      ],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '.svelte-kit/'],
  },
]
