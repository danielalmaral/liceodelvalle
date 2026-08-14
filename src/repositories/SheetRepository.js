function createSheetRepository(context) {
  return { context };
}

if (typeof module !== 'undefined') {
  module.exports = { createSheetRepository };
}
