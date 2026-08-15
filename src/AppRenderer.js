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
    ['matches', 'Partidos', 'Modulo preparado para el siguiente safe batch'],
    ['postmatch', 'Post Partido', 'Modulo preparado para el siguiente safe batch'],
    ['reports', 'Reportes', 'Modulo preparado para el siguiente safe batch'],
    ['communications', 'Comunicaciones', 'Modulo preparado para el siguiente safe batch'],
    ['config', 'Configuracion', 'Modulo preparado para el siguiente safe batch']
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
    var session = view.session || {};
    var rows = view.rows || [];
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
    var allDetails = convocation.details || [];
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
      '<div class="convocation-layout"><main class="convocation-main">' + renderConvocationFilters() + renderConvocationTable(details, convocation.convocationId || convocationId(existing)) + '</main><aside class="side-panel">' + renderMatchSummary(match) + renderConvocationActions(convocation.convocationId || convocationId(existing)) + '</aside></div></section>';
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

  function renderScaffold() {
    return '<section class="screen scaffold-screen">' + emptyState('Modulo preparado para el siguiente safe batch') + '</section>';
  }

  function emptyState(message) {
    return '<div class="empty-state">' + esc(message) + '</div>';
  }

  function screenHtml(routeName) {
    if (routeName === 'dashboard') return renderDashboard();
    if (routeName === 'students') return renderStudents();
    if (routeName === 'attendance') return renderAttendance();
    if (routeName === 'convocations') return renderConvocations();
    return renderScaffold();
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
    });
    target.addEventListener('change', function(event) {
      var element = event.target;
      if (element.id === 'app-competition') {
        controllerMethod('setCompetition')(element.value);
      }
      if (element.id === 'app-attendance-session') controller.loadAttendance(element.value);
      if (element.id === 'app-convocation-match') {
        controllerMethod('selectProgrammedMatch')(element.value);
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
    renderNavigation: renderNavigation,
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
