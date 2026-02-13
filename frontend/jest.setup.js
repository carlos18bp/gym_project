import '@testing-library/jest-dom';

const originalConsoleError = console.error;

beforeEach(() => {
  // Silence console.error during tests to avoid noisy logs
  if (console.error === originalConsoleError) {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  } else if (jest.isMockFunction(console.error)) {
    console.error.mockImplementation(() => {});
  }
});

afterEach(() => {
  if (jest.isMockFunction(console.error)) {
    console.error.mockClear();
  }
});

afterAll(() => {
  // Restore original console.error even if tests overwrote the mock
  if (jest.isMockFunction(console.error) && typeof console.error.mockRestore === 'function') {
    console.error.mockRestore();
  } else {
    console.error = originalConsoleError;
  }
});