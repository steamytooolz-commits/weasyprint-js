// Draw: color — mirrors weasyprint/draw/color.py
// Parse CSS Color 3 + Color 4 (named, hex 3/4/6/8, rgb()/rgba() legacy +
// modern space/slash syntax, hsl()/hsla(), hwb()) to sRGB for pdf-lib.
// Alpha is parsed and returned; the pdf-lib painter uses RGB (alpha is
// preserved on the RGB record for callers that support transparency).

const NAMED: Record<string, [number, number, number]> = {
  aliceblue: [0.941, 0.973, 1.0], antiquewhite: [0.98, 0.922, 0.843],
  aqua: [0, 1, 1], aquamarine: [0.498, 1, 0.831], azure: [0.941, 1, 1],
  beige: [0.961, 0.961, 0.863], bisque: [1, 0.894, 0.769],
  black: [0, 0, 0], blanchedalmond: [1, 0.922, 0.804], blue: [0, 0, 1],
  blueviolet: [0.541, 0.169, 0.886], brown: [0.647, 0.165, 0.165],
  burlywood: [0.871, 0.722, 0.529], cadetblue: [0.373, 0.62, 0.627],
  chartreuse: [0.498, 1, 0], chocolate: [0.824, 0.412, 0.118],
  coral: [1, 0.498, 0.314], cornflowerblue: [0.392, 0.584, 0.929],
  cornsilk: [1, 0.973, 0.863], crimson: [0.863, 0.078, 0.235],
  cyan: [0, 1, 1], darkblue: [0, 0, 0.545], darkcyan: [0, 0.545, 0.545],
  darkgoldenrod: [0.722, 0.525, 0.043], darkgray: [0.663, 0.663, 0.663],
  darkgreen: [0, 0.392, 0], darkgrey: [0.663, 0.663, 0.663],
  darkkhaki: [0.741, 0.718, 0.42], darkmagenta: [0.545, 0, 0.545],
  darkolivegreen: [0.333, 0.42, 0.184], darkorange: [1, 0.549, 0],
  darkorchid: [0.6, 0.196, 0.8], darkred: [0.545, 0, 0],
  darksalmon: [0.914, 0.588, 0.478], darkseagreen: [0.561, 0.737, 0.561],
  darkslateblue: [0.282, 0.239, 0.545], darkslategray: [0.184, 0.31, 0.31],
  darkslategrey: [0.184, 0.31, 0.31], darkturquoise: [0, 0.808, 0.82],
  darkviolet: [0.58, 0, 0.827], deeppink: [1, 0.078, 0.576],
  deepskyblue: [0, 0.749, 1], dimgray: [0.412, 0.412, 0.412],
  dimgrey: [0.412, 0.412, 0.412], dodgerblue: [0.118, 0.565, 1],
  firebrick: [0.698, 0.132, 0.132], floralwhite: [1, 0.98, 0.941],
  forestgreen: [0.133, 0.545, 0.133], fuchsia: [1, 0, 1],
  gainsboro: [0.863, 0.863, 0.863], ghostwhite: [0.973, 0.973, 1],
  gold: [1, 0.843, 0], goldenrod: [0.855, 0.647, 0.125],
  gray: [0.502, 0.502, 0.502], green: [0, 0.502, 0],
  greenyellow: [0.678, 1, 0.184], grey: [0.502, 0.502, 0.502],
  honeydew: [0.941, 1, 0.941], hotpink: [1, 0.412, 0.706],
  indianred: [0.804, 0.361, 0.361], indigo: [0.294, 0, 0.51],
  ivory: [1, 1, 0.941], khaki: [0.941, 0.902, 0.549],
  lavender: [0.902, 0.902, 0.98], lavenderblush: [1, 0.941, 0.961],
  lawngreen: [0.486, 0.988, 0], lemonchiffon: [1, 0.98, 0.804],
  lightblue: [0.678, 0.847, 0.902], lightcoral: [0.941, 0.502, 0.502],
  lightcyan: [0.878, 1, 1], lightgoldenrodyellow: [0.98, 0.98, 0.824],
  lightgray: [0.827, 0.827, 0.827], lightgreen: [0.565, 0.933, 0.565],
  lightgrey: [0.827, 0.827, 0.827], lightpink: [1, 0.714, 0.757],
  lightsalmon: [1, 0.627, 0.478], lightseagreen: [0.125, 0.698, 0.667],
  lightskyblue: [0.529, 0.808, 0.98], lightslategray: [0.467, 0.533, 0.6],
  lightslategrey: [0.467, 0.533, 0.6], lightsteelblue: [0.69, 0.769, 0.871],
  lightyellow: [1, 1, 0.878], lime: [0, 1, 0], limegreen: [0.196, 0.804, 0.196],
  linen: [0.98, 0.941, 0.902], magenta: [1, 0, 1], maroon: [0.502, 0, 0],
  mediumaquamarine: [0.4, 0.804, 0.667], mediumblue: [0, 0, 0.804],
  mediumorchid: [0.729, 0.333, 0.827], mediumpurple: [0.576, 0.439, 0.859],
  mediumseagreen: [0.235, 0.702, 0.443], mediumslateblue: [0.482, 0.408, 0.933],
  mediumspringgreen: [0, 0.98, 0.604], mediumturquoise: [0.282, 0.82, 0.8],
  mediumvioletred: [0.78, 0.082, 0.522], midnightblue: [0.098, 0.098, 0.439],
  mintcream: [0.961, 1, 0.98], mistyrose: [1, 0.894, 0.925],
  moccasin: [1, 0.894, 0.71], navajowhite: [1, 0.871, 0.678],
  navy: [0, 0, 0.502], oldlace: [0.992, 0.961, 0.902],
  olive: [0.502, 0.502, 0], olivedrab: [0.42, 0.557, 0.137],
  orange: [1, 0.647, 0], orangered: [1, 0.271, 0], orchid: [0.855, 0.439, 0.839],
  palegoldenrod: [0.933, 0.91, 0.667], palegreen: [0.596, 0.984, 0.596],
  paleturquoise: [0.686, 0.933, 0.933], palevioletred: [0.859, 0.439, 0.576],
  papayawhip: [1, 0.937, 0.835], peachpuff: [1, 0.855, 0.725],
  peru: [0.804, 0.522, 0.247], pink: [1, 0.753, 0.796], plum: [0.867, 0.627, 0.867],
  powderblue: [0.69, 0.878, 0.902], purple: [0.502, 0, 0.502],
  rebeccapurple: [0.4, 0.2, 0.6], red: [1, 0, 0],
  rosybrown: [0.737, 0.561, 0.561], royalblue: [0.255, 0.412, 0.882],
  saddlebrown: [0.545, 0.271, 0.075], salmon: [0.98, 0.502, 0.447],
  sandybrown: [0.957, 0.643, 0.376], seagreen: [0.18, 0.545, 0.341],
  seashell: [1, 0.961, 0.933], sienna: [0.627, 0.322, 0.176],
  silver: [0.753, 0.753, 0.753], skyblue: [0.529, 0.808, 0.922],
  slateblue: [0.416, 0.353, 0.804], slategray: [0.439, 0.502, 0.565],
  slategrey: [0.439, 0.502, 0.565], snow: [1, 0.98, 0.98],
  springgreen: [0, 1, 0.498], steelblue: [0.275, 0.51, 0.706],
  tan: [0.824, 0.706, 0.549], teal: [0, 0.502, 0.502],
  thistle: [0.847, 0.749, 0.847], tomato: [1, 0.388, 0.278],
  turquoise: [0.251, 0.878, 0.816], violet: [0.933, 0.51, 0.933],
  wheat: [0.961, 0.871, 0.702], white: [1, 1, 1],
  whitesmoke: [0.961, 0.961, 0.961], yellow: [1, 1, 0],
  yellowgreen: [0.604, 0.804, 0.196],
};

