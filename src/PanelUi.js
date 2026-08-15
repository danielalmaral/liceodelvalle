function getLdvPanelHtml() {
  return [
    '<!doctype html><html><head><base target="_top"><style>',
    'body{font-family:Arial,sans-serif;margin:0;color:#202124;background:#f8fafc}',
    'header{background:#0f766e;color:white;padding:14px 16px;font-weight:700}',
    'nav{display:flex;gap:6px;flex-wrap:wrap;padding:10px;background:white;border-bottom:1px solid #dde3ea}',
    'button{border:1px solid #b7c4d1;background:white;border-radius:6px;padding:7px 9px;cursor:pointer}',
    'button:disabled{opacity:.45;cursor:not-allowed}',
    'main{padding:12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.card{background:white;border:1px solid #dde3ea;border-radius:8px;padding:10px;min-height:52px}',
    'h2{font-size:16px;margin:8px 0}.muted{color:#5f6b7a;font-size:12px}.danger{color:#b42318}',
    '</style></head><body>',
    '<header>Liceo del Valle - Futbol</header>',
    '<nav>',
    '<button data-view="dashboard">Dashboard</button>',
    '<button data-view="attendance">Asistencia</button>',
    '<button data-view="matches">Partidos</button>',
    '<button data-view="convocations">Convocatorias</button>',
    '<button data-view="postmatch">Post Partido</button>',
    '<button data-view="alerts">Alertas</button>',
    '</nav>',
    '<main><h2>Dashboard</h2><section id="content" class="grid">',
    '<div class="card">Sesion actual/proxima<br><span class="muted" id="session-card">Cargando...</span></div>',
    '<div class="card">Pendientes de asistencia<br><span class="muted" id="attendance-card">Cargando...</span></div>',
    '<div class="card">Faltas por justificar<br><span class="muted" id="absence-card">Cargando...</span></div>',
    '<div class="card">Comunicaciones<br><span class="muted" id="communication-card">Cargando...</span></div>',
    '<div class="card">Convocatorias pendientes<br><span class="muted" id="convocation-card">Cargando...</span></div>',
    '<div class="card">Alertas deportivas<br><span class="muted" id="alert-card">Cargando...</span></div>',
    '</section><p class="muted">Panel operativo. Los cambios se ejecutan desde comandos del backend.</p></main>',
    '<script>',
    'function write(id,text){document.getElementById(id).textContent=text;}',
    'if (google&&google.script&&google.script.run){google.script.run.withSuccessHandler(function(r){var d=r&&r.data||{};write("session-card",(d.openSessions||[]).length+" abiertas");write("attendance-card",d.attendanceMissing||0);write("absence-card",d.pendingAbsences||0);write("communication-card",((d.communications||{}).pending||0)+" pendientes / "+((d.communications||{}).error||0)+" error");write("convocation-card",Object.keys(d.convocationStatusByMatch||{}).length);write("alert-card",(d.sportAlerts||[]).length);}).getPanelDashboard();}',
    '</script></body></html>'
  ].join('');
}

function showLdvPanel() {
  var html = HtmlService.createHtmlOutput(getLdvPanelHtml()).setTitle('Liceo del Valle - Futbol');
  SpreadsheetApp.getUi().showSidebar(html);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Liceo del Valle')
    .addItem('Abrir Panel', 'showLdvPanel')
    .addItem('Setup / Verificar estructura', 'setupLdvOperationalSheets')
    .addToUi();
}

function setupLdvOperationalSheets() {
  var runtime = createLdvAppsScriptRuntime();
  var spreadsheet = SpreadsheetApp.openById(runtime.runtime.spreadsheetId);
  return setupOperationalSheets(spreadsheet, setupSheetWithHeaders);
}

if (typeof module !== 'undefined') {
  module.exports = {
    getLdvPanelHtml,
    onOpen,
    setupLdvOperationalSheets,
    showLdvPanel
  };
}
