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
      convocationProposals: [{ CONVOCATORIA_ID: 'CON-001', PARTIDO_ID: 'PAR-001', ESTADO: 'PROPUESTA', TOTAL_OBJETIVO: 12 }],
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
    state: bootstrap(),
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
  const state = { activeRoute: 'attendance', ...bootstrap(), attendance: { rows: [{ nombre: 'Alumno', estadoActual: 'F', attendanceId: 'AST-001', capabilities: { canResolveAbsence: true } }] } };
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
  const view = convocationView({
    details: [
      { ...convocationView().details[0], posicionAsignada: 'PO' },
      { ...convocationView().details[1], posicionAsignada: 'DEF' },
      { ...convocationView().details[1], ALUMNO_ID: 'ALU-003', nombre: 'Tres', posicionAsignada: 'MED' },
      { ...convocationView().details[1], ALUMNO_ID: 'ALU-004', nombre: 'Cuatro', posicionAsignada: 'DEL' }
    ]
  });
  const html = createAppRenderer({ state: { activeRoute: 'convocations', ...bootstrap(), convocation: view } }).renderConvocations();
  ['PO 1', 'DEF 1', 'MED 1', 'DEL 1'].forEach((term) => assert.equal(html.includes(term), true));
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
  const state = { activeRoute: 'convocations', ...bootstrap() };
  const renderer = createAppRenderer({ state, controller: { loadConvocation(id) { state.loaded = id; } } });
  const existing = renderer.findConvocationForMatch('PAR-001');
  assert.equal(existing.CONVOCATORIA_ID, 'CON-001');
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
