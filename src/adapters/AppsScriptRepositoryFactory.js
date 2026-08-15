function createAppsScriptRepositoryFactory(context) {
  context = context || {};
  var spreadsheetId = context.spreadsheetId;
  var spreadsheetProvider = context.spreadsheetProvider;
  var createSheetRepo = context.createSheetRepository || context.createRepository || (typeof createSheetRepository === 'function' ? createSheetRepository : null);
  var createConfigRepo = context.createConfigRepository || (typeof createConfigRepository === 'function' ? createConfigRepository : null);
  var headersByName = {
    CONFIG: CONFIG_HEADERS,
    ALUMNOS: STUDENT_HEADERS,
    TUTORES: TUTOR_HEADERS,
    SESIONES: SESSION_HEADERS,
    ASISTENCIAS: ATTENDANCE_HEADERS,
    PARTIDOS: MATCH_HEADERS,
    CONVOCATORIAS: CONVOCATION_HEADERS,
    CONVOCATORIA_DETALLE: CONVOCATION_DETAIL_HEADERS,
    PARTICIPACION_PARTIDO: PARTICIPATION_HEADERS,
    COMUNICACIONES: COMMUNICATION_HEADERS,
    BITACORA: AUDIT_HEADERS,
    PANEL: PANEL_HEADERS
  };

  function resolveSpreadsheet() {
    if (context.spreadsheet) {
      return context.spreadsheet;
    }

    if (spreadsheetProvider && typeof spreadsheetProvider.openById === 'function') {
      return spreadsheetProvider.openById(spreadsheetId);
    }

    if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp && typeof SpreadsheetApp.openById === 'function') {
      return SpreadsheetApp.openById(spreadsheetId);
    }

    throw new Error('RUNTIME_SPREADSHEET_PROVIDER_REQUIRED');
  }

  function createRepositoryFor(sheetName) {
    var sheet = resolveSpreadsheet().getSheetByName(sheetName);
    var headers = headersByName[sheetName];

    if (!headers) {
      throw new Error('SHEET_HEADERS_REQUIRED: ' + sheetName);
    }

    if (!sheet) {
      throw new Error('SHEET_REQUIRED: ' + sheetName);
    }

    if (typeof createSheetRepo !== 'function') {
      throw new Error('SHEET_REPOSITORY_FACTORY_REQUIRED');
    }

    var sheetRepository = createSheetRepo({ sheet: sheet, headers: headers });

    if (sheetName === 'CONFIG') {
      if (typeof createConfigRepo !== 'function') {
        throw new Error('CONFIG_REPOSITORY_FACTORY_REQUIRED');
      }

      return createConfigRepo({
        getRows: function() {
          return sheetRepository.getAll();
        }
      });
    }

    return sheetRepository;
  }

  return {
    createRepository: createRepositoryFor
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createAppsScriptRepositoryFactory };
}
