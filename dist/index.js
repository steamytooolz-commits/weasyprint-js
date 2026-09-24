// Public API — mirrors weasyprint/__init__.py (part 1: HTML + CSS).
import { writeFile } from 'node:fs/promises';
import { URLFetcher } from './urls.js';
import { selectSource } from './source.js';
import { buildTree, attachStyles, pruneDisplayNone, resolveCountersAndGenerated } from './formatting-structure/boxes.js';
import { buildCascade } from './css/cascade.js';
import { pageBoxFromRules } from './layout/page.js';
import { flowDocument } from './layout/block.js';
import { Document } from './document.js';
import { PROGRESS_LOGGER, LOGGER } from './logger.js';
import { sniffImage, parseDataUrl } from './images/index.js';
import { registerFont, clearFonts, registeredFamilies } from './text/ttf.js';
const KNOWN_OPTIONS = new Set([
    'stylesheets', 'mediaType', 'baseUrl', 'urlFetcher', 'title', 'author',
    'subject', 'keywords', 'creator', 'pdfVariant', 'pdfVersion',
    'presentationalHints', 'outputIntent', 'optimizeImages', 'jpegQuality',
    'dpi', 'fullFonts', 'hinting', 'cacheFolder', 'uncompressedPdf',
    'zoom', 'finisher', 'attachments', 'pdfTags',
]);
function warnUnknownOptions(opts, where) {
    for (const key of Object.keys(opts)) {
        if (!KNOWN_OPTIONS.has(key)) {
            LOGGER.error(`Unknown ${where} option: ${key}`);
        }
    }
}
export const VERSION = '0.1.0';
export const __version__ = VERSION;
export const DEFAULT_OPTIONS = {
    stylesheets: null,
    mediaType: 'print',
    baseUrl: null,
    uncompressedPdf: false,
    presentationalHints: false,
    optimizeImages: false,
    jpegQuality: 95,
    dpi: null,
    fullFonts: false,
    hinting: false,
    zoom: 1,
    pdfVariant: null,
    pdfVersion: null,
    pdfTags: false,
    attachments: null,
};
export class HTML {
    baseUrl;
    htmlString;
    urlFetcher;
    mediaType;
    constructor(html, baseUrl, opts) {
        this.htmlString = html;
        this.baseUrl = baseUrl;
        this.urlFetcher = opts.urlFetcher ?? new URLFetcher();
        this.mediaType = opts.mediaType ?? 'print';
    }
    static async create(input, opts = {}) {
        const fetcher = opts.urlFetcher ?? new URLFetcher();
        const resolved = await selectSource(input, { baseUrl: opts.baseUrl ?? null, fetcher });
        const html = resolved.buffer.toString('utf8');
        let baseUrl = resolved.baseUrl;
        const m = /<base[^>]+href=["']([^"']+)["']/i.exec(html);
        if (m) {
            try {
                baseUrl = new URL(m[1], baseUrl).href;
            }
            catch { /* keep */ }
        }
        return new HTML(html, baseUrl, { urlFetcher: fetcher, mediaType: opts.mediaType ?? 'print' });
    }
    async collectCss(extra = []) {
        const out = [];
        for (const m of this.htmlString.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
            out.push({ css: m[1], origin: 'author' });
        }
        for (const m of this.htmlString.matchAll(/<link[^>]*>/gi)) {
            const tag = m[0];
            if (!/rel=["']?stylesheet/i.test(tag))
                continue;
            const href = /href=["']([^"']+)["']/i.exec(tag)?.[1];
            if (!href)
                continue;
            try {
                const fetched = await this.urlFetcher.fetch(new URL(href, this.baseUrl).href);
                out.push({ css: fetched.buffer.toString('utf8'), origin: 'author' });
            }
            catch { /* ignore */ }
        }
        for (const s of extra) {
            if (typeof s === 'string') {
                if (/[{;}]/.test(s) && !/^(https?|file|data):/.test(s) && !s.includes('\n')) {
                    try {
                        const fetched = await this.urlFetcher.fetch(new URL(s, this.baseUrl).href);
                        out.push({ css: fetched.buffer.toString('utf8'), origin: 'author' });
                        continue;
                    }
                    catch { /* fallthrough to literal */ }
                }
                if (/^(https?|file|data):/.test(s) || s.endsWith('.css')) {
                    try {
                        const fetched = await this.urlFetcher.fetch(new URL(s, this.baseUrl).href);
                        out.push({ css: fetched.buffer.toString('utf8'), origin: 'author' });
                        continue;
                    }
                    catch {
                        out.push({ css: '', origin: 'author' });
                        continue;
                    }
                }
                out.push({ css: s, origin: 'author' });
            }
            else {
                out.push({ css: s.cssText, origin: 'author' });
            }
        }
        return out;
    }
    async render(opts = {}) {
        warnUnknownOptions(opts, 'render');
        PROGRESS_LOGGER.info('Step 1 - Fetching and parsing HTML');
        const sheets = await this.collectCss(opts.stylesheets ?? []);
        PROGRESS_LOGGER.info('Step 2 - Fetching and parsing CSS');
        const tree = buildTree(this.htmlString);
        const { matched, pageRules, fontFaces, pseudos } = buildCascade(tree.elements, sheets.map((s) => ({ css: s.css, origin: s.origin })), {
            mediaType: opts.mediaType ?? this.mediaType,
            presentationalHints: opts.presentationalHints ?? false,
        });
        attachStyles(tree.root, tree.elements, matched, pseudos);
        resolveCountersAndGenerated(tree.root);
        const pruned = pruneDisplayNone(tree.root) ?? tree.root;
        PROGRESS_LOGGER.info('Step 3 - Fetching fonts and images');
        clearFonts();
        await attachDocumentFonts(fontFaces, this.baseUrl, opts.urlFetcher ?? this.urlFetcher);
        await attachDocumentImages(pruned, this.baseUrl, opts.urlFetcher ?? this.urlFetcher);
        await attachBackgroundImages(pruned, this.baseUrl, opts.urlFetcher ?? this.urlFetcher);
        PROGRESS_LOGGER.info('Step 4 - Layout');
        const pageBox = pageBoxFromRules(pageRules);
        const flow = flowDocument(pruned, pageBox.contentWidth, pageBox.contentHeight);
        const bookmarks = collectBookmarks(pruned);
        const docOpts = { ...opts, baseUrl: opts.baseUrl ?? this.baseUrl };
        return new Document(pruned, tree.elements, pageBox, flow, docOpts, bookmarks);
    }
    async writePdf(target, opts = {}) {
        const doc = await this.render(opts);
        const merged = { ...doc.opts, ...opts };
        const bytes = await doc.writePdf(merged);
        const buf = Buffer.from(bytes);
        if (target)
            await writeFile(target, buf);
        return buf;
    }
}
export class CSS {
    cssText;
    baseUrl;
    constructor(css, baseUrl) {
        this.cssText = css;
        this.baseUrl = baseUrl;
    }
    static async create(input, opts = {}) {
        const fetcher = opts.urlFetcher ?? new URLFetcher();
        const resolved = await selectSource(input, { baseUrl: opts.baseUrl ?? null, fetcher });
        return new CSS(resolved.buffer.toString('utf8'), resolved.baseUrl);
    }
    static fromString(css, baseUrl = null) {
        return new CSS(css, baseUrl);
    }
}
export class Attachment {
    source;
    name;
    constructor(source, name = null) {
        this.source = source;
        this.name = name;
    }
}
export { computedStyle } from './css/cascade.js';
export { Document } from './document.js';
/** Fetch @font-face sources and register TTF/OTF metrics for layout. */
async function attachDocumentFonts(faces, baseUrl, fetcher) {
    for (const face of faces) {
        const src = face.declarations['src'] ?? '';
        const urls = [...src.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)].map((m) => m[2].trim());
        // format() hints: skip woff/woff2 (different container, unsupported).
        const formats = [...src.matchAll(/format\(\s*(['"]?)(.*?)\1\s*\)/gi)].map((m) => m[2].trim().toLowerCase());
        for (let i = 0; i < urls.length; i++) {
            if (formats[i] && formats[i].includes('woff'))
                continue;
            const u = urls[i];
            if (!u || u.toLowerCase().startsWith('local('))
                continue;
            try {
                let buffer;
                if (u.toLowerCase().startsWith('data:')) {
                    const parsed = parseDataUrl(u);
                    if (!parsed)
                        continue;
                    buffer = parsed.data;
                }
                else {
                    let abs = u;
                    try {
                        abs = new URL(u, baseUrl).href;
                    }
                    catch { /* keep */ }
                    buffer = (await fetcher.fetch(abs)).buffer;
                }
                const parsed = registerFont(buffer);
                if (parsed) {
                    LOGGER.info(`@font-face registered: ${parsed.family} (${parsed.subfamily})`);
                    break;
                }
            }
            catch (e) {
                LOGGER.warning(`Failed to fetch @font-face ${u}: ${e instanceof Error ? e.message : e}`);
            }
        }
    }
    void registeredFamilies;
}
/** Resolve every <img> in the box tree to bytes + intrinsic size. */ async function attachDocumentImages(root, baseUrl, fetcher) {
    const imgs = [];
    const walk = (box) => {
        if (box.tag === 'img')
            imgs.push(box);
        for (const c of box.children)
            walk(c);
    };
    walk(root);
    // Cap concurrent fetches; documents with hundreds of images stay bounded.
    const CONCURRENCY = 6;
    let i = 0;
    async function worker() {
        while (i < imgs.length) {
            const box = imgs[i++];
            const src = (box.attrs['src'] ?? '').trim();
            if (!src) {
                box.image = null;
                continue;
            }
            try {
                if (src.toLowerCase().startsWith('data:')) {
                    const parsed = parseDataUrl(src);
                    if (!parsed) {
                        box.image = null;
                        continue;
                    }
                    const info = sniffImage(parsed.data);
                    if (!info) {
                        box.image = null;
                        continue;
                    }
                    box.image = { buffer: parsed.data, mime: info.mime, wPx: info.widthPx, hPx: info.heightPx };
                    continue;
                }
                let abs = src;
                try {
                    abs = new URL(src, baseUrl).href;
                }
                catch { /* keep raw */ }
                const fetched = await fetcher.fetch(abs);
                const info = sniffImage(fetched.buffer);
                if (!info) {
                    box.image = null;
                    continue;
                }
                box.image = { buffer: fetched.buffer, mime: info.mime, wPx: info.widthPx, hPx: info.heightPx };
            }
            catch (e) {
                LOGGER.warning(`Failed to fetch image ${src}: ${e instanceof Error ? e.message : e}`);
                box.image = null;
            }
        }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.max(1, imgs.length)) }, () => worker()));
}
/** Fetch `background-image: url()` layers (first layer only) per box. */
async function attachBackgroundImages(root, baseUrl, fetcher) {
    const boxes = [];
    const walk = (box) => {
        if (box.uid !== 0) {
            const bg = box.style['background-image'] ?? '';
            const m = /url\(\s*(['"]?)(.*?)\1\s*\)/i.exec(bg);
            if (m && m[2].trim() && m[2].trim().toLowerCase() !== 'none')
                boxes.push(box);
        }
        for (const c of box.children)
            walk(c);
    };
    walk(root);
    const CONCURRENCY = 6;
    let i = 0;
    async function worker() {
        while (i < boxes.length) {
            const box = boxes[i++];
            const bg = box.style['background-image'] ?? '';
            const src = /url\(\s*(['"]?)(.*?)\1\s*\)/i.exec(bg)?.[2].trim() ?? '';
            if (!src) {
                box.bgImage = null;
                continue;
            }
            try {
                let buffer;
                if (src.toLowerCase().startsWith('data:')) {
                    const parsed = parseDataUrl(src);
                    if (!parsed) {
                        box.bgImage = null;
                        continue;
                    }
                    buffer = parsed.data;
                }
                else {
                    let abs = src;
                    try {
                        abs = new URL(src, baseUrl).href;
                    }
                    catch { /* keep */ }
                    buffer = (await fetcher.fetch(abs)).buffer;
                }
                const info = sniffImage(buffer);
                if (!info || info.mime === 'image/svg+xml') {
                    box.bgImage = null;
                    continue;
                }
                box.bgImage = { buffer, mime: info.mime, wPx: info.widthPx, hPx: info.heightPx };
            }
            catch (e) {
                LOGGER.warning(`Failed to fetch background image ${src}: ${e instanceof Error ? e.message : e}`);
                box.bgImage = null;
            }
        }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.max(1, boxes.length)) }, () => worker()));
}
/** Collect h1–h6 headings as PDF bookmarks (document outline). */
function collectBookmarks(root) {
    const out = [];
    const walk = (box) => {
        const m = /^h([1-6])$/.exec(box.tag);
        if (m && box.uid !== 0) {
            const label = headingText(box).replace(/\s+/g, ' ').trim().slice(0, 200);
            if (label)
                out.push({ level: parseInt(m[1], 10), label, uid: box.uid });
        }
        for (const c of box.children)
            walk(c);
    };
    walk(root);
    return out;
}
function headingText(box) {
    const parts = [];
    const walk = (b) => {
        if (b.type === 'text' && b.text)
            parts.push(b.text);
        for (const c of b.children)
            walk(c);
    };
    walk(box);
    return parts.join(' ');
}
//# sourceMappingURL=index.js.map