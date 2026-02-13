// Suppress util._extend deprecation warning
// This is a temporary solution while dependencies update to use Object.assign()

const originalEmitWarning = process.emitWarning;

process.emitWarning = function(warning, type, code, ...args) {
  const warningCode = (typeof type === 'object' && type && type.code) ? type.code : code;

  // Suppress the specific util._extend deprecation warning
  if (warningCode === 'DEP0060' || warningCode === 'DEP0040') {
    return; // Suppress this specific warning
  }
  
  // Allow all other warnings to pass through
  return originalEmitWarning.call(process, warning, type, code, ...args);
};
