function createAppRenderer(dependencies) {
  dependencies = dependencies || {};
  var state = dependencies.state || {};
  var controller = dependencies.controller || {};
  var doc = dependencies.document || null;

  var routes = [
    ['dashboard', 'Panel Principal', 'Vista operativa del dia deportivo'],
    ['students', 'Alumnos', 'Consulta la plantilla deportiva y su clasificacion actual'],
    ['attendance', 'Asistencias', 'Registra y da seguimiento a la asistencia deportiva'],
    ['convocations', 'Convocatorias', 'Gestiona, revisa y prepara convocatorias a partidos'],
    ['matches', 'Partidos', 'Gestiona calendario, marcador y estado de partidos'],
    ['postmatch', 'Post Partido', 'Captura participacion desde asistencia canonica'],
    ['reports', 'Reportes', 'Consulta rendimiento y alertas operativas'],
    ['communications', 'Comunicaciones', 'Monitorea envios operativos seguros'],
    ['config', 'Configuracion', 'Configuracion operativa solo lectura durante el piloto']
  ];

  function esc(value) {
    return String(value === undefined || value === null ? '' : value).replace(/[&<>"]/g, function(character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[character];
    });
  }

  function valueOrDash(value) {
    return value === undefined || value === null || value === '' ? '-' : value;
  }

  function pairOrDash(left, right) {
    return valueOrDash(left) + ' / ' + valueOrDash(right);
  }

  function selectedCompetition() {
    return state.selectedCompetition || 'ALL';
  }

  function competitionMatches(value) {
    var selected = selectedCompetition();
    return selected === 'ALL' || value === selected || value === 'GENERAL';
  }

  function routeMeta(routeName) {
    return routes.filter(function(route) { return route[0] === routeName; })[0] || routes[0];
  }

  function renderNavigation() {
    return routes.map(function(route) {
      var active = state.activeRoute === route[0] ? ' is-active' : '';
      return '<button class="app-nav__item' + active + '" data-route="' + esc(route[0]) + '" aria-current="' + (active ? 'page' : 'false') + '">' +
        '<span class="app-nav__icon" aria-hidden="true"></span><span>' + esc(route[1]) + '</span></button>';
    }).join('');
  }

  function badge(value, tone) {
    return '<span class="badge badge--' + esc(tone || String(value || '').toLowerCase()) + '">' + esc(valueOrDash(value)) + '</span>';
  }

  function kpi(label, value, note, tone) {
    return '<article class="kpi kpi--' + esc(tone || 'neutral') + '"><p>' + esc(label) + '</p><strong>' + esc(valueOrDash(value)) + '</strong><span>' + esc(valueOrDash(note)) + '</span></article>';
  }

  function filteredStudents() {
    var students = state.students || [];
    var filters = state.studentFilters || {};
    var globalCompetition = state.selectedCompetition || 'ALL';
    return students.filter(function(student) {
      var fullName = [student.nombre, student.apellidos].join(' ').toLowerCase();
      if (globalCompetition !== 'ALL' && student.competenciaBase !== globalCompetition) return false;
      if (filters.search && fullName.indexOf(String(filters.search).toLowerCase()) === -1) return false;
      if (filters.competition && filters.competition !== 'ALL' && student.competenciaBase !== filters.competition) return false;
      if (filters.level && filters.level !== 'ALL' && student.nivel !== filters.level) return false;
      if (filters.position && filters.position !== 'ALL' && student.posicionPrincipal !== filters.position && student.posicionSecundaria !== filters.position) return false;
      if (filters.sportsState && filters.sportsState !== 'ALL' && student.estadoDeportivo !== filters.sportsState) return false;
      return true;
    });
  }

  function renderDashboard() {
    var dashboard = state.dashboard || {};
    var students = state.students || [];
    var activeStudents = students.filter(function(student) { return student.active === true; }).length;
    var alerts = (dashboard.sportAlerts || []).concat(dashboard.readinessIssues || []);
    return '<section class="screen dashboard-screen">' +
      '<div class="kpi-grid">' +
      kpi('Sesion actual / proxima', (dashboard.currentSession && dashboard.currentSession.sesionId) || (dashboard.nextSession && dashboard.nextSession.sesionId), 'Agenda') +
      kpi('Asistencia', pairOrDash((dashboard.attendanceSummary || {}).captured, (dashboard.attendanceSummary || {}).expected), 'capturados / esperados', 'success') +
      kpi('Faltas pendientes', dashboard.pendingAbsences, 'por resolver', 'danger') +
      kpi('Proximo partido A', dashboard.nextMatchA && dashboard.nextMatchA.rival, dashboard.nextMatchA && dashboard.nextMatchA.fecha) +
      kpi('Proximo partido B', dashboard.nextMatchB && dashboard.nextMatchB.rival, dashboard.nextMatchB && dashboard.nextMatchB.fecha) +
      kpi('Convocatorias pendientes', (dashboard.convocationProposals || []).length, 'propuestas') +
      kpi('Comunicaciones pendientes', (dashboard.communications || {}).pending, 'salida controlada') +
      kpi('Alumnos activos', activeStudents, 'plantilla') +
      '</div>' +
      '<div class="section-grid">' +
      '<section class="panel"><h3>Proximos partidos</h3>' + renderMatchList((dashboard.upcomingMatches || []).filter(function(match) { return competitionMatches(match.competencia); })) + '</section>' +
      '<section class="panel"><h3>Acciones rapidas</h3><div class="quick-actions"><button data-route="attendance">Tomar asistencia</button><button data-route="convocations">Ver convocatorias</button><button data-route="matches">Ver partidos</button></div></section>' +
      '<section class="panel panel--wide"><h3>Alertas</h3>' + (alerts.length ? '<ul class="alert-list">' + alerts.map(function(alert) { return '<li>' + esc(alert.code || alert) + '</li>'; }).join('') + '</ul>' : emptyState('Sin alertas operativas')) + '</section>' +
      '</div></section>';
  }

  function renderMatchList(matches) {
    if (!matches.length) return emptyState('Sin partidos programados');
    return '<div class="match-list">' + matches.map(function(match) {
      return '<article class="match-row"><strong>' + esc(match.rival) + '</strong><span>' + esc([match.competencia, match.fecha, match.horaPartido, match.sede].filter(Boolean).join(' | ')) + '</span></article>';
    }).join('') + '</div>';
  }

  function renderStudents() {
    var rows = filteredStudents();
    var active = (state.students || []).filter(function(student) { return student.active === true; });
    function count(predicate) { return active.filter(predicate).length; }
    return '<section class="screen students-screen">' +
      '<div class="kpi-grid kpi-grid--compact">' +
      kpi('Total activos', active.length) + kpi('Liga A', count(function(s) { return s.competenciaBase === 'A'; })) + kpi('Liga B', count(function(s) { return s.competenciaBase === 'B'; })) +
      kpi('A1', count(function(s) { return s.nivel === 'A1'; })) + kpi('A2', count(function(s) { return s.nivel === 'A2'; })) + kpi('B1', count(function(s) { return s.nivel === 'B1'; })) + kpi('B2', count(function(s) { return s.nivel === 'B2'; })) +
      '</div>' + renderStudentFilters() + renderStudentsTable(rows) + '</section>';
  }

  function select(name, values, selected) {
    return '<select data-filter="' + esc(name) + '">' + values.map(function(item) {
      return '<option value="' + esc(item[0]) + '"' + (item[0] === selected ? ' selected' : '') + '>' + esc(item[1]) + '</option>';
    }).join('') + '</select>';
  }

  function optionTags(values, selected) {
    return values.map(function(item) {
      return '<option value="' + esc(item[0]) + '"' + (String(item[0]) === String(selected) ? ' selected' : '') + '>' + esc(item[1]) + '</option>';
    }).join('');
  }

  function renderStudentFilters() {
    var filters = state.studentFilters || {};
    return '<div class="filters"><input data-filter="search" placeholder="Buscar alumno" value="' + esc(filters.search || '') + '">' +
      select('competition', [['ALL', 'Todas'], ['A', 'Liga A'], ['B', 'Liga B']], filters.competition || 'ALL') +
      select('level', [['ALL', 'Nivel'], ['A1', 'A1'], ['A2', 'A2'], ['B1', 'B1'], ['B2', 'B2']], filters.level || 'ALL') +
      select('position', [['ALL', 'Posicion'], ['PO', 'PO'], ['DEF', 'DEF'], ['MED', 'MED'], ['DEL', 'DEL']], filters.position || 'ALL') +
      select('sportsState', [['ALL', 'Estado deportivo'], ['ACTIVO', 'ACTIVO'], ['LESIONADO', 'LESIONADO'], ['SUSPENDIDO', 'SUSPENDIDO']], filters.sportsState || 'ALL') + '</div>';
  }

  function renderStudentsTable(rows) {
    if (!rows.length) return emptyState('Sin alumnos para los filtros actuales');
    return '<div class="table-wrap"><table id="app-students-table"><thead><tr><th>Alumno</th><th>Grado / Grupo</th><th>Competencia</th><th>Nivel</th><th>Posicion principal</th><th>Posicion secundaria</th><th>Estado deportivo</th></tr></thead><tbody>' +
      rows.map(function(student) {
        return '<tr><td>' + esc([student.nombre, student.apellidos].join(' ').trim()) + '</td><td>' + esc([student.grado, student.grupo].filter(Boolean).join(' / ')) + '</td><td>' + badge(student.competenciaBase, 'competition') + '</td><td>' + badge(student.nivel, 'level') + '</td><td>' + esc(student.posicionPrincipal) + '</td><td>' + esc(valueOrDash(student.posicionSecundaria)) + '</td><td>' + badge(student.estadoDeportivo || (student.active ? 'ACTIVO' : 'INACTIVO'), 'state') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function selectedSessionId() {
    var sessions = ((state.referenceData && state.referenceData.openSessions) || []).filter(function(session) { return competitionMatches(session.competencia); });
    return state.selectedSessionId || (state.attendance && state.attendance.sessionId) || (sessions[0] && sessions[0].sesionId) || '';
  }

  function renderAttendance() {
    var view = state.attendance || { rows: [] };
    var selected = state.selectedSessionId || '';
    var viewSessionId = view.sessionId || (view.session && view.session.sesionId) || '';
    var consistent = !!selected && !!viewSessionId && viewSessionId === selected;
    var session = consistent ? (view.session || {}) : {};
    var rows = consistent ? (view.rows || []) : [];
    var registered = rows.filter(function(row) { return row.estadoActual; }).length;
    var pending = rows.filter(function(row) { return !row.estadoActual; }).length;
    var pendingAbsence = rows.filter(function(row) { return row.pendienteJustificar; }).length;
    return '<section class="screen attendance-screen">' +
      '<div class="toolbar">' + renderSessionSelector() + '<div class="session-meta">' + esc([session.tipo, session.fecha, session.horaInicio, session.competencia, session.estado].filter(Boolean).join(' | ')) + '</div></div>' +
      '<div class="kpi-grid kpi-grid--compact">' + kpi('Registrados', registered) + kpi('Esperados', rows.length) + kpi('Pendientes', pending) + kpi('Faltas pendientes de justificar', pendingAbsence, '', 'danger') + '</div>' +
      renderAttendanceTable(rows) + '</section>';
  }

  function renderSessionSelector() {
    var selected = selectedSessionId();
    var sessions = ((state.referenceData && state.referenceData.openSessions) || []).filter(function(session) { return competitionMatches(session.competencia); });
    if (!sessions.length) return emptyState('Sin sesiones abiertas');
    return '<select id="app-attendance-session">' + sessions.map(function(session) {
      return '<option value="' + esc(session.sesionId) + '"' + (session.sesionId === selected ? ' selected' : '') + '>' + esc([session.sesionId, session.competencia, session.fecha].filter(Boolean).join(' | ')) + '</option>';
    }).join('') + '</select>';
  }

  function renderAttendanceTable(rows) {
    if (!rows.length) return emptyState('Sin alumnos esperados para la sesion');
    return '<div class="table-wrap"><table id="app-attendance-table"><thead><tr><th>Alumno</th><th>Grupo</th><th>Competencia</th><th>Estado</th><th>Registro</th><th>Limite de justificacion</th><th>Acciones</th></tr></thead><tbody>' +
      rows.map(function(row) {
        return '<tr><td>' + esc(row.nombre) + '</td><td>' + esc(row.grupo) + '</td><td>' + badge(row.competencia, 'competition') + '</td><td>' + badge(row.estadoActual || 'Pendiente', row.estadoActual || 'pending') + '</td><td>' + esc(valueOrDash(row.registradoEn)) + '</td><td>' + esc(valueOrDash(row.limiteJustificacion)) + '</td><td>' + renderAttendanceActions(row) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function renderAttendanceActions(row) {
    if (row.estadoActual === 'F' && row.capabilities && row.capabilities.canResolveAbsence) {
      return '<input class="absence-reason" data-attendance-id="' + esc(row.attendanceId) + '" placeholder="Motivo"><button data-action="resolve-absence" data-target-state="FJ" data-attendance-id="' + esc(row.attendanceId) + '">Justificar</button><button data-action="resolve-absence" data-target-state="LES" data-attendance-id="' + esc(row.attendanceId) + '">Lesion</button>';
    }
    if (row.capabilities && row.capabilities.canMarkAttendance) {
      return '<button data-action="mark-attendance" data-state="A" data-student-id="' + esc(row.studentId) + '">Asistencia</button><button data-action="mark-attendance" data-state="R" data-student-id="' + esc(row.studentId) + '">Retardo</button><button data-action="mark-attendance" data-state="F" data-student-id="' + esc(row.studentId) + '">Falta</button>';
    }
    return '<span class="muted">Sin acciones</span>';
  }

  function convocationId(item) {
    return item && (item.CONVOCATORIA_ID || item.convocationId);
  }

  function convocationMatchId(item) {
    return item && (item.PARTIDO_ID || item.partidoId || item.matchId);
  }

  function findConvocationForMatch(matchId) {
    var reference = state.referenceData || {};
    var all = (reference.authoritativeConvocations || []).concat(reference.convocationProposals || []);
    return all.filter(function(item) { return convocationMatchId(item) === matchId; })[0] || null;
  }

  function selectedMatchId() {
    var matches = programmedMatches();
    return state.selectedProgrammedMatchId || (matches[0] && matches[0].partidoId) || '';
  }

  function selectedMatch() {
    var id = selectedMatchId();
    return programmedMatches().filter(function(match) { return match.partidoId === id; })[0] || null;
  }

  function programmedMatches() {
    return ((state.referenceData && state.referenceData.programmedMatches) || []).filter(function(match) {
      return competitionMatches(match.competencia);
    });
  }

  function activeConvocationRecord() {
    var match = selectedMatch();
    return match ? findConvocationForMatch(match.partidoId) : null;
  }

  function convocationStatus() {
    return (activeConvocationRecord() && activeConvocationRecord().ESTADO) || 'SIN_PROPUESTA';
  }

  function isAuthoritativeStatus(status) {
    return status === 'APROBADA' || status === 'ENVIADA' || status === 'CERRADA';
  }

  function renderConvocations() {
    var match = selectedMatch();
    var existing = activeConvocationRecord();
    var status = (existing && existing.ESTADO) || 'SIN_PROPUESTA';
    var convocation = state.convocation || { details: [] };
    var canonicalConvocationId = convocationId(existing) || '';
    var loadedConvocationId = convocation.convocationId || '';
    var consistent = !!canonicalConvocationId && !!loadedConvocationId && canonicalConvocationId === loadedConvocationId;
    var activeConvocationId = consistent && loadedConvocationId ? loadedConvocationId : '';
    var allDetails = consistent && activeConvocationId ? (convocation.details || []) : [];
    var details = filteredConvocationDetails(allDetails);
    var selected = allDetails.filter(function(row) { return row.seleccionadoFinal === true; });
    var target = existing && existing.TOTAL_OBJETIVO !== undefined ? existing.TOTAL_OBJETIVO : valueOrDash(existing && existing.totalObjetivo);
    var eligible = allDetails.filter(function(row) { return row.ELEGIBILITY_STATUS === 'ELIGIBLE'; }).length;
    var rotation = allDetails.filter(function(row) { return row.prioridadRotacion === true; }).length;
    return '<section class="screen convocation-screen">' +
      '<div class="toolbar">' + renderMatchSelector() + '<button class="primary" data-action="convocation-generate" data-match-id="' + esc(match && match.partidoId) + '"' + (!match || existing || state.convocationGeneratePending ? ' disabled' : '') + '>Nueva / Generar propuesta</button></div>' +
      '<div class="kpi-grid kpi-grid--five">' +
      kpi('Proximo partido', match && match.rival, match && [match.fecha, match.horaPartido, match.sede].filter(Boolean).join(' | ')) +
      kpi('Jugadores elegibles', eligible + ' / ' + allDetails.length, 'evaluados') +
      kpi('Prioridad de rotacion', rotation, 'jugadores') +
      kpi('Cobertura de posiciones', positionCoverage(allDetails, existing), 'snapshots') +
      kpi('Convocatoria', selected.length + ' / ' + valueOrDash(target), 'seleccionados') +
      '</div>' + renderStepper(status) +
      '<div class="convocation-layout"><main class="convocation-main">' + renderConvocationFilters() + renderConvocationTable(details, activeConvocationId) + '</main><aside class="side-panel">' + renderMatchSummary(match) + renderConvocationActions(activeConvocationId) + '</aside></div></section>';
  }

  function renderMatchSelector() {
    var selected = selectedMatchId();
    var matches = programmedMatches();
    if (!matches.length) return emptyState('Sin partidos programados');
    return '<select id="app-convocation-match">' + matches.map(function(match) {
      return '<option value="' + esc(match.partidoId) + '"' + (match.partidoId === selected ? ' selected' : '') + '>' + esc([match.competencia, match.rival, match.fecha].filter(Boolean).join(' | ')) + '</option>';
    }).join('') + '</select>';
  }

  function positionCoverage(details, existing) {
    var minima = {
      PO: existing && existing.MIN_PORTEROS_SNAPSHOT,
      DEF: existing && existing.MIN_DEFENSAS_SNAPSHOT,
      MED: existing && existing.MIN_MEDIOS_SNAPSHOT,
      DEL: existing && existing.MIN_DELANTEROS_SNAPSHOT
    };
    var coverage = {};
    details.filter(function(row) { return row.seleccionadoFinal === true; }).forEach(function(row) {
      var position = row.posicionAsignada || row.posicionPrincipal;
      if (position) coverage[position] = (coverage[position] || 0) + 1;
    });
    if (['PO', 'DEF', 'MED', 'DEL'].every(function(position) { return minima[position] === undefined || minima[position] === null || minima[position] === ''; })) {
      return '-';
    }
    return ['PO', 'DEF', 'MED', 'DEL'].map(function(position) {
      return position + ' ' + (coverage[position] || 0) + '/' + valueOrDash(minima[position]);
    }).join(' | ');
  }

  function stepClass(index, status) {
    var doneUntil = 0;
    var active = 1;
    if (status === 'BORRADOR' || status === 'PROPUESTA') { doneUntil = 1; active = 2; }
    if (status === 'APROBADA') { doneUntil = 3; active = 4; }
    if (status === 'ENVIADA') { doneUntil = 4; active = 5; }
    if (status === 'CERRADA') { doneUntil = 5; active = 0; }
    if (index <= doneUntil) return 'is-done';
    if (index === active) return 'is-active';
    return '';
  }

  function renderStepper(status) {
    var steps = ['Propuesta generada', 'Revision del entrenador', 'Convocatoria aprobada', 'Comunicaciones', 'Partido'];
    return '<ol class="stepper">' + steps.map(function(label, index) {
      return '<li class="' + stepClass(index + 1, status || 'SIN_PROPUESTA') + '">' + esc(label) + '</li>';
    }).join('') + '</ol>';
  }

  function renderConvocationFilters() {
    var filters = state.convocationFilters || {};
    return '<div class="filters"><input data-convocation-filter="search" placeholder="Buscar jugador" value="' + esc(filters.search || '') + '">' +
      convocationSelect('selected', [['ALL', 'Seleccionados / Todos'], ['SELECTED', 'Seleccionados']], filters.selected || 'ALL') +
      convocationSelect('position', [['ALL', 'Posicion'], ['PO', 'PO'], ['DEF', 'DEF'], ['MED', 'MED'], ['DEL', 'DEL']], filters.position || 'ALL') +
      convocationSelect('priority', [['ALL', 'Prioridad'], ['YES', 'PRIORIDAD']], filters.priority || 'ALL') +
      convocationSelect('eligibility', [['ALL', 'Elegibilidad'], ['ELIGIBLE', 'Elegible'], ['INELIGIBLE', 'No elegible'], ['PENDING', 'Pendiente']], filters.eligibility || 'ALL') +
      convocationSelect('level', [['ALL', 'Nivel'], ['A1', 'A1'], ['A2', 'A2'], ['B1', 'B1'], ['B2', 'B2']], filters.level || 'ALL') + '</div>';
  }

  function convocationSelect(name, values, selected) {
    return '<select data-convocation-filter="' + esc(name) + '">' + values.map(function(item) {
      return '<option value="' + esc(item[0]) + '"' + (item[0] === selected ? ' selected' : '') + '>' + esc(item[1]) + '</option>';
    }).join('') + '</select>';
  }

  function filteredConvocationDetails(details) {
    var filters = state.convocationFilters || {};
    return details.filter(function(row) {
      var name = String(row.nombre || '').toLowerCase();
      if (filters.search && name.indexOf(String(filters.search).toLowerCase()) === -1) return false;
      if (filters.selected === 'SELECTED' && row.seleccionadoFinal !== true) return false;
      if (filters.position && filters.position !== 'ALL' && row.posicionPrincipal !== filters.position && row.posicionSecundaria !== filters.position && row.posicionAsignada !== filters.position) return false;
      if (filters.priority === 'YES' && row.prioridadRotacion !== true) return false;
      if (filters.eligibility && filters.eligibility !== 'ALL' && row.ELEGIBILITY_STATUS !== filters.eligibility) return false;
      if (filters.level && filters.level !== 'ALL' && row.nivel !== filters.level) return false;
      return true;
    });
  }

  function renderConvocationTable(details, activeConvocationId) {
    if (!details.length) return emptyState('Selecciona un partido con propuesta existente o genera una propuesta cuando corresponda');
    var readonly = isAuthoritativeStatus(convocationStatus());
    return '<div class="table-wrap"><table id="app-convocation-table"><thead><tr><th>Jugador</th><th>Nivel</th><th>Posicion</th><th>Rotacion</th><th>Asistencia</th><th>Elegibilidad</th><th>Seleccion</th><th>Posicion asignada</th><th>Motivo</th></tr></thead><tbody>' +
      details.map(function(row) {
        var disabled = readonly || row.ELEGIBILITY_STATUS === 'PENDING' || row.ELEGIBILITY_STATUS === 'INELIGIBLE';
        var positions = [row.posicionPrincipal, row.posicionSecundaria].filter(Boolean);
        return '<tr><td>' + esc(row.nombre) + '</td><td>' + badge(row.nivel, 'level') + '</td><td>' + esc([row.posicionPrincipal, row.posicionSecundaria].filter(Boolean).join(' / ')) + '</td><td>' + (row.prioridadRotacion ? badge('PRIORIDAD', 'warning') + ' ' : '') + esc(valueOrDash(row.rotacionAntes)) + '</td><td>' + esc(valueOrDash(row.puntajeAsistencia)) + '</td><td>' + badge(eligibilityLabel(row.ELEGIBILITY_STATUS), 'eligibility') + (row.MOTIVO_NO_ELEGIBLE ? '<span class="muted">' + esc(row.MOTIVO_NO_ELEGIBLE) + '</span>' : '') + '</td><td><input type="checkbox" data-action="convocation-selection" data-convocation-id="' + esc(activeConvocationId) + '" data-student-id="' + esc(row.ALUMNO_ID) + '"' + (row.seleccionadoFinal ? ' checked' : '') + (disabled ? ' disabled' : '') + '></td><td><select data-action="convocation-position" data-convocation-id="' + esc(activeConvocationId) + '" data-student-id="' + esc(row.ALUMNO_ID) + '"' + (disabled ? ' disabled' : '') + '>' + positions.map(function(position) { return '<option value="' + esc(position) + '"' + (position === row.posicionAsignada ? ' selected' : '') + '>' + esc(position) + '</option>'; }).join('') + '</select></td><td><input class="convocation-reason" data-student-id="' + esc(row.ALUMNO_ID) + '" placeholder="Motivo" value="' + esc(row.motivoCambio || '') + '"' + (readonly ? ' disabled' : '') + '></td></tr>';
      }).join('') + '</tbody></table></div><p class="legend">A1 A2 B1 B2</p>';
  }

  function eligibilityLabel(value) {
    if (value === 'ELIGIBLE') return 'Elegible';
    if (value === 'INELIGIBLE') return 'No elegible';
    if (value === 'PENDING') return 'Pendiente';
    return valueOrDash(value);
  }

  function renderMatchSummary(match) {
    if (!match) return '<section class="panel"><h3>Resumen del partido</h3>' + emptyState('Sin partido seleccionado') + '</section>';
    var fields = [['Fecha', match.fecha], ['Hora de citacion', match.horaCitacion], ['Hora del partido', match.horaPartido], ['Rival', match.rival], ['Sede', match.sede], ['Competencia', match.competencia], ['Local / visitante', match.localVisitante], ['Uniforme', match.uniforme], ['Indicaciones', match.indicaciones]];
    return '<section class="panel"><h3>Resumen del partido</h3><dl>' + fields.map(function(field) { return '<dt>' + esc(field[0]) + '</dt><dd>' + esc(valueOrDash(field[1])) + '</dd>'; }).join('') + '</dl></section>';
  }

  function renderConvocationActions(activeConvocationId) {
    var capabilities = (state.referenceData && state.referenceData.runtimeCapabilities) || {};
    var status = convocationStatus();
    var canApprove = activeConvocationId && (status === 'PROPUESTA' || status === 'BORRADOR');
    var canPrepare = activeConvocationId && status === 'APROBADA';
    var canSend = activeConvocationId && capabilities.externalMailEnabled === true && (status === 'APROBADA' || status === 'ENVIADA');
    return '<section class="panel"><h3>Acciones</h3><label>Aprobado por<input id="app-approval-actor" autocomplete="off"' + (canApprove ? '' : ' disabled') + '></label><button class="primary" data-action="convocation-approve" data-convocation-id="' + esc(activeConvocationId || '') + '"' + (canApprove ? '' : ' disabled') + '>Aprobar convocatoria</button><button data-action="communication-prepare" data-convocation-id="' + esc(activeConvocationId || '') + '"' + (canPrepare ? '' : ' disabled') + '>Preparar comunicaciones</button><button data-action="communication-send" ' + (canSend ? '' : 'disabled') + '>Enviar pendientes</button></section>';
  }

  function appMatches() {
    return (state.matches || []).filter(function(match) {
      return competitionMatches(match.competencia);
    });
  }

  function filteredMatches() {
    var filters = state.matchFilters || {};
    return appMatches().filter(function(match) {
      var search = String(filters.search || '').toLowerCase();
      if (filters.competition && filters.competition !== 'ALL' && match.competencia !== filters.competition) return false;
      if (filters.status && filters.status !== 'ALL' && match.estado !== filters.status) return false;
      if (search && [match.rival, match.sede, match.jornada].join(' ').toLowerCase().indexOf(search) === -1) return false;
      return true;
    });
  }

  function renderMatches() {
    var matches = filteredMatches();
    var all = appMatches();
    var programmed = all.filter(function(match) { return match.estado === 'PROGRAMADO'; });
    var played = all.filter(function(match) { return match.estado === 'JUGADO'; });
    var cancelled = all.filter(function(match) { return match.estado === 'CANCELADO'; });
    return '<section class="screen matches-screen">' +
      '<div class="kpi-grid kpi-grid--five">' +
      kpi('Programados', programmed.length) + kpi('Jugados', played.length) + kpi('Cancelados', cancelled.length) +
      kpi('Proximo partido A', nextMatchLabel(programmed, 'A')) + kpi('Proximo partido B', nextMatchLabel(programmed, 'B')) +
      '</div>' + renderMatchFilters() + renderMatchCreateForm() + renderMatchesTable(matches) + '</section>';
  }

  function nextMatchLabel(matches, competition) {
    var match = matches.filter(function(item) { return item.competencia === competition; })[0] || null;
    return match ? [match.rival, match.fecha].filter(Boolean).join(' | ') : '-';
  }

  function renderMatchFilters() {
    var filters = state.matchFilters || {};
    return '<div class="filters"><input data-match-filter="search" placeholder="Buscar rival, sede o jornada" value="' + esc(filters.search || '') + '">' +
      select('competition', [['ALL', 'Todas'], ['A', 'Liga A'], ['B', 'Liga B']], filters.competition || 'ALL').replace(/data-filter=/g, 'data-match-filter=') +
      '<select data-match-filter="status">' + optionTags([['ALL', 'Todos'], ['PROGRAMADO', 'Programado'], ['JUGADO', 'Jugado'], ['CANCELADO', 'Cancelado']], filters.status || 'ALL') + '</select></div>';
  }

  function renderMatchCreateForm() {
    var selected = selectedCompetition();
    var preset = selected === 'A' || selected === 'B' ? selected : '';
    return '<section class="panel"><h3>Nuevo partido</h3><div class="form-grid match-form" data-form="match-create">' +
      '<label>Competencia<select name="COMPETENCIA">' + optionTags([['', 'Seleccionar'], ['A', 'Liga A'], ['B', 'Liga B']], preset) + '</select></label>' +
      '<label>Jornada<input name="JORNADA"></label><label>Rival<input name="RIVAL"></label><label>Fecha<input name="FECHA" type="date"></label>' +
      '<label>Hora de citacion<input name="HORA_CITACION" type="time"></label><label>Hora del partido<input name="HORA_PARTIDO" type="time"></label>' +
      '<label>Sede<input name="SEDE"></label><label>Local / Visitante<select name="LOCAL_VISITANTE">' + optionTags([['', 'Seleccionar'], ['LOCAL', 'Local'], ['VISITANTE', 'Visitante']], '') + '</select></label>' +
      '<label>Duracion en minutos<input name="DURACION_MINUTOS" type="number" min="1"></label><label>Uniforme<input name="UNIFORME"></label>' +
      '<label>Indicaciones<input name="INDICACIONES"></label><label>Observaciones<input name="OBSERVACIONES"></label>' +
      '<button class="primary" data-action="match-create"' + (state.matchWritePending ? ' disabled' : '') + '>Crear partido</button></div></section>';
  }

  function renderMatchesTable(matches) {
    if (!matches.length) return emptyState('Sin partidos');
    return '<div class="table-wrap"><table id="app-matches-table"><thead><tr><th>Competencia</th><th>Jornada</th><th>Rival</th><th>Fecha</th><th>Hora</th><th>Sede</th><th>Local/Visitante</th><th>Estado</th><th>Marcador</th><th>Acciones</th></tr></thead><tbody>' +
      matches.map(function(match) {
        return '<tr><td>' + badge(match.competencia, 'competition') + '</td><td>' + esc(valueOrDash(match.jornada)) + '</td><td>' + esc(valueOrDash(match.rival)) + '</td><td>' + esc(valueOrDash(match.fecha)) + '</td><td>' + esc(valueOrDash(match.horaPartido)) + '</td><td>' + esc(valueOrDash(match.sede)) + '</td><td>' + esc(valueOrDash(match.localVisitante)) + '</td><td>' + badge(statusLabel(match.estado), 'state') + '</td><td>' + esc(scoreLabel(match)) + '</td><td>' + renderMatchActions(match) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function statusLabel(status) {
    if (status === 'PROGRAMADO') return 'Programado';
    if (status === 'JUGADO') return 'Jugado';
    if (status === 'CANCELADO') return 'Cancelado';
    return valueOrDash(status);
  }

  function scoreLabel(match) {
    return match.estado === 'JUGADO' ? valueOrDash(match.golesFavor) + ' - ' + valueOrDash(match.golesContra) : '-';
  }

  function renderMatchActions(match) {
    if (match.estado !== 'PROGRAMADO') return '<span class="muted">Solo lectura</span>';
    return '<button data-action="match-update" data-match-id="' + esc(match.partidoId) + '">Editar</button> <input class="score-input" data-score-for="' + esc(match.partidoId) + '" type="number" min="0" placeholder="GF"><input class="score-input" data-score-against="' + esc(match.partidoId) + '" type="number" min="0" placeholder="GC"><button data-action="match-mark-played" data-match-id="' + esc(match.partidoId) + '">Marcar como jugado</button> <button data-action="match-cancel" data-match-id="' + esc(match.partidoId) + '">Cancelar partido</button>';
  }

  function playedMatches() {
    return ((state.referenceData && state.referenceData.playedMatches) || []).filter(function(match) { return competitionMatches(match.competencia); });
  }

  function activePlayedMatch() {
    var id = state.selectedPlayedMatchId || (playedMatches()[0] && playedMatches()[0].partidoId) || '';
    return playedMatches().filter(function(match) { return match.partidoId === id; })[0] || null;
  }

  function renderPostMatch() {
    var match = activePlayedMatch();
    var view = state.postMatch || { rows: [] };
    var consistent = !!match && view.matchId === match.partidoId;
    var rows = consistent ? (view.rows || []) : [];
    if (!playedMatches().length) return '<section class="screen postmatch-screen">' + emptyState('Sin partidos jugados') + '</section>';
    return '<section class="screen postmatch-screen"><div class="toolbar">' + renderPlayedMatchSelector() + '</div>' +
      renderPostMatchSummary(match, rows, view) + renderReadiness(view) + renderPostMatchTable(rows, match) + '</section>';
  }

  function renderPlayedMatchSelector() {
    var selected = state.selectedPlayedMatchId || '';
    return '<select id="app-postmatch-match">' + playedMatches().map(function(match) {
      return '<option value="' + esc(match.partidoId) + '"' + (match.partidoId === selected ? ' selected' : '') + '>' + esc([match.competencia, match.rival, match.fecha].filter(Boolean).join(' | ')) + '</option>';
    }).join('') + '</select>';
  }

  function renderPostMatchSummary(match, rows, view) {
    var attended = rows.filter(function(row) { return row.ASISTIO_DERIVADO === true; }).length;
    var absent = rows.filter(function(row) { return row.ASISTIO_DERIVADO === false; }).length;
    var registered = rows.filter(function(row) { return row.PARTICIPACION_ID; }).length;
    var issueCount = ((view.issues || []).length + (((view.readiness || {}).errors || []).length));
    return '<div class="kpi-grid kpi-grid--five">' +
      kpi('Partido', match && [match.competencia, match.jornada, match.rival].filter(Boolean).join(' | '), match && [match.fecha, scoreLabel(match), match.duracionMinutos].filter(Boolean).join(' | ')) +
      kpi('Convocados en vista', rows.length) + kpi('Con asistencia', attended) + kpi('Ausentes', absent) + kpi('Participaciones registradas', registered + ' / alertas ' + issueCount) + '</div>';
  }

  function renderReadiness(view) {
    var items = (view.issues || []).concat(((view.readiness || {}).errors || []).map(function(code) { return { code: code }; }), ((view.readiness || {}).alerts || []).map(function(code) { return { code: code }; }));
    if (!items.length) return '';
    return '<div class="callouts">' + items.map(function(item) {
      var code = item.code || item;
      var label = code === 'PANEL_POSTMATCH_ATTENDANCE_REQUIRED' ? 'Falta registrar asistencia del partido' : code;
      return '<div class="callout">' + esc(label) + '</div>';
    }).join('') + '</div>';
  }

  function renderPostMatchTable(rows, match) {
    if (!rows.length) return emptyState('Sin registros de participacion');
    return '<div class="table-wrap"><table id="app-postmatch-table"><thead><tr><th>Jugador</th><th>Estado de asistencia</th><th>Asistio</th><th>Condicion inicial</th><th>Minutos</th><th>Goles</th><th>Amarillas</th><th>Rojas</th><th>Calificacion</th><th>Observaciones</th><th>Estado de captura</th><th>Accion</th></tr></thead><tbody>' +
      rows.map(function(row) { return renderPostMatchRow(row, match); }).join('') + '</tbody></table></div>';
  }

  function ratingConfig() {
    var entries = ((state.configuration || {}).entries || []);
    var byKey = {};
    entries.forEach(function(entry) { byKey[entry.key] = entry.value; });
    return { min: byKey.ESCALA_CALIFICACION_MIN, max: byKey.ESCALA_CALIFICACION_MAX, decimals: byKey.CALIFICACION_DECIMALES === true };
  }

  function renderPostMatchRow(row, match) {
    var attended = row.ASISTIO_DERIVADO === true;
    var missing = !row.ASISTENCIA_ESTADO;
    var locked = !attended || missing;
    var rating = ratingConfig();
    var disabled = locked || (state.participationWriteByStudent && state.participationWriteByStudent[row.ALUMNO_ID]);
    return '<tr><td>' + esc(row.nombre) + '</td><td>' + badge(row.ASISTENCIA_ESTADO || 'Pendiente', 'state') + '</td><td>' + esc(attended ? 'Si' : 'No') + '</td>' +
      '<td><select data-participation-field="CONDICION_INICIAL" data-student-id="' + esc(row.ALUMNO_ID) + '"' + (disabled ? ' disabled' : '') + '>' + optionTags([['', 'Seleccionar'], ['TITULAR', 'Titular'], ['SUPLENTE', 'Suplente']], attended ? row.CONDICION_INICIAL : '') + '</select></td>' +
      '<td><input data-participation-field="MINUTOS_JUGADOS" data-student-id="' + esc(row.ALUMNO_ID) + '" type="number" min="0" max="' + esc(match && match.duracionMinutos) + '" value="' + esc(attended ? valueOrDash(row.MINUTOS_JUGADOS) : 0) + '"' + (disabled ? ' disabled' : '') + '></td>' +
      '<td><input data-participation-field="GOLES" data-student-id="' + esc(row.ALUMNO_ID) + '" type="number" min="0" value="' + esc(attended ? valueOrDash(row.GOLES) : 0) + '"' + (disabled ? ' disabled' : '') + '></td>' +
      '<td><input data-participation-field="AMARILLAS" data-student-id="' + esc(row.ALUMNO_ID) + '" type="number" min="0" value="' + esc(attended ? valueOrDash(row.AMARILLAS) : 0) + '"' + (disabled ? ' disabled' : '') + '></td>' +
      '<td><input data-participation-field="ROJAS" data-student-id="' + esc(row.ALUMNO_ID) + '" type="number" min="0" value="' + esc(attended ? valueOrDash(row.ROJAS) : 0) + '"' + (disabled ? ' disabled' : '') + '></td>' +
      '<td><input data-participation-field="CALIFICACION" data-student-id="' + esc(row.ALUMNO_ID) + '" type="number" min="' + esc(valueOrDash(rating.min)) + '" max="' + esc(valueOrDash(rating.max)) + '" step="' + (rating.decimals ? '0.1' : '1') + '" value="' + esc(attended ? valueOrDash(row.CALIFICACION) : '') + '"' + (disabled ? ' disabled' : '') + '></td>' +
      '<td><input data-participation-field="OBSERVACIONES" data-student-id="' + esc(row.ALUMNO_ID) + '" value=""' + (disabled ? ' disabled' : '') + '></td><td>' + esc(row.PARTICIPACION_ID ? 'Registrado' : (missing ? 'Falta registrar asistencia del partido' : 'Pendiente')) + '</td><td><button data-action="participation-save" data-match-id="' + esc(match && match.partidoId) + '" data-student-id="' + esc(row.ALUMNO_ID) + '"' + (disabled ? ' disabled' : '') + '>Guardar</button></td></tr>';
  }

  function renderReports() {
    var reports = state.reports || { teamSummary: {}, players: [], alerts: {} };
    var players = filteredReportPlayers(reports.players || []);
    return '<section class="screen reports-screen">' + renderReportSummary(reports.teamSummary || {}) + renderReportFilters() + renderReportAlerts(reports.alerts || {}) + renderReportTable(players) + '</section>';
  }

  function renderReportSummary(summary) {
    var keys = selectedCompetition() === 'ALL' ? ['A', 'B'] : [selectedCompetition()];
    return '<div class="section-grid">' + keys.map(function(key) {
      var item = summary[key] || {};
      return '<section class="panel"><h3>Liga ' + esc(key) + '</h3><div class="kpi-grid kpi-grid--compact">' + kpi('Partidos jugados', item.played) + kpi('Ganados', item.wins) + kpi('Empatados', item.draws) + kpi('Perdidos', item.losses) + kpi('Goles a favor', item.goalsFor) + kpi('Goles en contra', item.goalsAgainst) + '</div></section>';
    }).join('') + '</div>';
  }

  function filteredReportPlayers(players) {
    var filters = state.reportFilters || {};
    return players.filter(function(player) {
      var search = String(filters.search || '').toLowerCase();
      if (!competitionMatches(player.competencia)) return false;
      if (search && String(player.nombre || '').toLowerCase().indexOf(search) === -1) return false;
      if (filters.level && filters.level !== 'ALL' && player.nivel !== filters.level) return false;
      if (filters.position && filters.position !== 'ALL' && player.posicionPrincipal !== filters.position) return false;
      return true;
    });
  }

  function renderReportFilters() {
    var filters = state.reportFilters || {};
    return '<div class="filters"><input data-report-filter="search" placeholder="Buscar jugador" value="' + esc(filters.search || '') + '">' +
      '<select data-report-filter="level">' + optionTags([['ALL', 'Todos'], ['A1', 'A1'], ['A2', 'A2'], ['B1', 'B1'], ['B2', 'B2']], filters.level || 'ALL') + '</select>' +
      '<select data-report-filter="position">' + optionTags([['ALL', 'Todas'], ['PO', 'PO'], ['DEF', 'DEF'], ['MED', 'MED'], ['DEL', 'DEL']], filters.position || 'ALL') + '</select></div>';
  }

  function renderReportAlerts(alerts) {
    var list = (alerts.sportAlerts || []).concat(alerts.readinessIssues || []);
    return '<section class="panel panel--wide"><h3>Alertas</h3>' + (list.length ? '<ul class="alert-list">' + list.map(function(item) { return '<li>' + esc(item.code || item) + '</li>'; }).join('') + '</ul>' : emptyState('Sin alertas operativas')) + '</section>';
  }

  function pct(value) {
    return value === null || value === undefined || value === '' ? '-' : Math.round(Number(value) * 10) / 10 + '%';
  }

  function renderReportTable(players) {
    if (!players.length) return emptyState('Sin datos de reporte');
    var headers = ['Jugador','Liga','Nivel','Posicion','Cumplimiento','Presencia real','A','R','FJ','FI','LES','Partidos registrados','Titular','Suplente','Minutos','Goles','Amarillas','Rojas','Calificacion promedio'];
    return '<div class="table-wrap"><table id="app-reports-table"><thead><tr>' + headers.map(function(header) { return '<th>' + esc(header) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      players.map(function(player) {
        return '<tr><td>' + esc(player.nombre) + '</td><td>' + esc(player.competencia) + '</td><td>' + esc(player.nivel) + '</td><td>' + esc(player.posicionPrincipal) + '</td><td>' + esc(pct(player.compliancePercentage)) + '</td><td>' + esc(pct(player.physicalPresencePercentage)) + '</td><td>' + esc(valueOrDash(player.attendanceCount)) + '</td><td>' + esc(valueOrDash(player.lateCount)) + '</td><td>' + esc(valueOrDash(player.justifiedAbsenceCount)) + '</td><td>' + esc(valueOrDash(player.unjustifiedAbsenceCount)) + '</td><td>' + esc(valueOrDash(player.injuryCount)) + '</td><td>' + esc(valueOrDash(player.participationRecords)) + '</td><td>' + esc(valueOrDash(player.starts)) + '</td><td>' + esc(valueOrDash(player.substituteStarts)) + '</td><td>' + esc(valueOrDash(player.minutes)) + '</td><td>' + esc(valueOrDash(player.goals)) + '</td><td>' + esc(valueOrDash(player.yellowCards)) + '</td><td>' + esc(valueOrDash(player.redCards)) + '</td><td>' + esc(valueOrDash(player.averageRating)) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function renderCommunications() {
    var model = state.communications || { rows: [], runtimeCapabilities: {} };
    var rows = filteredCommunications(model.rows || []);
    var pending = rows.filter(function(row) { return row.estado === 'PENDIENTE'; }).length;
    var sent = rows.filter(function(row) { return row.estado === 'ENVIADO'; }).length;
    var errors = rows.filter(function(row) { return row.estado === 'ERROR'; }).length;
    var uncertain = rows.filter(function(row) { return row.uncertainDelivery; }).length;
    var mailEnabled = model.runtimeCapabilities && model.runtimeCapabilities.externalMailEnabled === true;
    return '<section class="screen communications-screen">' + (!mailEnabled ? '<div class="callout">Envio externo deshabilitado</div>' : '') +
      '<div class="kpi-grid kpi-grid--compact">' + kpi('Pendientes', pending) + kpi('Enviados', sent) + kpi('Errores', errors) + kpi('Entrega incierta', uncertain) + '</div>' +
      renderCommunicationFilters() + '<div class="toolbar"><button class="primary" data-action="communications-send-pending"' + (!mailEnabled || state.communicationWritePending ? ' disabled' : '') + '>Enviar pendientes</button></div>' + renderCommunicationTable(rows, mailEnabled) + '</section>';
  }

  function filteredCommunications(rows) {
    var filters = state.communicationFilters || {};
    return rows.filter(function(row) {
      var search = String(filters.search || '').toLowerCase();
      if (!competitionMatches(row.competencia)) return false;
      if (filters.type && filters.type !== 'ALL' && row.tipo !== filters.type) return false;
      if (filters.status && filters.status !== 'ALL' && row.estado !== filters.status) return false;
      if (search && [row.nombreAlumno, row.referenciaId].join(' ').toLowerCase().indexOf(search) === -1) return false;
      return true;
    });
  }

  function renderCommunicationFilters() {
    var filters = state.communicationFilters || {};
    return '<div class="filters"><input data-communication-filter="search" placeholder="Buscar alumno o referencia" value="' + esc(filters.search || '') + '">' +
      '<select data-communication-filter="type">' + optionTags([['ALL', 'Todos'], ['AUSENCIA', 'Ausencia'], ['CONVOCATORIA', 'Convocatoria']], filters.type || 'ALL') + '</select>' +
      '<select data-communication-filter="status">' + optionTags([['ALL', 'Todos'], ['PENDIENTE', 'Pendiente'], ['ENVIADO', 'Enviado'], ['ERROR', 'Error']], filters.status || 'ALL') + '</select></div>';
  }

  function renderCommunicationTable(rows, mailEnabled) {
    if (!rows.length) return emptyState('Sin comunicaciones');
    return '<div class="table-wrap"><table id="app-communications-table"><thead><tr><th>Alumno</th><th>Liga</th><th>Tipo</th><th>Referencia</th><th>Creado</th><th>Enviado</th><th>Estado</th><th>Intentos</th><th>Resultado</th><th>Accion</th></tr></thead><tbody>' +
      rows.map(function(row) {
        var canRetry = mailEnabled && row.canRetry === true;
        return '<tr><td>' + esc(row.nombreAlumno) + '</td><td>' + esc(valueOrDash(row.competencia)) + '</td><td>' + esc(valueOrDash(row.tipo)) + '</td><td>' + esc(valueOrDash(row.referenciaId)) + '</td><td>' + esc(valueOrDash(row.creadoEn)) + '</td><td>' + esc(valueOrDash(row.enviadoEn)) + '</td><td>' + badge(statusLabel(row.estado), 'state') + '</td><td>' + esc(valueOrDash(row.intentos)) + '</td><td>' + esc(row.uncertainDelivery ? 'Entrega por verificar' : valueOrDash(row.errorCode || row.estado)) + '</td><td><button data-action="communication-retry" data-communication-id="' + esc(row.communicationId) + '"' + (canRetry ? '' : ' disabled') + '>Reintentar</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function renderConfiguration() {
    var config = state.configuration || { entries: [], runtimeCapabilities: {} };
    var entries = config.entries || [];
    var groups = {};
    entries.forEach(function(entry) {
      var list = groups[entry.group] || [];
      list.push(entry);
      groups[entry.group] = list;
    });
    return '<section class="screen config-screen"><div class="callout">Configuracion operativa - solo lectura durante el piloto</div>' +
      '<div class="kpi-grid kpi-grid--compact">' + kpi('Estado', config.ready ? 'Configuracion valida' : 'Error de configuracion') + kpi('Total de claves runtime', entries.length) + kpi('External mail', config.runtimeCapabilities && config.runtimeCapabilities.externalMailEnabled === true ? 'Habilitado' : 'Deshabilitado') + '</div>' +
      (entries.length ? Object.keys(groups).map(function(group) { return renderConfigGroup(group, groups[group]); }).join('') : emptyState('Sin configuracion disponible')) + '</section>';
  }

  function renderConfigGroup(group, entries) {
    return '<section class="panel"><h3>' + esc(group) + '</h3><div class="table-wrap"><table class="app-config-table"><thead><tr><th>Configuracion</th><th>Valor actual</th><th>Tipo</th><th>Unidad</th><th>Estado</th><th>Descripcion</th><th>Ultima modificacion</th></tr></thead><tbody>' +
      entries.map(function(entry) {
        var value = typeof entry.value === 'boolean' ? (entry.value ? 'Si' : 'No') : valueOrDash(entry.value);
        return '<tr><td>' + esc(entry.key) + '</td><td>' + esc(value) + '</td><td>' + esc(valueOrDash(entry.type)) + '</td><td>' + esc(valueOrDash(entry.unit)) + '</td><td>' + esc(entry.active === true ? 'Activa' : 'Inactiva') + '</td><td>' + esc(valueOrDash(entry.description)) + '</td><td>' + esc(valueOrDash(entry.modifiedAt)) + '</td></tr>';
      }).join('') + '</tbody></table></div></section>';
  }

  function formPayload(root, selector) {
    var payload = {};
    if (!root || !root.querySelectorAll) return payload;
    Array.prototype.slice.call(root.querySelectorAll(selector + ' [name]')).forEach(function(input) {
      payload[input.name] = input.value;
    });
    return payload;
  }

  function participationPayload(root, studentId) {
    var payload = {};
    if (!root || !root.querySelectorAll) return payload;
    Array.prototype.slice.call(root.querySelectorAll('[data-participation-field][data-student-id="' + studentId + '"]')).forEach(function(input) {
      payload[input.getAttribute('data-participation-field')] = input.value;
    });
    return payload;
  }

  function emptyState(message) {
    return '<div class="empty-state">' + esc(message) + '</div>';
  }

  function screenHtml(routeName) {
    if (routeName === 'dashboard') return renderDashboard();
    if (routeName === 'students') return renderStudents();
    if (routeName === 'attendance') return renderAttendance();
    if (routeName === 'convocations') return renderConvocations();
    if (routeName === 'matches') return renderMatches();
    if (routeName === 'postmatch') return renderPostMatch();
    if (routeName === 'reports') return renderReports();
    if (routeName === 'communications') return renderCommunications();
    if (routeName === 'config') return renderConfiguration();
    return emptyState('Ruta no disponible');
  }

  function render(routeName) {
    state.activeRoute = routeName || state.activeRoute || 'dashboard';
    var meta = routeMeta(state.activeRoute);
    var html = screenHtml(state.activeRoute);
    if (doc && typeof doc.getElementById === 'function') {
      var nav = doc.getElementById('app-nav');
      var title = doc.getElementById('app-title');
      var subtitle = doc.getElementById('app-subtitle');
      var content = doc.getElementById('app-content');
      if (nav) nav.innerHTML = renderNavigation();
      if (title) title.textContent = meta[1];
      if (subtitle) subtitle.textContent = meta[2];
      if (content) content.innerHTML = html;
    }
    return html;
  }

  function renderShell() {
    return '<div class="ldv-app-shell"><aside class="app-sidebar"><div class="brand"><span class="brand-mark">LDV</span><strong>LICEO DEL VALLE</strong><small>FUTBOL</small></div><nav id="app-nav">' + renderNavigation() + '</nav><div class="operator">Operador deportivo</div></aside><div class="app-main"><header class="app-header"><div><p class="eyebrow">Liceo del Valle - Futbol</p><h1 id="app-title">Panel Principal</h1><p id="app-subtitle">Vista operativa del dia deportivo</p></div><div class="header-actions"><select id="app-competition"><option value="ALL"' + (selectedCompetition() === 'ALL' ? ' selected' : '') + '>Todas</option><option value="A"' + (selectedCompetition() === 'A' ? ' selected' : '') + '>Liga A</option><option value="B"' + (selectedCompetition() === 'B' ? ' selected' : '') + '>Liga B</option></select></div></header><div id="app-error" class="error-banner" role="alert"></div><div id="app-feedback" class="feedback"></div><main id="app-content">' + screenHtml(state.activeRoute || 'dashboard') + '</main></div></div>';
  }

  function attachEvents(root) {
    var target = root || doc;
    if (!target || typeof target.addEventListener !== 'function') return;
    function controllerMethod(name) {
      if (controller && typeof controller[name] === 'function') {
        return controller[name];
      }
      if (typeof appController !== 'undefined' && appController && typeof appController[name] === 'function') {
        return function() { return appController[name].apply(appController, arguments); };
      }
      return null;
    }
    target.addEventListener('click', function(event) {
      var button = event.target;
      var route = button && button.getAttribute && button.getAttribute('data-route');
      var action = button && button.getAttribute && button.getAttribute('data-action');
      if (route && controller.route) controller.route(route);
      if (action === 'mark-attendance') controller.markAttendance(selectedSessionId(), button.getAttribute('data-student-id'), button.getAttribute('data-state'));
      if (action === 'resolve-absence') {
        var reason = target.querySelector('.absence-reason[data-attendance-id="' + button.getAttribute('data-attendance-id') + '"]');
        controller.resolveAbsence(button.getAttribute('data-attendance-id'), button.getAttribute('data-target-state'), reason && reason.value);
      }
      if (action === 'convocation-generate') controller.generateConvocation(button.getAttribute('data-match-id'));
      if (action === 'convocation-approve') {
        var actor = target.querySelector('#app-approval-actor');
        controller.approveConvocation(button.getAttribute('data-convocation-id'), actor && actor.value);
      }
      if (action === 'communication-prepare') controller.prepareConvocationCommunications(button.getAttribute('data-convocation-id'));
      if (action === 'communication-send') controller.sendPendingCommunications();
      if (action === 'match-create') controller.createMatch(formPayload(target, '[data-form="match-create"]'));
      if (action === 'match-update') controller.updateMatch(button.getAttribute('data-match-id'), formPayload(target, '[data-form="match-create"]'));
      if (action === 'match-mark-played') {
        controller.markMatchPlayed(button.getAttribute('data-match-id'), {
          golesFavor: (target.querySelector('[data-score-for="' + button.getAttribute('data-match-id') + '"]') || {}).value,
          golesContra: (target.querySelector('[data-score-against="' + button.getAttribute('data-match-id') + '"]') || {}).value
        });
      }
      if (action === 'match-cancel') controller.cancelMatch(button.getAttribute('data-match-id'));
      if (action === 'participation-save') controller.saveParticipation(button.getAttribute('data-match-id'), button.getAttribute('data-student-id'), participationPayload(target, button.getAttribute('data-student-id')));
      if (action === 'communications-send-pending') controller.sendPendingCommunications();
      if (action === 'communication-retry') controller.retryCommunication(button.getAttribute('data-communication-id'));
    });
    target.addEventListener('change', function(event) {
      var element = event.target;
      if (element.id === 'app-competition') {
        controllerMethod('setCompetition')(element.value);
      }
      if (element.id === 'app-attendance-session') controllerMethod('selectAttendanceSession')(element.value);
      if (element.id === 'app-convocation-match') {
        controllerMethod('selectProgrammedMatch')(element.value);
      }
      if (element.id === 'app-postmatch-match') {
        controllerMethod('selectPlayedMatch')(element.value);
      }
      if (element.getAttribute('data-filter')) {
        state.studentFilters = state.studentFilters || {};
        state.studentFilters[element.getAttribute('data-filter')] = element.value;
        render('students');
      }
      if (element.getAttribute('data-convocation-filter')) {
        state.convocationFilters = state.convocationFilters || {};
        state.convocationFilters[element.getAttribute('data-convocation-filter')] = element.value;
        render('convocations');
      }
      if (element.getAttribute('data-match-filter')) {
        state.matchFilters = state.matchFilters || {};
        state.matchFilters[element.getAttribute('data-match-filter')] = element.value;
        render('matches');
      }
      if (element.getAttribute('data-report-filter')) {
        state.reportFilters = state.reportFilters || {};
        state.reportFilters[element.getAttribute('data-report-filter')] = element.value;
        render('reports');
      }
      if (element.getAttribute('data-communication-filter')) {
        state.communicationFilters = state.communicationFilters || {};
        state.communicationFilters[element.getAttribute('data-communication-filter')] = element.value;
        render('communications');
      }
      if (element.getAttribute('data-action') === 'convocation-selection') {
        var reason = target.querySelector('.convocation-reason[data-student-id="' + element.getAttribute('data-student-id') + '"]');
        controller.setFinalSelection(element.getAttribute('data-convocation-id'), element.getAttribute('data-student-id'), element.checked, reason && reason.value);
      }
      if (element.getAttribute('data-action') === 'convocation-position') {
        var positionReason = target.querySelector('.convocation-reason[data-student-id="' + element.getAttribute('data-student-id') + '"]');
        controller.assignPosition(element.getAttribute('data-convocation-id'), element.getAttribute('data-student-id'), element.value, positionReason && positionReason.value);
      }
    });
    target.addEventListener('input', function(event) {
      var element = event.target;
      if (element.getAttribute && element.getAttribute('data-filter')) {
        state.studentFilters = state.studentFilters || {};
        state.studentFilters[element.getAttribute('data-filter')] = element.value;
        render('students');
      }
      if (element.getAttribute && element.getAttribute('data-convocation-filter')) {
        state.convocationFilters = state.convocationFilters || {};
        state.convocationFilters[element.getAttribute('data-convocation-filter')] = element.value;
        render('convocations');
      }
      if (element.getAttribute && element.getAttribute('data-match-filter')) {
        state.matchFilters = state.matchFilters || {};
        state.matchFilters[element.getAttribute('data-match-filter')] = element.value;
        render('matches');
      }
      if (element.getAttribute && element.getAttribute('data-report-filter')) {
        state.reportFilters = state.reportFilters || {};
        state.reportFilters[element.getAttribute('data-report-filter')] = element.value;
        render('reports');
      }
      if (element.getAttribute && element.getAttribute('data-communication-filter')) {
        state.communicationFilters = state.communicationFilters || {};
        state.communicationFilters[element.getAttribute('data-communication-filter')] = element.value;
        render('communications');
      }
    });
  }

  return {
    attachEvents: attachEvents,
    emptyState: emptyState,
    esc: esc,
    findConvocationForMatch: findConvocationForMatch,
    render: render,
    renderAttendance: renderAttendance,
    renderConvocations: renderConvocations,
    renderConvocationFilters: renderConvocationFilters,
    renderDashboard: renderDashboard,
    renderCommunications: renderCommunications,
    renderConfiguration: renderConfiguration,
    renderMatches: renderMatches,
    renderNavigation: renderNavigation,
    renderPostMatch: renderPostMatch,
    renderReports: renderReports,
    renderShell: renderShell,
    renderStudents: renderStudents
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createAppRenderer: createAppRenderer };
}

if (typeof globalThis !== 'undefined') {
  globalThis.createAppRenderer = createAppRenderer;
}
