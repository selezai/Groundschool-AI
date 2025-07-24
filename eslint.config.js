// @ts-check

import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import eslintPluginReact from 'eslint-plugin-react';
import eslintPluginReactHooks from 'eslint-plugin-react-hooks';
import eslintPluginReactNative from 'eslint-plugin-react-native';
// For Expo-specific globals, you might need a specific plugin if one exists and is compatible,
// or add them manually to globals.
// For now, we'll add common browser and Node.js globals, plus Jest.

export default tseslint.config(
  {
    // Global ignores
    ignores: [
      'node_modules/',
      '.expo/',
      'dist/',
      'babel.config.js', // Often not linted
      'metro.config.js', // Often not linted
      'jest.config.js',  // Often not linted
    ],
  },
  {
    // Base configuration for all JS/TS files
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module', // Matches your package.json
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        // Add any Expo-specific or React Native globals here if not covered
        // e.g., __DEV__: 'readonly',
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      react: eslintPluginReact,
      'react-hooks': eslintPluginReactHooks,
      'react-native': eslintPluginReactNative,
    },
    rules: {
      ...eslint.configs.recommended.rules,
      // React specific rules
      'react/jsx-uses-react': 'warn', // Not strictly necessary with new JSX transform, but good practice
      'react/react-in-jsx-scope': 'off', // Not needed with new JSX transform
      'react/jsx-uses-vars': 'warn',
      'react/prop-types': 'off', // Consider using TypeScript or PropTypes if needed, but off for basic JS
      // React Hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // React Native specific rules
      'react-native/no-unused-styles': 'warn',
      'react-native/split-platform-components': 'warn',
      'react-native/no-inline-styles': 'warn', // Encourages StyleSheet usage
      'react-native/no-color-literals': 'warn', // Encourages theme/variable usage
      'react-native/no-raw-text': 'warn', // Helps with i18n and consistency
      // General improvements
      'no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }], // Warn on unused vars, allow unused args starting with _
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }], // Allow console.warn/error/info
      'semi': ['warn', 'always'], // Require semicolons
      'quotes': ['warn', 'single', { 'avoidEscape': true }], // Prefer single quotes
      'indent': ['warn', 2], // 2-space indentation
      // Add any project-specific rule overrides here
    },
    settings: {
      react: {
        version: 'detect', // Automatically detect React version
      },
    },
  }
);
