const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createAppClientController } = require('../../src/AppClientController');
const { createAppRenderer } = require('../../src/AppRenderer');
const { getLdvAppCss, getLdvAppHtml, doGet } = require('../../src/AppUi');
const handlers = require('../../src/PanelHandlers');

const root = path.resolve(__dirname, '..', '..');

function student(overrides = {}) {
  return {
    alumnoId: 'ALU-001',
    nombre: 'Alumno',
    apellidos: 'Ficticio',
    grado: 1,
    grupo: 'A',
    competenciaBase: 'A',
    nivel: 'A1',
    posicionPrincipal: 'DEF',
    posicionSecundaria: 'MED',
    active: true,
    estadoDeportivo: 'ACTIVO',
    ...overrides
  };
}

function bootstrap(overrides = {}) {
  return {
    dashboard: {
      attendanceSummary: { captured: 1, expected: 2, missing: 1 },
      communications: { pending: 0, error: 0, uncertainDelivery: 0 },
      convocationProposals: [{ CONVOCATORIA_ID: 'CON-001', PARTIDO_ID: 'PAR-001', ESTADO: 'PROPUESTA', TOTAL_OBJETIVO: 12 }],
      currentSession: { sesionId: 'SES-001' },
      expiredAbsences: 0,
      nextMatchA: { partidoId: 'PAR-001', rival: 'Rival A', fecha: '2026-02-01' },
      nextMatchB: null,
      pendingAbsences: 1,
      readinessIssues: [],
      sportAlerts: [],
      upcomingMatches: [{ partidoId: 'PAR-001', competencia: 'A', rival: 'Rival A', fecha: '2026-02-01', horaPartido: '10:00', sede: 'Cancha' }]
    },
    referenceData: {
      authoritativeConvocations: [],
      convocationProposals: [{
        CONVOCATORIA_ID: 'CON-001',
        PARTIDO_ID: 'PAR-001',
        ESTADO: 'PROPUESTA',
        TOTAL_OBJETIVO: 12,
        MIN_PORTEROS_SNAPSHOT: 1,
        MIN_DEFENSAS_SNAPSHOT: 1,
        MIN_MEDIOS_SNAPSHOT: 0,
        MIN_DELANTEROS_SNAPSHOT: 0
      }],
      openSessions: [{ sesionId: 'SES-001', competencia: 'A', fecha: '2026-02-01' }],
      playedMatches: [],
      programmedMatches: [{
        partidoId: 'PAR-001',
        competencia: 'A',
        rival: 'Rival A',
        fecha: '2026-02-01',
        horaCitacion: '09:00',
        horaPartido: '10:00',
        sede: 'Cancha',
        localVisitante: 'LOCAL',
        uniforme: '',
        indicaciones: ''
      }],
      runtimeCapabilities: { externalMailEnabled: false }
    },
    students: [student()],
    ...overrides
  };
}

function convocationView(overrides = {}) {
  return {
    convocationId: 'CON-001',
    details: [
      {
        ALUMNO_ID: 'ALU-001',
        ELEGIBILITY_STATUS: 'ELIGIBLE',
        MOTIVO_NO_ELEGIBLE: '',
        nombre: 'Alumno Ficticio',
        nivel: 'A1',
        posicionPrincipal: 'PO',
        posicionSecundaria: 'DEF',
        posicionAsignada: 'PO',
        prioridadRotacion: true,
        puntajeAsistencia: 0.96,
        rotacionAntes: 3,
        seleccionadoFinal: true
      },
      {
        ALUMNO_ID: 'ALU-002',
        ELEGIBILITY_STATUS: 'ELIGIBLE',
        MOTIVO_NO_ELEGIBLE: '',
        nombre: 'Alumno Dos',
        nivel: 'A2',
        posicionPrincipal: 'DEF',
        posicionSecundaria: 'MED',
        posicionAsignada: 'DEF',
        prioridadRotacion: false,
        puntajeAsistencia: 1,
        rotacionAntes: 0,
        seleccionadoFinal: true
      }
    ],
    ...overrides
  };
}

test('APP_DOGET_FULL_PAGE_TEST', () => {
  global.HtmlService = {
    createHtmlOutput(html) {
      return {
        html,
        setTitle(title) {
          this.title = title;
          return this;
        }
      };
    }
  };
  try {
    const output = doGet();
    assert.equal(output.title, 'Liceo del Valle - Futbol');
    assert.equal(output.html.includes('<!doctype html>'), true);
    assert.equal(output.html.includes('ldv-app-shell'), true);
  } finally {
    delete global.HtmlService;
  }
});

test('APP_NO_SIDEBAR_DEPENDENCY_TEST', () => {
  const source = fs.readFileSync(path.join(root, 'src/AppUi.js'), 'utf8');
  assert.equal(source.includes('showSidebar'), false);
  assert.equal(source.includes('SpreadsheetApp.getUi'), false);
});

test('APP_SHELL_NAV_TEST', () => {
  const html = getLdvAppHtml();
  ['dashboard', 'students', 'attendance', 'convocations', 'matches', 'postmatch', 'reports', 'communications', 'config'].forEach((route) => {
    assert.equal(html.includes(route), true);
  });
});

test('APP_ACTIVE_ROUTE_TEST', () => {
  const state = { activeRoute: 'students', ...bootstrap() };
  const html = createAppRenderer({ state }).renderNavigation();
  assert.equal(html.includes('app-nav__item is-active'), true);
  assert.equal(html.includes('aria-current="page"'), true);
});

test('APP_RESPONSIVE_CSS_TEST', () => {
  const css = getLdvAppCss();
  assert.equal(css.includes('@media (max-width:980px)'), true);
  assert.equal(css.includes('@media (max-width:720px)'), true);
  assert.equal(css.includes('overflow-x:auto'), true);
});

test('APP_NO_EXTERNAL_FRONTEND_DEPENDENCY_TEST', () => {
  const html = getLdvAppHtml();
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(html.includes('https://'), false);
  assert.equal(html.includes('cdn'), false);
  assert.equal(packageJson.dependencies, undefined);
  assert.equal(packageJson.devDependencies, undefined);
});

test('APP_STALE_ROUTE_RESPONSE_TEST', () => {
  const calls = [];
  const rendered = [];
  const state = {};
  const controller = createAppClientController({
    callServer(name, args, onSuccess) {
      calls.push({ name, onSuccess });
    },
    state,
    render: { route(route) { rendered.push(route); }, loading() {} }
  });
  controller.route('dashboard');
  controller.route('convocations');
  calls[0].onSuccess({ ok: true, data: bootstrap() });
  calls[1].onSuccess({ ok: true, data: bootstrap() });
  calls[2].onSuccess({ ok: true, data: convocationView() });
  assert.deepEqual(rendered, ['convocations']);
});

test('APP_SAFE_ERROR_RENDER_TEST', () => {
  const errors = [];
  const controller = createAppClientController({
    callServer(name, args, onSuccess) {
      onSuccess({ ok: false, code: 'REQUIRED_FIELD', detail: 'stack path token', message: 'unsafe' });
    },
    render: { error(message) { errors.push(message); } }
  });
  controller.loadBootstrap('dashboard');
  assert.equal(errors[0], 'No se pudo completar la operacion solicitada. [REQUIRED_FIELD]');
  assert.equal(errors[0].includes('stack'), false);
});

test('APP_RUNTIME_HTML_ESCAPE_TEST', () => {
  const state = bootstrap({
    activeRoute: 'students',
    students: [student({ nombre: '<script>alert(1)</script>', apellidos: '& Ficticio' })]
  });
  const html = createAppRenderer({ state }).renderStudents();
  assert.equal(html.includes('<script>alert'), false);
  assert.equal(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), true);
});

test('APP_BOOTSTRAP_TEST', () => {
  handlers.setPanelRuntimeFactoryForTest(() => ({
    queries: {
      getPanelDashboard: () => ({ ok: 'dashboard' }),
      getPanelReferenceData: () => ({ ok: 'reference' }),
      getStudents: () => [student()]
    }
  }));
  try {
    const result = handlers.getAppBootstrap();
    assert.equal(result.ok, true);
    assert.deepEqual(Object.keys(result.data).sort(), ['dashboard', 'referenceData', 'students']);
  } finally {
    handlers.setPanelRuntimeFactoryForTest(null);
  }
});

test('APP_BOOTSTRAP_PII_BOUNDARY_TEST', () => {
  handlers.setPanelRuntimeFactoryForTest(() => ({
    queries: {
      getPanelDashboard: () => ({}),
      getPanelReferenceData: () => ({}),
      getStudents: () => [student({ tutor: 'Tutor Ficticio', email: 'family@example.invalid', telefono: 'not-a-phone', googleId: 'gid-test' })]
    }
  }));
  try {
    const serialized = JSON.stringify(handlers.getAppBootstrap().data);
    ['tutor', 'email', 'telefono', 'googleId', 'Script Property'].forEach((term) => {
      assert.equal(serialized.includes(term), false);
    });
  } finally {
    handlers.setPanelRuntimeFactoryForTest(null);
  }
});

test('APP_BOOTSTRAP_REAL_SHEETS_SCALARS_TEST', () => {
  handlers.setPanelRuntimeFactoryForTest(() => ({
    queries: {
      getPanelDashboard: () => ({ nextAbsenceDeadline: new Date('2026-02-01T12:00:00Z') }),
      getPanelReferenceData: () => ({ openSessions: [{ fecha: new Date('2026-02-01T00:00:00Z'), horaInicio: new Date('2000-01-01T08:05:00Z') }] }),
      getStudents: () => [student({ grado: 1 })]
    }
  }));
  try {
    const result = handlers.getAppBootstrap();
    assert.equal(result.ok, true);
    assert.equal(result.data.students[0].grado, 1);
    assert.equal(typeof result.data.dashboard.nextAbsenceDeadline, 'string');
  } finally {
    handlers.setPanelRuntimeFactoryForTest(null);
  }
});

test('APP_DASHBOARD_KPI_TEST', () => {
  const html = createAppRenderer({ state: { activeRoute: 'dashboard', ...bootstrap() } }).renderDashboard();
  assert.equal(html.includes('Asistencia'), true);
  assert.equal(html.includes('1 / 2'), true);
  assert.equal(html.includes('Rival A'), true);
});

