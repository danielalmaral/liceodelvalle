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

  function onFailure(error, options) {
    options = options || {};
    if (typeof options.isCurrent === 'function' && !options.isCurrent()) {
      return;
    }
    if (options.clearGeneratePending === true) {
      state.convocationGeneratePending = false;
    }
    state.error = safeErrorMessage(error);
    if (typeof render.error === 'function') {
      render.error(state.error);
    }
    if (typeof render.route === 'function' && state.activeRoute) {
      render.route(state.activeRoute);
    }
  }

  function rpc(name, args, onSuccess, options) {
    options = options || {};
    var settled = false;
    function settle() {
      if (!settled && typeof options.onSettled === 'function') {
        settled = true;
        options.onSettled();
      }
    }
    return callServer(name, args || [], function(response) {
      settle();
      if (!response || response.ok === false) {
        onFailure(response, options);
        return;
      }
      if (typeof options.isCurrent === 'function' && !options.isCurrent()) {
        return;
      }
      state.error = '';
      if (typeof render.error === 'function') {
        render.error('');
      }
      if (typeof onSuccess === 'function') {
        onSuccess(response.data);
      }
    }, function(error) {
      settle();
      onFailure(error, options);
    });
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
      state.bootstrap = data || {};
      state.dashboard = state.bootstrap.dashboard || {};
      state.referenceData = state.bootstrap.referenceData || {};
      state.students = state.bootstrap.students || [];
      hydrateRoute(state.activeRoute, token);
    }, {
      isCurrent: function() { return isFresh(token); }
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
      state.attendance = data || { rows: [] };
      state.loading = false;
      if (typeof render.route === 'function') {
        render.route('attendance');
      }
      if (typeof render.feedback === 'function') {
        render.feedback('');
      }
    }, {
      isCurrent: function() { return isFresh(token, 'attendance') && state.selectedSessionId === selected; }
    });
  }

  function selectAttendanceSession(sessionId) {
    var token = nextEpoch('attendance');
    var selected = validSessionId(sessionId) || '';
    state.selectedSessionId = selected;
    state.loading = true;
    state.attendance = { sessionId: selected, rows: [] };
    if (typeof render.route === 'function') {
      render.route('attendance');
    }
    if (!selected) {
      state.loading = false;
      if (typeof render.route === 'function') render.route('attendance');
      return null;
    }
    return rpc('getPanelAttendance', [selected], function(data) {
      state.attendance = data || { sessionId: selected, rows: [] };
      state.loading = false;
      if (typeof render.route === 'function') {
        render.route('attendance');
      }
      if (typeof render.feedback === 'function') {
        render.feedback('');
      }
    }, {
      isCurrent: function() { return isFresh(token, 'attendance') && state.selectedSessionId === selected; }
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
    return rpc('getPanelConvocation', [convocationIdValue], function(data) {
      state.convocation = data || { convocationId: '', details: [] };
      state.selectedConvocationId = convocationIdValue;
      state.loading = false;
      if (typeof render.route === 'function') {
        render.route('convocations');
      }
    }, {
      isCurrent: function() {
        return isFresh(token, 'convocations') &&
          state.selectedProgrammedMatchId === expectedMatchId;
      }
    });
  }

  function selectProgrammedMatch(matchId) {
    var token = nextEpoch('convocations');
    var selected = validMatchId(matchId) || '';
    var existing;
    state.selectedProgrammedMatchId = selected;
    state.loading = true;
    state.selectedConvocationId = '';
    state.convocation = { convocationId: '', details: [] };
    if (typeof render.route === 'function') {
      render.route('convocations');
    }
    if (!selected) {
      state.loading = false;
      if (typeof render.route === 'function') render.route('convocations');
      return null;
    }
    existing = findConvocationForMatch(selected);
    if (!existing || !convocationId(existing)) {
      state.loading = false;
      if (typeof render.route === 'function') render.route('convocations');
      return null;
    }
    return loadConvocation(convocationId(existing), token, selected);
  }

  function setCompetition(value) {
    var next = String(value || '').trim().toUpperCase();
    if (next !== 'ALL' && next !== 'A' && next !== 'B') {
      throw new Error('APP_COMPETITION_REJECTED');
    }
    nextEpoch(state.activeRoute || 'dashboard');
    state.selectedCompetition = next;
    if (!validSessionId(state.selectedSessionId)) {
      state.selectedSessionId = '';
      state.attendance = { rows: [] };
    }
    if (!validMatchId(state.selectedProgrammedMatchId)) {
      state.selectedProgrammedMatchId = '';
      state.selectedConvocationId = '';
      state.convocation = { convocationId: '', details: [] };
    }
    return loadBootstrap(state.activeRoute || 'dashboard');
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
    var originRoute = state.activeRoute;
    var originMatchId = validMatchId(matchId) || matchId;
    var token = state.requestEpoch;
    if (state.convocationGeneratePending) {
      return null;
    }
    if (findConvocationForMatch(originMatchId)) {
      return null;
    }
    state.selectedProgrammedMatchId = originMatchId;
    state.convocationGeneratePending = true;
    if (typeof render.route === 'function') {
      render.route('convocations');
    }
    return rpc('commandGenerateConvocation', [originMatchId], function(data) {
      var newId = convocationId(data);
      if (state.activeRoute !== 'convocations' || state.selectedProgrammedMatchId !== originMatchId || state.requestEpoch !== token) {
        return;
      }
      if (newId) {
        state.selectedConvocationId = newId;
      }
      loadBootstrap('convocations');
    }, {
      isCurrent: function() {
        return state.activeRoute === 'convocations' &&
          state.selectedProgrammedMatchId === originMatchId &&
          state.requestEpoch === token &&
          originRoute === 'convocations';
      },
      onSettled: function() {
        state.convocationGeneratePending = false;
      }
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
    selectAttendanceSession: selectAttendanceSession,
    selectProgrammedMatch: selectProgrammedMatch,
    sendPendingCommunications: sendPendingCommunications,
    setCompetition: setCompetition,
    setFinalSelection: setFinalSelection
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createAppClientController: createAppClientController };
}

if (typeof globalThis !== 'undefined') {
  globalThis.createAppClientController = createAppClientController;
}