export interface RGB { r: number; g: number; b: number; alpha: number }

export function parseColor(input: string | undefined): RGB | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  if (s === '' || s === 'transparent') return null;
  // currentcolor is resolved by the cascade (computeValue); treat as unresolvable here.
  if (s === 'currentcolor') return null;
  if (NAMED[s]) { const [r, g, b] = NAMED[s]; return { r, g, b, alpha: 1 }; }
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) {
    return {
      r: parseInt(m[1][0] + m[1][0], 16) / 255,
      g: parseInt(m[1][1] + m[1][1], 16) / 255,
      b: parseInt(m[1][2] + m[1][2], 16) / 255, alpha: 1,
    };
  }
  m = /^#([0-9a-f]{4})$/.exec(s);
  if (m) {
    return {
      r: parseInt(m[1][0] + m[1][0], 16) / 255,
      g: parseInt(m[1][1] + m[1][1], 16) / 255,
      b: parseInt(m[1][2] + m[1][2], 16) / 255,
      alpha: parseInt(m[1][3] + m[1][3], 16) / 255,
    };
  }
  m = /^#([0-9a-f]{6})$/.exec(s);
  if (m) {
    return {
      r: parseInt(m[1].slice(0, 2), 16) / 255,
      g: parseInt(m[1].slice(2, 4), 16) / 255,
      b: parseInt(m[1].slice(4, 6), 16) / 255, alpha: 1,
    };
  }
  m = /^#([0-9a-f]{8})$/.exec(s);
  if (m) {
    return {
      r: parseInt(m[1].slice(0, 2), 16) / 255,
      g: parseInt(m[1].slice(2, 4), 16) / 255,
      b: parseInt(m[1].slice(4, 6), 16) / 255,
      alpha: parseInt(m[1].slice(6, 8), 16) / 255,
    };
  }
  m = /^(rgba?|hsla?|hwb)\(\s*([^)]+)\)$/.exec(s);
  if (m) {
    const fn = m[1];
    if (fn.startsWith('rgb')) {
      const rgb = parseRgbArgs(m[2]);
      if (rgb) return rgb;
    } else if (fn.startsWith('hsl')) {
      const rgb = parseHslArgs(m[2]);
      if (rgb) return rgb;
    } else if (fn === 'hwb') {
      const rgb = parseHwbArgs(m[2]);
      if (rgb) return rgb;
    }
    return null;
  }
  return null;
}

