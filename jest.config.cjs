module.exports = {
  roots: ['<rootDir>/client'],
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest'
  },
  moduleNameMapper: {
    '^.+\\.(css|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/client/test/setupTests.js'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/', '/emulator-data/'],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
  moduleFileExtensions: ['js', 'jsx', 'json'],
  collectCoverageFrom: [
    'client/src/**/*.{js,jsx}',
    '!client/src/main.jsx',
    '!client/src/index.jsx',
    '!client/src/**/index.js'
  ]
};