test('APP_DASHBOARD_NO_FAKE_DATA_TEST', () => {
  const data = bootstrap({ dashboard: { attendanceSummary: {}, communications: {}, upcomingMatches: [], sportAlerts: [], readinessIssues: [] } });
  const html = createAppRenderer({ state: { activeRoute: 'dashboard', ...data } }).renderDashboard();
  assert.equal(html.includes('Sin partidos programados'), true);
  assert.equal(html.includes('14 /'), false);
});

test('APP_STUDENTS_TABLE_TEST', () => {
  const html = createAppRenderer({ state: { activeRoute: 'students', ...bootstrap() } }).renderStudents();
  ['Alumno', 'Grado / Grupo', 'Competencia', 'Nivel', 'Posicion principal', 'Estado deportivo'].forEach((text) => {
    assert.equal(html.includes(text), true);
  });
});

test('APP_STUDENTS_SEARCH_FILTER_TEST', () => {
  const state = { activeRoute: 'students', ...bootstrap({ students: [student(), student({ alumnoId: 'ALU-002', nombre: 'Otra' })] }), studentFilters: { search: 'Alumno' } };
  const html = createAppRenderer({ state }).renderStudents();
  assert.equal(html.includes('Alumno Ficticio'), true);
  assert.equal(html.includes('Otra Ficticio'), false);
});

test('APP_STUDENTS_COMPETITION_FILTER_TEST', () => {
  const state = { activeRoute: 'students', ...bootstrap({ students: [student(), student({ alumnoId: 'ALU-002', nombre: 'Beto', competenciaBase: 'B', nivel: 'B1' })] }), studentFilters: { competition: 'B' } };
  const html = createAppRenderer({ state }).renderStudents();
  assert.equal(html.includes('Beto Ficticio'), true);
  assert.equal(html.includes('Alumno Ficticio'), false);
});

test('APP_STUDENTS_LEVEL_FILTER_TEST', () => {
  const state = { activeRoute: 'students', ...bootstrap({ students: [student(), student({ alumnoId: 'ALU-002', nivel: 'A2' })] }), studentFilters: { level: 'A2' } };
  const html = createAppRenderer({ state }).renderStudents();
  assert.equal(html.includes('A2'), true);
});

test('APP_STUDENTS_NO_TUTOR_PII_TEST', () => {
  const html = createAppRenderer({ state: { activeRoute: 'students', ...bootstrap() } }).renderStudents();
  ['Tutor', 'EMAIL', 'TELEFONO'].forEach((term) => assert.equal(html.includes(term), false));
});

test('APP_ATTENDANCE_SESSION_SELECTOR_TEST', () => {
  const html = createAppRenderer({ state: { activeRoute: 'attendance', ...bootstrap(), attendance: { sessionId: 'SES-001', session: { tipo: 'ENTRENAMIENTO' }, rows: [] } } }).renderAttendance();
  assert.equal(html.includes('app-attendance-session'), true);
});

test('APP_ATTENDANCE_ACTION_A_R_F_TEST', () => {
  const calls = [];
  const controller = createAppClientController({
    callServer(name, args, onSuccess) {
      calls.push({ name, args });
      onSuccess({ ok: true, data: {} });
    },
    state: { activeRoute: 'attendance', ...bootstrap(), selectedSessionId: 'SES-001' },
    render: {}
  });
  controller.markAttendance('SES-001', 'ALU-001', 'A');
  controller.markAttendance('SES-001', 'ALU-001', 'R');
  controller.markAttendance('SES-001', 'ALU-001', 'F');
  assert.deepEqual(calls.map((call) => call.name), ['commandCreateAttendance', 'getPanelAttendance', 'commandCreateAttendance', 'getPanelAttendance', 'commandCreateAttendance', 'getPanelAttendance']);
  assert.deepEqual(calls.filter((call) => call.name === 'commandCreateAttendance').map((call) => call.args[0].estado), ['A', 'R', 'F']);
});

test('APP_ATTENDANCE_CAPABILITY_DISABLE_TEST', () => {
  const state = { activeRoute: 'attendance', ...bootstrap(), attendance: { rows: [{ nombre: 'Alumno', capabilities: { canMarkAttendance: false } }] } };
  const html = createAppRenderer({ state }).renderAttendance();
  assert.equal(html.includes('data-action="mark-attendance"'), false);
});

test('APP_ATTENDANCE_F_RESOLUTION_TEST', () => {
  const state = { activeRoute: 'attendance', ...bootstrap(), selectedSessionId: 'SES-001', attendance: { sessionId: 'SES-001', rows: [{ nombre: 'Alumno', estadoActual: 'F', attendanceId: 'AST-001', capabilities: { canResolveAbsence: true } }] } };
  const html = createAppRenderer({ state }).renderAttendance();
  assert.equal(html.includes('data-target-state="FJ"'), true);
  assert.equal(html.includes('data-target-state="LES"'), true);
  assert.equal(html.includes('data-target-state="FI"'), false);
});

test('APP_ATTENDANCE_ROUTE_PRESERVED_AFTER_WRITE_TEST', () => {
  const state = { activeRoute: 'attendance', ...bootstrap(), selectedSessionId: 'SES-001' };
  const controller = createAppClientController({
    callServer(name, args, onSuccess) { onSuccess({ ok: true, data: { rows: [] } }); },
    state,
    render: { route(route) { state.renderedRoute = route; }, feedback() {} }
  });
  controller.markAttendance('SES-001', 'ALU-001', 'A');
  assert.equal(state.activeRoute, 'attendance');
  assert.equal(state.renderedRoute, 'attendance');
});

test('APP_ATTENDANCE_ROUTE_AUTO_HYDRATE_TEST', () => {
  const calls = [];
  const controller = createAppClientController({
    callServer(name, args, onSuccess) {
      calls.push({ name, args });
      if (name === 'getAppBootstrap') onSuccess({ ok: true, data: bootstrap() });
      if (name === 'getPanelAttendance') onSuccess({ ok: true, data: { sessionId: args[0], rows: [] } });
    },
    state: {},
    render: { loading() {}, route() {} }
  });
  controller.route('attendance');
  assert.deepEqual(calls.map((call) => call.name), ['getAppBootstrap', 'getPanelAttendance']);
  assert.equal(calls[1].args[0], 'SES-001');
});

test('APP_ATTENDANCE_ROUTE_EMPTY_TEST', () => {
  const calls = [];
  const state = {};
  const rendered = [];
  const controller = createAppClientController({
    callServer(name, args, onSuccess) {
      calls.push({ name, args });
      onSuccess({ ok: true, data: bootstrap({ referenceData: { ...bootstrap().referenceData, openSessions: [] } }) });
    },
    state,
    render: { loading() {}, route(route) { rendered.push(route); } }
  });
  controller.route('attendance');
  assert.deepEqual(calls.map((call) => call.name), ['getAppBootstrap']);
  assert.deepEqual(state.attendance, { rows: [] });
  assert.deepEqual(rendered, ['attendance']);
});

test('APP_CONVOCATION_REFERENCE_LAYOUT_TEST', () => {
  const html = createAppRenderer({ state: { activeRoute: 'convocations', ...bootstrap(), convocation: convocationView() } }).renderConvocations();
  ['kpi-grid--five', 'stepper', 'convocation-main', 'side-panel', 'Acciones'].forEach((term) => assert.equal(html.includes(term), true));
});

test('APP_NO_PARENT_CONFIRMATION_UI_TEST', () => {
  const html = createAppRenderer({ state: { activeRoute: 'convocations', ...bootstrap(), convocation: convocationView() } }).renderConvocations();
  const blockedTerms = ['Confirma' + 'ciones', 'Confirma' + 'do', 'Pendiente de confirma' + 'r', 'padre'];
  blockedTerms.forEach((term) => assert.equal(html.includes(term), false));
});

test('APP_CONVOCATION_DYNAMIC_TARGET_TEST', () => {
  const html = createAppRenderer({ state: { activeRoute: 'convocations', ...bootstrap(), convocation: convocationView() } }).renderConvocations();
  assert.equal(html.includes('2 / 12'), true);
  assert.equal(html.includes('2 / 18'), false);
});

test('APP_CONVOCATION_DYNAMIC_POSITION_MINIMA_TEST', () => {
  const data = bootstrap();
  data.referenceData.convocationProposals[0] = {
    ...data.referenceData.convocationProposals[0],
    MIN_PORTEROS_SNAPSHOT: 2,
    MIN_DEFENSAS_SNAPSHOT: 5,
    MIN_MEDIOS_SNAPSHOT: 3,
    MIN_DELANTEROS_SNAPSHOT: 2
  };
  const details = [
    { ...convocationView().details[0], ALUMNO_ID: 'PO-1', posicionAsignada: 'PO', seleccionadoFinal: true },
    ...Array.from({ length: 4 }, (_, index) => ({ ...convocationView().details[1], ALUMNO_ID: `DEF-${index}`, nombre: `Def ${index}`, posicionAsignada: 'DEF', seleccionadoFinal: true })),
    ...Array.from({ length: 3 }, (_, index) => ({ ...convocationView().details[1], ALUMNO_ID: `MED-${index}`, nombre: `Med ${index}`, posicionAsignada: 'MED', seleccionadoFinal: true })),
    ...Array.from({ length: 2 }, (_, index) => ({ ...convocationView().details[1], ALUMNO_ID: `DEL-${index}`, nombre: `Del ${index}`, posicionAsignada: 'DEL', seleccionadoFinal: true }))
  ];
  const html = createAppRenderer({ state: { activeRoute: 'convocations', ...data, convocation: convocationView({ details }) } }).renderConvocations();
  ['PO 1/2', 'DEF 4/5', 'MED 3/3', 'DEL 2/2'].forEach((term) => assert.equal(html.includes(term), true));
});

test('APP_CONVOCATION_ELIGIBILITY_TEST', () => {
  const view = convocationView({ details: [{ ...convocationView().details[0], ELEGIBILITY_STATUS: 'INELIGIBLE', MOTIVO_NO_ELEGIBLE: 'SUSPENDIDO' }] });
  const html = createAppRenderer({ state: { activeRoute: 'convocations', ...bootstrap(), convocation: view } }).renderConvocations();
  assert.equal(html.includes('No elegible'), true);
  assert.equal(html.includes('SUSPENDIDO'), true);
});

