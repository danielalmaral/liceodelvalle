function toPanelSerializable(value, seen) {
  var activeSeen = seen || [];
  var output;

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'function') {
    throw new Error('PANEL_SERIALIZATION_FUNCTION_REJECTED');
  }

  if (typeof value !== 'object') {
    throw new Error('PANEL_SERIALIZATION_TYPE_REJECTED');
  }

  if (activeSeen.indexOf(value) !== -1) {
    throw new Error('PANEL_SERIALIZATION_CIRCULAR_REJECTED');
  }

  activeSeen.push(value);
  if (Array.isArray(value)) {
    output = value.map(function(item) {
      var serialized = toPanelSerializable(item, activeSeen);
      return serialized === undefined ? null : serialized;
    });
  } else {
    output = {};
    Object.keys(value).forEach(function(key) {
      var serialized = toPanelSerializable(value[key], activeSeen);
      if (serialized !== undefined) {
        output[key] = serialized;
      }
    });
  }
  activeSeen.pop();
  return output;
}

function safePanelResponse(callback) {
  try {
    return { ok: true, data: toPanelSerializable(callback()) };
  } catch (error) {
    var rawCode = String(error && error.message ? error.message : 'PANEL_ERROR').split(':')[0];
    return {
      ok: false,
      code: rawCode
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, '[email]')
        .replace(/(?:\+?\d[\s.-]?){10,}/g, '[number]'),
      message: 'No se pudo completar la operacion solicitada.'
    };
  }
}

var panelRuntimeFactoryForTest = null;

function setPanelRuntimeFactoryForTest_(factory) {
  panelRuntimeFactoryForTest = factory;
}

function panelRuntime() {
  if (panelRuntimeFactoryForTest) {
    return panelRuntimeFactoryForTest();
  }
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

function getPanelReferenceData() {
  return safePanelResponse(function() { return panelRuntime().queries.getPanelReferenceData(); });
}

function commandCreateSession(input) {
  return withPanelOperation('createSession', function(runtime, operationId) {
    var source = input || {};
    var dto = {
      TIPO: source.TIPO || source.tipo,
      FECHA: source.FECHA || source.fecha,
      HORA_INICIO: source.HORA_INICIO || source.horaInicio,
      HORA_FIN: source.HORA_FIN || source.horaFin,
      COMPETENCIA: source.COMPETENCIA || source.competencia,
      PARTIDO_ID: source.PARTIDO_ID || source.partidoId,
      DESCRIPCION: source.DESCRIPCION || source.descripcion
    };
    return runtime.commands.createSession(dto, { operationId: operationId, actor: source.actor });
  });
}

function commandCloseSession(sessionId, actor) {
  return withPanelOperation('closeSession', function(runtime, operationId) {
    return runtime.commands.closeSession(sessionId, actor, { operationId: operationId });
  });
}

function commandCreateAttendance(input) {
  return safePanelResponse(function() {
    var source = input || {};
    return panelRuntime().commands.createAttendance({
      sesionId: source.sesionId || source.SESION_ID,
      alumnoId: source.alumnoId || source.ALUMNO_ID,
      estado: source.estado || source.ESTADO
    });
  });
}

function commandResolveAbsence(attendanceId, targetState, options) {
  return withPanelOperation('resolveAbsence', function(runtime, operationId) {
    var source = options || {};
    var target = String(targetState || '').trim().toUpperCase();
    if (target !== 'FJ' && target !== 'LES') {
      throw new Error('PANEL_ABSENCE_TARGET_REJECTED');
    }
    return runtime.commands.resolveAbsence(attendanceId, target, {
      actor: source.actor,
      operationId: operationId,
      reason: source.reason
    });
  });
}

function commandCreateMatch(input) {
  return withPanelOperation('createMatch', function(runtime, operationId) {
    var source = input || {};
    var dto = {
      COMPETENCIA: source.COMPETENCIA || source.competencia,
      JORNADA: source.JORNADA !== undefined ? source.JORNADA : source.jornada,
      RIVAL: source.RIVAL || source.rival,
      FECHA: source.FECHA || source.fecha,
      HORA_CITACION: source.HORA_CITACION || source.horaCitacion,
      HORA_PARTIDO: source.HORA_PARTIDO || source.horaPartido,
      SEDE: source.SEDE || source.sede,
      LOCAL_VISITANTE: source.LOCAL_VISITANTE || source.localVisitante,
      DURACION_MINUTOS: source.DURACION_MINUTOS !== undefined ? source.DURACION_MINUTOS : source.duracionMinutos,
      UNIFORME: source.UNIFORME || source.uniforme,
      INDICACIONES: source.INDICACIONES || source.indicaciones,
      OBSERVACIONES: source.OBSERVACIONES || source.observaciones
    };
    return runtime.commands.createMatch(dto, { operationId: operationId, actor: source.actor });
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
    var source = input || {};
    var dto = {};
    [
      'PARTIDO_ID',
      'ALUMNO_ID',
      'CONVOCATORIA_ID',
      'ASISTIO',
      'ASISTENCIA_ESTADO',
      'CONDICION_INICIAL',
      'MINUTOS_JUGADOS',
      'GOLES',
      'AMARILLAS',
      'ROJAS',
      'CALIFICACION',
      'OBSERVACIONES'
    ].forEach(function(field) {
      if (source[field] !== undefined) {
        dto[field] = source[field];
      }
    });
    return runtime.commands.createParticipation(dto, { operationId: operationId, actor: source.actor });
  });
}

function commandUpdateParticipation(participationId, updates, actor) {
  return withPanelOperation('updateParticipation', function(runtime, operationId) {
    return runtime.commands.updateParticipation(participationId, updates, { operationId: operationId, actor: actor });
  });
}

function commandSaveParticipation(matchId, studentId, payload, actor) {
  return safePanelResponse(function() {
    var runtime = panelRuntime();
    var operationId = serverOperationId(runtime);
    var source = payload || {};
    var view = runtime.queries.getPanelParticipation(matchId);
    var row = (view.rows || []).filter(function(candidate) {
      return candidate.ALUMNO_ID === studentId;
    })[0] || null;
    var dto;

    if (!row || !row.CONVOCATORIA_ID || !row.ASISTENCIA_ESTADO) {
      throw new Error('PANEL_PARTICIPATION_ATTENDANCE_REQUIRED');
    }

    dto = {
      PARTIDO_ID: matchId,
      ALUMNO_ID: studentId,
      CONVOCATORIA_ID: row.CONVOCATORIA_ID,
      ASISTIO: row.ASISTIO_DERIVADO,
      ASISTENCIA_ESTADO: row.ASISTENCIA_ESTADO,
      CONDICION_INICIAL: source.CONDICION_INICIAL,
      MINUTOS_JUGADOS: source.MINUTOS_JUGADOS,
      GOLES: source.GOLES,
      AMARILLAS: source.AMARILLAS,
      ROJAS: source.ROJAS,
      CALIFICACION: source.CALIFICACION,
      OBSERVACIONES: source.OBSERVACIONES
    };

    if (row.PARTICIPACION_ID) {
      return runtime.commands.updateParticipation(row.PARTICIPACION_ID, dto, { operationId: operationId, actor: actor });
    }

    return runtime.commands.createParticipation(dto, { operationId: operationId, actor: actor });
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
    commandSaveParticipation,
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
    getPanelReferenceData,
    safePanelResponse,
    setPanelRuntimeFactoryForTest: setPanelRuntimeFactoryForTest_,
    setPanelRuntimeFactoryForTest_,
    toPanelSerializable
  };
}
