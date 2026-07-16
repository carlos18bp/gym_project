module.exports = {
    presets: [
      ['@babel/preset-env', { targets: { node: 'current' } }]
    ],
    // Jest-only (Vite does not read this file): make import.meta.env parseable
    plugins: [
      './test/babel/vite-meta-env.cjs'
    ]
  };