function createOperationalCommandService(dependencies) {
  var utils = dependencies.utils;
  var services = dependencies.services || {};
  var repositories = dependencies.repositories || {};
  var idGenerator = dependencies.idGenerator || {};
  var auditedFields = ['MINUTOS_JUGADOS', 'GOLES', 'AMARILLAS', 'ROJAS', 'CALIFICACION'];

  if (typeof idGenerator.operationId !== 'function') {
    throw utils.createDomainError('RUNTIME_OPERATION_ID_GENERATOR_REQUIRED', 'operationId');
  }

  function requireOperationId(prefix, options) {
    var id = options && options.operationId ? options.operationId : idGenerator.operationId(prefix);

    if (!id || String(id).trim() === '') {
      throw utils.createDomainError('RUNTIME_OPERATION_ID_GENERATOR_REQUIRED', prefix);
    }

    return String(id).trim();
  }

  function copyRecord(record) {
    var next = {};
    Object.keys(record || {}).forEach(function(key) {
      next[key] = record[key];
    });
    return next;
  }

  function canonicalValue(value) {
    if (value === undefined || value === null) {
      return '';
    }
    return String(value);
  }

  function stableStringify(value) {
    if (value === undefined || value === null) {
      return 'null';
    }

    if (Array.isArray(value)) {
      return '[' + value.map(stableStringify).join(',') + ']';
    }

    if (typeof value === 'object') {
      return '{' + Object.keys(value).sort().map(function(key) {
        return JSON.stringify(key) + ':' + stableStringify(value[key]);
      }).join(',') + '}';
    }

    return JSON.stringify(value);
  }

  function fnv1a32(text, seed) {
    var hash = seed >>> 0;
    var index;

    for (index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
    }

    return ('00000000' + hash.toString(16)).slice(-8);
  }

  function fingerprint(value) {
    var text = stableStringify(value);
    return fnv1a32(text, 0x811c9dc5) + fnv1a32(text, 0x9e3779b9);
  }

  function sensitiveFingerprint(value) {
    if (value === undefined || value === null || value === '') {
      return '';
    }
    return fingerprint(value);
  }

  function canonicalIntent(intent) {
    return {
      command: intent.command,
      fingerprint: fingerprint(intent.payload || {})
    };
  }

  function intentEvent(operationId, intent, actor) {
    var canonical = canonicalIntent(intent);

    return {
      EVENTO_ID: 'AUD-' + operationId + '-OPERACION-INTENT',
      USUARIO: actor || 'SYSTEM',
      ENTIDAD: 'OPERACION',
      ENTIDAD_ID: operationId,
      ACCION: canonical.command,
      CAMPO: 'INTENT',
      VALOR_ANTERIOR: '',
      VALOR_NUEVO: 'operationId=' + operationId + ';command=' + canonical.command + ';fingerprint=' + canonical.fingerprint,
      MOTIVO: 'OPERATION_INTENT'
    };
  }

  function completedEvent(operationId, intent, actor) {
    var canonical = canonicalIntent(intent);

    return {
      EVENTO_ID: 'AUD-' + operationId + '-OPERACION-COMPLETED',
      USUARIO: actor || 'SYSTEM',
      ENTIDAD: 'OPERACION',
      ENTIDAD_ID: operationId,
      ACCION: 'COMPLETED',
      CAMPO: 'STATUS',
      VALOR_ANTERIOR: '',
      VALOR_NUEVO: 'operationId=' + operationId + ';command=' + canonical.command + ';fingerprint=' + canonical.fingerprint,
      MOTIVO: 'OPERATION_COMPLETED'
    };
  }

  function canonicalEvent(event) {
    return {
      ENTIDAD: canonicalValue(event.ENTIDAD),
      ENTIDAD_ID: canonicalValue(event.ENTIDAD_ID),
      ACCION: canonicalValue(event.ACCION),
      CAMPO: canonicalValue(event.CAMPO),
      VALOR_ANTERIOR: canonicalValue(event.VALOR_ANTERIOR),
      VALOR_NUEVO: canonicalValue(event.VALOR_NUEVO),
      MOTIVO: canonicalValue(event.MOTIVO)
    };
  }

  function sameEvent(left, right) {
    var a = canonicalEvent(left);
    var b = canonicalEvent(right);
    return Object.keys(a).every(function(key) {
      return a[key] === b[key];
    });
  }

  function existingEventsFor(operationId) {
    var prefix = 'AUD-' + operationId + '-';
    return services.auditService.getEvents().filter(function(event) {
      return event.EVENTO_ID.indexOf(prefix) === 0;
    });
  }

  function beginAuditedOperation(operationId, intent) {
    var existing = existingEventsFor(operationId);
    var expectedIntent = intentEvent(operationId, intent, intent.actor);
    var expectedCompleted = completedEvent(operationId, intent, intent.actor);
    var existingIntent = null;
    var existingCompleted = null;

    if (existing.length === 0) {
      return { status: 'NEW_OPERATION', events: [] };
    }

    existing.forEach(function(event) {
      if (event.EVENTO_ID === expectedIntent.EVENTO_ID) {
        existingIntent = event;
      }
      if (event.EVENTO_ID === expectedCompleted.EVENTO_ID) {
        existingCompleted = event;
      }
    });

    if (!existingIntent || !sameEvent(existingIntent, expectedIntent)) {
      throw utils.createDomainError('OPERATION_ID_CONFLICT', operationId);
    }

    if (!existingCompleted || !sameEvent(existingCompleted, expectedCompleted)) {
      throw utils.createDomainError('AUDIT_RECONCILIATION_REQUIRED', operationId);
    }

    return { status: 'IDEMPOTENT_REPLAY', events: existing };
  }

  function appendEvents(events) {
    events.forEach(function(event) {
      services.auditService.appendEvent(event);
    });
  }

  function runAudited(operationId, intent, writeFn, resultEventsFn) {
    var status = beginAuditedOperation(operationId, intent);
    var result;
    var events;

    if (status.status === 'IDEMPOTENT_REPLAY') {
      return { idempotent: true, operationId: operationId, auditEvents: status.events };
    }

    result = writeFn();
    events = [intentEvent(operationId, intent, intent.actor)]
      .concat(resultEventsFn ? resultEventsFn(result) : [])
      .concat([completedEvent(operationId, intent, intent.actor)]);
    try {
      appendEvents(events);
    } catch (error) {
      throw utils.createDomainError('AUDIT_PERSISTENCE_FAILED_AFTER_WRITE', operationId);
    }
    return result;
  }

  function getAttendance(id) {
    return repositories.attendanceRepository.getAll().filter(function(record) {
      return record.ASISTENCIA_ID === id;
    })[0] || null;
  }

  function absenceMotive(targetState, reason) {
    if (reason === 'EXPIRED' || targetState === 'FI') {
      return 'ABSENCE_EXPIRED';
    }
    if (targetState === 'LES') {
      return 'INJURY_RECORDED';
    }
    if (targetState === 'FJ') {
      return 'ABSENCE_JUSTIFIED';
    }
    return 'STATUS_CHANGE';
  }

  function resolveAbsence(attendanceId, targetState, options) {
    options = options || {};
    var before = getAttendance(attendanceId);
    var opId = requireOperationId('ABSENCE', options);
    var intent = {
      actor: options.actor || 'SYSTEM',
      command: 'RESOLVE_ABSENCE',
      payload: {
        attendanceId: attendanceId,
        reasonFingerprint: sensitiveFingerprint(options.reason),
        targetState: targetState
      }
    };

    return runAudited(opId, intent, function() {
      return services.absenceResolutionService.resolveAbsence(attendanceId, targetState, options);
    }, function(result) {
      return [{
        EVENTO_ID: 'AUD-' + opId + '-ASISTENCIA-' + attendanceId + '-TRANSICION_AUSENCIA',
        USUARIO: options.actor || 'SYSTEM',
        ENTIDAD: 'ASISTENCIAS',
        ENTIDAD_ID: attendanceId,
        ACCION: 'TRANSICION_AUSENCIA',
        CAMPO: 'ESTADO',
        VALOR_ANTERIOR: before ? before.ESTADO : '',
        VALOR_NUEVO: result.attendance.ESTADO,
        MOTIVO: absenceMotive(result.attendance.ESTADO, options.reason)
      }];
    });
  }

  function resolveExpiredAbsences(now, options) {
    options = options || {};
    var opId = requireOperationId('EXPIRE_ABSENCES', options);
    var beforeById = {};
    var expectedEvents = [];

    repositories.attendanceRepository.getAll().forEach(function(record) {
      if (record.ESTADO === 'F' && record.LIMITE_JUSTIFICACION && (now || new Date()).getTime() > new Date(record.LIMITE_JUSTIFICACION).getTime()) {
        beforeById[record.ASISTENCIA_ID] = record.ESTADO;
        expectedEvents.push({
          EVENTO_ID: 'AUD-' + opId + '-ASISTENCIA-' + record.ASISTENCIA_ID + '-TRANSICION_AUSENCIA',
          USUARIO: options.actor || 'SYSTEM',
          ENTIDAD: 'ASISTENCIAS',
          ENTIDAD_ID: record.ASISTENCIA_ID,
          ACCION: 'TRANSICION_AUSENCIA',
          CAMPO: 'ESTADO',
          VALOR_ANTERIOR: record.ESTADO,
          VALOR_NUEVO: 'FI',
          MOTIVO: 'ABSENCE_EXPIRED'
        });
      }
    });

    return runAudited(opId, {
      actor: options.actor || 'SYSTEM',
      command: 'RESOLVE_EXPIRED_ABSENCES',
      payload: { now: now ? new Date(now).toISOString() : '' }
    }, function() {
      return services.absenceResolutionService.resolveExpiredAbsences(now);
    }, function(results) {
      return results.map(function(result) {
        return {
          EVENTO_ID: 'AUD-' + opId + '-ASISTENCIA-' + result.attendance.ASISTENCIA_ID + '-TRANSICION_AUSENCIA',
          USUARIO: options.actor || 'SYSTEM',
          ENTIDAD: 'ASISTENCIAS',
          ENTIDAD_ID: result.attendance.ASISTENCIA_ID,
          ACCION: 'TRANSICION_AUSENCIA',
          CAMPO: 'ESTADO',
          VALOR_ANTERIOR: beforeById[result.attendance.ASISTENCIA_ID] || 'F',
          VALOR_NUEVO: result.attendance.ESTADO,
          MOTIVO: 'ABSENCE_EXPIRED'
        };
      });
    });
  }

  function getDetail(convocationId, studentId) {
    return repositories.detailRepository.getAll().filter(function(detail) {
      return detail.CONVOCATORIA_ID === convocationId && detail.ALUMNO_ID === studentId;
    })[0] || null;
  }

  function setFinalSelection(convocationId, studentId, selected, reason, options) {
    options = options || {};
    var before = getDetail(convocationId, studentId);
    var detailId = before ? before.DETALLE_ID : convocationId + '-' + studentId;
    var opId = requireOperationId('CONVOCATION_SELECTION', options);
    var normalizedSelected = utils.normalizeStrictBoolean(selected, 'SELECCIONADO_FINAL');
    var intent = {
      actor: options.actor || 'coach',
      command: 'SET_FINAL_SELECTION',
      payload: {
        convocationId: convocationId,
        reasonFingerprint: sensitiveFingerprint(reason),
        selected: normalizedSelected,
        studentId: studentId
      }
    };

    return runAudited(opId, intent, function() {
      return services.convocationService.setFinalSelection(convocationId, studentId, selected, reason);
    }, function(result) {
      return [{
        EVENTO_ID: 'AUD-' + opId + '-CONVOCATORIA_DETALLE-' + detailId + '-SELECCIONADO_FINAL',
        USUARIO: options.actor || 'coach',
        ENTIDAD: 'CONVOCATORIA_DETALLE',
        ENTIDAD_ID: detailId,
        ACCION: 'CAMBIO_MANUAL_CONVOCATORIA',
        CAMPO: 'SELECCIONADO_FINAL',
        VALOR_ANTERIOR: before ? before.SELECCIONADO_FINAL : '',
        VALOR_NUEVO: result.SELECCIONADO_FINAL,
        MOTIVO: 'MANUAL_CHANGE'
      }];
    });
  }

  function assignPlayerPosition(convocationId, studentId, position, reason, options) {
    options = options || {};
    var before = getDetail(convocationId, studentId);
    var detailId = before ? before.DETALLE_ID : convocationId + '-' + studentId;
    var opId = requireOperationId('CONVOCATION_POSITION', options);
    var normalizedPosition = String(position || '').trim().toUpperCase();
    var intent = {
      actor: options.actor || 'coach',
      command: 'ASSIGN_POSITION',
      payload: {
        convocationId: convocationId,
        position: normalizedPosition,
        reasonFingerprint: sensitiveFingerprint(reason),
        studentId: studentId
      }
    };

    return runAudited(opId, intent, function() {
      return services.convocationService.assignPlayerPosition(convocationId, studentId, position, reason);
    }, function(result) {
      return [{
        EVENTO_ID: 'AUD-' + opId + '-CONVOCATORIA_DETALLE-' + detailId + '-POSICION_ASIGNADA',
        USUARIO: options.actor || 'coach',
        ENTIDAD: 'CONVOCATORIA_DETALLE',
        ENTIDAD_ID: detailId,
        ACCION: 'CAMBIO_MANUAL_CONVOCATORIA',
        CAMPO: 'POSICION_ASIGNADA',
        VALOR_ANTERIOR: before ? before.POSICION_ASIGNADA : '',
        VALOR_NUEVO: result.POSICION_ASIGNADA,
        MOTIVO: 'MANUAL_CHANGE'
      }];
    });
  }

  function approveConvocation(convocationId, actor, options) {
    options = options || {};
    var opId = requireOperationId('CONVOCATION_APPROVAL', options);
    var intent = {
      actor: String(actor || '').trim(),
      command: 'APPROVE_CONVOCATION',
      payload: {
        actorFingerprint: sensitiveFingerprint(String(actor || '').trim()),
        convocationId: convocationId
      }
    };

    return runAudited(opId, intent, function() {
      return services.convocationService.approveConvocation(convocationId, actor);
    }, function() {
      return [{
        EVENTO_ID: 'AUD-' + opId + '-CONVOCATORIA-' + convocationId + '-APROBACION',
        USUARIO: actor,
        ENTIDAD: 'CONVOCATORIAS',
        ENTIDAD_ID: convocationId,
        ACCION: 'APROBACION',
        CAMPO: 'ESTADO',
        VALOR_ANTERIOR: 'PROPUESTA',
        VALOR_NUEVO: 'APROBADA',
        MOTIVO: 'HUMAN_APPROVAL'
      }];
    });
  }

  function participationEvents(opId, participationId, before, after, actor) {
    return auditedFields.filter(function(field) {
      return canonicalValue(before[field]) !== canonicalValue(after[field]);
    }).map(function(field) {
      return {
        EVENTO_ID: 'AUD-' + opId + '-PARTICIPACION-' + participationId + '-' + field,
        USUARIO: actor || 'coach',
        ENTIDAD: 'PARTICIPACION_PARTIDO',
        ENTIDAD_ID: participationId,
        ACCION: 'ACTUALIZACION',
        CAMPO: field,
        VALOR_ANTERIOR: before[field],
        VALOR_NUEVO: after[field],
        MOTIVO: 'POST_MATCH_CAPTURE'
      };
    });
  }

  function updateParticipation(participationId, updates, options) {
    options = options || {};
    var before = copyRecord(repositories.participationRepository.getAll().filter(function(record) {
      return record.PARTICIPACION_ID === participationId;
    })[0] || {});
    var expectedAfter = copyRecord(before);
    var opId = requireOperationId('PARTICIPATION_UPDATE', options);

    Object.keys(updates || {}).forEach(function(field) {
      if (field !== 'MODIFICADO_EN') {
        expectedAfter[field] = updates[field];
      }
    });

    function canonicalUpdatePayload() {
      var payload = {};
      Object.keys(updates || {}).sort().forEach(function(field) {
        if (field !== 'MODIFICADO_EN' && field !== 'REGISTRADO_EN') {
          payload[field] = field === 'OBSERVACIONES' ? { fingerprint: sensitiveFingerprint(updates[field]) } : updates[field];
        }
      });
      return payload;
    }

    return runAudited(opId, {
      actor: options.actor || 'coach',
      command: 'UPDATE_PARTICIPATION',
      payload: {
        participationId: participationId,
        updates: canonicalUpdatePayload()
      }
    }, function() {
      return services.participationService.updateParticipation(participationId, updates);
    }, function(result) {
      return participationEvents(opId, participationId, before, result, options.actor);
    });
  }

  function createParticipation(input, options) {
    options = options || {};
    var opId = requireOperationId('PARTICIPATION_CREATE', options);
    var normalizedInput = copyRecord(input);
    var intent = {
      actor: options.actor || 'coach',
      command: 'CREATE_PARTICIPATION',
      payload: {
        ALUMNO_ID: normalizedInput.ALUMNO_ID || normalizedInput.alumnoId,
        AMARILLAS: normalizedInput.AMARILLAS,
        ASISTENCIA_ESTADO: normalizedInput.ASISTENCIA_ESTADO,
        ASISTIO: normalizedInput.ASISTIO,
        CALIFICACION: normalizedInput.CALIFICACION,
        CONDICION_INICIAL: normalizedInput.CONDICION_INICIAL,
        CONVOCATORIA_ID: normalizedInput.CONVOCATORIA_ID || normalizedInput.convocationId,
        GOLES: normalizedInput.GOLES,
        MINUTOS_JUGADOS: normalizedInput.MINUTOS_JUGADOS,
        OBSERVACIONES_FINGERPRINT: sensitiveFingerprint(normalizedInput.OBSERVACIONES),
        PARTICIPACION_ID: normalizedInput.PARTICIPACION_ID || normalizedInput.participacionId || '',
        PARTIDO_ID: normalizedInput.PARTIDO_ID || normalizedInput.matchId,
        ROJAS: normalizedInput.ROJAS
      }
    };

    return runAudited(opId, intent, function() {
      var participationId = normalizedInput.PARTICIPACION_ID || normalizedInput.participacionId || (idGenerator.participationId ? idGenerator.participationId() : '');
      normalizedInput.PARTICIPACION_ID = participationId;
      return services.participationService.createParticipation(normalizedInput);
    }, function(result) {
      return [{
        EVENTO_ID: 'AUD-' + opId + '-PARTICIPACION-' + result.PARTICIPACION_ID + '-CREACION',
        USUARIO: options.actor || 'coach',
        ENTIDAD: 'PARTICIPACION_PARTIDO',
        ENTIDAD_ID: result.PARTICIPACION_ID,
        ACCION: 'CREACION',
        CAMPO: 'PARTICIPACION_ID',
        VALOR_ANTERIOR: '',
        VALOR_NUEVO: result.PARTICIPACION_ID,
        MOTIVO: 'POST_MATCH_CAPTURE'
      }];
    });
  }

  function createSession(input, options) {
    options = options || {};
    var normalized = copyRecord(input || {});
    var opId = requireOperationId('SESSION_CREATE', options);

    return runAudited(opId, {
      actor: options.actor || normalized.actor || 'coach',
      command: 'CREATE_SESSION',
      payload: {
        COMPETENCIA: normalized.COMPETENCIA || normalized.competencia || '',
        DESCRIPCION_FINGERPRINT: sensitiveFingerprint(normalized.DESCRIPCION || normalized.descripcion),
        FECHA: normalized.FECHA || normalized.fecha,
        HORA_FIN: normalized.HORA_FIN || normalized.horaFin || '',
        HORA_INICIO: normalized.HORA_INICIO || normalized.horaInicio || '',
        PARTIDO_ID: normalized.PARTIDO_ID || normalized.partidoId || '',
        SESION_ID: normalized.SESION_ID || normalized.sesionId || '',
        TIPO: normalized.TIPO || normalized.tipo
      }
    }, function() {
      return services.sessionService.createSession(input);
    }, function(result) {
      return [{
        EVENTO_ID: 'AUD-' + opId + '-SESION-' + result.SESION_ID + '-CREACION',
        USUARIO: options.actor || normalized.actor || 'coach',
        ENTIDAD: 'SESIONES',
        ENTIDAD_ID: result.SESION_ID,
        ACCION: 'CREACION_SESION',
        CAMPO: 'ESTADO',
        VALOR_ANTERIOR: '',
        VALOR_NUEVO: result.ESTADO,
        MOTIVO: 'SESSION_OPERATION'
      }];
    });
  }

  function closeSession(sessionId, actor, options) {
    options = options || {};
    var before = repositories.sessionRepository.getAll().filter(function(record) {
      return record.SESION_ID === sessionId;
    })[0] || {};
    var opId = requireOperationId('SESSION_CLOSE', options);

    return runAudited(opId, {
      actor: actor || 'coach',
      command: 'CLOSE_SESSION',
      payload: { sessionId: sessionId }
    }, function() {
      return services.sessionService.closeSession(sessionId, actor);
    }, function(result) {
      return [{
        EVENTO_ID: 'AUD-' + opId + '-SESION-' + sessionId + '-CIERRE',
        USUARIO: actor || 'coach',
        ENTIDAD: 'SESIONES',
        ENTIDAD_ID: sessionId,
        ACCION: 'CIERRE_SESION',
        CAMPO: 'ESTADO',
        VALOR_ANTERIOR: before.ESTADO || '',
        VALOR_NUEVO: result.ESTADO,
        MOTIVO: 'SESSION_OPERATION'
      }];
    });
  }

  function createMatch(input, options) {
    options = options || {};
    var normalized = copyRecord(input || {});
    var opId = requireOperationId('MATCH_CREATE', options);

    return runAudited(opId, {
      actor: options.actor || normalized.actor || 'coach',
      command: 'CREATE_MATCH',
      payload: {
        COMPETENCIA: normalized.COMPETENCIA || normalized.competencia,
        DURACION_MINUTOS: normalized.DURACION_MINUTOS !== undefined ? normalized.DURACION_MINUTOS : normalized.duracionMinutos,
        FECHA: normalized.FECHA || normalized.fecha,
        HORA_CITACION: normalized.HORA_CITACION || normalized.horaCitacion || '',
        HORA_PARTIDO: normalized.HORA_PARTIDO || normalized.horaPartido || '',
        INDICACIONES_FINGERPRINT: sensitiveFingerprint(normalized.INDICACIONES || normalized.indicaciones),
        JORNADA: normalized.JORNADA !== undefined ? normalized.JORNADA : normalized.jornada,
        LOCAL_VISITANTE: normalized.LOCAL_VISITANTE || normalized.localVisitante,
        OBSERVACIONES_FINGERPRINT: sensitiveFingerprint(normalized.OBSERVACIONES || normalized.observaciones),
        PARTIDO_ID: normalized.PARTIDO_ID || normalized.partidoId || '',
        RIVAL: normalized.RIVAL || normalized.rival,
        SEDE: normalized.SEDE || normalized.sede,
        UNIFORME: normalized.UNIFORME || normalized.uniforme || ''
      }
    }, function() {
      return services.matchService.createMatch(input);
    }, function(result) {
      return [{
        EVENTO_ID: 'AUD-' + opId + '-PARTIDO-' + result.PARTIDO_ID + '-CREACION',
        USUARIO: options.actor || normalized.actor || 'coach',
        ENTIDAD: 'PARTIDOS',
        ENTIDAD_ID: result.PARTIDO_ID,
        ACCION: 'CREACION_PARTIDO',
        CAMPO: 'ESTADO',
        VALOR_ANTERIOR: '',
        VALOR_NUEVO: result.ESTADO,
        MOTIVO: 'MATCH_OPERATION'
      }];
    });
  }

  function updateMatch(matchId, updates, actor, options) {
    options = options || {};
    var before = repositories.matchRepository.getAll().filter(function(record) {
      return record.PARTIDO_ID === matchId;
    })[0] || {};
    var opId = requireOperationId('MATCH_UPDATE', options);

    return runAudited(opId, {
      actor: actor || 'coach',
      command: 'UPDATE_MATCH',
      payload: {
        matchId: matchId,
        updatesFingerprint: fingerprint(updates || {})
      }
    }, function() {
      return services.matchService.updateMatch(matchId, updates, actor);
    }, function(result) {
      return [{
        EVENTO_ID: 'AUD-' + opId + '-PARTIDO-' + matchId + '-CAMBIO',
        USUARIO: actor || 'coach',
        ENTIDAD: 'PARTIDOS',
        ENTIDAD_ID: matchId,
        ACCION: 'CAMBIO_PARTIDO',
        CAMPO: 'PARTIDO',
        VALOR_ANTERIOR: before.ESTADO || '',
        VALOR_NUEVO: result.ESTADO,
        MOTIVO: 'MATCH_OPERATION'
      }];
    });
  }

  function markMatchPlayed(matchId, score, actor, options) {
    options = options || {};
    var before = repositories.matchRepository.getAll().filter(function(record) {
      return record.PARTIDO_ID === matchId;
    })[0] || {};
    var opId = requireOperationId('MATCH_PLAYED', options);

    return runAudited(opId, {
      actor: actor || 'coach',
      command: 'MARK_MATCH_PLAYED',
      payload: {
        GOLES_CONTRA: score && (score.GOLES_CONTRA !== undefined ? score.GOLES_CONTRA : score.golesContra),
        GOLES_FAVOR: score && (score.GOLES_FAVOR !== undefined ? score.GOLES_FAVOR : score.golesFavor),
        matchId: matchId
      }
    }, function() {
      return services.matchService.markMatchPlayed(matchId, score, actor);
    }, function(result) {
      return [{
        EVENTO_ID: 'AUD-' + opId + '-PARTIDO-' + matchId + '-JUGADO',
        USUARIO: actor || 'coach',
        ENTIDAD: 'PARTIDOS',
        ENTIDAD_ID: matchId,
        ACCION: 'PARTIDO_JUGADO',
        CAMPO: 'ESTADO',
        VALOR_ANTERIOR: before.ESTADO || '',
        VALOR_NUEVO: result.ESTADO,
        MOTIVO: 'MATCH_OPERATION'
      }];
    });
  }

  function cancelMatch(matchId, actor, options) {
    options = options || {};
    var before = repositories.matchRepository.getAll().filter(function(record) {
      return record.PARTIDO_ID === matchId;
    })[0] || {};
    var opId = requireOperationId('MATCH_CANCEL', options);

    return runAudited(opId, {
      actor: actor || 'coach',
      command: 'CANCEL_MATCH',
      payload: { matchId: matchId }
    }, function() {
      return services.matchService.cancelMatch(matchId, actor);
    }, function(result) {
      return [{
        EVENTO_ID: 'AUD-' + opId + '-PARTIDO-' + matchId + '-CANCELADO',
        USUARIO: actor || 'coach',
        ENTIDAD: 'PARTIDOS',
        ENTIDAD_ID: matchId,
        ACCION: 'PARTIDO_CANCELADO',
        CAMPO: 'ESTADO',
        VALOR_ANTERIOR: before.ESTADO || '',
        VALOR_NUEVO: result.ESTADO,
        MOTIVO: 'MATCH_OPERATION'
      }];
    });
  }

  function updateStudentSportsState(studentId, state, actor, reasonCode, options) {
    options = options || {};
    var before = repositories.studentRepository.getAll().filter(function(record) {
      return record.ALUMNO_ID === studentId;
    })[0] || {};
    var opId = requireOperationId('STUDENT_SPORTS_STATE', options);

    return runAudited(opId, {
      actor: actor || 'coach',
      command: 'UPDATE_STUDENT_SPORTS_STATE',
      payload: {
        reasonCode: reasonCode,
        state: state,
        studentId: studentId
      }
    }, function() {
      return services.masterDataService.updateStudentSportsState(studentId, state, actor, reasonCode);
    }, function(result) {
      return [{
        EVENTO_ID: 'AUD-' + opId + '-ALUMNO-' + studentId + '-ESTADO_DEPORTIVO',
        USUARIO: actor || 'coach',
        ENTIDAD: 'ALUMNOS',
        ENTIDAD_ID: studentId,
        ACCION: 'ESTADO_DEPORTIVO',
        CAMPO: 'ESTADO_DEPORTIVO',
        VALOR_ANTERIOR: before.ESTADO_DEPORTIVO || '',
        VALOR_NUEVO: result.ESTADO_DEPORTIVO,
        MOTIVO: reasonCode
      }];
    });
  }

  function sendPendingCommunications(options) {
    options = options || {};
    var opId = requireOperationId('COMMUNICATION_SEND', options);
    var expectedEvents = repositories.communicationRepository.getAll().filter(function(record) {
      return record.ESTADO === 'PENDIENTE';
    }).map(function(record) {
      return {
        EVENTO_ID: 'AUD-' + opId + '-COMUNICACION-' + record.COMUNICACION_ID + '-CAMBIO_ESTADO',
        USUARIO: 'SYSTEM',
        ENTIDAD: 'COMUNICACIONES',
        ENTIDAD_ID: record.COMUNICACION_ID,
        ACCION: 'CAMBIO_ESTADO',
        CAMPO: 'ESTADO',
        VALOR_ANTERIOR: 'PENDIENTE',
        VALOR_NUEVO: 'ENVIADO',
        MOTIVO: 'SEND_ATTEMPT'
      };
    });

    return runAudited(opId, {
      command: 'SEND_PENDING_COMMUNICATIONS',
      payload: {}
    }, function() {
      return services.communicationService.sendPendingCommunications();
    }, function(results) {
      return results.filter(function(result) {
        return result && result.communication && !result.skipped && result.communication.ESTADO !== 'PENDIENTE';
      }).map(function(result) {
        return {
          EVENTO_ID: 'AUD-' + opId + '-COMUNICACION-' + result.communication.COMUNICACION_ID + '-CAMBIO_ESTADO',
          USUARIO: 'SYSTEM',
          ENTIDAD: 'COMUNICACIONES',
          ENTIDAD_ID: result.communication.COMUNICACION_ID,
          ACCION: 'CAMBIO_ESTADO',
          CAMPO: 'ESTADO',
          VALOR_ANTERIOR: 'PENDIENTE',
          VALOR_NUEVO: result.communication.ESTADO,
          MOTIVO: 'SEND_ATTEMPT'
        };
      });
    });
  }

  function retryCommunication(communicationId, options) {
    options = options || {};
    var record = repositories.communicationRepository.getAll().filter(function(candidate) {
      return candidate.COMUNICACION_ID === communicationId;
    })[0] || {};
    var opId = requireOperationId('COMMUNICATION_RETRY', options);
    var beforeState = record.ESTADO || 'ERROR';

    return runAudited(opId, {
      command: 'RETRY_COMMUNICATION',
      payload: { communicationId: communicationId }
    }, function() {
      return services.communicationService.retryCommunication(communicationId);
    }, function(result) {
      if (result.skipped) {
        return [];
      }
      return [{
        EVENTO_ID: 'AUD-' + opId + '-COMUNICACION-' + communicationId + '-CAMBIO_ESTADO',
        USUARIO: 'SYSTEM',
        ENTIDAD: 'COMUNICACIONES',
        ENTIDAD_ID: communicationId,
        ACCION: 'CAMBIO_ESTADO',
        CAMPO: 'ESTADO',
        VALOR_ANTERIOR: beforeState,
        VALOR_NUEVO: result.communication.ESTADO,
        MOTIVO: 'SEND_ATTEMPT'
      }];
    });
  }

  function generateConvocation(matchId, actor) {
    return services.convocationService.generateConvocation(matchId, actor);
  }

  function generateAbsenceCommunications(attendanceId) {
    return services.communicationService.generateAbsenceCommunications(attendanceId);
  }

  function generateConvocationCommunications(convocationId) {
    return services.communicationService.generateConvocationCommunications(convocationId);
  }

  return {
    approveConvocation: approveConvocation,
    assignPlayerPosition: assignPlayerPosition,
    cancelMatch: cancelMatch,
    closeSession: closeSession,
    createMatch: createMatch,
    createParticipation: createParticipation,
    createSession: createSession,
    generateAbsenceCommunications: generateAbsenceCommunications,
    generateConvocation: generateConvocation,
    generateConvocationCommunications: generateConvocationCommunications,
    markMatchPlayed: markMatchPlayed,
    resolveAbsence: resolveAbsence,
    resolveExpiredAbsences: resolveExpiredAbsences,
    retryCommunication: retryCommunication,
    sendPendingCommunications: sendPendingCommunications,
    setFinalSelection: setFinalSelection,
    updateMatch: updateMatch,
    updateStudentSportsState: updateStudentSportsState,
    updateParticipation: updateParticipation
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createOperationalCommandService };
}
