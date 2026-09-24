// URLs + fetching — mirrors weasyprint/urls.py (part 1: fetcher).
import { readFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { request } from 'undici';
import { LOGGER } from './logger.js';

export interface FetcherOptions {
  timeout?: number;
  allowedProtocols?: Set<string> | null;
  allowRedirects?: boolean;
  failOnErrors?: boolean;
}

const DEFAULT_ALLOWED = new Set(['http', 'https', 'file', 'data']);

export class URLFetcher {
  timeout: number;
  allowedProtocols: Set<string>;
  allowRedirects: boolean;
  failOnErrors: boolean;

  constructor(opts: FetcherOptions = {}) {
    this.timeout = opts.timeout ?? 10;
    this.allowedProtocols = opts.allowedProtocols ?? DEFAULT_ALLOWED;
    this.allowRedirects = opts.allowRedirects ?? true;
    this.failOnErrors = opts.failOnErrors ?? false;
  }

  async fetch(url: string): Promise<{ buffer: Buffer; mimeType: string; finalUrl: string }> {
    const parsed = new URL(url, 'file://' + process.cwd() + '/');
    const protocol = parsed.protocol.replace(/:$/, '').toLowerCase();
    if (!this.allowedProtocols.has(protocol)) {
      throw new Error(`Protocol not allowed: ${protocol} (${url})`);
    }
    if (protocol === 'file') {
      const p = fileURLToPath(parsed);
      const buffer = await readFile(p);
      return { buffer: Buffer.from(buffer), mimeType: guessMime(p), finalUrl: parsed.href };
    }
    if (protocol === 'data') {
      const comma = url.indexOf(',');
      const meta = url.slice(5, comma);
      const data = url.slice(comma + 1);
      const isBase64 = meta.includes(';base64');
      const buffer = isBase64
        ? Buffer.from(data, 'base64')
        : Buffer.from(decodeURIComponent(data), 'utf8');
      const mimeType = meta.split(';')[0] || 'text/plain';
      return { buffer, mimeType, finalUrl: url };
    }
    const res = await request(url, {
      method: 'GET',
      maxRedirections: (this.allowRedirects ? 20 : 0) as never,
      headersTimeout: this.timeout * 1000,
      bodyTimeout: this.timeout * 1000,
    } as never);
    if (res.statusCode >= 400) {
      const msg = `HTTP ${res.statusCode} for ${url}`;
      if (this.failOnErrors) throw new Error(msg);
      LOGGER.warning(msg);
    }
    const chunks: Buffer[] = [];
    for await (const chunk of res.body) chunks.push(Buffer.from(chunk));
    const mime = String(res.headers['content-type'] ?? 'application/octet-stream').split(';')[0];
    return { buffer: Buffer.concat(chunks), mimeType: mime, finalUrl: url };
  }
}

export function guessMime(p: string): string {
  const ext = path.extname(p).toLowerCase();
  switch (ext) {
    case '.html': case '.htm': return 'text/html';
    case '.css': return 'text/css';
    case '.png': return 'image/png';
    case '.jpg': case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.svg': return 'image/svg+xml';
    case '.woff': return 'font/woff';
    case '.woff2': return 'font/woff2';
    case '.ttf': return 'font/ttf';
    case '.otf': return 'font/otf';
    default: return 'application/octet-stream';
  }
}

/** Resolve a possibly-relative URL against a base URL. */
export function resolveUrl(ref: string, baseUrl: string): string {
  try {
    return new URL(ref, baseUrl).href;
  } catch {
    return ref;
  }
}
