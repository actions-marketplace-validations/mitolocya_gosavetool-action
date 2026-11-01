'use strict';
// Text helpers: word, character and reading-time counts, case changes, URL slugs and whitespace cleanup.
// No dependencies; works in Node and in the browser.

const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'so', 'the', 'to', 'up', 'yet', 'via', 'vs']);

/** Words, characters, lines and reading time of a text */
function stats(s) {
    const words = (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu) || []).length;
    const chars = [...s].length;
    return {
        words,
        chars,
        charsNoSpaces: [...s.replace(/\s/g, '')].length,
        lines: s === '' ? 0 : s.split(/\r\n|\r|\n/).length,
        sentences: (s.match(/[^.!?…]+[.!?…]+/g) || []).length,
        // 238 words a minute: the average silent reading speed for English non-fiction
        readSeconds: Math.round(words / 238 * 60),
    };
}

function words(s) {
    return s.replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

const upper = s => s.toLocaleUpperCase();
const lower = s => s.toLocaleLowerCase();

function title(s) {
    let i = 0;
    return s.toLocaleLowerCase().replace(/[\p{L}\p{N}][\p{L}\p{N}'’]*/gu, (w, at) => {
        const first = i++ === 0, afterColon = /[:.!?]\s*$/.test(s.slice(0, at));
        return !first && !afterColon && SMALL.has(w) ? w : w.charAt(0).toLocaleUpperCase() + w.slice(1);
    });
}

function sentence(s) {
    return s.toLocaleLowerCase().replace(/(^\s*|[.!?…]\s+)(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase());
}

/** "Ölçü Birimi & Çeviri!" → "olcu-birimi-ceviri" */
function slug(s) {
    const map = { ı: 'i', İ: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g', ç: 'c', Ç: 'c', ö: 'o', Ö: 'o', ü: 'u', Ü: 'u', ß: 'ss', æ: 'ae', ø: 'o', đ: 'd', ł: 'l' };
    return s.replace(/[ıİşŞğĞçÇöÖüÜßæøđł]/g, c => map[c]).normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const camel = s => words(s).map((w, i) => i ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()).join('');
const snake = s => words(s).map(w => w.toLowerCase()).join('_');
const kebab = s => words(s).map(w => w.toLowerCase()).join('-');

/** Trailing spaces, runs of spaces and more than one blank line in a row */
function clean(s) {
    const nl = s.includes('\r\n') ? '\r\n' : '\n';
    return s.split(/\r\n|\n/).map(l => l.replace(/[ \t]+$/, '').replace(/(\S)[ \t]{2,}/g, '$1 ')).join(nl).replace(new RegExp('(' + nl + '){3,}', 'g'), nl + nl);
}

// Character limits of common fields; SEO values are the length search results show before cutting
const LIMITS = {
    'x-post': 280,
    'instagram-caption': 2200,
    'tiktok-caption': 4000,
    'youtube-title': 100,
    'youtube-description': 5000,
    'linkedin-post': 3000,
    'pinterest-description': 500,
    'seo-title': 60,
    'meta-description': 160,
};

/** How each limit is met: { 'x-post': { limit: 280, used: 120, left: 160, fits: true }, … } */
function limits(s, only) {
    const used = [...s].length, out = {};
    for (const [k, limit] of Object.entries(LIMITS)) {
        if (only && !only.includes(k)) continue;
        out[k] = { limit, used, left: limit - used, fits: used <= limit };
    }
    return out;
}

module.exports = { stats, limits, LIMITS, words, upper, lower, title, sentence, slug, camel, snake, kebab, clean };