test('APP_CONVOCATION_ROTATION_PRIORITY_TEST', () => {
  const html = createAppRenderer({ state: { activeRoute: 'convocations', ...bootstrap(), convocation: convocationView() } }).renderConvocations();
  assert.equal(html.includes('PRIORIDAD'), true);
  assert.equal(html.includes('3'), true);
});

test('APP_CONVOCATION_EXISTING_RESUME_TEST', () => {
  const calls = [];
  const state = {};
  const controller = createAppClientController({
    callServer(name, args, onSuccess) {
      calls.push({ name, args });
      if (name === 'getAppBootstrap') onSuccess({ ok: true, data: bootstrap() });
      if (name === 'getPanelConvocation') onSuccess({ ok: true, data: convocationView() });
    },
    state,
    render: { loading() {}, route() {} }
  });
  controller.route('convocations');
  assert.deepEqual(calls.map((call) => call.name), ['getAppBootstrap', 'getPanelConvocation']);
  assert.equal(calls[1].args[0], 'CON-001');
});

test('APP_CONVOCATION_NO_DUPLICATE_GENERATE_TEST', () => {
  const html = createAppRenderer({ state: { activeRoute: 'convocations', ...bootstrap(), convocation: convocationView() } }).renderConvocations();
  assert.match(html, /data-action="convocation-generate"[^>]*disabled/);
});

test('APP_CONVOCATION_MANUAL_SELECTION_RPC_TEST', () => {
  const calls = [];
  const controller = createAppClientController({ callServer(name, args, onSuccess) { calls.push({ name, args }); onSuccess({ ok: true, data: {} }); }, state: bootstrap(), render: {} });
  controller.setFinalSelection('CON-001', 'ALU-001', false, 'motivo');
  assert.equal(calls[0].name, 'commandSetFinalSelection');
});

test('APP_CONVOCATION_POSITION_ASSIGNMENT_RPC_TEST', () => {
  const calls = [];
  const controller = createAppClientController({ callServer(name, args, onSuccess) { calls.push({ name, args }); onSuccess({ ok: true, data: {} }); }, state: bootstrap(), render: {} });
  controller.assignPosition('CON-001', 'ALU-001', 'DEF', 'motivo');
  assert.equal(calls[0].name, 'commandAssignPosition');
});

test('APP_CONVOCATION_ACTOR_REQUIRED_TEST', () => {
  const controller = createAppClientController({ callServer() {}, state: bootstrap(), render: {} });
  assert.throws(() => controller.approveConvocation('CON-001', '  '), /PANEL_APPROVAL_ACTOR_REQUIRED/);
});

test('APP_CONVOCATION_APPROVAL_ACTOR_RPC_TEST', () => {
  const calls = [];
  const controller = createAppClientController({ callServer(name, args, onSuccess) { calls.push({ name, args }); onSuccess({ ok: true, data: {} }); }, state: bootstrap(), render: {} });
  controller.approveConvocation('CON-001', 'Entrenador');
  assert.deepEqual(calls[0], { name: 'commandApproveConvocation', args: ['CON-001', 'Entrenador'] });
});

test('APP_CONVOCATION_MAIL_DISABLED_TEST', () => {
  const state = { activeRoute: 'convocations', ...bootstrap(), convocation: convocationView() };
  const html = createAppRenderer({ state }).renderConvocations();
  assert.match(html, /data-action="communication-send" disabled/);
  const controller = createAppClientController({ callServer() { throw new Error('unexpected'); }, state, render: {} });
  assert.throws(() => controller.sendPendingCommunications(), /PANEL_CLIENT_MAIL_DISABLED/);
});

test('APP_CONVOCATION_MATCH_SUMMARY_TEST', () => {
  const html = createAppRenderer({ state: { activeRoute: 'convocations', ...bootstrap(), convocation: convocationView() } }).renderConvocations();
  ['Fecha', 'Hora de citacion', 'Hora del partido', 'Rival', 'Sede', 'Competencia', 'Local / visitante', 'Uniforme', 'Indicaciones'].forEach((term) => assert.equal(html.includes(term), true));
});

test('APP_CONVOCATION_ROUTE_AUTO_RESUME_TEST', () => {
  const calls = [];
  const state = {};
  const rendered = [];
  const controller = createAppClientController({
    callServer(name, args, onSuccess) {
      calls.push({ name, args });
      if (name === 'getAppBootstrap') onSuccess({ ok: true, data: bootstrap() });
      if (name === 'getPanelConvocation') onSuccess({ ok: true, data: convocationView() });
    },
    state,
    render: { loading() {}, route(route) { rendered.push(route); } }
  });
  controller.route('convocations');
  assert.equal(calls[1].name, 'getPanelConvocation');
  assert.equal(calls[1].args[0], 'CON-001');
  assert.equal(state.convocation.details.length, 2);
  assert.deepEqual(rendered, ['convocations']);
});

test('APP_CONVOCATION_ROUTE_NO_PROPOSAL_TEST', () => {
  const data = bootstrap();
  data.referenceData.convocationProposals = [];
  data.dashboard.convocationProposals = [];
  const calls = [];
  const state = {};
  const rendered = [];
  const controller = createAppClientController({
    callServer(name, args, onSuccess) {
      calls.push({ name, args });
      onSuccess({ ok: true, data });
    },
    state,
    render: { loading() {}, route(route) { rendered.push(route); } }
  });
  controller.route('convocations');
  assert.deepEqual(calls.map((call) => call.name), ['getAppBootstrap']);
  assert.equal(state.convocation.details.length, 0);
  assert.deepEqual(rendered, ['convocations']);
});

test('APP_ATTENDANCE_STALE_RESPONSE_TEST', () => {
  const calls = [];
  const rendered = [];
  const state = {};
  const controller = createAppClientController({
    callServer(name, args, onSuccess) { calls.push({ name, args, onSuccess }); },
    state,
    render: { loading() {}, route(route) { rendered.push(route); } }
  });
  controller.route('attendance');
  calls[0].onSuccess({ ok: true, data: bootstrap() });
  controller.route('students');
  calls[1].onSuccess({ ok: true, data: { sessionId: 'SES-001', rows: [{ nombre: 'Late' }] } });
  calls[2].onSuccess({ ok: true, data: bootstrap() });
  assert.equal(state.activeRoute, 'students');
  assert.equal(state.attendance, undefined);
  assert.deepEqual(rendered, ['students']);
});

test('APP_ATTENDANCE_SESSION_RACE_TEST', () => {
  const calls = [];
  const state = { activeRoute: 'attendance', ...bootstrap(), selectedSessionId: 'SES-001' };
  state.referenceData.openSessions.push({ sesionId: 'SES-002', competencia: 'A' });
  const controller = createAppClientController({
    callServer(name, args, onSuccess) { calls.push({ name, args, onSuccess }); },
    state,
    render: { route() {} }
  });
  controller.loadAttendance('SES-001');
  controller.loadAttendance('SES-002');
  calls[1].onSuccess({ ok: true, data: { sessionId: 'SES-002', rows: [{ nombre: 'Fresh' }] } });
  calls[0].onSuccess({ ok: true, data: { sessionId: 'SES-001', rows: [{ nombre: 'Late' }] } });
  assert.equal(state.selectedSessionId, 'SES-002');
  assert.equal(state.attendance.rows[0].nombre, 'Fresh');
});

test('APP_CONVOCATION_STALE_RESPONSE_TEST', () => {
  const calls = [];
  const state = { activeRoute: 'convocations', ...bootstrap(), selectedProgrammedMatchId: 'PAR-001' };
  state.referenceData.programmedMatches.push({ partidoId: 'PAR-002', competencia: 'A', rival: 'Rival B' });
  state.referenceData.convocationProposals.push({ CONVOCATORIA_ID: 'CON-002', PARTIDO_ID: 'PAR-002', ESTADO: 'PROPUESTA', TOTAL_OBJETIVO: 12 });
  const controller = createAppClientController({
    callServer(name, args, onSuccess) { calls.push({ name, args, onSuccess }); },
    state,
    render: { route() {} }
  });
  controller.loadConvocation('CON-001', undefined, 'PAR-001');
  state.selectedProgrammedMatchId = 'PAR-002';
  controller.loadConvocation('CON-002', undefined, 'PAR-002');
  calls[1].onSuccess({ ok: true, data: convocationView({ convocationId: 'CON-002', details: [{ nombre: 'Fresh' }] }) });
  calls[0].onSuccess({ ok: true, data: convocationView({ convocationId: 'CON-001', details: [{ nombre: 'Late' }] }) });
  assert.equal(state.selectedConvocationId, 'CON-002');
  assert.equal(state.convocation.details[0].nombre, 'Fresh');
});

test('APP_GENERATE_CONVOCATION_REAL_RESPONSE_SHAPE_TEST', () => {
  const calls = [];
  const generatedData = bootstrap();
  generatedData.referenceData.convocationProposals = [{ CONVOCATORIA_ID: 'CON-NEW', PARTIDO_ID: 'PAR-001', ESTADO: 'PROPUESTA', TOTAL_OBJETIVO: 12 }];
  const state = { activeRoute: 'convocations', ...bootstrap({ referenceData: { ...bootstrap().referenceData, convocationProposals: [] } }) };
  const controller = createAppClientController({
    callServer(name, args, onSuccess) {
      calls.push({ name, args, onSuccess });
      if (name === 'commandGenerateConvocation') onSuccess({ ok: true, data: { convocation: { CONVOCATORIA_ID: 'CON-NEW' }, details: [] } });
      if (name === 'getAppBootstrap') onSuccess({ ok: true, data: generatedData });
      if (name === 'getPanelConvocation') onSuccess({ ok: true, data: convocationView({ convocationId: 'CON-NEW' }) });
    },
    state,
    render: { route() {} }
  });
  controller.generateConvocation('PAR-001');
  assert.deepEqual(calls.map((call) => call.name), ['commandGenerateConvocation', 'getAppBootstrap', 'getPanelConvocation']);
  assert.equal(calls[2].args[0], 'CON-NEW');
});

