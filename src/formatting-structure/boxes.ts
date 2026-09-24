// Box tree — mirrors weasyprint/formatting_structure/{boxes,build}.py
// parse5 DOM -> ElementRef list + Box tree (block/inline/text).
import { parse } from 'parse5';
import type { ElementRef, CascadeEntry } from '../css/types.js';
import { computedStyle, computedPseudoStyle } from '../css/cascade.js';
import type { CascadeResult } from '../css/cascade.js';
import { computeValue } from '../css/computed-values.js';
import { CounterScopes } from '../css/counters.js';
import { resolveContent, parseQuotes } from '../css/content.js';

export type BoxType = 'block' | 'inline' | 'text' | 'table' | 'table-row' | 'table-cell' | 'list-item';

export interface Box {
  uid: number;
  type: BoxType;
  tag: string;
  text: string | null;
  children: Box[];
  style: Record<string, string>;
  attrs: Record<string, string>;
  /** Resolved raster image (attached in HTML.render after style cascade). */
  image?: { buffer: Buffer; mime: string; wPx: number; hPx: number } | null;
  /** Resolved CSS background image (fetched in HTML.render). */
  bgImage?: { buffer: Buffer; mime: string; wPx: number; hPx: number } | null;
  /** Snapshot list-marker for <li> (value from list-item counter). */
  listMarker?: { value: number; type: string } | null;
  /** Computed ::before/::after styles (content resolved in counter walk). */
  pseudoBefore?: Record<string, string> | null;
  pseudoAfter?: Record<string, string> | null;
}

export interface BuiltTree {
  elements: ElementRef[];
  root: Box;
  byUid: Map<number, ElementRef>;
}

interface RawNode {
  tagName?: string;
  value?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: RawNode[];
}

let uidCounter = 1;

const BLOCK_TAGS = new Set(['html', 'body', 'div', 'p', 'section', 'article', 'header',
  'footer', 'main', 'nav', 'aside', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol',
  'li', 'pre', 'blockquote', 'figure', 'hr', 'table', 'thead', 'tbody', 'tr',
  'form', 'fieldset', 'address', 'dl', 'dd', 'dt', 'figcaption', 'details']);

export function buildTree(html: string): BuiltTree {
  uidCounter = 1;
  const doc = parse(html) as unknown as RawNode;
  const elements: ElementRef[] = [];
  const byUid = new Map<number, ElementRef>();
  const body = findTag(doc, 'body') ?? findTag(doc, 'html') ?? doc;
  const root = buildBox(body, null, elements, byUid);
  return { elements, root, byUid };
}

function findTag(node: RawNode, tag: string): RawNode | null {
  if (node.tagName === tag) return node;
  for (const c of node.childNodes ?? []) {
    const f = findTag(c, tag);
    if (f) return f;
  }
  return null;
}

function buildBox(node: RawNode, parentUid: number | null, elements: ElementRef[], byUid: Map<number, ElementRef>): Box {
  if (!node.tagName) {
    // Keep raw text (only normalize newlines); whitespace collapsing happens
    // per-element at layout time based on `white-space` (so <pre> survives).
    const text = (node.value ?? '').replace(/\r\n?/g, '\n');
    return { uid: 0, type: 'text', tag: '#text', text, children: [], style: {}, attrs: {} };
  }
  const uid = uidCounter++;
  const attrs: Record<string, string> = {};
  for (const a of node.attrs ?? []) attrs[a.name.toLowerCase()] = a.value;
  const classes = (attrs['class'] ?? '').split(/\s+/).filter(Boolean);
  const ref: ElementRef = {
    uid, tag: node.tagName.toLowerCase(), id: attrs['id'] ?? null,
    classes, attrs, parentUid,
    inlineStyle: attrs['style'],
  };
  elements.push(ref);
  byUid.set(uid, ref);
  let type: BoxType = BLOCK_TAGS.has(ref.tag) ? 'block' : 'inline';
  if (ref.tag === 'table') type = 'table';
  if (ref.tag === 'tr') type = 'table-row';
  if (ref.tag === 'td' || ref.tag === 'th') type = 'table-cell';
  if (ref.tag === 'li') type = 'list-item';
  if (ref.tag === 'br') {
    return { uid, type: 'text', tag: 'br', text: '\n', children: [], style: {}, attrs };
  }
  // Void / replaced elements never have box children.
  if (ref.tag === 'img' || ref.tag === 'hr' || ref.tag === 'input' || ref.tag === 'meta' || ref.tag === 'link') {
    return { uid, type: ref.tag === 'img' ? 'inline' : type, tag: ref.tag, text: null, children: [], style: {}, attrs };
  }
  const children: Box[] = [];
  for (const c of node.childNodes ?? []) {
    if (!c.tagName && !((c.value ?? '').trim())) continue;
    children.push(buildBox(c, uid, elements, byUid));
  }
  return { uid, type, tag: ref.tag, text: null, children, style: {}, attrs };
}

