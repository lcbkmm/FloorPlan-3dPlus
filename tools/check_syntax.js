const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const jsDir = path.join(root, 'js');

function ok(msg){ console.log(msg); }
function fail(msg){ console.error(msg); process.exitCode = 1; }

function stripImports(src){
  // Drop whole import / re-export statements (incl. multi-line)
  let s = src
    .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
    .replace(/^\s*import\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
    .replace(/^\s*export\s+\*\s+from\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
    .replace(/^\s*export\s+\{[\s\S]*?\}\s*from\s+['"][^'"]+['"]\s*;?\s*$/gm, '');
  return s
    .split(/\r?\n/)
    .map(l => l
      .replace(/^\s*export\s+async\s+function\b/, 'async function')
      .replace(/^\s*export\s+function\b/, 'function')
      .replace(/^\s*export\s+const\b/, 'const')
      .replace(/^\s*export\s+let\b/, 'let')
      .replace(/^\s*export\s+class\b/, 'class')
      .replace(/^\s*export\s+\{[^}]*\}\s*;?\s*$/, '')
      .replace(/^\s*export\s+\{[^}]*\}\s*;?\s*$/, '')
    )
    .join('\n');
}

// DXF importer (IIFE → window.DxfImport)
try {
  vm.runInNewContext(fs.readFileSync(path.join(jsDir, 'dxf-import.js'), 'utf8'), {
    window: {},
    globalThis: {},
    console,
    TextDecoder: require('util').TextDecoder,
    Uint8Array,
    Math,
    JSON,
    Infinity,
    parseInt,
    Number,
    Object,
    Array,
    Set,
    Map,
  });
  ok('dxf-import.js OK');
} catch (e) {
  fail('dxf-import.js FAIL: ' + e.message);
}

const classicOrder = [
  'i18n.js',
  'plan-data.js',
  'catalog.js',
  'floors.js',
  'core.js',
  'render-2d.js',
  'panel.js',
  'ops.js',
  'rooms.js',
  'input.js',
  'app.js',
  'projects.js',
  'bridge-3d.js',
];

for (const name of classicOrder) {
  const src = fs.readFileSync(path.join(jsDir, name), 'utf8');
  try {
    new Function(src);
    ok('classic ' + name + ' OK, len ' + src.length);
  } catch (e) {
    fail('classic ' + name + ' FAIL: ' + e.message);
  }
}

// bridge must be listed in index.html before the view3d module
{
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const bridgeAt = html.indexOf('js/bridge-3d.js');
  const modAt = html.indexOf('js/view3d.js');
  if (bridgeAt < 0) fail('index.html missing js/bridge-3d.js');
  else if (modAt < 0 || bridgeAt > modAt) fail('index.html must load bridge-3d.js before view3d.js');
  else ok('bridge-3d.js ordered before view3d module');
}

// Thin entry
{
  const view3d = fs.readFileSync(path.join(jsDir, 'view3d.js'), 'utf8');
  const body = stripImports(view3d);
  try {
    new Function(body);
    ok('view3d.js entry OK, len ' + view3d.length);
  } catch (e) {
    fail('view3d.js FAIL: ' + e.message);
  }
}

// ES modules under js/view3d/
const view3dDir = path.join(jsDir, 'view3d');
const modFiles = fs.readdirSync(view3dDir).filter(n => n.endsWith('.js')).sort();
if (!modFiles.length) fail('js/view3d/ has no modules');
for (const name of modFiles) {
  const src = fs.readFileSync(path.join(view3dDir, name), 'utf8');
  try {
    new Function(stripImports(src));
    ok('module view3d/' + name + ' OK, len ' + src.length);
  } catch (e) {
    fail('module view3d/' + name + ' FAIL: ' + e.message);
  }
}

const expectedMods = [
  'shared.js', 'materials.js', 'geo.js', 'lamps.js', 'furniture.js',
  'arch.js', 'lighting.js', 'camera.js', 'walk.js', 'main.js',
];
for (const n of expectedMods) {
  if (!modFiles.includes(n)) fail('missing module view3d/' + n);
}

// index.html should be a thin shell — no large inline classic scripts
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const inlineClassic = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type=["'](?:module|importmap)["'])[^>]*>([\s\S]*?)<\/script>/g)];
const heavy = inlineClassic.filter(m => m[1].trim().length > 80);
if (heavy.length) {
  fail('index.html still has ' + heavy.length + ' heavy inline classic script(s)');
} else {
  ok('index.html shell OK (no heavy inline classic scripts)');
}

const required = [
  'css/app.css',
  ...classicOrder.map(n => 'js/' + n),
  'js/view3d.js',
  'js/dxf-import.js',
  ...expectedMods.map(n => 'js/view3d/' + n),
];
for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) fail('missing ' + rel);
}
if (!process.exitCode) ok('all required files present');
