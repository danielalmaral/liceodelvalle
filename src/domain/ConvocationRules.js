function createConvocationRules(configService) {
  return {
    evaluate() {
      throw new Error('Convocation rules are defined in a later phase');
    },
    configService
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createConvocationRules };
}
