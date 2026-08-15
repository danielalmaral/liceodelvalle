function createAppsScriptEnvironmentAdapter(propertiesProvider) {
  function resolveProperties() {
    if (propertiesProvider && typeof propertiesProvider.getProperty === 'function') {
      return propertiesProvider;
    }

    if (typeof PropertiesService !== 'undefined' && PropertiesService && typeof PropertiesService.getScriptProperties === 'function') {
      return PropertiesService.getScriptProperties();
    }

    throw new Error('RUNTIME_PROPERTIES_REQUIRED');
  }

  function getProperty(name) {
    return resolveProperties().getProperty(name);
  }

  return {
    getExternalMailEnabled: function() {
      return String(getProperty('LDV_EXTERNAL_MAIL_ENABLED') || '').trim().toUpperCase() === 'TRUE';
    },
    getSpreadsheetId: function() {
      var spreadsheetId = String(getProperty('LDV_SPREADSHEET_ID') || '').trim();
      if (!spreadsheetId) {
        throw new Error('RUNTIME_SPREADSHEET_ID_REQUIRED');
      }
      return spreadsheetId;
    }
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createAppsScriptEnvironmentAdapter };
}
