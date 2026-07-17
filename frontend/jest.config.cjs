module.exports = {
    moduleFileExtensions: ['js', 'json', 'vue'],
    testMatch: ['<rootDir>/test/**/*.test.js'],
    testPathIgnorePatterns: ['<rootDir>/e2e/'],
    // v8 provider instruments at runtime, avoiding the babel-plugin-istanbul
    // "_interopRequireDefault already declared" crash that the babel provider
    // hits when instrumenting complex .vue SFCs.
    coverageProvider: 'v8',
    coverageReporters: ['text', 'json-summary'],
    collectCoverageFrom: [
      'src/**/*.{js,vue}',
      '!src/**/*.test.js',
      '!src/**/*.spec.js',
    ],
    transform: {
      // @vue/vue3-jest instruments .vue coverage natively when Jest requests it.
      // The former custom double-pass transformer (test/utils/vue-jest-transformer.cjs)
      // silently produced ZERO .vue coverage — every component/view read as 0%.
      '^.+\\.vue$': '@vue/vue3-jest',
      '^.+\\.js$': 'babel-jest',
      ".+\\.(css|styl|less|sass|scss|png|jpg|svg|ttf|woff|woff2)$": "jest-transform-stub"
    },
    testEnvironment: 'jest-environment-jsdom',
    testEnvironmentOptions: {
      customExportConditions: ["node", "node-addons"],
    },
    moduleNameMapper: {
      // Stub sweetalert2: its dist injects CSS jsdom can't parse, crashing any
      // suite that imports it transitively. Suites that assert Swal behavior
      // jest.mock() it themselves, which overrides this mapping.
      '^sweetalert2$': '<rootDir>/test/mocks/sweetalert2.cjs',
      '^@/(.*)$': '<rootDir>/src/$1',
      '\\.(css|less|scss|sass|png|svg)$': 'identity-obj-proxy',
    },
    transformIgnorePatterns: ['/node_modules/'],
    coveragePathIgnorePatterns: [
      '/node_modules/',
      '/e2e/',
      'src/components/dynamic_document/common/folders/index\\.js$',
      'scripts/e2e-coverage-module\\.cjs$',
      'scripts/e2e-module\\.cjs$',
      'scripts/e2e-modules\\.cjs$',
      'src/main\\.js$',
      'useDocumentPermissions_backup\\.js$',
      'src/stores/user_guide_updates\\.js$',
    ],
    setupFilesAfterEnv: ['./jest.setup.js']
  };