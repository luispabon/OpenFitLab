const js = require('@eslint/js');
const nodePlugin = require('eslint-plugin-n');
const globals = require('globals');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = [
  js.configs.recommended,
  nodePlugin.configs['flat/recommended-script'],
  {
    files: ['src/**/*.js'],
    languageOptions: {
      globals: globals.node,
      ecmaVersion: 2024,
      sourceType: 'commonjs',
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'prefer-const': 'error',
    },
  },
  prettierConfig,
];
