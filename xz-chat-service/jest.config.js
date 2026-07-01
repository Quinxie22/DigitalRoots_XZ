module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  moduleNameMapper: {
    '^uuid$': '<rootDir>/tests/uuidMock.ts',
    'file\\.service$': '<rootDir>/tests/fileServiceMock.ts',
    'cache\\.middleware$': '<rootDir>/tests/cacheMiddlewareMock.ts'
  }
};
