function getLdvPanelHtml() {
  var controllerSource = typeof createPanelClientController === 'function' ? createPanelClientController.toString() : '';
  var rendererSource = typeof createPanelRenderer === 'function' ? createPanelRenderer.toString() : '';
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
    rendererSource,
    'var currentView="dashboard";',
    'var panelState={};',
    'function esc(v){return String(v==null?"":v).replace(/[&<>]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c];});}',
    'function run(name,args,ok,fail){google.script.run.withSuccessHandler(ok).withFailureHandler(fail)[name].apply(google.script.run,args||[]);}',
    'function formObj(form){var o={};Array.prototype.forEach.call(form.elements||[],function(el){if(el.name)o[el.name]=el.value;});return o;}',
    'var renderer=null;',
    'var controller=createPanelClientController({callServer:run,state:panelState,render:{dashboard:function(d){renderer.render("dashboard",d);},referenceData:function(){if(currentView!=="dashboard")renderer.render(currentView);},attendance:function(d){renderer.render("attendance",d);},convocation:function(d){renderer.render("convocations",d);},postMatch:function(d){renderer.render("postmatch",d);},matchWrite:function(){controller.loadReferenceData(function(){controller.loadDashboard();renderer.render("matches");});},convocationWrite:function(d){controller.loadReferenceData(function(){if(d&&d.CONVOCATORIA_ID)controller.loadConvocation(d.CONVOCATORIA_ID);else renderer.render("convocations");});},communicationWrite:function(){controller.loadReferenceData(function(){renderer.render("convocations");});},participationWrite:function(){controller.loadPostMatch(panelState.selectedPlayedMatchId);},error:function(m){document.getElementById("panel-error").textContent=m;}}});',
    'renderer=createPanelRenderer({state:panelState,controller:controller,document:document});',
    'function load(view){currentView=view;document.getElementById("view-title").textContent=view; if(view==="dashboard"){controller.loadDashboard();controller.loadReferenceData();} else if(view==="attendance"){controller.loadReferenceData(function(){controller.loadAttendance();});} else if(view==="matches"){controller.loadReferenceData(function(){renderer.render("matches");});} else if(view==="convocations"){controller.loadReferenceData(function(){renderer.render("convocations");});} else if(view==="postmatch"){controller.loadReferenceData(function(){renderer.render("postmatch");var id=(panelState.referenceData.playedMatches||[])[0];if(id)controller.loadPostMatch(id.partidoId);});} else if(view==="alerts"){controller.loadDashboard();renderer.render("alerts");}}',
    'document.addEventListener("change",function(e){var t=e.target;if(t.id==="attendance-session")renderer.dispatch({type:"attendanceSessionChange",sessionId:t.value});if(t.id==="convocation-match")renderer.dispatch({type:"selectProgrammedMatch",matchId:t.value});if(t.id==="postmatch-match"){panelState.selectedPlayedMatchId=t.value;renderer.dispatch({type:"selectPlayedMatch",matchId:t.value});}if(t.getAttribute("data-action")==="convocation-selection"){var reason=document.querySelector(".convocation-reason[data-student-id=\\""+t.getAttribute("data-student-id")+"\\"]");renderer.dispatch({type:"setFinalSelection",convocationId:t.getAttribute("data-convocation-id"),studentId:t.getAttribute("data-student-id"),selected:t.checked,reason:reason&&reason.value});}if(t.getAttribute("data-action")==="convocation-position"){var reason2=document.querySelector(".convocation-reason[data-student-id=\\""+t.getAttribute("data-student-id")+"\\"]");renderer.dispatch({type:"assignPosition",convocationId:t.getAttribute("data-convocation-id"),studentId:t.getAttribute("data-student-id"),position:t.value,reason:reason2&&reason2.value});}});',
    'document.addEventListener("click",function(e){var t=e.target,a=t.getAttribute("data-action");if(!a)return;if(a==="mark-attendance")renderer.dispatch({type:"markAttendance",studentId:t.getAttribute("data-student-id"),state:t.getAttribute("data-state")});if(a==="resolve-absence"){var r=document.querySelector(".absence-reason[data-attendance-id=\\""+t.getAttribute("data-attendance-id")+"\\"]");renderer.dispatch({type:"resolveAbsence",attendanceId:t.getAttribute("data-attendance-id"),targetState:t.getAttribute("data-target-state"),reason:r&&r.value});}if(a==="match-cancel")renderer.dispatch({type:"cancelMatch",matchId:t.getAttribute("data-match-id")});if(a==="convocation-generate")renderer.dispatch({type:"generateConvocation",matchId:t.getAttribute("data-match-id")});if(a==="convocation-approve")renderer.dispatch({type:"approveConvocation",convocationId:t.getAttribute("data-convocation-id")});if(a==="communication-prepare")renderer.dispatch({type:"prepareCommunications",convocationId:t.getAttribute("data-convocation-id")});if(a==="communication-send")renderer.dispatch({type:"sendPendingCommunications"});if(a==="participation-save"){var row=t.parentNode.parentNode;renderer.dispatch({type:"saveParticipation",matchId:t.getAttribute("data-match-id"),studentId:t.getAttribute("data-student-id"),payload:formObj(row)});}});',
    'document.addEventListener("submit",function(e){var a=e.target.getAttribute("data-action");if(!a)return;e.preventDefault();if(a==="match-create")renderer.dispatch({type:"createMatch",payload:formObj(e.target)});if(a==="match-update")renderer.dispatch({type:"updateMatch",matchId:e.target.getAttribute("data-match-id"),payload:formObj(e.target)});if(a==="match-played")renderer.dispatch({type:"markMatchPlayed",matchId:e.target.getAttribute("data-match-id"),payload:formObj(e.target)});});',
    'document.querySelectorAll("button[data-view]").forEach(function(b){b.addEventListener("click",function(){load(b.getAttribute("data-view"));});});',
    'if (google&&google.script&&google.script.run){controller.loadDashboard();controller.loadReferenceData();}',
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
