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

  function matchIdForConvocation(convocationIdValue) {
    var reference = state.referenceData || {};
    var all = (reference.authoritativeConvocations || []).concat(reference.convocationProposals || []);
    var found = all.filter(function(item) { return convocationId(item) === convocationIdValue; })[0] || null;
    return convocationMatchId(found) || '';
  }

  function isCanonicalConvocationForMatch(convocationIdValue, matchId) {
    var canonical = findConvocationForMatch(matchId);
    return !!convocationIdValue && !!matchId && convocationId(canonical) === convocationIdValue;
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

  function validPlayedMatchId(candidate) {
    var matches = ((state.referenceData && state.referenceData.playedMatches) || []).filter(function(match) {
      return competitionMatches(match.competencia);
    });
    return matches.some(function(match) { return match.partidoId === candidate; }) ? candidate : '';
  }

  function defaultPlayedMatchId() {
    var matches = ((state.referenceData && state.referenceData.playedMatches) || []).filter(function(match) {
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
    if (route === 'matches') {
      return hydrateMatches(token);
    }
    if (route === 'postmatch') {
      return hydratePostMatch(token);
    }
    if (route === 'reports') {
      return hydrateReports(token);
    }
    if (route === 'communications') {
      return hydrateCommunications(token);
    }
    if (route === 'config') {
      return hydrateConfiguration(token);
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
    var owningMatchId = matchIdForConvocation(convocationIdValue);
    var expectedMatchId = matchId || owningMatchId || state.selectedProgrammedMatchId || '';
    if (!convocationIdValue) {
      if (!isFresh(token, 'convocations')) return null;
      state.convocation = { convocationId: '', details: [] };
      state.loading = false;
      if (typeof render.route === 'function') {
        render.route('convocations');
      }
      return null;
    }
    if (owningMatchId && state.selectedProgrammedMatchId && owningMatchId !== state.selectedProgrammedMatchId) {
      return null;
    }
    if (expectedMatchId && !isCanonicalConvocationForMatch(convocationIdValue, expectedMatchId)) {
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

  function hydrateMatches(token) {
    return rpc('getAppMatches', [], function(data) {
      state.matches = data || [];
      state.loading = false;
      if (typeof render.route === 'function') render.route('matches');
    }, {
      isCurrent: function() { return isFresh(token, 'matches'); }
    });
  }

  function loadMatches() {
    var token = nextEpoch('matches');
    state.loading = true;
    return hydrateMatches(token);
  }

  function hydratePostMatch(token) {
    var selected = validPlayedMatchId(state.selectedPlayedMatchId) || defaultPlayedMatchId();
    state.selectedPlayedMatchId = selected;
    if (!selected) {
      state.postMatch = { matchId: '', rows: [] };
      state.loading = false;
      if (typeof render.route === 'function') render.route('postmatch');
      return null;
    }
    return loadPostMatch(selected, token);
  }

  function loadPostMatch(matchId, existingToken) {
    var token = existingToken || nextEpoch('postmatch');
    var selected = validPlayedMatchId(matchId) || '';
    state.selectedPlayedMatchId = selected;
    state.postMatch = { matchId: selected, rows: [] };
    if (typeof render.route === 'function') render.route('postmatch');
    if (!selected) {
      state.loading = false;
      return null;
    }
    rpc('getAppConfiguration', [], function(data) {
      state.configuration = data || { entries: [] };
      if (typeof render.route === 'function') render.route('postmatch');
    }, {
      isCurrent: function() { return isFresh(token, 'postmatch') && state.selectedPlayedMatchId === selected; }
    });
    return rpc('getPanelParticipation', [selected], function(data) {
      state.postMatch = data || { matchId: selected, rows: [] };
      state.loading = false;
      if (typeof render.route === 'function') render.route('postmatch');
    }, {
      isCurrent: function() { return isFresh(token, 'postmatch') && state.selectedPlayedMatchId === selected; }
    });
  }

  function selectPlayedMatch(matchId) {
    var token = nextEpoch('postmatch');
    state.loading = true;
    return loadPostMatch(matchId, token);
  }

  function hydrateReports(token) {
    return rpc('getAppReports', [], function(data) {
      state.reports = data || {};
      state.loading = false;
      if (typeof render.route === 'function') render.route('reports');
    }, {
      isCurrent: function() { return isFresh(token, 'reports'); }
    });
  }

  function hydrateCommunications(token) {
    return rpc('getAppCommunications', [], function(data) {
      state.communications = data || { rows: [] };
      state.loading = false;
      if (typeof render.route === 'function') render.route('communications');
    }, {
      isCurrent: function() { return isFresh(token, 'communications'); }
    });
  }

  function hydrateConfiguration(token) {
    return rpc('getAppConfiguration', [], function(data) {
      state.configuration = data || { entries: [] };
      state.loading = false;
      if (typeof render.route === 'function') render.route('config');
    }, {
      isCurrent: function() { return isFresh(token, 'config'); }
    });
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
    if (!validPlayedMatchId(state.selectedPlayedMatchId)) {
      state.selectedPlayedMatchId = '';
      state.postMatch = { rows: [] };
    }
    return loadBootstrap(state.activeRoute || 'dashboard');
  }

  function createMatch(input) {
    var originRoute = state.activeRoute;
    if (state.matchWritePending) return null;
    state.matchWritePending = true;
    return rpc('commandCreateMatch', [input || {}], function() {
      if (originRoute === 'matches' && state.activeRoute === 'matches') loadBootstrap('matches');
    }, {
      isCurrent: function() { return originRoute === 'matches' && state.activeRoute === 'matches'; },
      onSettled: function() { state.matchWritePending = false; }
    });
  }

  function updateMatch(matchId, updates, actor) {
    var originRoute = state.activeRoute;
    var originMatchId = matchId;
    if (state.matchWritePending) return null;
    state.matchWritePending = true;
    return rpc('commandUpdateMatch', [matchId, updates || {}, actor], function() {
      state.editingMatchId = '';
      if (originRoute === 'matches' && state.activeRoute === 'matches') loadBootstrap('matches');
    }, {
      isCurrent: function() { return originRoute === 'matches' && state.activeRoute === 'matches' && originMatchId === matchId; },
      onSettled: function() { state.matchWritePending = false; }
    });
  }

  function markMatchPlayed(matchId, score, actor) {
    var originRoute = state.activeRoute;
    if (state.matchWritePending) return null;
    state.matchWritePending = true;
    return rpc('commandMarkMatchPlayed', [matchId, score || {}, actor], function() {
      if (originRoute === 'matches' && state.activeRoute === 'matches') loadBootstrap('matches');
    }, {
      isCurrent: function() { return originRoute === 'matches' && state.activeRoute === 'matches'; },
      onSettled: function() { state.matchWritePending = false; }
    });
  }

  function cancelMatch(matchId, actor) {
    var originRoute = state.activeRoute;
    if (state.matchWritePending) return null;
    state.matchWritePending = true;
    return rpc('commandCancelMatch', [matchId, actor], function() {
      if (originRoute === 'matches' && state.activeRoute === 'matches') loadBootstrap('matches');
    }, {
      isCurrent: function() { return originRoute === 'matches' && state.activeRoute === 'matches'; },
      onSettled: function() { state.matchWritePending = false; }
    });
  }

  function saveParticipation(matchId, studentId, payload, actor) {
    var originRoute = state.activeRoute;
    var originMatchId = matchId;
    state.participationWriteByStudent = state.participationWriteByStudent || {};
    if (state.participationWriteByStudent[studentId]) return null;
    state.participationWriteByStudent[studentId] = true;
    return rpc('commandSaveParticipation', [matchId, studentId, payload || {}, actor], function() {
      if (originRoute === 'postmatch' && state.activeRoute === 'postmatch' && state.selectedPlayedMatchId === originMatchId) {
        loadPostMatch(originMatchId);
      }
    }, {
      isCurrent: function() {
        return originRoute === 'postmatch' && state.activeRoute === 'postmatch' && state.selectedPlayedMatchId === originMatchId;
      },
      onSettled: function() { state.participationWriteByStudent[studentId] = false; }
    });
  }

  function markAttendance(sessionId, studentId, attendanceState) {
    var originRoute = state.activeRoute;
    var originSessionId = sessionId;
    return rpc('commandCreateAttendance', [{ sesionId: sessionId, alumnoId: studentId, estado: attendanceState }], function() {
      if (typeof render.feedback === 'function') {
        render.feedback('Guardado');
      }
      loadAttendance(originSessionId);
    }, {
      isCurrent: function() {
        return originRoute === 'attendance' &&
          state.activeRoute === 'attendance' &&
          state.selectedSessionId === originSessionId;
      }
    });
  }

  function resolveAbsence(attendanceId, targetState, reason) {
    var originRoute = state.activeRoute;
    var originSessionId = state.selectedSessionId || '';
    if (targetState !== 'FJ' && targetState !== 'LES') {
      throw new Error('PANEL_CLIENT_ABSENCE_TARGET_REJECTED');
    }
    return rpc('commandResolveAbsence', [attendanceId, targetState, { reason: reason || '' }], function() {
      if (typeof render.feedback === 'function') {
        render.feedback('Guardado');
      }
      loadAttendance(originSessionId);
    }, {
      isCurrent: function() {
        return originRoute === 'attendance' &&
          state.activeRoute === 'attendance' &&
          state.selectedSessionId === originSessionId;
      }
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
    var originRoute = state.activeRoute;
    var originMatchId = state.selectedProgrammedMatchId || matchIdForConvocation(convocationId);
    return rpc('commandSetFinalSelection', [convocationId, studentId, selected, reason || ''], function() {
      loadConvocation(convocationId, undefined, originMatchId);
    }, {
      isCurrent: function() {
        return originRoute === 'convocations' &&
          state.activeRoute === 'convocations' &&
          state.selectedProgrammedMatchId === originMatchId &&
          isCanonicalConvocationForMatch(convocationId, originMatchId);
      }
    });
  }

  function assignPosition(convocationId, studentId, position, reason) {
    var originRoute = state.activeRoute;
    var originMatchId = state.selectedProgrammedMatchId || matchIdForConvocation(convocationId);
    return rpc('commandAssignPosition', [convocationId, studentId, position, reason || ''], function() {
      loadConvocation(convocationId, undefined, originMatchId);
    }, {
      isCurrent: function() {
        return originRoute === 'convocations' &&
          state.activeRoute === 'convocations' &&
          state.selectedProgrammedMatchId === originMatchId &&
          isCanonicalConvocationForMatch(convocationId, originMatchId);
      }
    });
  }

  function approveConvocation(convocationId, actor) {
    var originRoute = state.activeRoute;
    var originMatchId = state.selectedProgrammedMatchId || matchIdForConvocation(convocationId);
    var trimmedActor = String(actor || '').trim();
    if (!trimmedActor) {
      throw new Error('PANEL_APPROVAL_ACTOR_REQUIRED');
    }
    return rpc('commandApproveConvocation', [convocationId, trimmedActor], function() {
      loadBootstrap('convocations');
    }, {
      isCurrent: function() {
        return originRoute === 'convocations' &&
          state.activeRoute === 'convocations' &&
          state.selectedProgrammedMatchId === originMatchId &&
          isCanonicalConvocationForMatch(convocationId, originMatchId);
      }
    });
  }

  function prepareConvocationCommunications(convocationId) {
    var originRoute = state.activeRoute;
    var originMatchId = state.selectedProgrammedMatchId || matchIdForConvocation(convocationId);
    return rpc('commandPrepareConvocationCommunications', [convocationId], function() {
      loadBootstrap('convocations');
    }, {
      isCurrent: function() {
        return originRoute === 'convocations' &&
          state.activeRoute === 'convocations' &&
          state.selectedProgrammedMatchId === originMatchId &&
          isCanonicalConvocationForMatch(convocationId, originMatchId);
      }
    });
  }

  function sendPendingCommunications() {
    var capabilities = (state.communications && state.communications.runtimeCapabilities) || (state.referenceData && state.referenceData.runtimeCapabilities) || {};
    var originRoute = state.activeRoute;
    var originMatchId = state.selectedProgrammedMatchId || '';
    var originConvocationId = state.selectedConvocationId || convocationId(findConvocationForMatch(originMatchId)) || '';
    if (capabilities.externalMailEnabled !== true) {
      throw new Error('PANEL_CLIENT_MAIL_DISABLED');
    }
    if (state.communicationWritePending) return null;
    state.communicationWritePending = true;
    return rpc('commandSendPendingCommunications', [], function() {
      if (originRoute === 'communications' && state.activeRoute === 'communications') loadBootstrap('communications');
      if (originRoute === 'convocations' &&
          state.activeRoute === 'convocations' &&
          state.selectedProgrammedMatchId === originMatchId &&
          (state.selectedConvocationId === originConvocationId || isCanonicalConvocationForMatch(originConvocationId, originMatchId))) {
        loadBootstrap('convocations');
      }
    }, {
      isCurrent: function() {
        if (originRoute === 'communications') return state.activeRoute === 'communications';
        return originRoute === 'convocations' &&
          state.activeRoute === 'convocations' &&
          state.selectedProgrammedMatchId === originMatchId &&
          (state.selectedConvocationId === originConvocationId || isCanonicalConvocationForMatch(originConvocationId, originMatchId));
      },
      onSettled: function() { state.communicationWritePending = false; }
    });
  }

  function retryCommunication(communicationId) {
    var capabilities = (state.communications && state.communications.runtimeCapabilities) || {};
    var originRoute = state.activeRoute;
    state.communicationRetryPendingById = state.communicationRetryPendingById || {};
    if (capabilities.externalMailEnabled !== true) {
      throw new Error('PANEL_CLIENT_MAIL_DISABLED');
    }
    if (state.communicationRetryPendingById[communicationId]) return null;
    state.communicationRetryPendingById[communicationId] = true;
    return rpc('commandRetryCommunication', [communicationId], function() {
      if (originRoute === 'communications' && state.activeRoute === 'communications') loadBootstrap('communications');
    }, {
      isCurrent: function() { return originRoute === 'communications' && state.activeRoute === 'communications'; },
      onSettled: function() { state.communicationRetryPendingById[communicationId] = false; }
    });
  }

  return {
    approveConvocation: approveConvocation,
    assignPosition: assignPosition,
    cancelMatch: cancelMatch,
    createMatch: createMatch,
    generateConvocation: generateConvocation,
    isFresh: isFresh,
    loadAttendance: loadAttendance,
    loadBootstrap: loadBootstrap,
    loadConvocation: loadConvocation,
    loadMatches: loadMatches,
    loadPostMatch: loadPostMatch,
    markAttendance: markAttendance,
    markMatchPlayed: markMatchPlayed,
    nextEpoch: nextEpoch,
    prepareConvocationCommunications: prepareConvocationCommunications,
    resolveAbsence: resolveAbsence,
    retryCommunication: retryCommunication,
    route: route,
    saveParticipation: saveParticipation,
    selectAttendanceSession: selectAttendanceSession,
    selectPlayedMatch: selectPlayedMatch,
    selectProgrammedMatch: selectProgrammedMatch,
    sendPendingCommunications: sendPendingCommunications,
    setCompetition: setCompetition,
    setFinalSelection: setFinalSelection,
    updateMatch: updateMatch
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createAppClientController: createAppClientController };
}

if (typeof globalThis !== 'undefined') {
  globalThis.createAppClientController = createAppClientController;
}
