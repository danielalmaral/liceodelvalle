function createConfigService(configRepository) {
  return {
    getValue(key) {
      if (!configRepository || typeof configRepository.get !== 'function') {
        throw new Error('ConfigRepository is required');
      }

      return configRepository.get(key);
    }
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createConfigService };
}
