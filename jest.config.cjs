module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js', '**/*.test.js'],
  moduleFileExtensions: ['js', 'jsx', 'json'],
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|expo|@expo|@unimodules)/)'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
  moduleNameMapper: {
    '^react-native$': '<rootDir>/node_modules/react-native',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/**/*.test.{js,jsx}',
    '!src/tests/**',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      statements: 10,
      branches: 10,
      functions: 10,
      lines: 10
    }
  }
};
