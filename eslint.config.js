const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const { importX } = require('eslint-plugin-import-x');
const {
  createTypeScriptImportResolver,
} = require('eslint-import-resolver-typescript');
const prettierConfig = require('eslint-config-prettier');
const globals = require('globals');

module.exports = tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'load-tests/**', // k6 scripts — k6 globals (__ENV/__VU/__ITER), not this project's Node/TS app
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver()],
    },
    rules: {
      'no-underscore-dangle': 'off',
      'no-console': 'off',
      'no-useless-constructor': 'off',
      'class-methods-use-this': 'off',
      'no-param-reassign': 'off',
      camelcase: 'off',
      'no-plusplus': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: 'next' },
      ],
      'import-x/prefer-default-export': 'off',
      'import-x/no-unresolved': 'off',
    },
  },
  {
    files: ['src/tests/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
  {
    files: ['*.js', '*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  prettierConfig
);
