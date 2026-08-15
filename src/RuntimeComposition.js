function createAppsScriptRuntime(options) {
  options = options || {};
  var environment = options.environment || {};
  var triggerFactory = options.createTriggerHandlers || createTriggerHandlers;
  var lock = options.lock;
  var spreadsheetId = environment.spreadsheetId || (typeof environment.getSpreadsheetId === 'function' ? environment.getSpreadsheetId() : '');
  var repositories = {};
  var constructors = options.constructors || {};
  var requiredRepositories = [
    'configRepository',
    'studentRepository',
    'tutorRepository',
    'sessionRepository',
    'attendanceRepository',
    'matchRepository',
    'convocationRepository',
    'detailRepository',
    'participationRepository',
    'communicationRepository',
    'auditRepository'
  ];

  if (!spreadsheetId) {
    throw new Error('RUNTIME_SPREADSHEET_ID_REQUIRED');
  }

  if (!lock || typeof lock.runExclusive !== 'function') {
    throw new Error('RUNTIME_LOCK_REQUIRED');
  }

  if (!options.idGenerator || typeof options.idGenerator.operationId !== 'function') {
    throw new Error('RUNTIME_OPERATION_ID_GENERATOR_REQUIRED');
  }

  if (options.repositories) {
    repositories = options.repositories;
  } else if (typeof options.createRepository === 'function') {
    repositories = {
      configRepository: options.createRepository('CONFIG'),
      studentRepository: options.createRepository('ALUMNOS'),
      tutorRepository: options.createRepository('TUTORES'),
      sessionRepository: options.createRepository('SESIONES'),
      attendanceRepository: options.createRepository('ASISTENCIAS'),
      matchRepository: options.createRepository('PARTIDOS'),
      convocationRepository: options.createRepository('CONVOCATORIAS'),
      detailRepository: options.createRepository('CONVOCATORIA_DETALLE'),
      participationRepository: options.createRepository('PARTICIPACION_PARTIDO'),
      communicationRepository: options.createRepository('COMUNICACIONES'),
      auditRepository: options.createRepository('BITACORA')
    };
  }

  requiredRepositories.forEach(function(name) {
    if (!repositories[name]) {
      throw new Error('RUNTIME_REPOSITORY_REQUIRED: ' + name);
    }
  });

  function requireConstructor(name) {
    var constructor = constructors[name] || (typeof globalThis !== 'undefined' ? globalThis[name] : null);
    if (typeof constructor !== 'function') {
      throw new Error('RUNTIME_CONFIG_DEPENDENCY_REQUIRED: ' + name);
    }
    return constructor;
  }

  function withLock(callback) {
    return lock.runExclusive(callback);
  }

  var configService = requireConstructor('createConfigService')(repositories.configRepository);
  var masterDataService = requireConstructor('createMasterDataService')({
    studentRepository: repositories.studentRepository,
    tutorRepository: repositories.tutorRepository,
    utils: options.utils
  });
  var attendanceFoundationService = requireConstructor('createAttendanceFoundationService')({
    attendanceRepository: repositories.attendanceRepository,
    configService: configService,
    idGenerator: options.idGenerator,
    matchRepository: repositories.matchRepository,
    sessionRepository: repositories.sessionRepository,
    studentRepository: repositories.studentRepository,
    utils: options.utils,
    validateAttendanceConfigPolicy: requireConstructor('validateAttendanceConfigPolicy'),
    validateAttendanceSnapshot: requireConstructor('validateAttendanceSnapshot')
  });
  var absenceResolutionService = requireConstructor('createAbsenceResolutionService')({
    attendanceRepository: repositories.attendanceRepository,
    clock: options.clock,
    configService: configService,
    tutorRepository: repositories.tutorRepository,
    utils: options.utils,
    validateAttendanceConfigPolicy: requireConstructor('validateAttendanceConfigPolicy'),
    validateAttendanceSnapshot: requireConstructor('validateAttendanceSnapshot')
  });
  var attendanceMetricsService = requireConstructor('createAttendanceMetricsService')({
    attendanceRepository: repositories.attendanceRepository,
    configService: configService,
    utils: options.utils,
    validateAttendanceConfigPolicy: requireConstructor('validateAttendanceConfigPolicy'),
    validateAttendanceSnapshot: requireConstructor('validateAttendanceSnapshot')
  });
  var matchService = requireConstructor('createMatchService')({
    clock: options.clock,
    idGenerator: options.idGenerator,
    matchRepository: repositories.matchRepository,
    utils: options.utils
  });
  var sessionService = requireConstructor('createSessionService')({
    clock: options.clock,
    idGenerator: options.idGenerator,
    matchService: matchService,
    sessionRepository: repositories.sessionRepository,
    utils: options.utils
  });
  var eligibilityService = requireConstructor('createEligibilityService')({
    attendanceMetricsService: attendanceMetricsService,
    attendanceRepository: repositories.attendanceRepository,
    convocationRepository: repositories.convocationRepository,
    detailRepository: repositories.detailRepository,
    configService: configService,
    matchService: matchService,
    metricsService: attendanceMetricsService,
    studentRepository: repositories.studentRepository,
    utils: options.utils
  });
  var rotationService = requireConstructor('createRotationService')({
    configService: configService,
    convocationRepository: repositories.convocationRepository,
    detailRepository: repositories.detailRepository,
    matchService: matchService,
    utils: options.utils
  });
  var convocationService = requireConstructor('createConvocationService')({
    configService: configService,
    convocationRepository: repositories.convocationRepository,
    detailRepository: repositories.detailRepository,
    eligibilityService: eligibilityService,
    idGenerator: options.idGenerator,
    matchService: matchService,
    rotationService: rotationService,
    studentRepository: repositories.studentRepository,
    utils: options.utils
  });
  var participationService = requireConstructor('createParticipationService')({
    attendanceService: attendanceFoundationService,
    configService: configService,
    convocationRepository: repositories.convocationRepository,
    detailRepository: repositories.detailRepository,
    idGenerator: options.idGenerator,
    matchService: matchService,
    participationRepository: repositories.participationRepository,
    studentRepository: repositories.studentRepository,
    utils: options.utils
  });
  var communicationService = requireConstructor('createCommunicationService')({
    attendanceRepository: repositories.attendanceRepository,
    clock: options.clock,
    communicationRepository: repositories.communicationRepository,
    configService: configService,
    convocationRepository: repositories.convocationRepository,
    detailRepository: repositories.detailRepository,
    idGenerator: options.idGenerator,
    mailAdapter: options.mailAdapter,
    matchService: matchService,
    studentRepository: repositories.studentRepository,
    tutorRepository: repositories.tutorRepository,
    utils: options.utils
  });
  var auditService = requireConstructor('createAuditService')({
    auditRepository: repositories.auditRepository,
    clock: options.clock,
    idGenerator: options.idGenerator,
    utils: options.utils
  });
  var services = {
    absenceResolutionService: absenceResolutionService,
    attendanceFoundationService: attendanceFoundationService,
    attendanceMetricsService: attendanceMetricsService,
    auditService: auditService,
    communicationService: communicationService,
    configService: configService,
    convocationService: convocationService,
    eligibilityService: eligibilityService,
    masterDataService: masterDataService,
    matchService: matchService,
    participationService: participationService,
    rotationService: rotationService,
    sessionService: sessionService
  };
  var operationalCommandService = requireConstructor('createOperationalCommandService')({
    idGenerator: options.idGenerator,
    repositories: repositories,
    services: services,
    utils: options.utils
  });

  function lockedCommand(name) {
    return function() {
      var args = arguments;
      return withLock(function() {
        return operationalCommandService[name].apply(null, args);
      });
    };
  }

  var commands = {
    appendAudit: function(event) { return withLock(function() { return auditService.appendEvent(event); }); },
    approveConvocation: lockedCommand('approveConvocation'),
    assignPlayerPosition: lockedCommand('assignPlayerPosition'),
    cancelMatch: lockedCommand('cancelMatch'),
    closeSession: lockedCommand('closeSession'),
    createAttendance: function(input) { return withLock(function() { return attendanceFoundationService.createAttendance(input); }); },
    createMatch: lockedCommand('createMatch'),
    createParticipation: lockedCommand('createParticipation'),
    createSession: lockedCommand('createSession'),
    generateAbsenceCommunications: function(attendanceId) { return withLock(function() { return operationalCommandService.generateAbsenceCommunications(attendanceId); }); },
    generateConvocation: function(matchId, actor) { return withLock(function() { return operationalCommandService.generateConvocation(matchId, actor); }); },
    generateConvocationCommunications: function(convocationId) { return withLock(function() { return operationalCommandService.generateConvocationCommunications(convocationId); }); },
    resolveAbsence: lockedCommand('resolveAbsence'),
    resolveExpiredAbsences: lockedCommand('resolveExpiredAbsences'),
    retryCommunication: lockedCommand('retryCommunication'),
    sendPendingCommunications: lockedCommand('sendPendingCommunications'),
    setFinalSelection: lockedCommand('setFinalSelection'),
    markMatchPlayed: lockedCommand('markMatchPlayed'),
    updateMatch: lockedCommand('updateMatch'),
    updateStudentSportsState: lockedCommand('updateStudentSportsState'),
    updateParticipation: lockedCommand('updateParticipation')
  };
  var queries = {
    evaluateMatch: function(matchId) { return eligibilityService.evaluateMatch(matchId); },
    getAttendances: function() { return attendanceFoundationService.getAttendances(); },
    getCommunications: function() { return communicationService.getCommunications(); },
    getEvents: function() { return auditService.getEvents(); },
    getMatches: function() { return matchService.getMatches(); },
    getParticipations: function() { return participationService.getParticipations(); },
    getRotationBefore: function(studentId, competition) { return rotationService.getRotationBefore(studentId, competition); },
    getSessions: function() { return attendanceFoundationService.getSessions(); },
    getStudentMetrics: function(studentId) { return attendanceMetricsService.getStudentMetrics(studentId); },
    getStudents: function() { return masterDataService.getStudents(); },
    getTutors: function() { return masterDataService.getTutors(); },
    validateMatchParticipationReadiness: function(matchId) { return participationService.validateMatchParticipationReadiness(matchId); }
  };
  var panelQueryService = requireConstructor('createPanelQueryService')({
    configService: configService,
    convocationRepository: repositories.convocationRepository,
    detailRepository: repositories.detailRepository,
    queries: queries
  });
  queries.getPanelAttendance = function(sessionId) { return panelQueryService.getAttendanceView(sessionId); };
  queries.getPanelConvocation = function(convocationId) { return panelQueryService.getConvocationView(convocationId); };
  queries.getPanelDashboard = function() { return panelQueryService.getDashboard(); };
  queries.getPanelParticipation = function(matchId) { return panelQueryService.getParticipationView(matchId); };

  return {
    commands: commands,
    queries: queries,
    runtime: { idGenerator: options.idGenerator, spreadsheetId: spreadsheetId, withLock: withLock },
    services: queries,
    triggerHandlers: triggerFactory({ commands: commands })
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createAppsScriptRuntime };
}
