const t = require('@babel/types');

module.exports = function transformImportMetaEnv() {
  const buildReplacement = () => {
    const globalId = t.identifier('globalThis');
    const envMember = t.memberExpression(t.identifier('globalThis'), t.identifier('__PINPOINT_IMPORT_META_ENV__'));
    const typeofGlobal = t.unaryExpression('typeof', t.identifier('globalThis'));
    const hasEnv = t.logicalExpression(
      '&&',
      t.binaryExpression('!==', typeofGlobal, t.stringLiteral('undefined')),
      envMember
    );

    return t.logicalExpression('||', hasEnv, t.objectExpression([]));
  };

  return {
    name: 'transform-import-meta-env',
    visitor: {
      MemberExpression(path) {
        const { node } = path;

        if (
          node.object?.type === 'MetaProperty' &&
          node.object.meta?.name === 'import' &&
          node.object.property?.name === 'meta' &&
          node.property?.type === 'Identifier' &&
          node.property.name === 'env'
        ) {
          path.replaceWith(buildReplacement());
        }
      }
    }
  };
};
