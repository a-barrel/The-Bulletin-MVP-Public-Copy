module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  ignorePatterns: [
    'node_modules/',
    'client/node_modules/',
    'server/node_modules/',
    'client/dist/',
    'server/dist/',
    'dist/',
    'build/'
  ],
  rules: {
    'no-unused-vars': 'off',
    'no-undef': 'off'
  },
  overrides: [
    {
      files: ['client/**/*.{js,jsx}'],
      env: {
        browser: true,
        es2022: true
      },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      },
      plugins: ['react', 'react-hooks', 'jsx-a11y'],
      extends: [
        'eslint:recommended',
        'plugin:react/recommended',
        'plugin:react-hooks/recommended',
        'plugin:jsx-a11y/recommended'
      ],
      settings: {
        react: {
          version: 'detect'
        }
      },
      rules: {
        'react/react-in-jsx-scope': 'off',
        'react/prop-types': 'off',
        'react-hooks/exhaustive-deps': 'off',
        'jsx-a11y/click-events-have-key-events': 'off',
        'jsx-a11y/no-noninteractive-element-interactions': 'off',
        'jsx-a11y/no-static-element-interactions': 'off',
        'jsx-a11y/media-has-caption': 'off',
        'jsx-a11y/alt-text': 'off',
        'react/no-unescaped-entities': 'off',
        'no-unused-vars': 'off',
        'no-undef': 'off'
      }
    },
    {
      files: ['**/*.test.{js,jsx}'],
      env: {
        jest: true
      },
      rules: {
        'no-undef': 'off'
      }
    },
    {
      files: ['server/**/*.js'],
      env: {
        node: true,
        es2022: true
      },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'script'
      },
      extends: ['eslint:recommended'],
      rules: {
        'no-console': 'off',
        'no-useless-catch': 'off',
        'no-unused-vars': 'off',
        'no-undef': 'off'
      }
    }
  ]
};
