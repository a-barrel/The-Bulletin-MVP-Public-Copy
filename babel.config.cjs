module.exports = (api) => {
  const isTest = api.env('test');

  return {
    presets: [
      ['@babel/preset-env', { targets: { node: 'current' } }],
      ['@babel/preset-react', { runtime: 'automatic' }],
      '@babel/preset-typescript'
    ],
    plugins: [
      isTest && './scripts/babel-plugin-transform-import-meta-env.cjs',
      ['babel-plugin-transform-import-meta', { module: 'CommonJS' }]
    ].filter(Boolean)
  };
};