test('APP_GENERATE_CONVOCATION_IN_FLIGHT_GUARD_TEST', () => {
  const calls = [];
  const state = { activeRoute: 'convocations', ...bootstrap({ referenceData: { ...bootstrap().referenceData, convocationProposals: [] } }) };
  const controller = createAppClientController({
    callServer(name, args, onSuccess) { calls.push({ name, args, onSuccess }); },
    state,
    render: { route() {} }
  });
  controller.generateConvocation('PAR-001');
  controller.generateConvocation('PAR-001');
  assert.equal(calls.filter((call) => call.name === 'commandGenerateConvocation').length, 1);
});

test('APP_GENERATE_CONVOCATION_REFRESHES_REFERENCE_TEST', () => {
  const state = { activeRoute: 'convocations', ...bootstrap(), convocationGeneratePending: false };
  const html = createAppRenderer({ state }).renderConvocations();
  assert.match(html, /data-action="convocation-generate"[^>]*disabled/);
});

test('APP_CONVOCATION_FILTER_SEARCH_TEST', () => {
  const state = { activeRoute: 'convocations', ...bootstrap(), convocation: convocationView(), convocationFilters: { search: 'Dos' } };
  const html = createAppRenderer({ state }).renderConvocations();
  assert.equal(html.includes('Alumno Dos'), true);
  assert.equal(html.includes('Alumno Ficticio'), false);
});

test('APP_CONVOCATION_FILTER_SELECTED_TEST', () => {
  const view = convocationView({ details: [{ ...convocationView().details[0], seleccionadoFinal: false }, convocationView().details[1]] });
  const html = createAppRenderer({ state: { activeRoute: 'convocations', ...bootstrap(), convocation: view, convocationFilters: { selected: 'SELECTED' } } }).renderConvocations();
  assert.equal(html.includes('Alumno Dos'), true);
  assert.equal(html.includes('Alumno Ficticio'), false);
});

test('APP_CONVOCATION_FILTER_POSITION_TEST', () => {
  const html = createAppRenderer({ state: { activeRoute: 'convocations', ...bootstrap(), convocation: convocationView(), convocationFilters: { position: 'PO' } } }).renderConvocations();
  assert.equal(html.includes('Alumno Ficticio'), true);
  assert.equal(html.includes('Alumno Dos'), false);
});

test('APP_CONVOCATION_FILTER_PRIORITY_TEST', () => {
  const html = createAppRenderer({ state: { activeRoute: 'convocations', ...bootstrap(), convocation: convocationView(), convocationFilters: { priority: 'YES' } } }).renderConvocations();
  assert.equal(html.includes('PRIORIDAD'), true);
  assert.equal(html.includes('Alumno Dos'), false);
});

test('APP_CONVOCATION_FILTER_ELIGIBILITY_TEST', () => {
  const view = convocationView({ details: [{ ...convocationView().details[0], ELEGIBILITY_STATUS: 'PENDING' }, convocationView().details[1]] });
  const html = createAppRenderer({ state: { activeRoute: 'convocations', ...bootstrap(), convocation: view, convocationFilters: { eligibility: 'PENDING' } } }).renderConvocations();
  assert.equal(html.includes('Pendiente'), true);
  assert.equal(html.includes('Alumno Dos'), false);
});

test('APP_CONVOCATION_FILTER_LEVEL_TEST', () => {
  const html = createAppRenderer({ state: { activeRoute: 'convocations', ...bootstrap(), convocation: convocationView(), convocationFilters: { level: 'A2' } } }).renderConvocations();
  assert.equal(html.includes('Alumno Dos'), true);
  assert.equal(html.includes('Alumno Ficticio'), false);
});

test('APP_CONVOCATION_FILTER_STAYS_ON_ROUTE_TEST', () => {
  const state = { activeRoute: 'convocations', ...bootstrap(), convocation: convocationView(), convocationFilters: { search: 'Alumno' } };
  const html = createAppRenderer({ state }).renderConvocationFilters();
  assert.equal(html.includes('data-filter='), false);
  assert.equal(html.includes('data-convocation-filter'), true);
  createAppRenderer({ state }).render('convocations');
  assert.equal(state.activeRoute, 'convocations');
});

test('APP_CONVOCATION_STEPPER_NO_PROPOSAL_TEST', () => {
  const data = bootstrap();
  data.referenceData.convocationProposals = [];
  const html = createAppRenderer({ state: { activeRoute: 'convocations', ...data, convocation: { details: [] } } }).renderConvocations();
  assert.match(html, /<li class="is-active">Propuesta generada/);
});

test('APP_CONVOCATION_STEPPER_PROPOSAL_TEST', () => {
  const html = createAppRenderer({ state: { activeRoute: 'convocations', ...bootstrap(), convocation: convocationView() } }).renderConvocations();
  assert.match(html, /<li class="is-done">Propuesta generada/);
  assert.match(html, /<li class="is-active">Revision del entrenador/);
});

test('APP_CONVOCATION_STEPPER_APPROVED_TEST', () => {
  const data = bootstrap();
  data.referenceData.convocationProposals = [];
  data.referenceData.authoritativeConvocations = [{ ...bootstrap().referenceData.convocationProposals[0], ESTADO: 'APROBADA' }];
  const html = createAppRenderer({ state: { activeRoute: 'convocations', ...data, convocation: convocationView() } }).renderConvocations();
  assert.match(html, /Convocatoria aprobada/);
  assert.match(html, /<li class="is-active">Comunicaciones/);
});

test('APP_CONVOCATION_STEPPER_SENT_TEST', () => {
  const data = bootstrap();
  data.referenceData.convocationProposals = [];
  data.referenceData.authoritativeConvocations = [{ ...bootstrap().referenceData.convocationProposals[0], ESTADO: 'ENVIADA' }];
  const html = createAppRenderer({ state: { activeRoute: 'convocations', ...data, convocation: convocationView() } }).renderConvocations();
  assert.match(html, /<li class="is-active">Partido/);
});

test('APP_CONVOCATION_STEPPER_CLOSED_TEST', () => {
  const data = bootstrap();
  data.referenceData.convocationProposals = [];
  data.referenceData.authoritativeConvocations = [{ ...bootstrap().referenceData.convocationProposals[0], ESTADO: 'CERRADA' }];
  const html = createAppRenderer({ state: { activeRoute: 'convocations', ...data, convocation: convocationView() } }).renderConvocations();
  assert.equal((html.match(/is-done/g) || []).length >= 5, true);
});

test('APP_CONVOCATION_AUTHORITATIVE_READONLY_TEST', () => {
  const data = bootstrap();
  data.referenceData.convocationProposals = [];
  data.referenceData.authoritativeConvocations = [{ ...bootstrap().referenceData.convocationProposals[0], ESTADO: 'APROBADA' }];
  const html = createAppRenderer({ state: { activeRoute: 'convocations', ...data, convocation: convocationView() } }).renderConvocations();
  assert.match(html, /data-action="convocation-selection"[^>]*disabled/);
  assert.match(html, /data-action="convocation-position"[^>]*disabled/);
});

test('APP_CONVOCATION_ACTION_GATING_TEST', () => {
  const proposalHtml = createAppRenderer({ state: { activeRoute: 'convocations', ...bootstrap(), convocation: convocationView() } }).renderConvocations();
  assert.match(proposalHtml, /data-action="convocation-approve"[^>]*(?<!disabled)>Aprobar convocatoria/);
  assert.match(proposalHtml, /data-action="communication-prepare"[^>]*disabled/);
  const approved = bootstrap();
  approved.referenceData.convocationProposals = [];
  approved.referenceData.authoritativeConvocations = [{ ...bootstrap().referenceData.convocationProposals[0], ESTADO: 'APROBADA' }];
  const approvedHtml = createAppRenderer({ state: { activeRoute: 'convocations', ...approved, convocation: convocationView() } }).renderConvocations();
  assert.match(approvedHtml, /data-action="convocation-approve"[^>]*disabled/);
  assert.match(approvedHtml, /data-action="communication-prepare"[^>]*(?<!disabled)>Preparar comunicaciones/);
  const sent = bootstrap();
  sent.referenceData.convocationProposals = [];
  sent.referenceData.authoritativeConvocations = [{ ...bootstrap().referenceData.convocationProposals[0], ESTADO: 'ENVIADA' }];
  const sentHtml = createAppRenderer({ state: { activeRoute: 'convocations', ...sent, convocation: convocationView() } }).renderConvocations();
  assert.match(sentHtml, /data-action="communication-prepare"[^>]*disabled/);
});

test('APP_GLOBAL_COMPETITION_MATCH_FILTER_TEST', () => {
  const data = bootstrap();
  data.dashboard.upcomingMatches.push({ partidoId: 'PAR-B', competencia: 'B', rival: 'Rival B' });
  data.referenceData.programmedMatches.push({ partidoId: 'PAR-B', competencia: 'B', rival: 'Rival B' });
  const state = { activeRoute: 'dashboard', selectedCompetition: 'A', ...data };
  const dashboardHtml = createAppRenderer({ state }).renderDashboard();
  const convocationHtml = createAppRenderer({ state: { ...state, activeRoute: 'convocations', convocation: convocationView() } }).renderConvocations();
  assert.equal(dashboardHtml.includes('Rival A'), true);
  assert.equal(dashboardHtml.includes('Rival B'), false);
  assert.equal(convocationHtml.includes('PAR-B'), false);
});

test('APP_GLOBAL_COMPETITION_ATTENDANCE_FILTER_TEST', () => {
  const data = bootstrap();
  data.referenceData.openSessions = [
    { sesionId: 'SES-GEN', competencia: 'GENERAL' },
    { sesionId: 'SES-A', competencia: 'A' },
    { sesionId: 'SES-B', competencia: 'B' }
  ];
  const html = createAppRenderer({ state: { activeRoute: 'attendance', selectedCompetition: 'A', ...data, attendance: { rows: [] } } }).renderAttendance();
  assert.equal(html.includes('SES-GEN'), true);
  assert.equal(html.includes('SES-A'), true);
  assert.equal(html.includes('SES-B'), false);
});

