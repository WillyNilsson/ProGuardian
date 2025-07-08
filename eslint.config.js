import js from '@eslint/js'

export default [
  js.configs.recommended,
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      '.nyc_output/**',
      'dist/**',
      'build/**',
      'test/fixtures/**',
      '.vscode/**',
      '.idea/**',
      '*.log',
      '*.tmp',
      '.temp/**',
    ],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
      },
    },
    rules: {
      // Security-focused rules
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-with': 'error',

      // ES6+ best practices
      'prefer-const': 'error',
      'no-var': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'no-useless-concat': 'error',

      // Code quality rules
      'max-lines-per-function': [
        'error',
        {
          max: 50,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      complexity: ['error', 10],
      'max-depth': ['error', 3],
      'max-nested-callbacks': ['error', 3],
      'max-params': ['error', 4],

      // Error handling
      'no-throw-literal': 'error',
      'prefer-promise-reject-errors': 'error',
      'no-unused-expressions': 'error',

      // General code quality
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-use-before-define': 'error',
      'no-shadow': 'error',
      'no-param-reassign': 'error',
      'no-return-await': 'error',
      'require-await': 'error',
      'no-duplicate-imports': 'error',

      // Stylistic rules (will be handled by Prettier, but good as fallback)
      indent: ['error', 2, { SwitchCase: 1 }],
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'never'],
      'comma-dangle': ['error', 'always-multiline'],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'computed-property-spacing': ['error', 'never'],
      'func-call-spacing': ['error', 'never'],
      'key-spacing': ['error', { beforeColon: false, afterColon: true }],
      'keyword-spacing': ['error', { before: true, after: true }],
      'space-before-blocks': 'error',
      'space-before-function-paren': [
        'error',
        {
          anonymous: 'always',
          named: 'never',
          asyncArrow: 'always',
        },
      ],
      'arrow-spacing': ['error', { before: true, after: true }],
      'template-curly-spacing': ['error', 'never'],

      // Node.js specific
      'no-process-exit': 'error',
      'no-sync': ['warn', { allowAtRootLevel: true }],
      'global-require': 'error',
      'callback-return': 'error',
      'handle-callback-err': 'error',
      'no-buffer-constructor': 'error',
      'no-path-concat': 'error',
    },
  },
  {
    // Special rules for test files
    files: ['test/**/*.js', '**/*.test.js'],
    rules: {
      'max-lines-per-function': 'off',
      'no-console': 'off',
    },
  },
  {
    // Special rules for CLI entry points
    files: ['bin/**/*.js'],
    rules: {
      'no-console': 'off',
      'no-process-exit': 'off',
    },
  },
  {
    // Special rules for command files that need console output
    files: ['src/commands/**/*.js', 'src/wrapper/**/*.js'],
    rules: {
      'no-console': 'off',
      'max-lines-per-function': ['error', 150], // Allow longer functions for complex CLI commands
      complexity: ['error', 30], // Allow higher complexity for CLI commands
      'max-depth': ['error', 5], // Allow deeper nesting for CLI command logic
      'no-process-exit': 'off',
    },
  },
  {
    // Special rules for utility files with complex validation
    files: ['src/utils/validation.js', 'src/utils/errors.js'],
    rules: {
      complexity: ['error', 15], // Allow higher complexity for validation logic
      'no-process-exit': 'off', // Allow process.exit in error handlers
      'max-depth': ['error', 5], // Allow deeper nesting for validation logic
    },
  },
  {
    // Special rules for CLI detection utility
    files: ['src/utils/cli-detector.js'],
    rules: {
      'no-console': 'off', // CLI detector needs to communicate with user
      complexity: ['error', 15], // Allow higher complexity for detection logic
    },
  },
]
