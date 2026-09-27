/** Obsidian controls have chainable .then(), which Promise resolution assimilates forever. */
export default {
  meta: { type: 'problem', schema: [], messages: { thenable: 'Do not return an Obsidian control from a Promise callback. Use a block with no return.' } },
  create(context) {
    const services = context.sourceCode.parserServices;
    if (!services?.program) return {};
    const checker = services.program.getTypeChecker();
    const check = (node, expression) => {
      const type = checker.getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(expression));
      const then = type.getProperty('then');
      if (then?.declarations?.some((d) => /(?:^|[/\\])obsidian[/\\]obsidian\.d\.ts$/.test(d.getSourceFile().fileName)))
        context.report({ node, messageId: 'thenable' });
    };
    return {
      'CallExpression[callee.type="MemberExpression"]'(node) {
        if (!['then', 'catch', 'finally'].includes(node.callee.property.name)) return;
        const receiver = checker.getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(node.callee.object));
        if (!receiver.getProperty('catch') || !receiver.getProperty('then')) return;
        for (const callback of node.arguments) {
          if (callback.type === 'ArrowFunctionExpression' && callback.body.type !== 'BlockStatement') check(callback.body, callback.body);
          else if (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression') {
            for (const statement of callback.body.body) if (statement.type === 'ReturnStatement' && statement.argument) check(statement, statement.argument);
          }
        }
      },
    };
  },
};
