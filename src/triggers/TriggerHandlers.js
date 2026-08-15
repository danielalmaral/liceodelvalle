function createTriggerHandlers(dependencies) {
  var commands = dependencies.commands || {};

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
    if (!commands.resolveExpiredAbsences) {
      throw new Error('TRIGGER_COMMAND_REQUIRED: resolveExpiredAbsences');
    }

    var commandResults = commands.resolveExpiredAbsences(now) || [];
    return summarize(commandResults.map(function() { return { ok: true }; }));
  }

  function sendPendingCommunications() {
    if (!commands.sendPendingCommunications) {
      throw new Error('TRIGGER_COMMAND_REQUIRED: sendPendingCommunications');
    }

    return summarize(commands.sendPendingCommunications() || []);
  }

  return {
    expirePendingAbsences: expirePendingAbsences,
    sendPendingCommunications: sendPendingCommunications
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createTriggerHandlers };
}
