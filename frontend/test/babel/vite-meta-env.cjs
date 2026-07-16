/**
 * Jest-only babel plugin: rewrites `import.meta` to `({ env: process.env })`
 * so Vite-style `import.meta.env.VITE_*` reads work under Jest's CJS runtime.
 * Without this, any module using `import.meta` (msal_config.js,
 * DocumentEditor.vue) fails to transform and cannot be covered by unit tests.
 * Vite itself never uses babel.config.cjs, so the app build is unaffected.
 */
module.exports = function viteMetaEnv({ types: t }) {
  return {
    name: 'vite-meta-env',
    visitor: {
      MetaProperty(path) {
        if (
          path.node.meta.name === 'import' &&
          path.node.property.name === 'meta'
        ) {
          path.replaceWith(
            t.objectExpression([
              t.objectProperty(
                t.identifier('env'),
                t.memberExpression(t.identifier('process'), t.identifier('env'))
              ),
            ])
          );
        }
      },
    },
  };
};
