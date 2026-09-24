// Fonts — mirrors weasyprint/text/fonts.py (subset).
// Fontconfig lookup replaced by generic-family mapping + @font-face registry.
// Full HarfBuzz shaping lands in Phase 4; here metrics use approximations.
export interface FontFace {
  family: string;
  style: string;
  weight: number;
  src: string | null;
}

const GENERIC: Record<string, string[]> = {
  serif: ['Times-Roman', 'Times New Roman', 'serif'],
  'sans-serif': ['Helvetica', 'Arial', 'sans-serif'],
  monospace: ['Courier', 'monospace'],
  cursive: ['Helvetica'],
  fantasy: ['Helvetica'],
};

export function resolveFontFamily(spec: string): string[] {
  const fams = spec.split(',').map((s) => s.trim().replace(/^["']|["']$/g, '').toLowerCase());
  const out: string[] = [];
  for (const f of fams) {
    if (GENERIC[f]) out.push(...GENERIC[f]);
    else out.push(f);
  }
  return out.length ? out : GENERIC['sans-serif'];
}

export function standardPdfFont(family: string, bold: boolean, italic: boolean): string {
  const f = family.toLowerCase();
  if (f.includes('courier') || f.includes('monospace')) {
    if (bold && italic) return 'Courier-BoldOblique';
    if (bold) return 'Courier-Bold';
    if (italic) return 'Courier-Oblique';
    return 'Courier';
  }
  if (f.includes('times') || f.includes('serif')) {
    if (bold && italic) return 'Times-BoldItalic';
    if (bold) return 'Times-Bold';
    if (italic) return 'Times-Italic';
    return 'Times-Roman';
  }
  if (bold && italic) return 'Helvetica-BoldOblique';
  if (bold) return 'Helvetica-Bold';
  if (italic) return 'Helvetica-Oblique';
  return 'Helvetica';
}

export function fontWeightToNumber(w: string): number {
  if (w === 'bold') return 700;
  if (w === 'normal') return 400;
  const n = parseInt(w, 10);
  return Number.isFinite(n) ? n : 400;
}

export function parseFontFaces(rules: { declarations: Record<string, string> }[]): FontFace[] {
  return rules.map((r) => ({
    family: (r.declarations['font-family'] ?? 'sans-serif').replace(/["']/g, ''),
    style: r.declarations['font-style'] ?? 'normal',
    weight: fontWeightToNumber(r.declarations['font-weight'] ?? 'normal'),
    src: r.declarations['src'] ?? null,
  }));
}
