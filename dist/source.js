// Source resolution — mirrors `select_source()` in weasyprint/urls.py
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { URLFetcher, guessMime } from './urls.js';
export async function selectSource(input, opts = {}) {
    const fetcher = opts.fetcher ?? new URLFetcher();
    if (typeof input === 'string' || Buffer.isBuffer(input) || input instanceof URL) {
        return resolveGuess(input, opts.baseUrl ?? null, fetcher);
    }
    const o = input;
    if (o['filename'] != null) {
        const filename = String(o['filename']);
        const buffer = await readFile(filename);
        const baseUrl = opts.baseUrl ?? pathToFileURL(path.resolve(filename)).href;
        return { buffer: Buffer.from(buffer), baseUrl, mimeType: guessMime(filename) };
    }
    if (o['url'] != null) {
        const r = await fetcher.fetch(String(o['url']));
        return { buffer: r.buffer, baseUrl: opts.baseUrl ?? r.finalUrl, mimeType: r.mimeType };
    }
    if (o['string'] != null) {
        const v = o['string'];
        const buffer = Buffer.isBuffer(v) ? v : Buffer.from(v, 'utf8');
        return { buffer, baseUrl: opts.baseUrl ?? defaultBaseUrl(), mimeType: 'text/html' };
    }
    if (o['fileObj'] != null) {
        const fo = o['fileObj'];
        const buffer = Buffer.isBuffer(fo) ? fo : await streamToBuffer(fo);
        return { buffer, baseUrl: opts.baseUrl ?? defaultBaseUrl(), mimeType: 'text/html' };
    }
    if (o['guess'] != null) {
        return resolveGuess(o['guess'], opts.baseUrl ?? null, fetcher);
    }
    throw new Error('No source provided (filename, url, fileObj, string or guess required)');
}
async function resolveGuess(guess, baseUrl, fetcher) {
    if (Buffer.isBuffer(guess)) {
        return { buffer: guess, baseUrl: baseUrl ?? defaultBaseUrl(), mimeType: 'text/html' };
    }
    const s = String(guess instanceof URL ? guess.href : guess);
    const looksUrl = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)
        && !s.startsWith('/') && !s.startsWith('./') && !s.startsWith('../');
    if (looksUrl) {
        try {
            const r = await fetcher.fetch(s);
            return { buffer: r.buffer, baseUrl: baseUrl ?? r.finalUrl, mimeType: r.mimeType };
        }
        catch { /* treat as literal below */ }
    }
    try {
        const buffer = await readFile(s);
        return {
            buffer: Buffer.from(buffer),
            baseUrl: baseUrl ?? pathToFileURL(path.resolve(s)).href,
            mimeType: guessMime(s),
        };
    }
    catch { /* not a file -> literal HTML string */ }
    return { buffer: Buffer.from(s, 'utf8'), baseUrl: baseUrl ?? defaultBaseUrl(), mimeType: 'text/html' };
}
export function defaultBaseUrl() {
    return pathToFileURL(process.cwd() + path.sep).href;
}
function streamToBuffer(s) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        s.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        s.on('end', () => resolve(Buffer.concat(chunks)));
        s.on('error', reject);
    });
}
//# sourceMappingURL=source.js.map