function parseAlphaToken(tok: string): number | null {
  const t = tok.trim().toLowerCase();
  if (t.endsWith('%')) {
    const n = parseFloat(t);
    if (!Number.isFinite(n)) return null;
    return Math.min(1, Math.max(0, n / 100));
  }
  const n = parseFloat(t);
  if (!Number.isFinite(n)) return null;
  return Math.min(1, Math.max(0, n));
}

function splitAlpha(body: string): { color: string; alpha: number } | null {
  // Split on top-level `/` for modern syntax: `rgb(255 0 0 / 50%)`.
  const idx = body.indexOf('/');
  if (idx < 0) return { color: body, alpha: 1 };
  const a = parseAlphaToken(body.slice(idx + 1));
  if (a == null) return null;
  return { color: body.slice(0, idx), alpha: a };
}

function rgbChannel(tok: string): number | null {
  const t = tok.trim().toLowerCase();
  if (t.endsWith('%')) {
    const n = parseFloat(t);
    if (!Number.isFinite(n)) return null;
    return Math.min(1, Math.max(0, n / 100));
  }
  if (t === 'none') return 0;
  const n = parseFloat(t);
  if (!Number.isFinite(n)) return null;
  return Math.min(1, Math.max(0, n / 255));
}

function parseRgbArgs(body: string): RGB | null {
  const split = splitAlpha(body);
  if (!split) return null;
  const raw = split.color.trim();
  let toks: string[];
  if (raw.includes(',')) {
    toks = raw.split(',').map((t) => t.trim()).filter((t) => t !== '');
    if (toks.length === 4) {
      const a = parseAlphaToken(toks[3]);
      if (a == null) return null;
      toks = toks.slice(0, 3);
      return finishRgb(toks, Math.min(1, split.alpha * a));
    }
    if (toks.length !== 3) return null;
  } else {
    toks = raw.split(/\s+/).filter(Boolean);
    if (toks.length !== 3) return null;
  }
  return finishRgb(toks, split.alpha);
}

