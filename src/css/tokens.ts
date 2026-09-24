// CSS tokens & parsing — mirrors weasyprint/css/tokens.py + tinycss2 layer.
// Python uses tinycss2 (tokenizer) + cssselect2. Here css-tree is the
// tokenizer/parser; this module normalizes its AST into our Rule model.

import { parse, walk, generate } from 'css-tree';

export interface Declaration {
  prop: string;
  value: string;
  important: boolean;
}

export interface StyleRule {
  type: 'style';
  selectors: string[];
  declarations: Declaration[];
  media: string | null;
  order: number;
}

export interface AtRule {
  type: 'at';
  name: string;
  prelude: string;
  block: string | null;
  media: string | null;
  order: number;
}

export type CssRule = StyleRule | AtRule;

export interface ParsedStylesheet {
  rules: CssRule[];
}

let orderCounter = 0;

export function parseStylesheet(css: string, media: string | null = null): ParsedStylesheet {
  const rules: CssRule[] = [];
  if (!css.trim()) return { rules };
  let ast: unknown;
  try {
    ast = parse(css, { positions: false });
  } catch {
    return { rules };
  }
  walk(ast as never, (node: { type: string; [k: string]: unknown }) => {
    if (node.type === 'Rule') {
      const prelude = node['prelude'];
      const block = node['block'] as { children?: { toArray?: () => Array<{ property?: string; value?: unknown; important?: boolean }> } } | undefined;
      const selectors = splitSelectors(generate(prelude as never));
      const declarations: Declaration[] = [];
      for (const decl of block?.children?.toArray?.() ?? []) {
        if (!decl.property || decl.value == null) continue;
        declarations.push({
          prop: String(decl.property).trim().toLowerCase(),
          value: generate(decl.value as never).trim(),
          important: Boolean(decl.important),
        });
      }
      rules.push({ type: 'style', selectors, declarations, media, order: orderCounter++ });
    } else if (node.type === 'Atrule') {
      const name = String(node['name'] ?? '').toLowerCase();
      // Only collect top-level at-rules; nested rules are re-parsed in cascade
      rules.push({
        type: 'at',
        name,
        prelude: node['prelude'] ? generate(node['prelude'] as never).trim() : '',
        block: node['block'] ? generate(node['block'] as never) : null,
        media,
        order: orderCounter++,
      });
    }
  });
  return { rules };
}

function splitSelectors(prelude: string): string[] {
  // Naïve comma split (good enough for MVP; css-tree keeps commas at top level)
  return prelude.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Expand `margin: a b c d`-style shorthands into longhands. */
export function expandShorthands(decls: Declaration[]): Declaration[] {
  const out: Declaration[] = [];
  for (const d of decls) {
    if (d.prop === 'margin' || d.prop === 'padding') {
      const parts = d.value.split(/\s+/).filter(Boolean);
      const [t, r, b, l] = quad(parts);
      out.push(
        { prop: `${d.prop}-top`, value: t, important: d.important },
        { prop: `${d.prop}-right`, value: r, important: d.important },
        { prop: `${d.prop}-bottom`, value: b, important: d.important },
        { prop: `${d.prop}-left`, value: l, important: d.important },
      );
    } else if (d.prop === 'border-width' || d.prop === 'border-style' || d.prop === 'border-color') {
      const parts = d.value.split(/\s+/).filter(Boolean);
      const [t, r, b, l] = quad(parts);
      const kind = d.prop.slice('border-'.length);
      out.push(
        { prop: `border-top-${kind}`, value: t, important: d.important },
        { prop: `border-right-${kind}`, value: r, important: d.important },
        { prop: `border-bottom-${kind}`, value: b, important: d.important },
        { prop: `border-left-${kind}`, value: l, important: d.important },
      );
    } else if (d.prop === 'font') {
      for (const e of expandFont(d.value, d.important)) out.push(e);
    } else {
      out.push(d);
    }
  }
  return out;
}

function quad(parts: string[]): [string, string, string, string] {
  if (parts.length === 0) return ['0', '0', '0', '0'];
  if (parts.length === 1) return [parts[0], parts[0], parts[0], parts[0]];
  if (parts.length === 2) return [parts[0], parts[1], parts[0], parts[1]];
  if (parts.length === 3) return [parts[0], parts[1], parts[2], parts[1]];
  return [parts[0], parts[1], parts[2], parts[3]];
}

function expandFont(value: string, important: boolean): Declaration[] {
  // Very small subset: `italic bold 12px/1.5 Family, serif`
  const out: Declaration[] = [];
  const m = /^(?:(italic|oblique|normal)\s+)?(?:(bold|bolder|lighter|[1-9]00|normal)\s+)?([0-9.]+(?:px|pt|em|rem|%|xx-small|x-small|small|medium|large|x-large|xx-large|smaller|larger)?)(?:\/([0-9.]+))?\s+(.+)$/.exec(value.trim());
  if (!m) return out;
  if (m[1] && m[1] !== 'normal') out.push({ prop: 'font-style', value: m[1], important });
  if (m[2] && m[2] !== 'normal') out.push({ prop: 'font-weight', value: m[2], important });
  out.push({ prop: 'font-size', value: m[3], important });
  if (m[4]) out.push({ prop: 'line-height', value: m[4], important });
  out.push({ prop: 'font-family', value: m[5], important });
  return out;
}
