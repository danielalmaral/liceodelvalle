function createAppsScriptRuntime(options) {
  var environment = options.environment || {};
  var factories = options.factories || {};
  var triggerFactory = options.createTriggerHandlers || createTriggerHandlers;
  var lock = options.lock || { runExclusive: function(callback) { return callback(); } };
  var spreadsheetId = environment.spreadsheetId || (typeof environment.getSpreadsheetId === 'function' ? environment.getSpreadsheetId() : '');
  var repositories = {};

  if (!spreadsheetId) {
    throw new Error('RUNTIME_SPREADSHEET_ID_REQUIRED');
  }

  if (typeof options.createRepository === 'function') {
    Object.keys(options.sheets || {}).forEach(function(name) {
      repositories[name] = options.createRepository(name, options.sheets[name]);
    });
  }

  function withLock(callback) {
    if (lock && typeof lock.runExclusive === 'function') {
      return lock.runExclusive(callback);
    }

    if (lock && typeof lock.withLock === 'function') {
      return lock.withLock(callback);
    }

    return callback();
  }

  var services = {};
  Object.keys(factories).forEach(function(name) {
    services[name] = factories[name]({ repositories: repositories, runtime: { spreadsheetId: spreadsheetId, withLock: withLock } });
  });

  return {
    repositories: repositories,
    runtime: { spreadsheetId: spreadsheetId, withLock: withLock },
    services: services,
    triggerHandlers: triggerFactory({ lock: { runExclusive: withLock }, services: services })
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createAppsScriptRuntime };
}
