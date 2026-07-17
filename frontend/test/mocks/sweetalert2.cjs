// Global test stub for sweetalert2.
//
// The real sweetalert2 dist injects a <style> block at import time whose CSS
// jsdom cannot parse, throwing "Could not parse CSS stylesheet" and crashing
// any suite that transitively imports it (e.g. via @/shared/notification_message).
// No test exercises real Swal behavior — every suite that references sweetalert2
// jest.mock()s it, which overrides this stub. This stub only prevents the
// import-time jsdom crash for suites that pull it in transitively.
const Swal = {
  fire: () => Promise.resolve({ isConfirmed: true, isDenied: false, isDismissed: false, value: true }),
  mixin: () => Swal,
  close: () => {},
  isVisible: () => false,
  getPopup: () => null,
  showLoading: () => {},
  hideLoading: () => {},
  update: () => {},
  clickConfirm: () => {},
  clickCancel: () => {},
  showValidationMessage: () => {},
  resetValidationMessage: () => {},
};

module.exports = Swal;
module.exports.default = Swal;
module.exports.__esModule = true;