function finishRgb(toks: string[], alpha: number): RGB | null {
  if (toks.length !== 3) return null;
  const r = rgbChannel(toks[0]);
  const g = rgbChannel(toks[1]);
  const b = rgbChannel(toks[2]);
  if (r == null || g == null || b == null) return null;
  return { r, g, b, alpha };
}

function hueToDeg(tok: string): number | null {
  const t = tok.trim().toLowerCase();
  if (t === 'none') return 0;
  const m = /^(-?[0-9]*\.?[0-9]+)(deg|grad|rad|turn)?$/.exec(t);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const u = m[2] ?? 'deg';
  if (u === 'deg') return ((n % 360) + 360) % 360;
  if (u === 'grad') return ((((n * 0.9) % 360) + 360) % 360);
  if (u === 'rad') return ((((n * 180) / Math.PI % 360) + 360) % 360);
  return ((((n * 360) % 360) + 360) % 360); // turn
}

function pct01(tok: string): number | null {
  const t = tok.trim().toLowerCase();
  if (t === 'none') return 0;
  if (!t.endsWith('%')) return null;
  const n = parseFloat(t);
  if (!Number.isFinite(n)) return null;
  return Math.min(1, Math.max(0, n / 100));
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (hp < 1) { r1 = c; g1 = x; }
  else if (hp < 2) { r1 = x; g1 = c; }
  else if (hp < 3) { g1 = c; b1 = x; }
  else if (hp < 4) { g1 = x; b1 = c; }
  else if (hp < 5) { r1 = x; b1 = c; }
  else { r1 = c; b1 = x; }
  const m2 = l - c / 2;
  return [r1 + m2, g1 + m2, b1 + m2];
}

function parseHslArgs(body: string): RGB | null {
  const split = splitAlpha(body);
  if (!split) return null;
  const raw = split.color.trim();
  let toks: string[];
  if (raw.includes(',')) {
    toks = raw.split(',').map((t) => t.trim());
    if (toks.length === 4) {
      const a = parseAlphaToken(toks[3]);
      if (a == null) return null;
      toks = toks.slice(0, 3);
      return finishHsl(toks, Math.min(1, split.alpha * a));
    }
    if (toks.length !== 3) return null;
  } else {
    toks = raw.split(/\s+/).filter(Boolean);
    if (toks.length !== 3) return null;
  }
  return finishHsl(toks, split.alpha);
}

function finishHsl(toks: string[], alpha: number): RGB | null {
  const h = hueToDeg(toks[0]);
  const s = pct01(toks[1]);
  const l = pct01(toks[2]);
  if (h == null || s == null || l == null) return null;
  const [r, g, b] = hslToRgb(h, s, l);
  return { r, g, b, alpha };
}

function parseHwbArgs(body: string): RGB | null {
  const split = splitAlpha(body);
  if (!split) return null;
  const toks = split.color.trim().split(/\s+/).filter(Boolean);
  if (toks.length !== 3) return null;
  const h = hueToDeg(toks[0]);
  const w = pct01(toks[1]);
  const bk = pct01(toks[2]);
  if (h == null || w == null || bk == null) return null;
  if (w + bk >= 1) {
    const g = w / (w + bk);
    return { r: g, g, b: g, alpha: split.alpha };
  }
  const [r0, g0, b0] = hslToRgb(h, 1, 0.5);
  const r = r0 * (1 - w - bk) + w;
  const g = g0 * (1 - w - bk) + w;
  const b = b0 * (1 - w - bk) + w;
  return { r, g, b, alpha: split.alpha };
}
