function createRotationRules(configService) {
  return {
    evaluate() {
      throw new Error('Rotation rules are defined in a later phase');
    },
    configService
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createRotationRules };
}
