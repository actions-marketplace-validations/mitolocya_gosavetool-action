'use strict';
// Runs index.js the way the runner does: inputs as INPUT_* variables, outputs read back from GITHUB_OUTPUT.
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
let failed = 0;

function run(inputs) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gst-'));
    const env = { ...process.env, GITHUB_WORKSPACE: root, GITHUB_OUTPUT: path.join(dir, 'out'), GITHUB_STEP_SUMMARY: path.join(dir, 'sum') };
    for (const [k, v] of Object.entries(inputs)) env['INPUT_' + k.toUpperCase()] = v;
    let code = 0;
    try { execFileSync(process.execPath, [path.join(root, 'index.js')], { env, stdio: 'pipe' }); } catch (e) { code = e.status; }
    const raw = fs.existsSync(env.GITHUB_OUTPUT) ? fs.readFileSync(env.GITHUB_OUTPUT, 'utf8') : '';
    const out = {};
    for (const m of raw.matchAll(/^([\w-]+)<<(EOF_\w+)\n([\s\S]*?)\n\2$/gm)) out[m[1]] = m[3];
    return { code, out, summary: fs.existsSync(env.GITHUB_STEP_SUMMARY) ? fs.readFileSync(env.GITHUB_STEP_SUMMARY, 'utf8') : '' };
}

function test(name, fn) {
    try { fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + e.message); }
}

test('stats', () => {
    const r = run({ command: 'stats', text: 'Hello world. This is a test!' });
    assert.strictEqual(r.code, 0);
    assert.strictEqual(r.out.words, '6');
    assert.strictEqual(r.out.chars, '28');
    assert.match(r.summary, /gosavetool\.com/);
});

test('limits fail-on-exceed', () => {
    const r = run({ command: 'limits', text: 'x'.repeat(70), limits: 'seo-title,meta-description', 'fail-on-exceed': 'true' });
    assert.strictEqual(r.code, 1);
    assert.strictEqual(r.out.fits, 'false');
});

test('limits unknown name', () => {
    assert.strictEqual(run({ command: 'limits', text: 'a', limits: 'nope' }).code, 1);
});

test('slug', () => {
    assert.strictEqual(run({ command: 'slug', text: 'Ölçü Birimi & Çeviri!' }).out.result, 'olcu-birimi-ceviri');
});

test('case', () => {
    assert.strictEqual(run({ command: 'case', text: 'the lord of the rings', to: 'title' }).out.result, 'The Lord of the Rings');
    assert.strictEqual(run({ command: 'case', text: 'Hello World', to: 'snake' }).out.result, 'hello_world');
    assert.strictEqual(run({ command: 'case', text: 'x', to: 'bad' }).code, 1);
});

test('clean keeps multiline output', () => {
    assert.strictEqual(run({ command: 'clean', text: 'a  b  \n\n\n\nc' }).out.result, 'a b\n\nc');
});

test('convert srt to vtt from file', () => {
    const r = run({ command: 'convert-subtitles', file: 'test/fixtures/sample.srt' });
    assert.strictEqual(r.code, 0);
    assert.ok(r.out.result.startsWith('WEBVTT\n\n00:00:01.000 --> 00:00:03.500\nMerhaba dünya!'));
    assert.strictEqual(r.out.cues, '2');
});

test('shift', () => {
    const r = run({ command: 'shift-subtitles', file: 'test/fixtures/sample.srt', 'shift-ms': '-500' });
    assert.match(r.out.result, /00:00:00,500 --> 00:00:03,000/);
});

test('repair', () => {
    const r = run({ command: 'repair-subtitles', file: 'test/fixtures/sample.srt' });
    assert.strictEqual(r.out.fixed, '2');
    assert.match(r.out.result, /00:00:01,000 --> 00:00:02,999/);
});

test('unknown command', () => {
    assert.strictEqual(run({ command: 'nope' }).code, 1);
});

if (failed) { console.log(failed + ' failed'); process.exit(1); }
console.log('all passed');