test('APP_NO_UNDEFINED_NULL_RENDER_TEST', () => {
  const data = bootstrap({ dashboard: { attendanceSummary: {}, communications: {}, upcomingMatches: [], sportAlerts: [], readinessIssues: [] } });
  const html = createAppRenderer({ state: { activeRoute: 'dashboard', ...data } }).renderDashboard();
  assert.equal(html.includes('undefined'), false);
  assert.equal(html.includes('>null<'), false);
  assert.equal(html.includes('[object Object]'), false);
});

test('APP_CONVOCATION_SWITCH_TO_NO_PROPOSAL_CLEARS_STATE_TEST', () => {
  const data = bootstrap();
  data.referenceData.programmedMatches.push({ partidoId: 'PAR-002', competencia: 'A', rival: 'Sin propuesta' });
  const state = { activeRoute: 'convocations', ...data, selectedProgrammedMatchId: 'PAR-001', selectedConvocationId: 'CON-001', convocation: convocationView() };
  const controller = createAppClientController({
    callServer() { throw new Error('unexpected rpc'); },
    state,
    render: { route() {} }
  });
  controller.selectProgrammedMatch('PAR-002');
  assert.equal(state.selectedProgrammedMatchId, 'PAR-002');
  assert.equal(state.selectedConvocationId, '');
  assert.equal(state.convocation.details.length, 0);
});

test('APP_CONVOCATION_SWITCH_TO_NO_PROPOSAL_NO_OLD_RPC_TARGET_TEST', () => {
  const data = bootstrap();
  data.referenceData.programmedMatches.push({ partidoId: 'PAR-002', competencia: 'A', rival: 'Sin propuesta' });
  const state = { activeRoute: 'convocations', ...data, selectedProgrammedMatchId: 'PAR-002', selectedConvocationId: '', convocation: { convocationId: '', details: [] } };
  const html = createAppRenderer({ state }).renderConvocations();
  assert.equal(html.includes('data-convocation-id="CON-001"'), false);
  assert.equal(html.includes('CON-001'), false);
});

test('APP_CONVOCATION_SWITCH_EXISTING_PROPOSAL_TEST', () => {
  const data = bootstrap();
  data.referenceData.programmedMatches.push({ partidoId: 'PAR-002', competencia: 'A', rival: 'Rival Dos' });
  data.referenceData.convocationProposals.push({ CONVOCATORIA_ID: 'CON-002', PARTIDO_ID: 'PAR-002', ESTADO: 'PROPUESTA', TOTAL_OBJETIVO: 12 });
  const calls = [];
  const state = { activeRoute: 'convocations', ...data, selectedProgrammedMatchId: 'PAR-001', selectedConvocationId: 'CON-001', convocation: convocationView() };
  const controller = createAppClientController({
    callServer(name, args, onSuccess) {
      calls.push({ name, args });
      onSuccess({ ok: true, data: convocationView({ convocationId: args[0], details: [{ nombre: 'Nuevo' }] }) });
    },
    state,
    render: { route() {} }
  });
  controller.selectProgrammedMatch('PAR-002');
  assert.deepEqual(calls[0], { name: 'getPanelConvocation', args: ['CON-002'] });
  assert.equal(state.selectedProgrammedMatchId, 'PAR-002');
  assert.equal(state.selectedConvocationId, 'CON-002');
});

test('APP_COMPETITION_CHANGE_ATTENDANCE_REHYDRATES_TEST', () => {
  const data = bootstrap();
  data.referenceData.openSessions = [
    { sesionId: 'SES-A', competencia: 'A' },
    { sesionId: 'SES-B', competencia: 'B' },
    { sesionId: 'SES-GEN', competencia: 'GENERAL' }
  ];
  const calls = [];
  const state = { activeRoute: 'attendance', selectedCompetition: 'B', ...data, selectedSessionId: 'SES-B', attendance: { rows: [{ nombre: 'Row B' }] } };
  const controller = createAppClientController({
    callServer(name, args, onSuccess) {
      calls.push({ name, args });
      if (name === 'getAppBootstrap') onSuccess({ ok: true, data });
      if (name === 'getPanelAttendance') onSuccess({ ok: true, data: { sessionId: args[0], rows: [{ nombre: 'Row A' }] } });
    },
    state,
    render: { loading() {}, route() {} }
  });
  controller.setCompetition('A');
  assert.equal(state.selectedCompetition, 'A');
  assert.notEqual(state.selectedSessionId, 'SES-B');
  assert.equal(calls.some((call) => call.name === 'getPanelAttendance'), true);
  assert.equal(state.attendance.rows[0].nombre, 'Row A');
});

test('APP_COMPETITION_CHANGE_CONVOCATION_REHYDRATES_TEST', () => {
  const data = bootstrap();
  data.referenceData.programmedMatches = [
    { partidoId: 'PAR-A', competencia: 'A', rival: 'A' },
    { partidoId: 'PAR-B', competencia: 'B', rival: 'B' }
  ];
  data.referenceData.convocationProposals = [
    { CONVOCATORIA_ID: 'CON-A', PARTIDO_ID: 'PAR-A', ESTADO: 'PROPUESTA', TOTAL_OBJETIVO: 12 },
    { CONVOCATORIA_ID: 'CON-B', PARTIDO_ID: 'PAR-B', ESTADO: 'PROPUESTA', TOTAL_OBJETIVO: 12 }
  ];
  const calls = [];
  const state = { activeRoute: 'convocations', selectedCompetition: 'B', ...data, selectedProgrammedMatchId: 'PAR-B', selectedConvocationId: 'CON-B', convocation: convocationView({ convocationId: 'CON-B' }) };
  const controller = createAppClientController({
    callServer(name, args, onSuccess) {
      calls.push({ name, args });
      if (name === 'getAppBootstrap') onSuccess({ ok: true, data });
      if (name === 'getPanelConvocation') onSuccess({ ok: true, data: convocationView({ convocationId: args[0], details: [{ nombre: 'A' }] }) });
    },
    state,
    render: { loading() {}, route() {} }
  });
  controller.setCompetition('A');
  assert.equal(state.selectedProgrammedMatchId, 'PAR-A');
  assert.equal(state.selectedConvocationId, 'CON-A');
  assert.equal(calls.some((call) => call.name === 'getPanelConvocation' && call.args[0] === 'CON-A'), true);
});

test('APP_COMPETITION_CHANGE_INVALID_SELECTION_CLEARED_TEST', () => {
  const data = bootstrap();
  data.referenceData.openSessions = [{ sesionId: 'SES-A', competencia: 'A' }, { sesionId: 'SES-B', competencia: 'B' }];
  data.referenceData.programmedMatches = [{ partidoId: 'PAR-A', competencia: 'A', rival: 'A' }, { partidoId: 'PAR-B', competencia: 'B', rival: 'B' }];
  data.referenceData.convocationProposals = [];
  const state = { activeRoute: 'convocations', selectedCompetition: 'B', ...data, selectedSessionId: 'SES-B', selectedProgrammedMatchId: 'PAR-B', selectedConvocationId: 'CON-B', convocation: convocationView({ convocationId: 'CON-B' }) };
  const controller = createAppClientController({
    callServer(name, args, onSuccess) { onSuccess({ ok: true, data }); },
    state,
    render: { loading() {}, route() {} }
  });
  controller.setCompetition('A');
  assert.notEqual(state.selectedSessionId, 'SES-B');
  assert.notEqual(state.selectedProgrammedMatchId, 'PAR-B');
  assert.equal(state.selectedConvocationId, '');
  assert.equal(state.convocation.details.length, 0);
});

test('APP_STALE_BOOTSTRAP_FAILURE_IGNORED_TEST', () => {
  const errors = [];
  const calls = [];
  const controller = createAppClientController({
    callServer(name, args, onSuccess, onFailure) { calls.push({ name, onSuccess, onFailure }); },
    state: {},
    render: { loading() {}, route() {}, error(message) { errors.push(message); } }
  });
  controller.route('dashboard');
  controller.route('students');
  calls[0].onFailure({ ok: false, code: 'REQUIRED_FIELD' });
  assert.deepEqual(errors, []);
});

test('APP_STALE_ATTENDANCE_FAILURE_IGNORED_TEST', () => {
  const errors = [];
  const calls = [];
  const state = { activeRoute: 'attendance', ...bootstrap(), selectedSessionId: 'SES-001' };
  const controller = createAppClientController({
    callServer(name, args, onSuccess, onFailure) { calls.push({ name, args, onSuccess, onFailure }); },
    state,
    render: { route() {}, error(message) { errors.push(message); } }
  });
  controller.loadAttendance('SES-001');
  controller.route('students');
  calls[0].onFailure({ ok: false, code: 'REQUIRED_FIELD' });
  assert.deepEqual(errors, []);
});

test('APP_STALE_CONVOCATION_FAILURE_IGNORED_TEST', () => {
  const errors = [];
  const calls = [];
  const state = { activeRoute: 'convocations', ...bootstrap(), selectedProgrammedMatchId: 'PAR-001', selectedConvocationId: 'CON-001' };
  const controller = createAppClientController({
    callServer(name, args, onSuccess, onFailure) { calls.push({ name, args, onSuccess, onFailure }); },
    state,
    render: { route() {}, error(message) { errors.push(message); } }
  });
  controller.loadConvocation('CON-001', undefined, 'PAR-001');
  state.selectedProgrammedMatchId = 'PAR-002';
  controller.route('students');
  calls[0].onFailure({ ok: false, code: 'REQUIRED_FIELD' });
  assert.deepEqual(errors, []);
});

test('APP_STALE_FAILURE_NO_VISIBLE_ERROR_TEST', () => {
  const errors = [];
  const calls = [];
  const controller = createAppClientController({
    callServer(name, args, onSuccess, onFailure) { calls.push({ onFailure }); },
    state: {},
    render: { loading() {}, route() {}, error(message) { errors.push(message); } }
  });
  controller.route('dashboard');
  controller.route('students');
  calls[0].onFailure({ ok: false, code: 'REQUIRED_FIELD' });
  assert.deepEqual(errors, []);
});

