function createEligibilityRules(configService) {
  return {
    evaluate() {
      throw new Error('Eligibility rules are defined in a later phase');
    },
    configService
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createEligibilityRules };
}
