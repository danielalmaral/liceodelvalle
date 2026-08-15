function createAppClientController(dependencies) {
  dependencies = dependencies || {};
  var callServer = dependencies.callServer;
  var state = dependencies.state || {};
  var render = dependencies.render || {};
  var epoch = 0;

  if (typeof callServer !== 'function') {
    throw new Error('APP_CLIENT_RPC_REQUIRED');
  }

  function nextEpoch(route) {
    epoch += 1;
    state.requestEpoch = epoch;
    state.activeRoute = route || state.activeRoute || 'dashboard';
    return epoch;
  }

  function isFresh(token, route) {
    return token === state.requestEpoch && (!route || state.activeRoute === route);
  }

  function convocationId(source) {
    return source && (
      source.CONVOCATORIA_ID ||
      source.convocationId ||
      (source.convocation && (source.convocation.CONVOCATORIA_ID || source.convocation.convocationId))
    );
  }

  function convocationMatchId(source) {
    return source && (source.PARTIDO_ID || source.partidoId || source.matchId);
  }

  function findConvocationForMatch(matchId) {
    var reference = state.referenceData || {};
    var all = (reference.authoritativeConvocations || []).concat(reference.convocationProposals || []);
    return all.filter(function(item) { return convocationMatchId(item) === matchId; })[0] || null;
  }

  function selectedCompetition() {
    return state.selectedCompetition || 'ALL';
  }

  function competitionMatches(value) {
    var selected = selectedCompetition();
    return selected === 'ALL' || value === selected || value === 'GENERAL';
  }

  function validSessionId(candidate) {
    var sessions = ((state.referenceData && state.referenceData.openSessions) || []).filter(function(session) {
      return competitionMatches(session.competencia);
    });
    return sessions.some(function(session) { return session.sesionId === candidate; }) ? candidate : '';
  }

  function defaultSessionId() {
    var sessions = ((state.referenceData && state.referenceData.openSessions) || []).filter(function(session) {
      return competitionMatches(session.competencia);
    });
    return sessions[0] && sessions[0].sesionId || '';
  }

  function validMatchId(candidate) {
    var matches = ((state.referenceData && state.referenceData.programmedMatches) || []).filter(function(match) {
      return competitionMatches(match.competencia);
    });
    return matches.some(function(match) { return match.partidoId === candidate; }) ? candidate : '';
  }

  function defaultMatchId() {
    var matches = ((state.referenceData && state.referenceData.programmedMatches) || []).filter(function(match) {
      return competitionMatches(match.competencia);
    });
    return matches[0] && matches[0].partidoId || '';
  }

  function safeErrorMessage(response) {
    var code = response && typeof response.code === 'string' ? response.code : '';
    var message = 'No se pudo completar la operacion solicitada.';
    return /^[A-Z][A-Z0-9_]*$/.test(code) ? message + ' [' + code + ']' : message;
  }

  function onFailure(error) {
    state.convocationGeneratePending = false;
    state.error = safeErrorMessage(error);
    if (typeof render.error === 'function') {
      render.error(state.error);
    }
    if (typeof render.route === 'function' && state.activeRoute) {
      render.route(state.activeRoute);
    }
  }

  function rpc(name, args, onSuccess) {
    return callServer(name, args || [], function(response) {
      if (!response || response.ok === false) {
        onFailure(response);
        return;
      }
      state.error = '';
      if (typeof render.error === 'function') {
        render.error('');
      }
      if (typeof onSuccess === 'function') {
        onSuccess(response.data);
      }
    }, onFailure);
  }

  function hydrateRoute(route, token) {
    if (!isFresh(token, route)) {
      return null;
    }
    if (route === 'attendance') {
      return hydrateAttendance(token);
    }
    if (route === 'convocations') {
      return hydrateConvocations(token);
    }
    state.loading = false;
    if (typeof render.route === 'function') {
      render.route(state.activeRoute);
    }
    return null;
  }

  function loadBootstrap(route) {
    var token = nextEpoch(route || state.activeRoute || 'dashboard');
    state.loading = true;
    if (typeof render.loading === 'function') {
      render.loading();
    }
    return rpc('getAppBootstrap', [], function(data) {
      if (!isFresh(token)) {
        return;
      }
      state.bootstrap = data || {};
      state.dashboard = state.bootstrap.dashboard || {};
      state.referenceData = state.bootstrap.referenceData || {};
      state.students = state.bootstrap.students || [];
      hydrateRoute(state.activeRoute, token);
    });
  }

  function route(routeName) {
    state.activeRoute = routeName || 'dashboard';
    return loadBootstrap(state.activeRoute);
  }

  function hydrateAttendance(token) {
    var selected = validSessionId(state.selectedSessionId) || defaultSessionId();
    if (!selected) {
      state.attendance = { rows: [] };
      state.loading = false;
      if (typeof render.route === 'function') {
        render.route('attendance');
      }
      return null;
    }
    return loadAttendance(selected, token);
  }

  function loadAttendance(sessionId, existingToken) {
    var token = existingToken || nextEpoch('attendance');
    var selected = validSessionId(sessionId) || validSessionId(state.selectedSessionId) || defaultSessionId();
    if (!selected) {
      if (!isFresh(token, 'attendance')) return null;
      state.attendance = { rows: [] };
      state.loading = false;
      if (typeof render.route === 'function') render.route('attendance');
      return null;
    }
    state.selectedSessionId = selected;
    return rpc('getPanelAttendance', [selected], function(data) {
      if (!isFresh(token, 'attendance') || state.selectedSessionId !== selected) {
        return;
      }
      state.attendance = data || { rows: [] };
      state.loading = false;
      if (typeof render.route === 'function') {
        render.route('attendance');
      }
      if (typeof render.feedback === 'function') {
        render.feedback('');
      }
    });
  }

  function hydrateConvocations(token) {
    var selectedMatch = validMatchId(state.selectedProgrammedMatchId) || defaultMatchId();
    var existing;
    state.selectedProgrammedMatchId = selectedMatch;
    if (!selectedMatch) {
      state.convocation = { convocationId: '', details: [] };
      state.loading = false;
      if (typeof render.route === 'function') render.route('convocations');
      return null;
    }
    existing = findConvocationForMatch(selectedMatch);
    if (!existing || !convocationId(existing)) {
      state.selectedConvocationId = '';
      state.convocation = { convocationId: '', details: [] };
      state.loading = false;
      if (typeof render.route === 'function') render.route('convocations');
      return null;
    }
    return loadConvocation(convocationId(existing), token, selectedMatch);
  }

  function loadConvocation(convocationIdValue, existingToken, matchId) {
    var token = existingToken || nextEpoch('convocations');
    var expectedMatchId = matchId || state.selectedProgrammedMatchId || '';
    if (!convocationIdValue) {
      if (!isFresh(token, 'convocations')) return null;
      state.convocation = { convocationId: '', details: [] };
      state.loading = false;
      if (typeof render.route === 'function') {
        render.route('convocations');
      }
      return null;
    }
    state.selectedConvocationId = convocationIdValue;
    return rpc('getPanelConvocation', [convocationIdValue], function(data) {
      if (!isFresh(token, 'convocations') || state.selectedProgrammedMatchId !== expectedMatchId || state.selectedConvocationId !== convocationIdValue) {
        return;
      }
      state.convocation = data || { convocationId: '', details: [] };
      state.loading = false;
      if (typeof render.route === 'function') {
        render.route('convocations');
      }
    });
  }

  function markAttendance(sessionId, studentId, attendanceState) {
    return rpc('commandCreateAttendance', [{ sesionId: sessionId, alumnoId: studentId, estado: attendanceState }], function() {
      if (state.activeRoute !== 'attendance') {
        return;
      }
      if (typeof render.feedback === 'function') {
        render.feedback('Guardado');
      }
      loadAttendance(sessionId);
    });
  }

  function resolveAbsence(attendanceId, targetState, reason) {
    if (targetState !== 'FJ' && targetState !== 'LES') {
      throw new Error('PANEL_CLIENT_ABSENCE_TARGET_REJECTED');
    }
    return rpc('commandResolveAbsence', [attendanceId, targetState, { reason: reason || '' }], function() {
      if (state.activeRoute !== 'attendance') {
        return;
      }
      if (typeof render.feedback === 'function') {
        render.feedback('Guardado');
      }
      loadAttendance(state.selectedSessionId);
    });
  }

  function generateConvocation(matchId) {
    if (state.convocationGeneratePending) {
      return null;
    }
    if (findConvocationForMatch(matchId)) {
      return null;
    }
    state.convocationGeneratePending = true;
    if (typeof render.route === 'function') {
      render.route('convocations');
    }
    return rpc('commandGenerateConvocation', [matchId], function(data) {
      var newId = convocationId(data);
      state.convocationGeneratePending = false;
      if (newId) {
        state.selectedConvocationId = newId;
      }
      loadBootstrap('convocations');
    });
  }

  function setFinalSelection(convocationId, studentId, selected, reason) {
    return rpc('commandSetFinalSelection', [convocationId, studentId, selected, reason || ''], function() {
      if (state.activeRoute === 'convocations') loadConvocation(convocationId);
    });
  }

  function assignPosition(convocationId, studentId, position, reason) {
    return rpc('commandAssignPosition', [convocationId, studentId, position, reason || ''], function() {
      if (state.activeRoute === 'convocations') loadConvocation(convocationId);
    });
  }

  function approveConvocation(convocationId, actor) {
    var trimmedActor = String(actor || '').trim();
    if (!trimmedActor) {
      throw new Error('PANEL_APPROVAL_ACTOR_REQUIRED');
    }
    return rpc('commandApproveConvocation', [convocationId, trimmedActor], function() {
      if (state.activeRoute === 'convocations') loadBootstrap('convocations');
    });
  }

  function prepareConvocationCommunications(convocationId) {
    return rpc('commandPrepareConvocationCommunications', [convocationId], function() {
      if (state.activeRoute === 'convocations') loadBootstrap('convocations');
    });
  }

  function sendPendingCommunications() {
    var capabilities = (state.referenceData && state.referenceData.runtimeCapabilities) || {};
    if (capabilities.externalMailEnabled !== true) {
      throw new Error('PANEL_CLIENT_MAIL_DISABLED');
    }
    return rpc('commandSendPendingCommunications', [], function() {
      if (state.activeRoute) loadBootstrap(state.activeRoute);
    });
  }

  return {
    approveConvocation: approveConvocation,
    assignPosition: assignPosition,
    generateConvocation: generateConvocation,
    isFresh: isFresh,
    loadAttendance: loadAttendance,
    loadBootstrap: loadBootstrap,
    loadConvocation: loadConvocation,
    markAttendance: markAttendance,
    nextEpoch: nextEpoch,
    prepareConvocationCommunications: prepareConvocationCommunications,
    resolveAbsence: resolveAbsence,
    route: route,
    sendPendingCommunications: sendPendingCommunications,
    setFinalSelection: setFinalSelection
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createAppClientController: createAppClientController };
}

if (typeof globalThis !== 'undefined') {
  globalThis.createAppClientController = createAppClientController;
}
