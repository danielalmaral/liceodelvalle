function createExternalMailGuardAdapter(environment, mailAdapter) {
  return {
    send: function(message) {
      if (!environment.getExternalMailEnabled()) {
        throw new Error('MAIL_EXTERNAL_DISABLED');
      }
      return mailAdapter.send(message);
    }
  };
}

function createRuntimeUtilsAdapter() {
  return {
    assertOneOf: assertOneOf,
    assertUnique: assertUnique,
    createDomainError: createDomainError,
    isValidEmail: isValidEmail,
    normalizeEmail: normalizeEmail,
    normalizeStrictBoolean: normalizeStrictBoolean,
    optionalText: optionalText,
    parseDateValue: parseDateValue,
    parseOptionalDateValue: parseOptionalDateValue,
    requireText: requireText
  };
}

function createLdvAppsScriptRuntime(dependencies) {
  dependencies = dependencies || {};
  var environment = dependencies.environment || createAppsScriptEnvironmentAdapter(dependencies.propertiesProvider);
  var spreadsheetId = environment.getSpreadsheetId();
  var repositoryFactory = dependencies.repositoryFactory || createAppsScriptRepositoryFactory({
    createRepository: dependencies.createRepository,
    spreadsheet: dependencies.spreadsheet,
    spreadsheetId: spreadsheetId,
    spreadsheetProvider: dependencies.spreadsheetProvider
  });
  var idGenerator = dependencies.idGenerator || createAppsScriptIdGenerator(dependencies.uuidProvider);
  var mailAdapter = dependencies.mailAdapter || createAppsScriptMailAdapter(dependencies.mailProvider);
  var protectedMailAdapter = dependencies.protectedMailAdapter || createExternalMailGuardAdapter(environment, mailAdapter);
  var runtimeFactory = dependencies.runtimeFactory || createAppsScriptRuntime;

  return runtimeFactory({
    constructors: dependencies.constructors,
    createRepository: repositoryFactory.createRepository,
    createTriggerHandlers: dependencies.createTriggerHandlers,
    environment: environment,
    idGenerator: idGenerator,
    lock: dependencies.lock || createAppsScriptLockAdapter(dependencies.lockProvider),
    mailAdapter: protectedMailAdapter,
    utils: dependencies.utils || createRuntimeUtilsAdapter()
  });
}

if (typeof module !== 'undefined') {
  module.exports = {
    createExternalMailGuardAdapter,
    createRuntimeUtilsAdapter,
    createLdvAppsScriptRuntime
  };
}
