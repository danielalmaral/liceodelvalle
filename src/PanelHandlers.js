function safePanelResponse(callback) {
  try {
    return { ok: true, data: callback() };
  } catch (error) {
    return {
      ok: false,
      code: String(error && error.message ? error.message : 'PANEL_ERROR').split(':')[0],
      message: 'No se pudo completar la operacion solicitada.'
    };
  }
}

function panelRuntime() {
  return createLdvAppsScriptRuntime();
}

function serverOperationId(runtime) {
  if (!runtime.runtime || !runtime.runtime.idGenerator || typeof runtime.runtime.idGenerator.operationId !== 'function') {
    throw new Error('RUNTIME_OPERATION_ID_GENERATOR_REQUIRED');
  }
  return runtime.runtime.idGenerator.operationId();
}

function withPanelOperation(commandName, callback) {
  return safePanelResponse(function() {
    var runtime = panelRuntime();
    var operationId = serverOperationId(runtime);
    if (!runtime.commands || typeof runtime.commands[commandName] !== 'function') {
      throw new Error('PANEL_COMMAND_REQUIRED: ' + commandName);
    }
    return callback(runtime, operationId);
  });
}

function getPanelDashboard() {
  return safePanelResponse(function() { return panelRuntime().queries.getPanelDashboard(); });
}

function getPanelAttendance(sessionId) {
  return safePanelResponse(function() { return panelRuntime().queries.getPanelAttendance(sessionId); });
}

function getPanelConvocation(convocationId) {
  return safePanelResponse(function() { return panelRuntime().queries.getPanelConvocation(convocationId); });
}

function getPanelParticipation(matchId) {
  return safePanelResponse(function() { return panelRuntime().queries.getPanelParticipation(matchId); });
}

function commandCreateSession(input) {
  return withPanelOperation('createSession', function(runtime, operationId) {
    return runtime.commands.createSession(input, { operationId: operationId, actor: input && input.actor });
  });
}

function commandCloseSession(sessionId, actor) {
  return withPanelOperation('closeSession', function(runtime, operationId) {
    return runtime.commands.closeSession(sessionId, actor, { operationId: operationId });
  });
}

function commandCreateAttendance(input) {
  return safePanelResponse(function() { return panelRuntime().commands.createAttendance(input); });
}

function commandResolveAbsence(attendanceId, targetState, options) {
  return withPanelOperation('resolveAbsence', function(runtime, operationId) {
    options = options || {};
    options.operationId = operationId;
    return runtime.commands.resolveAbsence(attendanceId, targetState, options);
  });
}

function commandCreateMatch(input) {
  return withPanelOperation('createMatch', function(runtime, operationId) {
    return runtime.commands.createMatch(input, { operationId: operationId, actor: input && input.actor });
  });
}

function commandUpdateMatch(matchId, updates, actor) {
  return withPanelOperation('updateMatch', function(runtime, operationId) {
    return runtime.commands.updateMatch(matchId, updates, actor, { operationId: operationId });
  });
}

function commandMarkMatchPlayed(matchId, score, actor) {
  return withPanelOperation('markMatchPlayed', function(runtime, operationId) {
    return runtime.commands.markMatchPlayed(matchId, score, actor, { operationId: operationId });
  });
}

function commandCancelMatch(matchId, actor) {
  return withPanelOperation('cancelMatch', function(runtime, operationId) {
    return runtime.commands.cancelMatch(matchId, actor, { operationId: operationId });
  });
}

function commandUpdateSportsState(studentId, state, actor, reasonCode) {
  return withPanelOperation('updateStudentSportsState', function(runtime, operationId) {
    return runtime.commands.updateStudentSportsState(studentId, state, actor, reasonCode, { operationId: operationId });
  });
}

function commandGenerateConvocation(matchId, actor) {
  return safePanelResponse(function() { return panelRuntime().commands.generateConvocation(matchId, actor); });
}

function commandSetFinalSelection(convocationId, studentId, selected, reason, actor) {
  return withPanelOperation('setFinalSelection', function(runtime, operationId) {
    return runtime.commands.setFinalSelection(convocationId, studentId, selected, reason, { operationId: operationId, actor: actor });
  });
}

function commandAssignPosition(convocationId, studentId, position, reason, actor) {
  return withPanelOperation('assignPlayerPosition', function(runtime, operationId) {
    return runtime.commands.assignPlayerPosition(convocationId, studentId, position, reason, { operationId: operationId, actor: actor });
  });
}

function commandApproveConvocation(convocationId, actor) {
  return withPanelOperation('approveConvocation', function(runtime, operationId) {
    return runtime.commands.approveConvocation(convocationId, actor, { operationId: operationId });
  });
}

function commandPrepareConvocationCommunications(convocationId) {
  return safePanelResponse(function() { return panelRuntime().commands.generateConvocationCommunications(convocationId); });
}

function commandSendPendingCommunications() {
  return withPanelOperation('sendPendingCommunications', function(runtime, operationId) {
    return runtime.commands.sendPendingCommunications({ operationId: operationId });
  });
}

function commandCreateParticipation(input) {
  return withPanelOperation('createParticipation', function(runtime, operationId) {
    return runtime.commands.createParticipation(input, { operationId: operationId, actor: input && input.actor });
  });
}

function commandUpdateParticipation(participationId, updates, actor) {
  return withPanelOperation('updateParticipation', function(runtime, operationId) {
    return runtime.commands.updateParticipation(participationId, updates, { operationId: operationId, actor: actor });
  });
}

if (typeof module !== 'undefined') {
  module.exports = {
    commandApproveConvocation,
    commandAssignPosition,
    commandCancelMatch,
    commandCloseSession,
    commandCreateAttendance,
    commandCreateMatch,
    commandCreateParticipation,
    commandCreateSession,
    commandGenerateConvocation,
    commandMarkMatchPlayed,
    commandPrepareConvocationCommunications,
    commandResolveAbsence,
    commandSendPendingCommunications,
    commandSetFinalSelection,
    commandUpdateMatch,
    commandUpdateParticipation,
    commandUpdateSportsState,
    getPanelAttendance,
    getPanelConvocation,
    getPanelDashboard,
    getPanelParticipation,
    safePanelResponse
  };
}
