const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');

const requiredPaths = [
  'README.md',
  'AGENTS.md',
  '.gitignore',
  '.editorconfig',
  'package.json',
  'docs/PILOT_SPEC.md',
  'docs/CONFIG_CATALOG.md',
  'docs/ARCHITECTURE.md',
  'docs/DATA_MODEL.md',
  'docs/DECISIONS.md',
  'src/appsscript.json',
  'src/config/ConfigSchema.js',
  'src/config/ConfigService.js',
  'src/config/ConfigSetup.js',
  'src/domain/AttendanceRules.js',
  'src/domain/EligibilityRules.js',
  'src/domain/RotationRules.js',
  'src/domain/ConvocationRules.js',
  'src/services/StudentService.js',
  'src/services/TutorService.js',
  'src/services/AttendanceService.js',
  'src/services/MatchService.js',
  'src/services/ConvocationService.js',
  'src/services/ParticipationService.js',
  'src/services/CommunicationService.js',
  'src/services/AuditService.js',
  'src/repositories/SheetRepository.js',
  'src/repositories/ConfigRepository.js',
  'src/triggers/TriggerHandlers.js',
  'tests/attendance/attendance.test.js',
  'tests/config/config-fixtures.js',
  'tests/config/config-service.test.js',
  'tests/config/config-setup.test.js',
  'tests/eligibility/eligibility.test.js',
  'tests/rotation/rotation.test.js',
  'tests/convocation/convocation.test.js',
  'scripts/validate.js',
  'scripts/bootstrap.js'
];

const ignoredDirs = new Set(['.git', 'node_modules', 'coverage']);
const textExtensions = new Set(['.js', '.json', '.md', '.gitignore', '.editorconfig']);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, '/');
}

function assertRequiredStructure() {
  const missing = requiredPaths.filter((item) => !fs.existsSync(path.join(root, item)));

  if (missing.length > 0) {
    throw new Error(`Missing required paths: ${missing.join(', ')}`);
  }
}

function assertAppsScriptManifest() {
  const manifest = JSON.parse(readText(path.join(root, 'src/appsscript.json')));

  if (manifest.runtimeVersion !== 'V8') {
    throw new Error('Apps Script manifest must use V8 runtime');
  }
}

function assertValidBranchName(branch) {
  if (typeof branch !== 'string' || branch.trim() === '') {
    throw new Error('Unexpected branch: detached HEAD or empty branch');
  }

  if (branch === 'HEAD') {
    throw new Error('Unexpected branch: detached HEAD');
  }
}

function assertRepoLock() {
  const topLevel = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' }).trim();
  const origin = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8' }).trim();
  const branch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim();

  const normalizedTopLevel = topLevel.replaceAll('\\', '/').toLowerCase();
  const normalizedRoot = root.replaceAll('\\', '/').toLowerCase();

  if (normalizedTopLevel !== normalizedRoot) {
    throw new Error(`Unexpected repo root: ${topLevel}`);
  }

  if (origin !== 'https://github.com/danielalmaral/liceodelvalle.git') {
    throw new Error(`Unexpected origin: ${origin}`);
  }

  assertValidBranchName(branch);
}

function getScannableFiles() {
  return walk(root).filter((file) => {
    const name = path.basename(file);
    const ext = path.extname(file);
    return textExtensions.has(ext) || textExtensions.has(name);
  });
}

function scanSecurity() {
  const findings = [];
  const patterns = [
    ['private_key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/i],
    ['github_token', /gh[pousr]_[A-Za-z0-9_]{20,}/],
    ['google_api_key', /AIza[0-9A-Za-z_-]{35}/],
    ['password_assignment', /\b(password|passwd|pwd|secret|token|api[_-]?key)\b\s*[:=]\s*['"][^'"]+['"]/i]
  ];

  for (const file of getScannableFiles()) {
    const content = readText(file);

    for (const [name, pattern] of patterns) {
      if (pattern.test(content)) {
        findings.push(`${relative(file)}:${name}`);
      }
    }
  }

  return findings;
}

function scanPii() {
  const findings = [];
  const patterns = [
    ['email', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
    ['phone', /(?:\+?\d[\s.-]?){10,}/]
  ];

  for (const file of getScannableFiles()) {
    const content = readText(file);

    for (const [name, pattern] of patterns) {
      if (pattern.test(content)) {
        findings.push(`${relative(file)}:${name}`);
      }
    }
  }

  return findings;
}

function scanConfigHardcodedRules() {
  const findings = [];
  const files = walk(path.join(root, 'src')).filter((file) => path.extname(file) === '.js');
  const ruleWords = /(convocados|asistencia|retardo|falta|justificada|lesion|lesión|horas|posicion|posición|rotacion|rotación|calificacion|calificación)/i;
  const literalAssignment = /(const|let|var)\s+\w+\s*=\s*(?:\d+|'[^']+'|"[^"]+")/;

  for (const file of files) {
    const content = readText(file);

    if (ruleWords.test(content) && literalAssignment.test(content)) {
      findings.push(relative(file));
    }
  }

  return findings;
}

function main() {
  assertRepoLock();
  assertRequiredStructure();
  assertAppsScriptManifest();

  const securityFindings = scanSecurity();
  const piiFindings = scanPii();
  const configFindings = scanConfigHardcodedRules();

  if (securityFindings.length > 0) {
    throw new Error(`Secret scan findings: ${securityFindings.join(', ')}`);
  }

  if (piiFindings.length > 0) {
    throw new Error(`PII scan findings: ${piiFindings.join(', ')}`);
  }

  if (configFindings.length > 0) {
    throw new Error(`Hardcoded config rule findings: ${configFindings.join(', ')}`);
  }

  console.log('STRUCTURE_VALIDATION: PASS');
  console.log('SECRET_SCAN: PASS');
  console.log('PII_SCAN: PASS');
  console.log('CONFIG_HARDCODED_RULES: 0');
}

if (require.main === module) {
  main();
}

module.exports = {
  assertValidBranchName
};
