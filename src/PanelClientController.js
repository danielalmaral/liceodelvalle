function createPanelClientController(dependencies) {
  dependencies = dependencies || {};
  var callServer = dependencies.callServer;
  var state = dependencies.state || {};
  var render = dependencies.render || {};

  if (typeof callServer !== 'function') {
    throw new Error('PANEL_CLIENT_RPC_REQUIRED');
  }

  function setState(key, value) {
    state[key] = value;
    if (typeof render.stateChanged === 'function') {
      render.stateChanged(key, value);
    }
  }

  function safeErrorMessage(response) {
    var code = response && typeof response.code === 'string' ? response.code : '';
    var message = 'No se pudo completar la operacion solicitada.';

    if (/^[A-Z][A-Z0-9_]*$/.test(code)) {
      return message + ' [' + code + ']';
    }

    return message;
  }

  function onFailure(error) {
    var message = safeErrorMessage(error);
    setState('error', message);
    if (typeof render.error === 'function') {
      render.error(message);
    }
  }

  function onSuccess(key, renderer) {
    return function(response) {
      if (!response || response.ok === false) {
        onFailure(response);
        return;
      }
      setState('error', '');
      if (typeof render.error === 'function') {
        render.error('');
      }
      setState(key, response.data);
      if (typeof renderer === 'function') {
        renderer(response.data);
      }
    };
  }

  function rpc(name, args, key, renderer) {
    return callServer(name, args || [], onSuccess(key, renderer), onFailure);
  }

  function loadReferenceData(callback) {
    return rpc('getPanelReferenceData', [], 'referenceData', callback || render.referenceData);
  }

  function selectedSessionId(sessionId) {
    var reference = state.referenceData || {};
    var dashboard = state.dashboard || {};
    var sessions = reference.openSessions || [];
    return sessionId ||
      (dashboard.currentSession && dashboard.currentSession.sesionId) ||
      (dashboard.nextSession && dashboard.nextSession.sesionId) ||
      (sessions[0] && sessions[0].sesionId) ||
      '';
  }

  function loadDashboard() {
    return rpc('getPanelDashboard', [], 'dashboard', render.dashboard);
  }

  function loadAttendance(sessionId) {
    var id = selectedSessionId(sessionId);
    if (!id) {
      return null;
    }
    setState('selectedSessionId', id);
    return rpc('getPanelAttendance', [id], 'attendance', render.attendance);
  }

  function markAttendance(sessionId, studentId, attendanceState) {
    var id = selectedSessionId(sessionId);
    return rpc('commandCreateAttendance', [{ sesionId: id, alumnoId: studentId, estado: attendanceState }], 'attendanceWrite', function(data) {
      if (typeof render.attendanceWrite === 'function') {
        render.attendanceWrite(data);
      }
      loadAttendance(id);
    });
  }

  function resolveAbsence(attendanceId, targetState, reason) {
    if (targetState !== 'FJ' && targetState !== 'LES') {
      throw new Error('PANEL_CLIENT_ABSENCE_TARGET_REJECTED');
    }
    return rpc('commandResolveAbsence', [attendanceId, targetState, { reason: reason || '' }], 'absenceWrite', function(data) {
      if (typeof render.absenceWrite === 'function') {
        render.absenceWrite(data);
      }
      loadAttendance(state.selectedSessionId);
    });
  }

  function createMatch(payload) {
    return rpc('commandCreateMatch', [payload || {}], 'matchWrite', render.matchWrite);
  }

  function updateMatch(matchId, payload) {
    return rpc('commandUpdateMatch', [matchId, payload || {}], 'matchWrite', render.matchWrite);
  }

  function markMatchPlayed(matchId, score) {
    return rpc('commandMarkMatchPlayed', [matchId, score || {}], 'matchWrite', render.matchWrite);
  }

  function cancelMatch(matchId) {
    return rpc('commandCancelMatch', [matchId], 'matchWrite', render.matchWrite);
  }

  function generateConvocation(matchId) {
    return rpc('commandGenerateConvocation', [matchId], 'convocationWrite', render.convocationWrite);
  }

  function loadConvocation(convocationId) {
    return rpc('getPanelConvocation', [convocationId], 'convocation', render.convocation);
  }

  function setFinalSelection(convocationId, studentId, selected, reason) {
    return rpc('commandSetFinalSelection', [convocationId, studentId, selected, reason || ''], 'convocationWrite', render.convocationWrite);
  }

  function assignPosition(convocationId, studentId, position, reason) {
    return rpc('commandAssignPosition', [convocationId, studentId, position, reason || ''], 'convocationWrite', render.convocationWrite);
  }

  function approveConvocation(convocationId, actor) {
    return rpc('commandApproveConvocation', [convocationId, actor], 'convocationWrite', render.convocationWrite);
  }

  function prepareConvocationCommunications(convocationId) {
    return rpc('commandPrepareConvocationCommunications', [convocationId], 'communicationWrite', render.communicationWrite);
  }

  function sendPendingCommunications() {
    var capabilities = (state.referenceData && state.referenceData.runtimeCapabilities) || {};
    if (capabilities.externalMailEnabled !== true) {
      throw new Error('PANEL_CLIENT_MAIL_DISABLED');
    }
    return rpc('commandSendPendingCommunications', [], 'communicationWrite', render.communicationWrite);
  }

  function loadPostMatch(matchId) {
    if (!matchId) {
      return null;
    }
    setState('selectedPlayedMatchId', matchId);
    return rpc('getPanelParticipation', [matchId], 'postMatch', render.postMatch);
  }

  function saveParticipation(matchId, studentId, payload) {
    return rpc('commandSaveParticipation', [matchId, studentId, payload || {}], 'participationWrite', render.participationWrite);
  }

  return {
    assignPosition: assignPosition,
    approveConvocation: approveConvocation,
    cancelMatch: cancelMatch,
    createMatch: createMatch,
    generateConvocation: generateConvocation,
    loadAttendance: loadAttendance,
    loadConvocation: loadConvocation,
    loadDashboard: loadDashboard,
    loadPostMatch: loadPostMatch,
    loadReferenceData: loadReferenceData,
    markAttendance: markAttendance,
    markMatchPlayed: markMatchPlayed,
    prepareConvocationCommunications: prepareConvocationCommunications,
    resolveAbsence: resolveAbsence,
    saveParticipation: saveParticipation,
    sendPendingCommunications: sendPendingCommunications,
    setFinalSelection: setFinalSelection,
    updateMatch: updateMatch
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createPanelClientController };
}

if (typeof globalThis !== 'undefined') {
  globalThis.createPanelClientController = createPanelClientController;
}
