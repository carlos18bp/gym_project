module.exports = {
    moduleFileExtensions: ['js', 'json', 'vue'],
    testMatch: ['<rootDir>/test/**/*.test.js'],
    testPathIgnorePatterns: ['<rootDir>/e2e/'],
    coverageProvider: 'babel',
    transform: {
      '^.+\\.vue$': '<rootDir>/test/utils/vue-jest-transformer.cjs',
      '^.+\\.js$': 'babel-jest',
      ".+\\.(css|styl|less|sass|scss|png|jpg|svg|ttf|woff|woff2)$": "jest-transform-stub"
    },
    testEnvironment: 'jest-environment-jsdom',
    testEnvironmentOptions: {
      customExportConditions: ["node", "node-addons"],
    },
    moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/src/$1',
      '\\.(css|less|scss|sass|png|svg)$': 'identity-obj-proxy',
    },
    transformIgnorePatterns: ['/node_modules/'],
    coveragePathIgnorePatterns: [
      '/node_modules/',
      'src/components/dynamic_document/common/folders/index\\.js$',
    ],
    setupFilesAfterEnv: ['./jest.setup.js']
  };