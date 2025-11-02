module.exports = {
  projects: [
    {
      displayName: 'client',
      roots: ['<rootDir>/client'],
      testEnvironment: 'jsdom',
      transform: {
        '^.+\\.[jt]sx?$': 'babel-jest'
      },
      moduleNameMapper: {
        '^.+\\.(css|scss|sass)$': 'identity-obj-proxy',
        '^.+\\.svg$': '<rootDir>/client/test/mocks/svgMock.js',
        '^@/(.*)$': '<rootDir>/$1',
        '^react$': '<rootDir>/node_modules/react',
        '^react-dom$': '<rootDir>/node_modules/react-dom',
        '^react-dom/client$': '<rootDir>/node_modules/react-dom/client.js'
      },
      setupFilesAfterEnv: ['<rootDir>/client/test/setupTests.js'],
      testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/', '/emulator-data/'],
      coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
      moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json'],
      collectCoverageFrom: [
        'client/src/**/*.{js,jsx,ts,tsx}',
        '!client/src/main.jsx',
        '!client/src/index.jsx',
        '!client/src/**/index.js'
      ]
    },
    {
      displayName: 'server',
      roots: ['<rootDir>/server'],
      testEnvironment: 'node',
      testMatch: ['**/?(*.)+(test).[jt]s?(x)'],
      setupFilesAfterEnv: ['<rootDir>/server/test/setupTests.js'],
      testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/', '/emulator-data/'],
      coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
      moduleFileExtensions: ['js', 'json']
    }
  ]
};