/** Attach computed styles to every box (mutates in place). */
export function attachStyles(
  root: Box,
  elements: ElementRef[],
  matched: Map<number, Map<string, CascadeEntry>>,
  pseudos?: CascadeResult['pseudos'],
): void {
  const memo = new Map<number, Record<string, string>>();
  const walk = (box: Box, parentStyle: Record<string, string>): void => {
    if (box.uid !== 0) {
      const specified = computedStyle(matched, elements, box.uid, memo);
      const computed: Record<string, string> = {};
      for (const [prop, value] of Object.entries(specified)) {
        const c = computeValue(prop, value, parentStyle);
        if (c !== '') computed[prop] = c;
      }
      box.style = computed;
      if (pseudos) {
        box.pseudoBefore = computedPseudoStyle(pseudos, box.uid, 'before', computed);
        box.pseudoAfter = computedPseudoStyle(pseudos, box.uid, 'after', computed);
      }
      const d = (box.style['display'] ?? '').trim();
      if (d.startsWith('inline')) box.type = 'inline';
      else if (d === 'block' || d === 'list-item') box.type = d as BoxType;
      else if (d === 'table') box.type = 'table';
      else if (d === 'table-row') box.type = 'table-row';
      else if (d === 'table-cell') box.type = 'table-cell';
    }
    for (const c of box.children) {
      if (c.uid === 0) c.style = box.style;
      walk(c, box.style);
    }
  };
  walk(root, {});
}

/** Void elements never get ::before/::after boxes. */
const NO_GENERATED = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'col', 'area', 'base', 'embed', 'source', 'track', 'wbr']);

/**
 * Counter assignment + ::before/::after generation (document order walk).
 * Mirrors the counter/content side of formatting_structure/build.py.
 */
export function resolveCountersAndGenerated(root: Box): void {
  const scopes = new CounterScopes();
  let quoteDepth = 0;
  const walk = (box: Box): void => {
    if (box.uid !== 0 && !NO_GENERATED.has(box.tag)) {
      const style = box.style;
      if (style['counter-reset']) scopes.applyReset(style['counter-reset'], box.uid);
      if (box.tag === 'li' && !mentionsCounter(style['counter-increment'], 'list-item')) {
        scopes.increment('list-item', 1);
      }
      if (style['counter-increment']) scopes.applyIncrement(style['counter-increment'], box.uid);
      if (box.tag === 'li') {
        box.listMarker = {
          value: scopes.getValue('list-item') ?? 0,
          type: style['list-style-type'] ?? 'disc',
        };
      }
      const quotes = parseQuotes(style['quotes']);
      for (const kind of ['before', 'after'] as const) {
        const pseudo = kind === 'before' ? box.pseudoBefore : box.pseudoAfter;
        if (!pseudo) continue;
        const content = pseudo['content'] ?? 'normal';
        const resolved = resolveContent(content, {
          counters: scopes, attrs: box.attrs, quotes, quoteDepth,
        });
        if (resolved && resolved.text) {
          quoteDepth = resolved.quoteDepth;
          const gen: Box = {
            uid: 0, type: 'text', tag: kind === 'before' ? '::before' : '::after',
            text: resolved.text, children: [], style: pseudo, attrs: {},
          };
          if (kind === 'before') box.children.unshift(gen);
          else box.children.push(gen);
        }
        box.pseudoBefore = kind === 'before' ? null : box.pseudoBefore;
        box.pseudoAfter = kind === 'after' ? null : box.pseudoAfter;
      }
    }
    for (const c of box.children) walk(c);
    if (box.uid !== 0) scopes.exitElement(box.uid);
  };
  walk(root);
}

function mentionsCounter(value: string | undefined, name: string): boolean {
  if (!value) return false;
  return value.toLowerCase().split(/\s+/).includes(name);
}

/** Remove display:none subtrees (and display:none generated boxes). */
export function pruneDisplayNone(root: Box): Box | null {
  if (root.uid !== 0 && (root.style['display'] ?? '').trim() === 'none') return null;
  if (root.uid === 0 && (root.tag === '::before' || root.tag === '::after') &&
      (root.style['display'] ?? '').trim() === 'none') return null;
  root.children = root.children.map(pruneDisplayNone).filter((b): b is Box => b != null);
  return root;
}