test('APP_UNRELATED_FAILURE_DOES_NOT_CLEAR_GENERATE_GUARD_TEST', () => {
  const calls = [];
  const state = { activeRoute: 'convocations', ...bootstrap({ referenceData: { ...bootstrap().referenceData, convocationProposals: [] } }), convocationGeneratePending: true };
  const controller = createAppClientController({
    callServer(name, args, onSuccess, onFailure) { calls.push({ name, args, onSuccess, onFailure }); },
    state,
    render: { route() {}, error() {} }
  });
  controller.loadAttendance('SES-001');
  calls[0].onFailure({ ok: false, code: 'REQUIRED_FIELD' });
  controller.generateConvocation('PAR-001');
  assert.equal(state.convocationGeneratePending, true);
  assert.equal(calls.filter((call) => call.name === 'commandGenerateConvocation').length, 0);
});

function manyConvocationDetails() {
  return Array.from({ length: 10 }, (_, index) => ({
    ...convocationView().details[index % 2],
    ALUMNO_ID: `ALU-${index}`,
    nombre: index === 0 ? 'Visible Uno' : `Oculto ${index}`,
    ELEGIBILITY_STATUS: index < 8 ? 'ELIGIBLE' : 'INELIGIBLE',
    prioridadRotacion: index < 3,
    seleccionadoFinal: index < 6,
    posicionAsignada: index === 0 ? 'PO' : index < 4 ? 'DEF' : index < 7 ? 'MED' : 'DEL'
  }));
}

test('APP_CONVOCATION_FILTER_KPI_INVARIANT_TEST', () => {
  const data = bootstrap();
  data.referenceData.convocationProposals[0].TOTAL_OBJETIVO = 12;
  const state = {
    activeRoute: 'convocations',
    ...data,
    convocation: convocationView({ details: manyConvocationDetails() }),
    convocationFilters: { search: 'Visible Uno' }
  };
  const html = createAppRenderer({ state }).renderConvocations();
  assert.equal(html.includes('8 / 10'), true);
  assert.equal(html.includes('<strong>3</strong>'), true);
  assert.equal(html.includes('6 / 12'), true);
  assert.equal(html.includes('Visible Uno'), true);
  assert.equal(html.includes('Oculto 1'), false);
});

test('APP_CONVOCATION_POSITION_COVERAGE_FILTER_INVARIANT_TEST', () => {
  const data = bootstrap();
  data.referenceData.convocationProposals[0] = {
    ...data.referenceData.convocationProposals[0],
    MIN_PORTEROS_SNAPSHOT: 1,
    MIN_DEFENSAS_SNAPSHOT: 3,
    MIN_MEDIOS_SNAPSHOT: 2,
    MIN_DELANTEROS_SNAPSHOT: 1
  };
  const state = {
    activeRoute: 'convocations',
    ...data,
    convocation: convocationView({ details: manyConvocationDetails() }),
    convocationFilters: { position: 'PO' }
  };
  const html = createAppRenderer({ state }).renderConvocations();
  assert.equal(html.includes('PO 1/1'), true);
  assert.equal(html.includes('DEF 3/3'), true);
  assert.equal(html.includes('MED 2/2'), true);
  assert.equal(html.includes('DEL 0/1'), true);
});

test('APP_CONVOCATION_SWITCH_EXISTING_INFLIGHT_CLEARS_OLD_STATE_TEST', () => {
  const data = bootstrap();
  data.referenceData.programmedMatches.push({ partidoId: 'PAR-002', competencia: 'A', rival: 'Rival Dos' });
  data.referenceData.convocationProposals.push({ CONVOCATORIA_ID: 'CON-002', PARTIDO_ID: 'PAR-002', ESTADO: 'PROPUESTA', TOTAL_OBJETIVO: 12 });
  const calls = [];
  const state = { activeRoute: 'convocations', ...data, selectedProgrammedMatchId: 'PAR-001', selectedConvocationId: 'CON-001', convocation: convocationView() };
  const controller = createAppClientController({
    callServer(name, args, onSuccess) { calls.push({ name, args, onSuccess }); },
    state,
    render: { route() {} }
  });
  controller.selectProgrammedMatch('PAR-002');
  assert.deepEqual(calls[0], { name: 'getPanelConvocation', args: ['CON-002'], onSuccess: calls[0].onSuccess });
  assert.equal(state.selectedProgrammedMatchId, 'PAR-002');
  assert.equal(state.selectedConvocationId, '');
  assert.equal(state.convocation.details.length, 0);
});

test('APP_CONVOCATION_SWITCH_EXISTING_INFLIGHT_REMOVES_OLD_ACTIONS_TEST', () => {
  const data = bootstrap();
  data.referenceData.programmedMatches.push({ partidoId: 'PAR-002', competencia: 'A', rival: 'Rival Dos' });
  data.referenceData.convocationProposals.push({ CONVOCATORIA_ID: 'CON-002', PARTIDO_ID: 'PAR-002', ESTADO: 'PROPUESTA', TOTAL_OBJETIVO: 12 });
  const state = { activeRoute: 'convocations', ...data, selectedProgrammedMatchId: 'PAR-001', selectedConvocationId: 'CON-001', convocation: convocationView() };
  const controller = createAppClientController({
    callServer() {},
    state,
    render: { route() {} }
  });
  controller.selectProgrammedMatch('PAR-002');
  const html = createAppRenderer({ state }).renderConvocations();
  assert.equal(html.includes('data-convocation-id="CON-001"'), false);
  assert.equal(html.includes('data-action="convocation-selection"'), false);
  assert.equal(html.includes('data-action="convocation-position"'), false);
});

test('APP_CONVOCATION_RENDER_MISMATCH_GUARD_TEST', () => {
  const data = bootstrap();
  data.referenceData.programmedMatches.push({ partidoId: 'PAR-002', competencia: 'A', rival: 'Rival Dos' });
  data.referenceData.convocationProposals.push({ CONVOCATORIA_ID: 'CON-002', PARTIDO_ID: 'PAR-002', ESTADO: 'PROPUESTA', TOTAL_OBJETIVO: 12 });
  const state = { activeRoute: 'convocations', ...data, selectedProgrammedMatchId: 'PAR-002', selectedConvocationId: 'CON-001', convocation: convocationView({ convocationId: 'CON-001' }) };
  const html = createAppRenderer({ state }).renderConvocations();
  assert.equal(html.includes('Alumno Ficticio'), false);
  assert.equal(html.includes('data-convocation-id="CON-001"'), false);
  assert.equal(html.includes('data-action="convocation-selection"'), false);
  assert.equal(html.includes('data-action="communication-prepare" data-convocation-id="CON-001"'), false);
});

test('APP_CONVOCATION_SWITCH_EXISTING_COMPLETES_TEST', () => {
  const data = bootstrap();
  data.referenceData.programmedMatches.push({ partidoId: 'PAR-002', competencia: 'A', rival: 'Rival Dos' });
  data.referenceData.convocationProposals.push({ CONVOCATORIA_ID: 'CON-002', PARTIDO_ID: 'PAR-002', ESTADO: 'PROPUESTA', TOTAL_OBJETIVO: 12 });
  const calls = [];
  const state = { activeRoute: 'convocations', ...data, selectedProgrammedMatchId: 'PAR-001', selectedConvocationId: 'CON-001', convocation: convocationView() };
  const controller = createAppClientController({
    callServer(name, args, onSuccess) { calls.push({ name, args, onSuccess }); },
    state,
    render: { route() {} }
  });
  controller.selectProgrammedMatch('PAR-002');
  calls[0].onSuccess({ ok: true, data: convocationView({ convocationId: 'CON-002', details: [{ ...convocationView().details[0], nombre: 'Jugador Nuevo' }] }) });
  const html = createAppRenderer({ state }).renderConvocations();
  assert.equal(state.selectedConvocationId, 'CON-002');
  assert.equal(state.convocation.details[0].nombre, 'Jugador Nuevo');
  assert.equal(html.includes('data-convocation-id="CON-002"'), true);
  assert.equal(html.includes('data-convocation-id="CON-001"'), false);
});

test('APP_ATTENDANCE_SESSION_SWITCH_INFLIGHT_CLEARS_OLD_ROWS_TEST', () => {
  const data = bootstrap();
  data.referenceData.openSessions.push({ sesionId: 'SES-NEW', competencia: 'A', fecha: '2026-02-02' });
  const calls = [];
  const state = { activeRoute: 'attendance', ...data, selectedSessionId: 'SES-OLD', attendance: { sessionId: 'SES-OLD', rows: [{ studentId: 'ALU-OLD', nombre: 'Alumno Viejo', capabilities: { canMarkAttendance: true } }] } };
  const controller = createAppClientController({
    callServer(name, args, onSuccess) { calls.push({ name, args, onSuccess }); },
    state,
    render: { route() {} }
  });
  controller.selectAttendanceSession('SES-NEW');
  assert.equal(state.selectedSessionId, 'SES-NEW');
  assert.equal(state.attendance.sessionId, 'SES-NEW');
  assert.equal(state.attendance.rows.length, 0);
});

test('APP_ATTENDANCE_SESSION_SWITCH_OLD_ACTIONS_UNAVAILABLE_TEST', () => {
  const data = bootstrap();
  data.referenceData.openSessions.push({ sesionId: 'SES-NEW', competencia: 'A', fecha: '2026-02-02' });
  const state = { activeRoute: 'attendance', ...data, selectedSessionId: 'SES-OLD', attendance: { sessionId: 'SES-OLD', rows: [{ studentId: 'ALU-OLD', nombre: 'Alumno Viejo', capabilities: { canMarkAttendance: true } }] } };
  const controller = createAppClientController({
    callServer() {},
    state,
    render: { route() {} }
  });
  controller.selectAttendanceSession('SES-NEW');
  const html = createAppRenderer({ state }).renderAttendance();
  assert.equal(html.includes('ALU-OLD'), false);
  assert.equal(html.includes('data-action="mark-attendance"'), false);
});

