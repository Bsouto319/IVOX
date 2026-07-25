// Alguma dependencia (nao identificada com certeza - node_modules local nao bate
// com o que o CI instala) usa um import() dinamico com especificador nao-literal,
// tipo `import(/* webpackIgnore: true */ /* turbopackIgnore: true */ /* @vite-ignore */ OTEL_PKG).catch(...)`
// pra carregar OpenTelemetry de forma opcional. O parser do Hermes quebra nisso
// (erro "Invalid expression encountered" no bytecode compiler), mesmo o código já
// tratando a falha com .catch(). Esse plugin troca qualquer import() dinâmico com
// especificador que não seja uma string literal por uma Promise rejeitada — mantém
// o graceful-degradation (o .catch() já existente continua funcionando) sem o
// Hermes precisar parsear a expressão problemática.
function stripDynamicImportOfNonLiteral({ types: t }) {
  return {
    visitor: {
      Import(path) {
        const callExpr = path.parentPath;
        if (!callExpr.isCallExpression()) return;
        const [arg] = callExpr.node.arguments;
        if (arg && t.isStringLiteral(arg)) return; // import('algo') estatico, deixa passar
        callExpr.replaceWith(
          t.callExpression(
            t.memberExpression(t.identifier("Promise"), t.identifier("reject")),
            [t.newExpression(t.identifier("Error"), [t.stringLiteral("dynamic import disabled")])]
          )
        );
      },
    },
  };
}

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [stripDynamicImportOfNonLiteral],
  };
};
