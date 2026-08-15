function createPanelRenderer(dependencies) {
  dependencies = dependencies || {};
  var state = dependencies.state || {};
  var controller = dependencies.controller;
  var doc = dependencies.document || null;

  function esc(value) {
    return String(value === undefined || value === null ? '' : value).replace(/[&<>"]/g, function(character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[character];
    });
  }

  function selectedSessionId() {
    var dashboard = state.dashboard || {};
    var reference = state.referenceData || {};
    var sessions = reference.openSessions || [];
    return state.selectedSessionId ||
      (dashboard.currentSession && dashboard.currentSession.sesionId) ||
      (dashboard.nextSession && dashboard.nextSession.sesionId) ||
      (sessions[0] && sessions[0].sesionId) ||
      '';
  }

  function selectedProgrammedMatchId() {
    var matches = (state.referenceData && state.referenceData.programmedMatches) || [];
    return state.selectedProgrammedMatchId || (matches[0] && matches[0].partidoId) || '';
  }

  function selectedPlayedMatchId() {
    var matches = (state.referenceData && state.referenceData.playedMatches) || [];
    return state.selectedPlayedMatchId || (matches[0] && matches[0].partidoId) || '';
  }

  function field(name, type, value) {
    var current = value === undefined || value === null ? '' : value;
    return '<label>' + esc(name) + '<input name="' + esc(name) + '" type="' + esc(type || 'text') + '" value="' + esc(current) + '"></label>';
  }

  function option(value, label, selected) {
    return '<option value="' + esc(value) + '"' + (selected ? ' selected' : '') + '>' + esc(label || value) + '</option>';
  }

  function renderSessionSelector() {
    var selected = selectedSessionId();
    var sessions = (state.referenceData && state.referenceData.openSessions) || [];
    return '<select id="attendance-session" data-action="attendance-session-change">' + sessions.map(function(session) {
      return option(session.sesionId, [session.sesionId, session.competencia, session.fecha].filter(Boolean).join(' - '), session.sesionId === selected);
    }).join('') + '</select>';
  }

  function renderDashboard(data) {
    var dashboard = data || state.dashboard || {};
    var proposalCount = (dashboard.convocationProposals || []).length;
    var pendingCount = proposalCount + Object.keys(dashboard.convocationStatusByMatch || {}).length;
    return [
      card('Sesion actual/proxima', (dashboard.currentSession && dashboard.currentSession.sesionId) || (dashboard.nextSession && dashboard.nextSession.sesionId) || ''),
      card('Asistencias', ((dashboard.attendanceSummary || {}).captured || 0) + '/' + ((dashboard.attendanceSummary || {}).expected || 0)),
      card('Faltas pendientes', dashboard.pendingAbsences || 0),
      card('Faltas vencidas', dashboard.expiredAbsences || 0),
      card('Proximo vencimiento', dashboard.nextAbsenceDeadline || ''),
      card('Proximo A', (dashboard.nextMatchA && dashboard.nextMatchA.partidoId) || ''),
      card('Proximo B', (dashboard.nextMatchB && dashboard.nextMatchB.partidoId) || ''),
      card('Convocatorias pendientes', pendingCount),
      card('Comunicaciones', (((dashboard.communications || {}).pending) || 0) + ' pendientes'),
      card('Alertas', ((dashboard.sportAlerts || []).length + (dashboard.readinessIssues || []).length))
    ].join('');
  }

  function card(title, value) {
    return '<div class="card"><strong>' + esc(title) + '</strong><br><span class="muted">' + esc(value) + '</span></div>';
  }

  function renderAttendance(data) {
    var view = data || state.attendance || { rows: [] };
    return [
      '<div class="toolbar">', renderSessionSelector(), '</div>',
      '<table id="attendance-table"><tbody>',
      (view.rows || []).map(function(row) {
        var reason = '<input class="absence-reason" data-attendance-id="' + esc(row.attendanceId) + '" placeholder="Motivo" value="">';
        var actions = '';
        if (row.estadoActual === 'F') {
          actions = reason +
            '<button data-action="resolve-absence" data-attendance-id="' + esc(row.attendanceId) + '" data-target-state="FJ">FJ</button>' +
            '<button data-action="resolve-absence" data-attendance-id="' + esc(row.attendanceId) + '" data-target-state="LES">LES</button>';
        } else if (row.capabilities && row.capabilities.canMarkAttendance) {
          actions = '<button data-action="mark-attendance" data-student-id="' + esc(row.studentId) + '" data-state="A">A</button>' +
            '<button data-action="mark-attendance" data-student-id="' + esc(row.studentId) + '" data-state="R">R</button>' +
            '<button data-action="mark-attendance" data-student-id="' + esc(row.studentId) + '" data-state="F">F</button>';
        }
        return '<tr data-student-id="' + esc(row.studentId) + '"><td>' + esc(row.nombre) + '</td><td>' + esc(row.estadoActual) + '</td><td>' + actions + '</td></tr>';
      }).join(''),
      '</tbody></table>'
    ].join('');
  }

  function renderMatchCreateForm() {
    return '<form id="match-create-form" data-action="match-create">' +
      '<select name="COMPETENCIA">' + option('A') + option('B') + '</select>' +
      field('JORNADA') + field('RIVAL') + field('FECHA', 'date') + field('HORA_CITACION', 'time') +
      field('HORA_PARTIDO', 'time') + field('SEDE') +
      '<select name="LOCAL_VISITANTE">' + option('LOCAL') + option('VISITANTE') + '</select>' +
      field('DURACION_MINUTOS', 'number') + field('UNIFORME') + field('INDICACIONES') + field('OBSERVACIONES') +
      '<button type="submit">Crear partido</button></form>';
  }

  function renderMatches() {
    var matches = (state.referenceData && state.referenceData.programmedMatches) || [];
    return renderMatchCreateForm() + '<section id="programmed-matches">' + matches.map(function(match) {
      return '<article data-match-id="' + esc(match.partidoId) + '">' +
        '<strong>' + esc(match.rival) + '</strong> <span>' + esc(match.competencia) + ' ' + esc(match.fecha) + ' ' + esc(match.horaPartido) + ' ' + esc(match.sede) + '</span>' +
        '<form data-action="match-update" data-match-id="' + esc(match.partidoId) + '">' +
        field('RIVAL', 'text', match.rival) + field('FECHA', 'date', match.fecha) + field('HORA_PARTIDO', 'time', match.horaPartido) + field('SEDE', 'text', match.sede) +
        '<button type="submit">Editar</button></form>' +
        '<form data-action="match-played" data-match-id="' + esc(match.partidoId) + '">' + field('GOLES_FAVOR', 'number') + field('GOLES_CONTRA', 'number') + '<button type="submit">Marcar JUGADO</button></form>' +
        '<button data-action="match-cancel" data-match-id="' + esc(match.partidoId) + '">Cancelar</button>' +
        '</article>';
    }).join('') + '</section>';
  }

  function renderConvocations() {
    var reference = state.referenceData || {};
    var selectedMatch = selectedProgrammedMatchId();
    var convocation = state.convocation || { details: [] };
    var existing = findConvocationForMatch(selectedMatch, reference);
    var capabilities = reference.runtimeCapabilities || {};
    return [
      '<select id="convocation-match" data-action="convocation-match-change">',
      (reference.programmedMatches || []).map(function(match) { return option(match.partidoId, match.rival + ' - ' + match.fecha, match.partidoId === selectedMatch); }).join(''),
      '</select>',
      '<button data-action="convocation-generate" data-match-id="' + esc(selectedMatch) + '"' + (existing ? ' disabled' : '') + '>Generar propuesta</button>',
      existing ? '<p class="muted">Propuesta existente</p>' : '<p class="muted">Sin propuesta</p>',
      renderConvocationDetails(convocation),
      '<label>Aprobado por<input id="convocation-approval-actor" aria-label="Aprobado por" autocomplete="off"></label>',
      '<button data-action="convocation-approve" data-convocation-id="' + esc(convocation.convocationId || '') + '"' + (convocation.convocationId ? '' : ' disabled') + '>Aprobar convocatoria</button>',
      '<button data-action="communication-prepare" data-convocation-id="' + esc(convocation.convocationId || '') + '">Preparar comunicaciones</button>',
      '<button id="send-pending" data-action="communication-send" ' + (capabilities.externalMailEnabled === true ? '' : 'disabled') + '>Enviar pendientes</button>'
    ].join('');
  }

  function renderConvocationDetails(convocation) {
    return '<table id="convocation-details"><thead><tr><th>Nombre</th><th>ELEGIBILITY_STATUS</th><th>MOTIVO_NO_ELEGIBLE</th><th>Nivel</th><th>posicionPrincipal</th><th>posicionSecundaria</th><th>posicionAsignada</th><th>rotacionAntes</th><th>prioridadRotacion</th><th>ordenPrioridad</th><th>puntajeAsistencia</th><th>presenciaReal</th><th>recomendadoSistema</th><th>cambioManual</th><th>rotationException</th><th>Seleccion</th><th>Asignar</th><th>Motivo</th></tr></thead><tbody>' + ((convocation && convocation.details) || []).map(function(row) {
      var disabled = row.ELEGIBILITY_STATUS === 'PENDING' || row.ELEGIBILITY_STATUS === 'INELIGIBLE';
      var positions = [row.posicionPrincipal, row.posicionSecundaria].filter(Boolean);
      return '<tr data-student-id="' + esc(row.ALUMNO_ID) + '">' +
        '<td>' + esc(row.nombre) + '</td><td>' + esc(row.ELEGIBILITY_STATUS) + '</td><td>' + esc(row.MOTIVO_NO_ELEGIBLE) + '</td>' +
        '<td>' + esc(row.nivel) + '</td><td>' + esc(row.posicionPrincipal) + '</td><td>' + esc(row.posicionSecundaria) + '</td><td>' + esc(row.posicionAsignada) + '</td>' +
        '<td>' + esc(row.rotacionAntes) + '</td><td>' + esc(row.prioridadRotacion) + '</td><td>' + esc(row.ordenPrioridad) + '</td>' +
        '<td>' + esc(row.puntajeAsistencia) + '</td><td>' + esc(row.presenciaReal) + '</td><td>' + esc(row.recomendadoSistema) + '</td><td>' + esc(row.cambioManual) + '</td><td>' + esc(row.rotationException) + '</td>' +
        '<td><input type="checkbox" data-action="convocation-selection" data-convocation-id="' + esc(convocation.convocationId) + '" data-student-id="' + esc(row.ALUMNO_ID) + '"' + (row.seleccionadoFinal ? ' checked' : '') + (disabled ? ' disabled' : '') + '></td>' +
        '<td><select data-action="convocation-position" data-convocation-id="' + esc(convocation.convocationId) + '" data-student-id="' + esc(row.ALUMNO_ID) + '"' + (disabled ? ' disabled' : '') + '>' + positions.map(function(position) { return option(position, position, position === row.posicionAsignada); }).join('') + '</select></td>' +
        '<td><input class="convocation-reason" data-student-id="' + esc(row.ALUMNO_ID) + '" aria-label="motivo obligatorio" placeholder="Motivo" value="' + esc(row.motivoCambio || '') + '"></td>' +
        '</tr>';
    }).join('') + '</tbody></table>';
  }

  function renderPostMatch() {
    var playedMatches = (state.referenceData && state.referenceData.playedMatches) || [];
    var selectedMatch = selectedPlayedMatchId();
    var view = state.postMatch || { rows: [], issues: [], readiness: {} };
    var issuesByStudent = {};
    (view.issues || []).forEach(function(issue) {
      if (issue.studentId) {
        issuesByStudent[issue.studentId] = issue.code;
      }
    });
    return [
      '<select id="postmatch-match" data-action="postmatch-match-change">',
      playedMatches.map(function(match) { return option(match.partidoId, match.rival + ' - ' + match.fecha, match.partidoId === selectedMatch); }).join(''),
      '</select>',
      '<p class="muted">ASISTENCIA_ESTADO es lectura</p>',
      '<pre id="postmatch-readiness">' + esc(JSON.stringify(view.readiness || {})) + '</pre>',
      '<pre id="postmatch-issues">' + esc(JSON.stringify(view.issues || [])) + '</pre>',
      '<table id="postmatch-rows"><thead><tr><th>Nombre</th><th>ASISTENCIA_ESTADO</th><th>ASISTIO_DERIVADO</th><th>CONDICION_INICIAL</th><th>MINUTOS_JUGADOS</th><th>GOLES</th><th>AMARILLAS</th><th>ROJAS</th><th>CALIFICACION</th><th>OBSERVACIONES</th><th>Guardar participacion</th></tr></thead><tbody>',
      (view.rows || []).map(function(row) {
        var blocked = issuesByStudent[row.ALUMNO_ID] === 'PANEL_POSTMATCH_ATTENDANCE_REQUIRED';
        return '<tr data-student-id="' + esc(row.ALUMNO_ID) + '">' +
          '<td>' + esc(row.nombre) + '</td><td class="readonly">' + esc(row.ASISTENCIA_ESTADO) + '</td><td class="readonly">' + esc(row.ASISTIO_DERIVADO) + '</td>' +
          '<td><select name="CONDICION_INICIAL">' + option('TITULAR', 'TITULAR', row.CONDICION_INICIAL === 'TITULAR') + option('SUPLENTE', 'SUPLENTE', row.CONDICION_INICIAL === 'SUPLENTE') + '</select></td>' +
          ['MINUTOS_JUGADOS', 'GOLES', 'AMARILLAS', 'ROJAS', 'CALIFICACION', 'OBSERVACIONES'].map(function(fieldName) {
            var value = row[fieldName] === undefined || row[fieldName] === null ? '' : row[fieldName];
            return '<td><input name="' + esc(fieldName) + '" value="' + esc(value) + '"></td>';
          }).join('') +
          '<td><button data-action="participation-save" data-match-id="' + esc(selectedMatch) + '" data-student-id="' + esc(row.ALUMNO_ID) + '"' + (blocked ? ' disabled' : '') + '>Guardar</button></td>' +
          '</tr>';
      }).join(''),
      '</tbody></table>'
    ].join('');
  }

  function renderAlerts(data) {
    var dashboard = data || state.dashboard || {};
    return '<section id="alerts-view">' +
      card('Faltas pendientes', dashboard.pendingAbsences || 0) +
      card('Faltas vencidas', dashboard.expiredAbsences || 0) +
      card('Proximo vencimiento', dashboard.nextAbsenceDeadline || '') +
      card('Comunicaciones error', (dashboard.communications || {}).error || 0) +
      card('Entrega incierta', (dashboard.communications || {}).uncertainDelivery || 0) +
      '<ul>' + (dashboard.sportAlerts || []).concat(dashboard.readinessIssues || []).map(function(alert) { return '<li>' + esc(alert.code) + '</li>'; }).join('') + '</ul>' +
      '</section>';
  }

  function formPayload(form, allowed) {
    var payload = {};
    allowed.forEach(function(name) {
      if (form && form[name] !== undefined) {
        payload[name] = form[name];
      }
    });
    return payload;
  }

  function elementValue(element) {
    if (!element) {
      return '';
    }
    if (element.type === 'checkbox') {
      return element.checked === true;
    }
    return element.value;
  }

  function namedElements(container) {
    if (!container) {
      return [];
    }
    if (container.elements !== undefined) {
      return Array.prototype.slice.call(container.elements);
    }
    if (typeof container.querySelectorAll === 'function') {
      return Array.prototype.slice.call(container.querySelectorAll('[name]'));
    }
    if (typeof container === 'object') {
      return Object.keys(container).map(function(name) {
        return { name: name, value: container[name] };
      });
    }
    return [];
  }

  function elementPayload(container) {
    var payload = {};
    namedElements(container).forEach(function(element) {
      if (element && element.name) {
        payload[element.name] = elementValue(element);
      }
    });
    return payload;
  }

  function rowFromButton(button) {
    return button && button.parentNode && button.parentNode.parentNode;
  }

  function convocationMatchId(convocation) {
    return convocation && (convocation.PARTIDO_ID || convocation.partidoId || convocation.matchId);
  }

  function convocationId(convocation) {
    return convocation && (convocation.CONVOCATORIA_ID || convocation.convocationId);
  }

  function byConvocationId(left, right) {
    return String(convocationId(left) || '').localeCompare(String(convocationId(right) || ''));
  }

  function findConvocationForMatch(matchId, referenceData) {
    var reference = referenceData || {};
    var authoritative = (reference.authoritativeConvocations || [])
      .filter(function(convocation) { return convocationMatchId(convocation) === matchId; })
      .sort(byConvocationId);
    if (authoritative[0]) {
      return authoritative[0];
    }
    return ((reference.convocationProposals || [])
      .filter(function(convocation) { return convocationMatchId(convocation) === matchId; })
      .sort(byConvocationId))[0] || null;
  }

  function resolveConvocationForMatch(matchId) {
    state.selectedProgrammedMatchId = matchId || selectedProgrammedMatchId();
    var existing = findConvocationForMatch(state.selectedProgrammedMatchId, state.referenceData || {});
    if (existing && convocationId(existing)) {
      return controller.loadConvocation(convocationId(existing));
    }
    state.convocation = { convocationId: '', details: [] };
    return render('convocations');
  }

  function dispatch(action) {
    action = action || {};
    if (action.type === 'attendanceSessionChange') {
      state.selectedSessionId = action.sessionId;
      if (!action.sessionId) {
        return null;
      }
      return controller.loadAttendance(action.sessionId);
    }
    if (action.type === 'markAttendance') {
      var sessionId = selectedSessionId();
      if (!sessionId) {
        return null;
      }
      return controller.markAttendance(sessionId, action.studentId, action.state);
    }
    if (action.type === 'resolveAbsence') {
      return controller.resolveAbsence(action.attendanceId, action.targetState, action.reason || '');
    }
    if (action.type === 'createMatch') {
      return controller.createMatch(formPayload(elementPayload(action.payload), ['COMPETENCIA', 'JORNADA', 'RIVAL', 'FECHA', 'HORA_CITACION', 'HORA_PARTIDO', 'SEDE', 'LOCAL_VISITANTE', 'DURACION_MINUTOS', 'UNIFORME', 'INDICACIONES', 'OBSERVACIONES']));
    }
    if (action.type === 'updateMatch') {
      return controller.updateMatch(action.matchId, formPayload(elementPayload(action.payload), ['COMPETENCIA', 'JORNADA', 'RIVAL', 'FECHA', 'HORA_CITACION', 'HORA_PARTIDO', 'SEDE', 'LOCAL_VISITANTE', 'DURACION_MINUTOS', 'UNIFORME', 'INDICACIONES', 'OBSERVACIONES']));
    }
    if (action.type === 'markMatchPlayed') {
      return controller.markMatchPlayed(action.matchId, formPayload(elementPayload(action.payload), ['GOLES_FAVOR', 'GOLES_CONTRA']));
    }
    if (action.type === 'cancelMatch') {
      return controller.cancelMatch(action.matchId);
    }
    if (action.type === 'selectProgrammedMatch') {
      return resolveConvocationForMatch(action.matchId);
    }
    if (action.type === 'generateConvocation') {
      var matchId = action.matchId || selectedProgrammedMatchId();
      if (findConvocationForMatch(matchId, state.referenceData || {})) {
        return null;
      }
      return controller.generateConvocation(matchId);
    }
    if (action.type === 'loadConvocation') {
      return controller.loadConvocation(action.convocationId);
    }
    if (action.type === 'setFinalSelection') {
      return controller.setFinalSelection(action.convocationId, action.studentId, action.selected, action.reason || '');
    }
    if (action.type === 'assignPosition') {
      return controller.assignPosition(action.convocationId, action.studentId, action.position, action.reason || '');
    }
    if (action.type === 'approveConvocation') {
      var actor = String(action.actor || '').trim();
      if (!actor) {
        throw new Error('PANEL_APPROVAL_ACTOR_REQUIRED');
      }
      if (!action.convocationId) {
        return null;
      }
      return controller.approveConvocation(action.convocationId, actor);
    }
    if (action.type === 'prepareCommunications') {
      return controller.prepareConvocationCommunications(action.convocationId);
    }
    if (action.type === 'sendPendingCommunications') {
      return controller.sendPendingCommunications();
    }
    if (action.type === 'selectPlayedMatch') {
      if (!action.matchId) {
        return null;
      }
      state.selectedPlayedMatchId = action.matchId;
      return controller.loadPostMatch(action.matchId);
    }
    if (action.type === 'saveParticipation') {
      var saveMatchId = action.matchId || selectedPlayedMatchId();
      if (!saveMatchId) {
        return null;
      }
      return controller.saveParticipation(saveMatchId, action.studentId, formPayload(elementPayload(action.payload), ['CONDICION_INICIAL', 'MINUTOS_JUGADOS', 'GOLES', 'AMARILLAS', 'ROJAS', 'CALIFICACION', 'OBSERVACIONES']));
    }
    if (action.type === 'saveParticipationFromElement') {
      return dispatch({
        type: 'saveParticipation',
        matchId: action.button && action.button.getAttribute ? action.button.getAttribute('data-match-id') : '',
        studentId: action.button && action.button.getAttribute ? action.button.getAttribute('data-student-id') : '',
        payload: rowFromButton(action.button)
      });
    }
    if (action.type === 'resolveConvocationForMatch') {
      return resolveConvocationForMatch(action.matchId);
    }
    return null;
  }

  function writeContent(html, className) {
    if (!doc || typeof doc.getElementById !== 'function') {
      return html;
    }
    var content = doc.getElementById('content');
    if (content) {
      content.className = className || '';
      content.innerHTML = html;
    }
    return html;
  }

  function render(viewName, data) {
    if (viewName === 'dashboard') return writeContent(renderDashboard(data), 'grid');
    if (viewName === 'attendance') return writeContent(renderAttendance(data), '');
    if (viewName === 'matches') return writeContent(renderMatches(), '');
    if (viewName === 'convocations') return writeContent(renderConvocations(), '');
    if (viewName === 'postmatch') return writeContent(renderPostMatch(), '');
    if (viewName === 'alerts') return writeContent(renderAlerts(data), '');
    return writeContent('');
  }

  return {
    dispatch: dispatch,
    elementPayload: elementPayload,
    findConvocationForMatch: findConvocationForMatch,
    formPayload: formPayload,
    render: render,
    renderAlerts: renderAlerts,
    renderAttendance: renderAttendance,
    renderConvocationDetails: renderConvocationDetails,
    renderConvocations: renderConvocations,
    renderDashboard: renderDashboard,
    renderMatches: renderMatches,
    renderPostMatch: renderPostMatch,
    renderSessionSelector: renderSessionSelector
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createPanelRenderer: createPanelRenderer };
}

if (typeof globalThis !== 'undefined') {
  globalThis.createPanelRenderer = createPanelRenderer;
}
