// CLI — mirrors weasyprint/__main__.py
// `weasyprint-js input.html output.pdf [options]`
import { Command } from 'commander';
import { readFile, writeFile } from 'node:fs/promises';
import { HTML, VERSION, DEFAULT_OPTIONS, CSS } from '../index.js';
import { URLFetcher } from '../urls.js';
import { LOGGER } from '../logger.js';

const program = new Command();
program
  .name('weasyprint-js')
  .description('Render web pages to PDF. (TypeScript port of WeasyPrint)')
  .argument('[input]', 'URL or filename of the HTML input, or - for stdin')
  .argument('[output]', 'filename where output is written, or - for stdout')
  .option('-s, --stylesheet <url...>', 'URL or filename for a user CSS stylesheet')
  .option('-m, --media-type <type>', 'media type to use for @media', DEFAULT_OPTIONS.mediaType)
  .option('-u, --base-url <url>', 'base for relative URLs in the HTML input')
  .option('-e, --encoding <enc>', 'force the input character encoding')
  .option('-t, --timeout <s>', 'timeout in seconds for HTTP requests', '10')
  .option('--allowed-protocols <list>', 'comma-separated list of allowed protocols')
  .option('--no-http-redirects', 'do not follow HTTP redirects')
  .option('--fail-on-http-errors', 'abort on any HTTP error')
  .option('--uncompressed-pdf', 'do not compress PDF content')
  .option('--title <t>', 'PDF title metadata')
  .option('--author <a>', 'PDF author metadata')
  .option('--subject <s>', 'PDF subject metadata')
  .option('--keywords <k>', 'PDF keywords metadata')
  .option('--creator <c>', 'PDF creator metadata')
  .option('--pdf-variant <v>', 'PDF variant (PDF/A-1b, PDF/A-2b, PDF/A-3b, PDF/UA-1)')
  .option('--pdf-version <v>', 'PDF version (e.g. 1.4, 1.7)')
  .option('--pdf-tags', 'emit a tagged (accessible) PDF')
  .option('--pdf-identifier <id>', 'PDF file identifier (trailer ID)')
  .option('--attachment <file...>', 'file to embed as a PDF attachment (repeatable)')
  .option('--zoom <z>', 'zoom factor: PDF units per CSS unit', '1')
  .option('--presentational-hints', 'enable HTML presentational hints')
  .option('--output-intent <s>', 'PDF output intent ICC profile')
  .option('--optimize-images', 'optimize raster images')
  .option('--jpeg-quality <n>', 'JPEG quality for optimized images', '95')
  .option('--dpi <n>', 'target DPI for raster images', '96')
  .option('--full-fonts', 'embed full fonts instead of subsets')
  .option('--hinting', 'keep hinting in embedded fonts')
  .option('--cache-folder <dir>', 'folder used to cache images and fonts')
  .option('-v, --verbose', 'show warnings and information messages')
  .option('-d, --debug', 'show debugging messages')
  .option('-q, --quiet', 'hide logging messages')
  .option('--version', 'print version and exit')
  .action(async (input: string, output: string, opts: Record<string, unknown>) => {
    if (opts['version']) {
      // eslint-disable-next-line no-console
      console.log(`weasyprint-js version ${VERSION}`);
      return;
    }
    if (!input || !output) {
      program.error('missing required arguments \'input\' and \'output\'', { exitCode: 1 });
    }
    if (!opts['quiet']) {
      if (opts['debug']) LOGGER.setLevel('debug');
      else if (opts['verbose']) LOGGER.setLevel('info');
    }
    const fetcher = new URLFetcher({
      timeout: parseInt(String(opts['timeout'] ?? '10'), 10),
      allowedProtocols: opts['allowedProtocols']
        ? new Set(String(opts['allowedProtocols']).split(',').map((s: string) => s.trim().toLowerCase()))
        : undefined,
      allowRedirects: !(opts as { noHttpRedirects?: boolean }).noHttpRedirects,
      failOnErrors: Boolean((opts as { failOnHttpErrors?: boolean }).failOnHttpErrors),
    });

    let source: string | Buffer;
    if (input === '-') {
      const chunks: Buffer[] = [];
      for await (const c of process.stdin) chunks.push(Buffer.from(c));
      source = Buffer.concat(chunks);
    } else {
      source = input;
    }
    const baseUrl = (opts['baseUrl'] as string | undefined) ?? (input === '-' ? null : null);
    const html = await HTML.create(
      (opts['encoding'] ? { filename: String(source) } : source) as never,
      { baseUrl: baseUrl ?? null, urlFetcher: fetcher, mediaType: String(opts['mediaType'] ?? 'print') },
    );
    const stylesheets: Array<CSS | string> = [];
    const extra = (opts['stylesheet'] as string[] | undefined) ?? [];
    for (const s of extra) {
      try {
        const css = await CSS.create({ filename: s }, { urlFetcher: fetcher });
        stylesheets.push(css);
      } catch {
        try {
          const css = await CSS.create({ url: s }, { urlFetcher: fetcher });
          stylesheets.push(css);
        } catch {
          stylesheets.push(s);
        }
      }
    }
    const pdf = await html.writePdf(null, {
      stylesheets,
      mediaType: String(opts['mediaType'] ?? 'print'),
      urlFetcher: fetcher,
      baseUrl: (opts['baseUrl'] as string | undefined) ?? null,
      title: opts['title'] as string | undefined,
      author: opts['author'] as string | undefined,
      subject: opts['subject'] as string | undefined,
      keywords: opts['keywords'] as string | undefined,
      creator: opts['creator'] as string | undefined,
      pdfVariant: opts['pdfVariant'] as string | null | undefined,
      pdfVersion: opts['pdfVersion'] as string | undefined,
      pdfTags: Boolean(opts['pdfTags']),
      zoom: parseFloat(String(opts['zoom'] ?? '1')) || 1,
      attachments: await loadAttachments((opts['attachment'] as string[] | undefined) ?? []),
      presentationalHints: Boolean(opts['presentationalHints']),
      outputIntent: opts['outputIntent'] as string | undefined,
      optimizeImages: Boolean(opts['optimizeImages']),
      jpegQuality: parseInt(String(opts['jpegQuality'] ?? '95'), 10),
      dpi: parseInt(String(opts['dpi'] ?? '96'), 10),
      fullFonts: Boolean(opts['fullFonts']),
      hinting: Boolean(opts['hinting']),
      cacheFolder: opts['cacheFolder'] as string | undefined,
      uncompressedPdf: Boolean(opts['uncompressedPdf']),
    });
    if (output === '-') {
      await new Promise<void>((resolve, reject) => {
        process.stdout.write(pdf, (e) => (e ? reject(e) : resolve()));
      });
    } else {
      await writeFile(output, pdf);
    }
    void readFile;
  });

async function loadAttachments(files: string[]): Promise<Array<{ source: Buffer; name: string }>> {
  const out: Array<{ source: Buffer; name: string }> = [];
  for (const f of files) {
    try {
      const buf = await readFile(f);
      const name = f.split(/[\\/]/).pop() ?? f;
      out.push({ source: Buffer.from(buf), name });
    } catch (e) {
      LOGGER.warning(`Could not read attachment ${f}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return out;
}

program.parseAsync(process.argv);
