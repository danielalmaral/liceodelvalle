function createConfigRepository(source) {
  return {
    get(key) {
      if (!source || typeof source.get !== 'function') {
        throw new Error('Config source is required');
      }

      return source.get(key);
    }
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createConfigRepository };
}
