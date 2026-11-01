'use strict';
// SRT and WebVTT: read cues, write them in either format, shift and repair timings.
// No dependencies; works in Node and in the browser.

const TIME = /(\d{1,2}:)?(\d{1,2}):(\d{1,2})[,.](\d{1,3})/;
const ARROW = /^\s*((?:\d{1,2}:)?\d{1,2}:\d{1,2}[,.]\d{1,3})\s*-->\s*((?:\d{1,2}:)?\d{1,2}:\d{1,2}[,.]\d{1,3})(.*)$/;

/** "00:01:02,500" or "01:02.5" → milliseconds (NaN when it is not a timestamp) */
function toMs(s) {
    const m = TIME.exec(s);
    if (!m) return NaN;
    const h = m[1] ? parseInt(m[1], 10) : 0;
    const ms = parseInt(m[4].padEnd(3, '0'), 10);
    return ((h * 60 + parseInt(m[2], 10)) * 60 + parseInt(m[3], 10)) * 1000 + ms;
}

/** milliseconds → "00:01:02,500" (sep ",", SRT) or "00:01:02.500" (sep ".", WebVTT) */
function fromMs(ms, sep = ',') {
    ms = Math.max(0, Math.round(ms));
    const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
    const p = (n, l = 2) => String(n).padStart(l, '0');
    return p(h) + ':' + p(m) + ':' + p(s) + sep + p(ms % 1000, 3);
}

/** Cues of an SRT or WebVTT text: [{ start, end, settings, text }], times in milliseconds */
function parse(src) {
    // "\r\r\n" too: a file saved twice with Windows line endings
    const blocks = String(src).replace(/^﻿/, '').replace(/\r*\n|\r/g, '\n').split(/\n{2,}/);
    const cues = [];
    for (const block of blocks) {
        const lines = block.split('\n');
        const at = lines.findIndex(l => ARROW.test(l));
        if (at < 0) continue; // WEBVTT header, NOTE, STYLE or a stray line
        const m = ARROW.exec(lines[at]);
        cues.push({ start: toMs(m[1]), end: toMs(m[2]), settings: m[3].trim(), text: lines.slice(at + 1).join('\n').trim() });
    }
    return cues;
}

/** True when the text starts with the WEBVTT signature */
function isVtt(src) {
    return /^﻿?WEBVTT/.test(String(src));
}

function toSrt(cues) {
    return cues.map((c, i) => (i + 1) + '\n' + fromMs(c.start, ',') + ' --> ' + fromMs(c.end, ',') + '\n' + c.text).join('\n\n') + '\n';
}

function toVtt(cues) {
    return 'WEBVTT\n\n' + cues.map(c => fromMs(c.start, '.') + ' --> ' + fromMs(c.end, '.') + (c.settings ? ' ' + c.settings : '') + '\n' + c.text).join('\n\n') + '\n';
}

/** Converts a subtitle text to "srt" or "vtt" */
function convert(src, to) {
    if (to !== 'srt' && to !== 'vtt') throw new TypeError('convert(): the target format must be "srt" or "vtt"');
    return to === 'vtt' ? toVtt(parse(src)) : toSrt(parse(src));
}

/** Moves every cue by ms (negative = earlier); cues pushed before zero are clipped or dropped */
function shift(cues, ms) {
    return cues.map(c => ({ ...c, start: Math.max(0, c.start + ms), end: Math.max(0, c.end + ms) })).filter(c => c.end > 0);
}

/**
 * Repairs common faults: cues out of order, an end before its start, overlapping cues and
 * empty cues. Returns the repaired cues and the number of changes.
 */
function repair(cues, { minDuration = 2000 } = {}) {
    let fixed = cues.filter(c => c.text === '').length;
    const out = cues.filter(c => c.text !== '').map(c => ({ ...c }));
    const before = out.map(c => c.start);
    out.sort((a, b) => a.start - b.start);
    if (out.some((c, i) => c.start !== before[i])) fixed++;
    for (let i = 0; i < out.length; i++) {
        const c = out[i], next = out[i + 1];
        if (!(c.end > c.start)) { c.end = c.start + minDuration; fixed++; }
        if (next && c.end > next.start) { c.end = Math.max(c.start + 1, next.start - 1); fixed++; }
    }
    return { cues: out, fixed };
}

module.exports = { toMs, fromMs, parse, isVtt, toSrt, toVtt, convert, shift, repair };