test('APP_ATTENDANCE_SESSION_RENDER_MISMATCH_GUARD_TEST', () => {
  const state = {
    activeRoute: 'attendance',
    ...bootstrap(),
    selectedSessionId: 'SES-NEW',
    attendance: { sessionId: 'SES-OLD', rows: [{ studentId: 'ALU-OLD', nombre: 'Alumno Viejo', capabilities: { canMarkAttendance: true } }] }
  };
  const html = createAppRenderer({ state }).renderAttendance();
  assert.equal(html.includes('Alumno Viejo'), false);
  assert.equal(html.includes('data-student-id="ALU-OLD"'), false);
  assert.equal(html.includes('data-action="mark-attendance"'), false);
});

test('APP_ATTENDANCE_SESSION_SWITCH_COMPLETES_TEST', () => {
  const data = bootstrap();
  data.referenceData.openSessions.push({ sesionId: 'SES-NEW', competencia: 'A', fecha: '2026-02-02' });
  const calls = [];
  const state = { activeRoute: 'attendance', ...data, selectedSessionId: 'SES-OLD', attendance: { sessionId: 'SES-OLD', rows: [{ studentId: 'ALU-OLD', nombre: 'Alumno Viejo', capabilities: { canMarkAttendance: true } }] } };
  const controller = createAppClientController({
    callServer(name, args, onSuccess) { calls.push({ name, args, onSuccess }); },
    state,
    render: { route() {}, feedback() {} }
  });
  controller.selectAttendanceSession('SES-NEW');
  calls[0].onSuccess({ ok: true, data: { sessionId: 'SES-NEW', rows: [{ studentId: 'ALU-NEW', nombre: 'Alumno Nuevo', capabilities: { canMarkAttendance: true } }] } });
  const html = createAppRenderer({ state }).renderAttendance();
  assert.equal(state.attendance.rows[0].studentId, 'ALU-NEW');
  assert.equal(html.includes('ALU-NEW'), true);
  assert.equal(html.includes('ALU-OLD'), false);
});

test('APP_GENERATE_SUCCESS_AFTER_ROUTE_CHANGE_NO_HIJACK_TEST', () => {
  const data = bootstrap();
  data.referenceData.convocationProposals = [];
  const calls = [];
  const rendered = [];
  const state = { activeRoute: 'convocations', ...data, selectedProgrammedMatchId: 'PAR-001' };
  const controller = createAppClientController({
    callServer(name, args, onSuccess, onFailure) { calls.push({ name, args, onSuccess, onFailure }); },
    state,
    render: { loading() {}, route(route) { rendered.push(route); }, error() {} }
  });
  controller.generateConvocation('PAR-001');
  controller.route('students');
  calls[0].onSuccess({ ok: true, data: { CONVOCATORIA_ID: 'CON-NEW' } });
  assert.equal(state.activeRoute, 'students');
  assert.equal(state.convocationGeneratePending, false);
  assert.equal(calls.filter((call) => call.name === 'getAppBootstrap').length, 1);
  assert.equal(rendered.includes('convocations'), true);
});

test('APP_GENERATE_FAILURE_AFTER_ROUTE_CHANGE_NO_HIJACK_TEST', () => {
  const data = bootstrap();
  data.referenceData.convocationProposals = [];
  const calls = [];
  const errors = [];
  const state = { activeRoute: 'convocations', ...data, selectedProgrammedMatchId: 'PAR-001' };
  const controller = createAppClientController({
    callServer(name, args, onSuccess, onFailure) { calls.push({ name, args, onSuccess, onFailure }); },
    state,
    render: { loading() {}, route() {}, error(message) { errors.push(message); } }
  });
  controller.generateConvocation('PAR-001');
  controller.route('students');
  calls[0].onFailure({ ok: false, code: 'REQUIRED_FIELD' });
  assert.equal(state.activeRoute, 'students');
  assert.equal(state.convocationGeneratePending, false);
  assert.deepEqual(errors, []);
});

test('APP_GENERATE_SUCCESS_SAME_CONTEXT_REFRESHES_TEST', () => {
  const data = bootstrap();
  data.referenceData.convocationProposals = [];
  const refreshed = bootstrap();
  refreshed.referenceData.convocationProposals = [{ CONVOCATORIA_ID: 'CON-NEW', PARTIDO_ID: 'PAR-001', ESTADO: 'PROPUESTA', TOTAL_OBJETIVO: 12 }];
  const calls = [];
  const state = { activeRoute: 'convocations', ...data, selectedProgrammedMatchId: 'PAR-001' };
  const controller = createAppClientController({
    callServer(name, args, onSuccess) {
      calls.push({ name, args, onSuccess });
      if (name === 'getAppBootstrap') onSuccess({ ok: true, data: refreshed });
      if (name === 'getPanelConvocation') onSuccess({ ok: true, data: convocationView({ convocationId: args[0], details: [{ nombre: 'Generado' }] }) });
    },
    state,
    render: { loading() {}, route() {}, error() {} }
  });
  controller.generateConvocation('PAR-001');
  calls[0].onSuccess({ ok: true, data: { CONVOCATORIA_ID: 'CON-NEW' } });
  assert.deepEqual(calls.map((call) => call.name), ['commandGenerateConvocation', 'getAppBootstrap', 'getPanelConvocation']);
  assert.equal(state.convocationGeneratePending, false);
  assert.equal(state.selectedConvocationId, 'CON-NEW');
  assert.equal(state.convocation.details[0].nombre, 'Generado');
});

test('APP_GENERATE_FAILURE_SAME_CONTEXT_VISIBLE_TEST', () => {
  const data = bootstrap();
  data.referenceData.convocationProposals = [];
  const calls = [];
  const errors = [];
  const state = { activeRoute: 'convocations', ...data, selectedProgrammedMatchId: 'PAR-001' };
  const controller = createAppClientController({
    callServer(name, args, onSuccess, onFailure) { calls.push({ name, args, onSuccess, onFailure }); },
    state,
    render: { route() {}, error(message) { errors.push(message); } }
  });
  controller.generateConvocation('PAR-001');
  calls[0].onFailure({ ok: false, code: 'REQUIRED_FIELD' });
  assert.equal(state.convocationGeneratePending, false);
  assert.equal(errors[0], 'No se pudo completar la operacion solicitada. [REQUIRED_FIELD]');
});

function twoConvocationsBootstrap(overrides = {}) {
  const data = bootstrap(overrides);
  data.referenceData.programmedMatches = [
    { partidoId: 'PAR-001', competencia: 'A', rival: 'Rival Uno' },
    { partidoId: 'PAR-002', competencia: 'A', rival: 'Rival Dos' }
  ];
  data.referenceData.convocationProposals = [
    { CONVOCATORIA_ID: 'CON-001', PARTIDO_ID: 'PAR-001', ESTADO: 'PROPUESTA', TOTAL_OBJETIVO: 12 },
    { CONVOCATORIA_ID: 'CON-002', PARTIDO_ID: 'PAR-002', ESTADO: 'PROPUESTA', TOTAL_OBJETIVO: 12 }
  ];
  return data;
}

test('APP_ATTENDANCE_MARK_SUCCESS_AFTER_SESSION_SWITCH_NO_REVERT_TEST', () => {
  const data = bootstrap();
  data.referenceData.openSessions = [{ sesionId: 'SES-001', competencia: 'A' }, { sesionId: 'SES-002', competencia: 'A' }];
  const calls = [];
  const state = { activeRoute: 'attendance', ...data, selectedSessionId: 'SES-001', attendance: { sessionId: 'SES-001', rows: [{ studentId: 'ALU-001' }] } };
  const controller = createAppClientController({
    callServer(name, args, onSuccess, onFailure) { calls.push({ name, args, onSuccess, onFailure }); },
    state,
    render: { route() {}, feedback() {}, error() {} }
  });
  controller.markAttendance('SES-001', 'ALU-001', 'A');
  controller.selectAttendanceSession('SES-002');
  calls[0].onSuccess({ ok: true, data: {} });
  assert.equal(state.selectedSessionId, 'SES-002');
  assert.equal(calls.filter((call) => call.name === 'getPanelAttendance' && call.args[0] === 'SES-001').length, 0);
});

test('APP_ATTENDANCE_MARK_FAILURE_AFTER_SESSION_SWITCH_NO_ERROR_TEST', () => {
  const data = bootstrap();
  data.referenceData.openSessions = [{ sesionId: 'SES-001', competencia: 'A' }, { sesionId: 'SES-002', competencia: 'A' }];
  const calls = [];
  const errors = [];
  const state = { activeRoute: 'attendance', ...data, selectedSessionId: 'SES-001', attendance: { sessionId: 'SES-001', rows: [{ studentId: 'ALU-001' }] } };
  const controller = createAppClientController({
    callServer(name, args, onSuccess, onFailure) { calls.push({ name, args, onSuccess, onFailure }); },
    state,
    render: { route() {}, error(message) { errors.push(message); } }
  });
  controller.markAttendance('SES-001', 'ALU-001', 'A');
  controller.selectAttendanceSession('SES-002');
  calls[0].onFailure({ ok: false, code: 'REQUIRED_FIELD' });
  assert.equal(state.selectedSessionId, 'SES-002');
  assert.deepEqual(errors, []);
});

test('APP_ATTENDANCE_MARK_SUCCESS_SAME_SESSION_REFRESHES_TEST', () => {
  const data = bootstrap();
  data.referenceData.openSessions = [{ sesionId: 'SES-001', competencia: 'A' }];
  const calls = [];
  const feedback = [];
  const state = { activeRoute: 'attendance', ...data, selectedSessionId: 'SES-001', attendance: { sessionId: 'SES-001', rows: [{ studentId: 'ALU-001' }] } };
  const controller = createAppClientController({
    callServer(name, args, onSuccess, onFailure) { calls.push({ name, args, onSuccess, onFailure }); },
    state,
    render: { route() {}, feedback(message) { feedback.push(message); } }
  });
  controller.markAttendance('SES-001', 'ALU-001', 'A');
  calls[0].onSuccess({ ok: true, data: {} });
  assert.equal(feedback[0], 'Guardado');
  assert.equal(calls.some((call) => call.name === 'getPanelAttendance' && call.args[0] === 'SES-001'), true);
});

