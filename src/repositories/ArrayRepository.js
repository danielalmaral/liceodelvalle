function createArrayRepository(rows) {
  return {
    getAll: function() {
      return rows;
    },
    setRows: function(nextRows) {
      rows = nextRows;
    }
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createArrayRepository };
}
