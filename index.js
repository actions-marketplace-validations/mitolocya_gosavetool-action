'use strict';
// GitHub Action entry point. Reads inputs from the environment, writes outputs and the job summary
// through the files the runner names. No dependencies and no network access.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const text = require('./lib/text');
const subtitles = require('./lib/subtitles');

const SITE = 'https://www.gosavetool.com';

function input(name) {
    return (process.env['INPUT_' + name.replace(/ /g, '_').toUpperCase()] || '').trim();
}

function setOutput(name, value) {
    value = String(value);
    const file = process.env.GITHUB_OUTPUT;
    if (!file) { console.log(`${name}=${value}`); return; }
    // Multiline values need a delimiter that cannot appear in the value
    const eof = 'EOF_' + crypto.randomBytes(8).toString('hex');
    fs.appendFileSync(file, `${name}<<${eof}\n${value}\n${eof}\n`);
}

function summary(md) {
    if (input('summary') === 'false' || !process.env.GITHUB_STEP_SUMMARY) return;
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + `\n\n<sub>Made with [GoSaveTool](${SITE}) free online tools.</sub>\n`);
}

function source() {
    const file = input('file');
    if (file) return fs.readFileSync(path.resolve(process.env.GITHUB_WORKSPACE || '.', file), 'utf8');
    return process.env.INPUT_TEXT || '';
}

function writeResult(value) {
    const out = input('output-file');
    if (!out) return;
    const p = path.resolve(process.env.GITHUB_WORKSPACE || '.', out);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, value);
    console.log('Wrote ' + out);
}

function int(name) {
    const n = Number(input(name));
    if (!Number.isFinite(n)) throw new Error(`"${name}" must be a number`);
    return Math.round(n);
}

const CASES = { upper: text.upper, lower: text.lower, title: text.title, sentence: text.sentence, camel: text.camel, snake: text.snake, kebab: text.kebab };

const commands = {
    stats() {
        const s = text.stats(source());
        setOutput('words', s.words);
        setOutput('chars', s.chars);
        setOutput('read-seconds', s.readSeconds);
        summary('### Text stats\n\n| Words | Characters | No spaces | Lines | Sentences | Reading time |\n|---|---|---|---|---|---|\n'
            + `| ${s.words} | ${s.chars} | ${s.charsNoSpaces} | ${s.lines} | ${s.sentences} | ${Math.ceil(s.readSeconds / 60)} min |`);
        return { result: JSON.stringify(s), json: s };
    },
    limits() {
        const only = input('limits') ? input('limits').split(',').map(s => s.trim()).filter(Boolean) : undefined;
        const unknown = (only || []).filter(k => !(k in text.LIMITS));
        if (unknown.length) throw new Error('Unknown limit: ' + unknown.join(', '));
        const r = text.limits(source(), only);
        const fits = Object.values(r).every(c => c.fits);
        setOutput('chars', Object.values(r)[0] ? Object.values(r)[0].used : 0);
        setOutput('fits', fits);
        summary('### Character limits\n\n| Field | Limit | Used | Left | |\n|---|---|---|---|---|\n'
            + Object.entries(r).map(([k, c]) => `| ${k} | ${c.limit} | ${c.used} | ${c.left} | ${c.fits ? '✅' : '❌'} |`).join('\n'));
        if (!fits && input('fail-on-exceed') === 'true') {
            process.exitCode = 1;
            console.log('::error::Text is over: ' + Object.keys(r).filter(k => !r[k].fits).join(', '));
        }
        return { result: JSON.stringify(r), json: r };
    },
    slug() {
        const s = text.slug(source());
        writeResult(s);
        return { result: s, json: { slug: s } };
    },
    case() {
        const to = input('to');
        if (!CASES[to]) throw new Error('"to" must be one of: ' + Object.keys(CASES).join(', '));
        const s = CASES[to](source());
        writeResult(s);
        return { result: s, json: { text: s } };
    },
    clean() {
        const s = text.clean(source());
        writeResult(s);
        return { result: s, json: { text: s } };
    },
    'convert-subtitles'() {
        const src = source(), to = input('to') || (subtitles.isVtt(src) ? 'srt' : 'vtt');
        if (to !== 'srt' && to !== 'vtt') throw new Error('"to" must be srt or vtt');
        const cues = subtitles.parse(src);
        const s = to === 'vtt' ? subtitles.toVtt(cues) : subtitles.toSrt(cues);
        writeResult(s);
        setOutput('cues', cues.length);
        summary(`### Subtitles\n\nConverted ${cues.length} cues to ${to.toUpperCase()}.`);
        return { result: s, json: { format: to, cues } };
    },
    'shift-subtitles'() {
        const src = source(), ms = int('shift-ms');
        const cues = subtitles.shift(subtitles.parse(src), ms);
        const to = input('to') || (subtitles.isVtt(src) ? 'vtt' : 'srt');
        const s = to === 'vtt' ? subtitles.toVtt(cues) : subtitles.toSrt(cues);
        writeResult(s);
        setOutput('cues', cues.length);
        summary(`### Subtitles\n\nShifted ${cues.length} cues by ${ms} ms.`);
        return { result: s, json: { format: to, cues } };
    },
    'repair-subtitles'() {
        const src = source();
        const r = subtitles.repair(subtitles.parse(src), { minDuration: int('min-duration') });
        const to = input('to') || (subtitles.isVtt(src) ? 'vtt' : 'srt');
        const s = to === 'vtt' ? subtitles.toVtt(r.cues) : subtitles.toSrt(r.cues);
        writeResult(s);
        setOutput('cues', r.cues.length);
        setOutput('fixed', r.fixed);
        summary(`### Subtitles\n\nRepaired ${r.fixed} problems in ${r.cues.length} cues.`);
        return { result: s, json: { format: to, fixed: r.fixed, cues: r.cues } };
    },
};

try {
    const name = input('command');
    if (!commands[name]) throw new Error('"command" must be one of: ' + Object.keys(commands).join(', '));
    const { result, json } = commands[name]();
    setOutput('result', result);
    setOutput('json', JSON.stringify(json));
    console.log(result.length > 2000 ? result.slice(0, 2000) + '…' : result);
} catch (e) {
    process.exitCode = 1;
    console.log('::error::' + e.message);
}
