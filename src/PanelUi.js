function getLdvPanelHtml() {
  var controllerSource = typeof createPanelClientController === 'function' ? createPanelClientController.toString() : '';
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
    '<main><h2 id="view-title">Dashboard</h2><section id="content" class="grid"></section><p id="panel-error" class="danger"></p></main>',
    '<script>',
    controllerSource,
    'var currentView="dashboard";',
    'var panelState={};',
    'function esc(v){return String(v==null?"":v).replace(/[&<>]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c];});}',
    'function card(t,v){return "<div class=card>"+esc(t)+"<br><span class=muted>"+esc(v)+"</span></div>";}',
    'function run(name,args,ok,fail){google.script.run.withSuccessHandler(ok).withFailureHandler(fail)[name].apply(google.script.run,args||[]);}',
    'function renderDashboard(d){if(!d)return;document.getElementById("content").className="grid";document.getElementById("content").innerHTML=card("Sesion actual/proxima",(d.currentSession&&d.currentSession.sesionId)||(d.nextSession&&d.nextSession.sesionId)||"") + card("Asistencias",(d.attendanceSummary||{}).captured+"/"+(d.attendanceSummary||{}).expected) + card("Faltas pendientes",d.pendingAbsences) + card("Proximo vencimiento",d.nextAbsenceDeadline||"") + card("Vencidas",d.expiredAbsences) + card("Comunicaciones",((d.communications||{}).pending||0)+" pendientes / "+((d.communications||{}).error||0)+" error / "+((d.communications||{}).uncertainDelivery||0)+" inciertas") + card("Alertas",(d.sportAlerts||[]).length);}',
    'function renderAttendance(d){if(!d)return;var rows=(d.rows||[]).map(function(r){var actions=r.estadoActual==="F"?"<button onclick=\\"resolveAbsence(\\\'"+r.attendanceId+"\\\',\\\'FJ\\\')\\">FJ</button><button onclick=\\"resolveAbsence(\\\'"+r.attendanceId+"\\\',\\\'LES\\\')\\">LES</button>":(r.capabilities&&r.capabilities.canMarkAttendance?"<button onclick=\\"markAttendance(\\\'"+r.studentId+"\\\',\\\'A\\\')\\">A</button><button onclick=\\"markAttendance(\\\'"+r.studentId+"\\\',\\\'R\\\')\\">R</button><button onclick=\\"markAttendance(\\\'"+r.studentId+"\\\',\\\'F\\\')\\">F</button>":"");return "<tr><td>"+esc(r.nombre)+"</td><td>"+esc(r.estadoActual)+"</td><td>"+actions+"</td></tr>";}).join("");document.getElementById("content").className="";document.getElementById("content").innerHTML="<table><tbody>"+rows+"</tbody></table>";}',
    'function renderSimple(title,html){document.getElementById("content").className="";document.getElementById("content").innerHTML=html||card(title,"Sin datos");}',
    'var controller=createPanelClientController({callServer:run,state:panelState,render:{dashboard:renderDashboard,attendance:renderAttendance,error:function(m){document.getElementById("panel-error").textContent=m;}}});',
    'function load(view){currentView=view;document.getElementById("view-title").textContent=view; if(view==="dashboard")controller.loadDashboard(); else if(view==="attendance")controller.loadReferenceData(function(){controller.loadAttendance();}); else if(view==="matches")renderSimple("Partidos","<button onclick=\\"controller.createMatch({})\\">Crear</button><button onclick=\\"controller.updateMatch(\\\'\\\',{})\\">Editar PROGRAMADO</button><button onclick=\\"controller.markMatchPlayed(\\\'\\\',{golesFavor:0,golesContra:0})\\">Marcar JUGADO</button><button onclick=\\"controller.cancelMatch(\\\'\\\')\\">Cancelar</button>"); else if(view==="convocations")renderSimple("Convocatorias","<button onclick=\\"controller.generateConvocation(\\\'\\\')\\">Generar propuesta</button><button>Seleccionar</button><button>Asignar posicion</button><label>motivo obligatorio</label><button>Aprobar</button><button>Preparar comunicaciones</button><button id=\\"send-pending\\" disabled>Enviar pendientes</button><span class=muted>PENDING e INELIGIBLE no seleccionables</span>"); else if(view==="postmatch")renderSimple("Post Partido","<button onclick=\\"controller.saveParticipation(\\\'\\\',\\\'\\\',{})\\">Guardar participacion</button><span class=muted>ASISTENCIA_ESTADO es lectura</span>"); else if(view==="alerts")renderSimple("Alertas","FI / RED_CARD_REVIEW_REQUIRED / LOW_PARTICIPATION_STREAK / communication ERROR / DELIVERY_ATTEMPT_IN_PROGRESS");}',
    'function markAttendance(studentId,estado){controller.markAttendance(panelState.selectedSessionId,studentId,estado);}',
    'function resolveAbsence(attendanceId,target){controller.resolveAbsence(attendanceId,target,"");}',
    'document.querySelectorAll("button[data-view]").forEach(function(b){b.addEventListener("click",function(){load(b.getAttribute("data-view"));});});',
    'if (google&&google.script&&google.script.run){load("dashboard");}',
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
  return setupLdvOperationalSheetsWithDependencies({
    environment: createAppsScriptEnvironmentAdapter(),
    spreadsheetProvider: SpreadsheetApp,
    setupFn: setupSheetWithHeaders
  });
}

function setupLdvOperationalSheetsWithDependencies(dependencies) {
  dependencies = dependencies || {};
  var environment = dependencies.environment || createAppsScriptEnvironmentAdapter(dependencies.propertiesProvider);
  var spreadsheetProvider = dependencies.spreadsheetProvider || (typeof SpreadsheetApp !== 'undefined' ? SpreadsheetApp : null);
  var spreadsheet = dependencies.spreadsheet || spreadsheetProvider.openById(environment.getSpreadsheetId());
  var setupFn = dependencies.setupFn || setupSheetWithHeaders;
  var setupCore = dependencies.setupOperationalSheets || setupOperationalSheets;
  return setupCore(spreadsheet, setupFn);
}

if (typeof module !== 'undefined') {
  module.exports = {
    getLdvPanelHtml,
    onOpen,
    setupLdvOperationalSheets,
    setupLdvOperationalSheetsWithDependencies,
    showLdvPanel
  };
}
