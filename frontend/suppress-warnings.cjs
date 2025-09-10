// Suppress util._extend deprecation warning
// This is a temporary solution while dependencies update to use Object.assign()

const originalEmitWarning = process.emitWarning;

process.emitWarning = function(warning, type, code, ...args) {
  // Suppress the specific util._extend deprecation warning
  if (code === 'DEP0060') {
    return; // Suppress this specific warning
  }
  
  // Allow all other warnings to pass through
  return originalEmitWarning.call(process, warning, type, code, ...args);
};