test('APP_RESOLVE_ABSENCE_AFTER_SESSION_SWITCH_NO_HIJACK_TEST', () => {
  const data = bootstrap();
  data.referenceData.openSessions = [{ sesionId: 'SES-001', competencia: 'A' }, { sesionId: 'SES-002', competencia: 'A' }];
  const calls = [];
  const feedback = [];
  const state = { activeRoute: 'attendance', ...data, selectedSessionId: 'SES-001', attendance: { sessionId: 'SES-001', rows: [{ attendanceId: 'AST-001' }] } };
  const controller = createAppClientController({
    callServer(name, args, onSuccess, onFailure) { calls.push({ name, args, onSuccess, onFailure }); },
    state,
    render: { route() {}, feedback(message) { feedback.push(message); }, error() {} }
  });
  controller.resolveAbsence('AST-001', 'FJ', 'motivo');
  controller.selectAttendanceSession('SES-002');
  calls[0].onSuccess({ ok: true, data: {} });
  assert.equal(state.selectedSessionId, 'SES-002');
  assert.deepEqual(feedback, []);
  assert.equal(calls.filter((call) => call.name === 'getPanelAttendance' && call.args[0] === 'SES-001').length, 0);
});

test('APP_CONVOCATION_SELECTION_SUCCESS_AFTER_MATCH_SWITCH_NO_HIJACK_TEST', () => {
  const data = twoConvocationsBootstrap();
  const calls = [];
  const state = { activeRoute: 'convocations', ...data, selectedProgrammedMatchId: 'PAR-001', selectedConvocationId: 'CON-001', convocation: convocationView() };
  const controller = createAppClientController({
    callServer(name, args, onSuccess, onFailure) { calls.push({ name, args, onSuccess, onFailure }); },
    state,
    render: { route() {}, error() {} }
  });
  controller.setFinalSelection('CON-001', 'ALU-001', false, 'motivo');
  controller.selectProgrammedMatch('PAR-002');
  calls[0].onSuccess({ ok: true, data: {} });
  assert.equal(state.selectedProgrammedMatchId, 'PAR-002');
  assert.equal(calls.filter((call) => call.name === 'getPanelConvocation' && call.args[0] === 'CON-001').length, 0);
});

test('APP_CONVOCATION_SELECTION_FAILURE_AFTER_MATCH_SWITCH_NO_ERROR_TEST', () => {
  const data = twoConvocationsBootstrap();
  const calls = [];
  const errors = [];
  const state = { activeRoute: 'convocations', ...data, selectedProgrammedMatchId: 'PAR-001', selectedConvocationId: 'CON-001', convocation: convocationView() };
  const controller = createAppClientController({
    callServer(name, args, onSuccess, onFailure) { calls.push({ name, args, onSuccess, onFailure }); },
    state,
    render: { route() {}, error(message) { errors.push(message); } }
  });
  controller.setFinalSelection('CON-001', 'ALU-001', false, 'motivo');
  controller.selectProgrammedMatch('PAR-002');
  calls[0].onFailure({ ok: false, code: 'REQUIRED_FIELD' });
  assert.deepEqual(errors, []);
});

test('APP_CONVOCATION_POSITION_SUCCESS_AFTER_MATCH_SWITCH_NO_HIJACK_TEST', () => {
  const data = twoConvocationsBootstrap();
  const calls = [];
  const state = { activeRoute: 'convocations', ...data, selectedProgrammedMatchId: 'PAR-001', selectedConvocationId: 'CON-001', convocation: convocationView() };
  const controller = createAppClientController({
    callServer(name, args, onSuccess, onFailure) { calls.push({ name, args, onSuccess, onFailure }); },
    state,
    render: { route() {}, error() {} }
  });
  controller.assignPosition('CON-001', 'ALU-001', 'DEF', 'motivo');
  controller.selectProgrammedMatch('PAR-002');
  calls[0].onSuccess({ ok: true, data: {} });
  assert.equal(state.selectedProgrammedMatchId, 'PAR-002');
  assert.equal(calls.filter((call) => call.name === 'getPanelConvocation' && call.args[0] === 'CON-001').length, 0);
});

test('APP_CONVOCATION_POSITION_FAILURE_AFTER_MATCH_SWITCH_NO_ERROR_TEST', () => {
  const data = twoConvocationsBootstrap();
  const calls = [];
  const errors = [];
  const state = { activeRoute: 'convocations', ...data, selectedProgrammedMatchId: 'PAR-001', selectedConvocationId: 'CON-001', convocation: convocationView() };
  const controller = createAppClientController({
    callServer(name, args, onSuccess, onFailure) { calls.push({ name, args, onSuccess, onFailure }); },
    state,
    render: { route() {}, error(message) { errors.push(message); } }
  });
  controller.assignPosition('CON-001', 'ALU-001', 'DEF', 'motivo');
  controller.selectProgrammedMatch('PAR-002');
  calls[0].onFailure({ ok: false, code: 'REQUIRED_FIELD' });
  assert.deepEqual(errors, []);
});

test('APP_CONVOCATION_OLD_WRITE_DOES_NOT_INVALIDATE_NEW_LOAD_TEST', () => {
  const data = twoConvocationsBootstrap();
  const calls = [];
  const state = { activeRoute: 'convocations', ...data, selectedProgrammedMatchId: 'PAR-001', selectedConvocationId: 'CON-001', convocation: convocationView() };
  const controller = createAppClientController({
    callServer(name, args, onSuccess, onFailure) { calls.push({ name, args, onSuccess, onFailure }); },
    state,
    render: { route() {}, error() {} }
  });
  controller.setFinalSelection('CON-001', 'ALU-001', false, 'motivo');
  controller.selectProgrammedMatch('PAR-002');
  calls[0].onSuccess({ ok: true, data: {} });
  calls[1].onSuccess({ ok: true, data: convocationView({ convocationId: 'CON-002', details: [{ nombre: 'Fresh Dos' }] }) });
  assert.equal(state.selectedProgrammedMatchId, 'PAR-002');
  assert.equal(state.selectedConvocationId, 'CON-002');
  assert.equal(state.convocation.details[0].nombre, 'Fresh Dos');
});

test('APP_CONVOCATION_APPROVE_AFTER_MATCH_SWITCH_NO_HIJACK_TEST', () => {
  const data = twoConvocationsBootstrap();
  const calls = [];
  const state = { activeRoute: 'convocations', ...data, selectedProgrammedMatchId: 'PAR-001', selectedConvocationId: 'CON-001', convocation: convocationView() };
  const controller = createAppClientController({
    callServer(name, args, onSuccess, onFailure) { calls.push({ name, args, onSuccess, onFailure }); },
    state,
    render: { route() {}, error() {} }
  });
  controller.approveConvocation('CON-001', 'Entrenador');
  controller.selectProgrammedMatch('PAR-002');
  calls[0].onSuccess({ ok: true, data: {} });
  assert.equal(state.selectedProgrammedMatchId, 'PAR-002');
  assert.equal(calls.filter((call) => call.name === 'getAppBootstrap').length, 0);
});

test('APP_CONVOCATION_PREPARE_AFTER_MATCH_SWITCH_NO_HIJACK_TEST', () => {
  const data = twoConvocationsBootstrap();
  const calls = [];
  const state = { activeRoute: 'convocations', ...data, selectedProgrammedMatchId: 'PAR-001', selectedConvocationId: 'CON-001', convocation: convocationView() };
  const controller = createAppClientController({
    callServer(name, args, onSuccess, onFailure) { calls.push({ name, args, onSuccess, onFailure }); },
    state,
    render: { route() {}, error() {} }
  });
  controller.prepareConvocationCommunications('CON-001');
  controller.selectProgrammedMatch('PAR-002');
  calls[0].onSuccess({ ok: true, data: {} });
  assert.equal(state.selectedProgrammedMatchId, 'PAR-002');
  assert.equal(calls.filter((call) => call.name === 'getAppBootstrap').length, 0);
});

test('APP_LOAD_CONVOCATION_WRONG_MATCH_REJECTED_TEST', () => {
  const data = twoConvocationsBootstrap();
  const calls = [];
  const state = { activeRoute: 'convocations', ...data, selectedProgrammedMatchId: 'PAR-002', selectedConvocationId: 'CON-002', convocation: convocationView({ convocationId: 'CON-002' }) };
  const controller = createAppClientController({
    callServer(name, args, onSuccess, onFailure) { calls.push({ name, args, onSuccess, onFailure }); },
    state,
    render: { route() {} }
  });
  controller.loadConvocation('CON-001');
  assert.deepEqual(calls, []);
  assert.equal(state.selectedConvocationId, 'CON-002');
  assert.equal(state.convocation.convocationId, 'CON-002');
});

test('APP_CONVOCATION_NO_PROPOSAL_STALE_LOADED_GUARD_TEST', () => {
  const data = bootstrap();
  data.referenceData.programmedMatches.push({ partidoId: 'PAR-002', competencia: 'A', rival: 'Sin propuesta' });
  const state = { activeRoute: 'convocations', ...data, selectedProgrammedMatchId: 'PAR-002', selectedConvocationId: 'CON-001', convocation: convocationView({ convocationId: 'CON-001' }) };
  const html = createAppRenderer({ state }).renderConvocations();
  assert.equal(html.includes('Alumno Ficticio'), false);
  assert.equal(html.includes('data-convocation-id="CON-001"'), false);
  assert.equal(html.includes('data-action="convocation-selection"'), false);
  assert.equal(html.includes('data-action="convocation-position"'), false);
  assert.equal(html.includes('data-action="convocation-approve" data-convocation-id="CON-001"'), false);
  assert.equal(html.includes('data-action="communication-prepare" data-convocation-id="CON-001"'), false);
});

test('APP_ATTENDANCE_NO_SELECTED_SESSION_STALE_ROWS_GUARD_TEST', () => {
  const state = {
    activeRoute: 'attendance',
    ...bootstrap(),
    selectedSessionId: '',
    attendance: { sessionId: 'SES-OLD', rows: [{ studentId: 'ALU-OLD', nombre: 'Alumno Viejo', capabilities: { canMarkAttendance: true } }] }
  };
  const html = createAppRenderer({ state }).renderAttendance();
  assert.equal(html.includes('Alumno Viejo'), false);
  assert.equal(html.includes('data-student-id="ALU-OLD"'), false);
  assert.equal(html.includes('data-action="mark-attendance"'), false);
});
