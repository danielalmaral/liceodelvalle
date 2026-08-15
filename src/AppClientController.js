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

  function isFresh(token) {
    return token === state.requestEpoch;
  }

  function safeErrorMessage(response) {
    var code = response && typeof response.code === 'string' ? response.code : '';
    var message = 'No se pudo completar la operacion solicitada.';
    return /^[A-Z][A-Z0-9_]*$/.test(code) ? message + ' [' + code + ']' : message;
  }

  function onFailure(error) {
    state.error = safeErrorMessage(error);
    if (typeof render.error === 'function') {
      render.error(state.error);
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
      state.loading = false;
      if (typeof render.route === 'function') {
        render.route(state.activeRoute);
      }
    });
  }

  function route(routeName) {
    state.activeRoute = routeName || 'dashboard';
    return loadBootstrap(state.activeRoute);
  }

  function loadAttendance(sessionId) {
    var selected = sessionId || state.selectedSessionId || '';
    if (!selected) {
      var sessions = (state.referenceData && state.referenceData.openSessions) || [];
      selected = sessions[0] && sessions[0].sesionId || '';
    }
    if (!selected) {
      state.attendance = { rows: [] };
      if (typeof render.route === 'function') {
        render.route('attendance');
      }
      return null;
    }
    state.selectedSessionId = selected;
    return rpc('getPanelAttendance', [selected], function(data) {
      state.attendance = data || { rows: [] };
      if (typeof render.route === 'function') {
        render.route('attendance');
      }
      if (typeof render.feedback === 'function') {
        render.feedback('');
      }
    });
  }

  function loadConvocation(convocationId) {
    if (!convocationId) {
      state.convocation = { convocationId: '', details: [] };
      if (typeof render.route === 'function') {
        render.route('convocations');
      }
      return null;
    }
    state.selectedConvocationId = convocationId;
    return rpc('getPanelConvocation', [convocationId], function(data) {
      state.convocation = data || { convocationId: '', details: [] };
      if (typeof render.route === 'function') {
        render.route('convocations');
      }
    });
  }

  function markAttendance(sessionId, studentId, attendanceState) {
    return rpc('commandCreateAttendance', [{ sesionId: sessionId, alumnoId: studentId, estado: attendanceState }], function() {
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
      if (typeof render.feedback === 'function') {
        render.feedback('Guardado');
      }
      loadAttendance(state.selectedSessionId);
    });
  }

  function generateConvocation(matchId) {
    return rpc('commandGenerateConvocation', [matchId], function(data) {
      if (data && (data.CONVOCATORIA_ID || data.convocationId)) {
        loadConvocation(data.CONVOCATORIA_ID || data.convocationId);
      }
    });
  }

  function setFinalSelection(convocationId, studentId, selected, reason) {
    return rpc('commandSetFinalSelection', [convocationId, studentId, selected, reason || ''], function() {
      loadConvocation(convocationId);
    });
  }

  function assignPosition(convocationId, studentId, position, reason) {
    return rpc('commandAssignPosition', [convocationId, studentId, position, reason || ''], function() {
      loadConvocation(convocationId);
    });
  }

  function approveConvocation(convocationId, actor) {
    var trimmedActor = String(actor || '').trim();
    if (!trimmedActor) {
      throw new Error('PANEL_APPROVAL_ACTOR_REQUIRED');
    }
    return rpc('commandApproveConvocation', [convocationId, trimmedActor], function() {
      loadBootstrap('convocations');
      loadConvocation(convocationId);
    });
  }

  function prepareConvocationCommunications(convocationId) {
    return rpc('commandPrepareConvocationCommunications', [convocationId], function() {
      loadBootstrap('convocations');
    });
  }

  function sendPendingCommunications() {
    var capabilities = (state.referenceData && state.referenceData.runtimeCapabilities) || {};
    if (capabilities.externalMailEnabled !== true) {
      throw new Error('PANEL_CLIENT_MAIL_DISABLED');
    }
    return rpc('commandSendPendingCommunications', [], function() {
      loadBootstrap(state.activeRoute);
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
