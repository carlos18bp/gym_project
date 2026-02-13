const babel = require('@babel/core');
const vueJest = require('@vue/vue3-jest');

const istanbulPlugin = require.resolve('babel-plugin-istanbul');

const normalizeMap = (map) => {
  if (!map) {
    return null;
  }
  if (typeof map === 'string') {
    try {
      return JSON.parse(map);
    } catch (error) {
      return map;
    }
  }
  return map;
};

const instrumentCode = (code, map, filename, transformOptions) => {
  const result = babel.transformSync(code, {
    filename,
    sourceMaps: true,
    inputSourceMap: normalizeMap(map),
    babelrc: false,
    configFile: false,
    parserOpts: {
      sourceType: 'script'
    },
    plugins: [
      [istanbulPlugin, { cwd: transformOptions.config.rootDir, exclude: [] }]
    ]
  });

  if (!result) {
    return { code, map };
  }

  return {
    code: result.code || code,
    map: result.map || map
  };
};

module.exports = {
  canInstrument: true,
  getCacheKey: vueJest.getCacheKey,
  process(sourceText, sourcePath, transformOptions) {
    const processed = vueJest.process(sourceText, sourcePath, transformOptions);
    if (!transformOptions.instrument) {
      return processed;
    }

    const code = processed.code || processed;
    const map = processed.map || null;
    return instrumentCode(code, map, sourcePath, transformOptions);
  }
};
