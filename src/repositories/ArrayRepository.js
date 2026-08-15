function createArrayRepository(rows) {
  return {
    getAll: function() {
      return rows;
    },
    insert: function(record) {
      rows.push(record);
      return record;
    },
    setRows: function(nextRows) {
      rows = nextRows;
    },
    updateById: function(idField, id, nextRecord) {
      var index = rows.findIndex(function(record) {
        return record[idField] === id;
      });

      if (index === -1) {
        throw new Error('REPOSITORY_RECORD_NOT_FOUND: ' + id);
      }

      rows[index] = nextRecord;
      return nextRecord;
    }
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createArrayRepository };
}
