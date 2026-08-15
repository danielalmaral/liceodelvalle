function createTriggerHandlers(dependencies) {
  var services = dependencies.services || {};
  var commands = dependencies.commands || {};
  var lock = dependencies.lock || { runExclusive: function(callback) { return callback(); } };

  function withLock(callback) {
    if (lock && typeof lock.runExclusive === 'function') {
      return lock.runExclusive(callback);
    }
    return callback();
  }

  function summarize(results) {
    var succeeded = 0;
    var failed = 0;

    results.forEach(function(result) {
      if (result && result.ok === false) {
        failed += 1;
      } else {
        succeeded += 1;
      }
    });

    return { processed: results.length, succeeded: succeeded, failed: failed };
  }

  function expirePendingAbsences(now) {
    if (commands.resolveExpiredAbsences) {
      var commandResults = commands.resolveExpiredAbsences(now) || [];
      return summarize(commandResults.map(function() { return { ok: true }; }));
    }

    return withLock(function() {
      var results = services.absenceResolutionService.resolveExpiredAbsences(now) || [];
      return summarize(results.map(function() { return { ok: true }; }));
    });
  }

  function sendPendingCommunications() {
    if (commands.sendPendingCommunications) {
      return summarize(commands.sendPendingCommunications() || []);
    }

    return withLock(function() {
      return summarize(services.communicationService.sendPendingCommunications() || []);
    });
  }

  return {
    expirePendingAbsences: expirePendingAbsences,
    sendPendingCommunications: sendPendingCommunications
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createTriggerHandlers };
}
