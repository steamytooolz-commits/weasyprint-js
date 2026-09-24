// Source resolution — mirrors `select_source()` in weasyprint/urls.py
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { URLFetcher, guessMime } from './urls.js';

export type SourceInput =
  | { guess: string | Buffer | URL }
  | { filename: string }
  | { url: string }
  | { fileObj: NodeJS.ReadableStream | Buffer }
  | { string: string | Buffer };

export interface ResolvedSource {
  buffer: Buffer;
  baseUrl: string;
  mimeType: string;
}

export async function selectSource(
  input: string | Buffer | URL | SourceInput,
  opts: { baseUrl?: string | null; fetcher?: URLFetcher } = {},
): Promise<ResolvedSource> {
  const fetcher = opts.fetcher ?? new URLFetcher();
  if (typeof input === 'string' || Buffer.isBuffer(input) || input instanceof URL) {
    return resolveGuess(input, opts.baseUrl ?? null, fetcher);
  }
  const o = input as Record<string, unknown>;
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
    const v = o['string'] as string | Buffer;
    const buffer = Buffer.isBuffer(v) ? v : Buffer.from(v, 'utf8');
    return { buffer, baseUrl: opts.baseUrl ?? defaultBaseUrl(), mimeType: 'text/html' };
  }
  if (o['fileObj'] != null) {
    const fo = o['fileObj'] as Buffer | NodeJS.ReadableStream;
    const buffer = Buffer.isBuffer(fo) ? fo : await streamToBuffer(fo);
    return { buffer, baseUrl: opts.baseUrl ?? defaultBaseUrl(), mimeType: 'text/html' };
  }
  if (o['guess'] != null) {
    return resolveGuess(o['guess'] as string | Buffer | URL, opts.baseUrl ?? null, fetcher);
  }
  throw new Error('No source provided (filename, url, fileObj, string or guess required)');
}

async function resolveGuess(
  guess: string | Buffer | URL, baseUrl: string | null, fetcher: URLFetcher,
): Promise<ResolvedSource> {
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
    } catch { /* treat as literal below */ }
  }
  try {
    const buffer = await readFile(s);
    return {
      buffer: Buffer.from(buffer),
      baseUrl: baseUrl ?? pathToFileURL(path.resolve(s)).href,
      mimeType: guessMime(s),
    };
  } catch { /* not a file -> literal HTML string */ }
  return { buffer: Buffer.from(s, 'utf8'), baseUrl: baseUrl ?? defaultBaseUrl(), mimeType: 'text/html' };
}

export function defaultBaseUrl(): string {
  return pathToFileURL(process.cwd() + path.sep).href;
}

function streamToBuffer(s: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    s.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    s.on('end', () => resolve(Buffer.concat(chunks)));
    s.on('error', reject);
  });
}
