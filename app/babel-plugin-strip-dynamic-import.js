// Neutraliza import() dinamico com especificador nao-literal (ex: import(ALGUMA_VAR)),
// que quebra o compilador de bytecode do Hermes ("Invalid expression encountered"),
// mesmo quando o codigo original ja trata a falha com .catch(). Troca a expressao por
// uma Promise rejeitada, preservando o graceful-degradation.
module.exports = function stripDynamicImportOfNonLiteral({ types: t }) {
  return {
    visitor: {
      Import(path) {
        const callExpr = path.parentPath;
        if (!callExpr.isCallExpression()) return;
        const [arg] = callExpr.node.arguments;
        if (arg && t.isStringLiteral(arg)) return;
        callExpr.replaceWith(
          t.callExpression(
            t.memberExpression(t.identifier("Promise"), t.identifier("reject")),
            [t.newExpression(t.identifier("Error"), [t.stringLiteral("dynamic import disabled")])]
          )
        );
      },
    },
  };
};
