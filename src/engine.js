/**
 * Motor de manuscrito Tinta Propia.
 * Extraído y adaptado de "Manuscrito Papernotes.html".
 * Dibuja el documento completo sobre canvas, sin depender del DOM de la interfaz.
 */

export const PAGE_SIZES = {
  a4: { w: 1240, h: 1754, mmW: 210, mmH: 297, label: "A4" },
  letter: { w: 1275, h: 1650, mmW: 215.9, mmH: 279.4, label: "Carta" },
  legal: { w: 1275, h: 2100, mmW: 215.9, mmH: 355.6, label: "Legal" },
  a5: { w: 874, h: 1240, mmW: 148, mmH: 210, label: "A5" },
  oficio: { w: 1275, h: 1950, mmW: 216, mmH: 330, label: "Oficio" },
};

export const MARGIN_PRESETS = {
  ninguno: { left: 4, right: 4, top: 4, bottom: 4, label: "Ninguno (0,1 cm)" },
  minimos: { left: 36, right: 32, top: 34, bottom: 32, label: "Muy pequeños" },
  pequenos: { left: 62, right: 54, top: 58, bottom: 56, label: "Pequeños" },
  normales: { left: 100, right: 78, top: 92, bottom: 86, label: "Normales" },
  amplios: { left: 140, right: 110, top: 120, bottom: 110, label: "Amplios" },
};

export const PAPER_COLORS = {
  cream: { value: "#fffdf6", label: "Crema" },
  white: { value: "#ffffff", label: "Blanco" },
  yellow: { value: "#fff9e6", label: "Amarillo" },
};

export const INKS = {
  blue: { value: "#17365d", label: "Azul" },
  black: { value: "#1d2530", label: "Negro" },
  red: { value: "#a52a2a", label: "Rojo" },
  pencil: { value: "#4a4f57", label: "Lápiz" },
  green: { value: "#2e6b4f", label: "Verde" },
};

export const FONTS = [
  { value: "MiLetra", label: "Mi letra (calibrada)" },
  { value: "Papernotes", label: "Papel clásico (incluida)" },
  { value: "Caveat", label: "Caveat" },
  { value: "Patrick Hand", label: "Patrick Hand" },
  { value: "Kalam", label: "Kalam" },
  { value: "Shadows Into Light", label: "Shadows Into Light" },
  { value: "Indie Flower", label: "Indie Flower" },
  { value: "Gochi Hand", label: "Gochi Hand" },
  { value: "Sue Ellen Francisco", label: "Sue Ellen Francisco" },
  { value: "Over the Rainbow", label: "Over the Rainbow" },
  { value: "Annie Use Your Telescope", label: "Annie Use Your Telescope" },
  { value: "Gloria Hallelujah", label: "Gloria Hallelujah" },
  { value: "Reenie Beanie", label: "Reenie Beanie" },
  { value: "Schoolbell", label: "Schoolbell" },
  { value: "Grape Nuts", label: "Grape Nuts" },
  { value: "Mynerve", label: "Mynerve" },
];

export const DEFAULT_SETTINGS = {
  font: "MiLetra",
  size: 26,
  leading: 1.32,
  tracking: 1.05,
  wordSpacing: 1.3,
  jitter: 0.8,
  realism: 24,
  pressure: 72,
  slant: 0.8,
  bleed: 0.2,
  seed: 1847,
  paper: "plain",
  paperColor: "white",
  ink: "blue",
  headingInk: "red",
  margins: "pequenos",
  pageSize: "a4",
  markdown: true,
  numberPages: true,
  mathEnabled: true,
  mathMode: "auto",
  mixFonts: false,
  mixStrength: 30,
  mixMode: "section",
  mixFont1: "Papernotes",
  mixFont2: "Caveat",
  mixFont3: "Kalam",
  layout: "normal",
  columnGuides: true,
};

export const PRESETS = {
  apunte: {
    label: "Apunte clásico",
    values: {
      ...DEFAULT_SETTINGS,
    },
  },
  natural: {
    label: "Natural",
    values: {
      font: "Papernotes",
      size: 27,
      leading: 1.42,
      jitter: 1.8,
      realism: 55,
      pressure: 65,
      slant: 0,
      bleed: 0.35,
      paper: "ruled",
      paperColor: "cream",
      ink: "blue",
      headingInk: "body",
      tracking: 1.05,
      wordSpacing: 1.3,
    },
  },
  rapido: {
    label: "Rápido",
    values: {
      font: "Caveat",
      size: 26,
      leading: 1.3,
      jitter: 2.5,
      realism: 78,
      pressure: 52,
      slant: -2,
      bleed: 0.55,
      paper: "ruled",
      paperColor: "white",
      ink: "blue",
      headingInk: "body",
      tracking: 1.05,
      wordSpacing: 1.3,
    },
  },
  cuidadoso: {
    label: "Cuidadoso",
    values: {
      font: "Papernotes",
      size: 28,
      leading: 1.52,
      jitter: 0.9,
      realism: 28,
      pressure: 78,
      slant: 0,
      bleed: 0.25,
      paper: "ruled",
      paperColor: "cream",
      ink: "blue",
      headingInk: "body",
      tracking: 1.05,
      wordSpacing: 1.3,
    },
  },
  desordenado: {
    label: "Desordenado",
    values: {
      font: "Gloria Hallelujah",
      size: 27,
      leading: 1.38,
      jitter: 3.2,
      realism: 92,
      pressure: 44,
      slant: 3,
      bleed: 0.65,
      paper: "plain",
      paperColor: "cream",
      ink: "black",
      headingInk: "body",
      tracking: 1.05,
      wordSpacing: 1.3,
    },
  },
};

const state = {
  settings: { ...DEFAULT_SETTINGS },
  page: { ...PAGE_SIZES.a4 },
  W: 1240,
  H: 1754,
  M: { left: 62, right: 54, top: 58, bottom: 56 },
  columns: 1,
  columnGap: 0,
  columnWidth: 1124,
  frame: { x: 62, width: 1124, top: 58, bottom: 1698, col: 0 },
  pages: [],
  images: new Map(),
  mermaid: new Map(),
  pendingMermaid: new Set(),
  mathImages: new Map(),
  mathTokens: new Map(),
  currentFont: "MiLetra",
  sectionFont: "MiLetra",
  sectionIndex: 0,
  lineIndex: 0,
  mathTokenSeq: 0,
  warnings: new Set(),
  rngState: 1847,
  mmW: 210,
  mmH: 297,
};

const num = (value, fallback) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function hashText(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickMixedFont(seed) {
  const base = state.settings.font || "Papernotes";
  if (!state.settings.mixFonts) return base;
  const strength = clamp(num(state.settings.mixStrength, 30) / 100, 0, 1);
  const roll = hashText(`${state.settings.seed}|${seed}|${base}`) / 4294967296;
  if (roll >= strength) return base;
  const pool = [
    state.settings.mixFont1,
    state.settings.mixFont2,
    state.settings.mixFont3,
  ].filter((family) => family && family !== base);
  if (!pool.length) return base;
  return pool[hashText(`${state.settings.seed}|${seed}|pick`) % pool.length];
}

function rand() {
  state.rngState =
    (Math.imul(state.rngState, 1664525) + 1013904223) >>> 0;
  return state.rngState / 4294967296;
}

function gauss() {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function seedRng(seed) {
  state.rngState = (seed >>> 0) || 1;
}

function realism() {
  return num(state.settings.realism, 24) / 100;
}
function pressure() {
  return num(state.settings.pressure, 72) / 100;
}
function tracking() {
  return num(state.settings.tracking, 1.05);
}
function wordSpacing() {
  return num(state.settings.wordSpacing, 1.3);
}
function bleed() {
  return num(state.settings.bleed, 0.2);
}
function paperColor() {
  return (PAPER_COLORS[state.settings.paperColor] || PAPER_COLORS.cream).value;
}
function inkColor() {
  return (INKS[state.settings.ink] || INKS.blue).value;
}
function headingColor() {
  const value = state.settings.headingInk;
  if (value === "body") return inkColor();
  return (INKS[value] || INKS.blue).value;
}
function lineStep() {
  return Math.round(num(state.settings.size, 26) * num(state.settings.leading, 1.32));
}

function applyMetrics() {
  const cfg = PAGE_SIZES[state.settings.pageSize] || PAGE_SIZES.a4;
  const landscape = state.settings.layout === "columns";
  const width = landscape ? cfg.h : cfg.w;
  const height = landscape ? cfg.w : cfg.h;
  state.page = { ...cfg, w: width, h: height };
  state.W = width;
  state.H = height;
  state.mmW = landscape ? cfg.mmH : cfg.mmW;
  state.mmH = landscape ? cfg.mmW : cfg.mmH;
  const preset = MARGIN_PRESETS[state.settings.margins] || MARGIN_PRESETS.pequenos;
  const scale = Math.min(width, height) / 1240;
  state.M = {
    left: Math.round(preset.left * scale),
    right: Math.round(preset.right * scale),
    top: Math.round(preset.top * scale),
    bottom: Math.round(preset.bottom * scale),
  };
  state.columns = landscape ? 3 : 1;
  state.columnGap = landscape ? Math.round(20 * scale) : 0;
  const usable = state.W - state.M.left - state.M.right;
  state.columnWidth = landscape
    ? (usable - state.columnGap * 2) / 3
    : usable;
  state.frame = {
    x: state.M.left,
    width: state.columnWidth,
    top: state.M.top,
    bottom: state.H - state.M.bottom,
    col: 0,
  };
}

function setColumnFrame(page, col) {
  const x =
    state.M.left + col * (state.columnWidth + state.columnGap);
  state.frame = {
    x,
    width: state.columnWidth,
    top: state.M.top,
    bottom: state.H - state.M.bottom,
    col,
  };
  page.col = col;
  page.y = state.M.top;
}

function newColumn(page) {
  if (state.columns <= 1) return newPage();
  if (page.col + 1 < state.columns) {
    setColumnFrame(page, page.col + 1);
    return page;
  }
  return newPage();
}

function drawPaper(ctx) {
  const { W, H, M } = state;
  ctx.fillStyle = paperColor();
  ctx.fillRect(0, 0, W, H);

  const step = lineStep();
  const paper = state.settings.paper;
  ctx.lineWidth = 1.1;

  if (paper === "ruled" || paper === "grid") {
    ctx.strokeStyle = "rgba(91,140,195,.20)";
    for (let y = M.top; y < H - M.bottom + step; y += step) {
      ctx.beginPath();
      ctx.moveTo(M.left - 18, y);
      ctx.lineTo(W - M.right, y);
      ctx.stroke();
    }
  }
  if (paper === "grid") {
    ctx.strokeStyle = "rgba(91,140,195,.14)";
    for (let x = M.left - 18; x < W - M.right; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, M.top);
      ctx.lineTo(x, H - M.bottom);
      ctx.stroke();
    }
  }
  if (paper === "dots") {
    ctx.fillStyle = "rgba(91,140,195,.30)";
    for (let y = M.top; y < H - M.bottom; y += step) {
      for (let x = M.left - 18; x < W - M.right; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  if (paper !== "plain") {
    ctx.strokeStyle = "rgba(190,80,70,.32)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(M.left - 34, M.top - 20);
    ctx.lineTo(M.left - 34, H - M.bottom + 10);
    ctx.stroke();
  }

  const grain = 0.35 + realism() * 0.65;
  for (let i = 0; i < 1100; i++) {
    ctx.fillStyle = `rgba(120,105,80,${rand() * 0.018 * grain})`;
    ctx.fillRect(rand() * W, rand() * H, 1, 1);
  }

  if (state.columns > 1 && state.settings.columnGuides !== false) {
    ctx.save();
    ctx.strokeStyle = "rgba(58,80,110,.60)";
    ctx.lineWidth = Math.max(2.4, Math.round(3 * (W / 1754) * 10) / 10);
    ctx.setLineDash([9, 8]);
    for (let col = 1; col < state.columns; col++) {
      const x = M.left + col * (state.columnWidth + state.columnGap) - state.columnGap / 2;
      ctx.beginPath();
      ctx.moveTo(x, Math.max(0, M.top - 12));
      ctx.lineTo(x, Math.min(H, H - M.bottom + 12));
      ctx.stroke();
    }
    ctx.restore();
  }
}

function newPage() {
  const canvas = document.createElement("canvas");
  canvas.width = state.W;
  canvas.height = state.H;
  const ctx = canvas.getContext("2d");
  drawPaper(ctx);
  const page = { canvas, ctx, y: state.M.top, col: 0 };
  state.pages.push(page);
  setColumnFrame(page, 0);
  return page;
}

function font(size, bold) {
  const family = state.currentFont || state.settings.font || "Papernotes";
  const weight = bold && family !== "MiLetra" ? "700 " : "400 ";
  return `${weight}${size}px "${family}", cursive`;
}

function monoFont(size) {
  return `${Math.round(size)}px "Courier New", "DejaVu Sans Mono", monospace`;
}

export function cleanText(source) {
  const codes = [];
  let s = String(source ?? "");
  s = s.replace(/`([^`]+)`/g, (_, code) => {
    codes.push(code);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = s
    .replace(/!\[\[([^\]]+)\]\]/g, "[imagen: $1]")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, (_, alt) => (alt ? `[imagen: ${alt}]` : ""))
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/==([^=]+)==/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|[\s(])\*([^\s*][^*\n]*?)\*(?=[\s).,;:!?]|$)/g, "$1$2")
    .replace(/(^|[\s(])_([^\s_][^_\n]*?)_(?=[\s).,;:!?]|$)/g, "$1$2")
    .replace(/\\([\\`*_{}\[\]()#+\-.!|>])/g, "$1")
    .replace(/\[\^[^\]]+\]/g, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[a-zA-Z][^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[→←↔]/g, (m) => (m === "→" ? "->" : m === "←" ? "<-" : "<->"))
    .replace(/[—–]/g, "-")
    .replace(/…/g, "...");
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[+i]);
}

function cleanCode(source) {
  return String(source ?? "")
    .replace(/[→←↔]/g, (m) => (m === "→" ? "->" : m === "←" ? "<-" : "<->"))
    .replace(/[—–]/g, "-")
    .replace(/…/g, "...");
}

const MATH_TOKEN_RE = /\u0001\d+\u0001/;

function parseMathWord(word) {
  const match = word.match(/^(.*?)\u0001(\d+)\u0001(.*)$/);
  if (!match) return null;
  const entry = state.mathTokens.get(Number(match[2]));
  if (!entry) return null;
  return { prefix: match[1] || "", suffix: match[3] || "", entry };
}

function mathWordWidth(ctx, word, size) {
  const parsed = parseMathWord(word);
  if (!parsed) return ctx.measureText(word).width;
  return (
    ctx.measureText(parsed.prefix).width +
    parsed.entry.widthEm * size +
    ctx.measureText(parsed.suffix).width
  );
}

function lineMathExtents(text, size) {
  let above = 0;
  let below = 0;
  for (const word of text.split(/ +/)) {
    const math = parseMathWord(word);
    if (!math) continue;
    above = Math.max(above, math.entry.baselineEm * size);
    below = Math.max(below, (math.entry.heightEm - math.entry.baselineEm) * size);
  }
  return { above, below };
}

function injectInlineMath(text) {
  if (!state.settings.mathEnabled || !state.mathImages.size) return text;
  const addToken = (code) => {
    const entry = state.mathImages.get(`I:${code.trim()}`);
    if (!entry) return null;
    const id = ++state.mathTokenSeq;
    state.mathTokens.set(id, entry);
    return `\u0001${id}\u0001`;
  };

  let result = text.replace(/(^|[^\\])\$([^$\n]+)\$/g, (match, prefix, code) => {
    const token = addToken(code);
    return token ? `${prefix}${token}` : match;
  });
  result = result.replace(/(^|[^\\])\\(([^)\n]+)\\)/g, (match, prefix, code) => {
    const token = addToken(code);
    return token ? `${prefix}${token}` : match;
  });
  return result;
}

function measureLine(ctx, text, size, bold) {
  const family = state.currentFont || state.settings.font || "Papernotes";
  ctx.font = font(size, bold);
  const words = text.split(/ +/).filter(Boolean);
  let width = 0;
  for (let i = 0; i < words.length; i++) {
    width += mathWordWidth(ctx, words[i], size);
    if (i < words.length - 1) {
      const gap = Math.max(ctx.measureText(" ").width, size * 0.38) * wordSpacing();
      width += family === "MiLetra" ? gap : gap * tracking() * 1.45;
    }
  }
  return width;
}

function wrap(ctx, text, maxWidth, size, bold) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  const pushLine = () => {
    if (line) {
      lines.push(line);
      line = "";
    }
  };
  for (const word of words) {
    ctx.font = font(size, bold);
    const math = parseMathWord(word);
    if (math) {
      const mathWidth = mathWordWidth(ctx, word, size);
      if (mathWidth > maxWidth && line) {
        lines.push(line);
        line = "";
      }
      const testMath = line ? `${line} ${word}` : word;
      if (!line || measureLine(ctx, testMath, size, bold) <= maxWidth) {
        line = testMath;
      } else {
        lines.push(line);
        line = word;
      }
      continue;
    }
    if (measureLine(ctx, word, size, bold) > maxWidth) {
      pushLine();
      let chunk = "";
      for (const char of word) {
        const test = chunk + char;
        if (measureLine(ctx, test, size, bold) > maxWidth && chunk) {
          lines.push(chunk);
          chunk = char;
        } else {
          chunk = test;
        }
      }
      if (chunk) line = chunk;
      continue;
    }
    const test = line ? `${line} ${word}` : word;
    if (measureLine(ctx, test, size, bold) <= maxWidth || !line) {
      line = test;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (!lines.length) lines.push("");
  return lines;
}

function drawWordLine(ctx, text, x, y, size, bold, lineColor) {
  ctx.fillStyle = lineColor;
  ctx.font = font(size, bold);
  ctx.textBaseline = "alphabetic";
  const r = realism();
  const press = pressure();
  const inkAlpha = 0.72 + press * 0.28;
  const lineDrift = gauss() * r * 1.4;
  const lineTilt = gauss() * r * 0.0012;
  const words = text.split(/ +/);
  let cx = x + gauss() * r * 2.2;
  for (let wi = 0; wi < words.length; wi++) {
    const word = words[wi];
    if (!word) continue;
    const math = parseMathWord(word);
    const wordRot =
      (gauss() * r * 0.55 * Math.PI) / 180 +
      ((num(state.settings.slant, 0) || 0) * Math.PI) / 180;
    const wordDy = gauss() * r * 1.0;
    const wordScaleX = 1 + gauss() * r * 0.008;
    const wordScaleY = 1 + gauss() * r * 0.007;
    const alpha = clamp(inkAlpha * (0.94 + rand() * 0.06), 0.45, 1);

    if (math) {
      const entry = math.entry;
      const prefixW = ctx.measureText(math.prefix).width;
      const suffixW = ctx.measureText(math.suffix).width;
      const mw = entry.widthEm * size;
      const mh = entry.heightEm * size;
      const mbase = entry.baselineEm * size;
      ctx.save();
      ctx.translate(cx, y + lineDrift + wordDy + (cx - x) * lineTilt);
      ctx.rotate(wordRot);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = lineColor;
      ctx.font = font(size, bold);
      if (math.prefix) ctx.fillText(math.prefix, 0, 0);
      ctx.drawImage(entry.img, prefixW, -mbase, mw, mh);
      if (math.suffix) ctx.fillText(math.suffix, prefixW + mw, 0);
      ctx.restore();
      cx += prefixW + mw + suffixW + Math.max(ctx.measureText(" ").width, size * 0.38) * wordSpacing();
      continue;
    }

    const w = ctx.measureText(word).width;
    ctx.save();
    ctx.translate(cx, y + lineDrift + wordDy + (cx - x) * lineTilt);
    ctx.rotate(wordRot);
    ctx.scale(wordScaleX, wordScaleY);
    ctx.globalAlpha = alpha;
    if (bleed() > 0.01) {
      ctx.shadowColor = lineColor;
      ctx.shadowBlur = bleed() * 0.55;
    }
    ctx.fillText(word, 0, 0);
    ctx.restore();
    cx += w + Math.max(ctx.measureText(" ").width, size * 0.38) * wordSpacing();
  }
}

function drawLine(ctx, text, x, y, size, bold) {
  const family = state.currentFont || state.settings.font || "Papernotes";
  const lineColor = bold ? headingColor() : inkColor();
  if (family === "MiLetra" || MATH_TOKEN_RE.test(text)) {
    drawWordLine(ctx, text, x, y, size, bold, lineColor);
    return;
  }
  ctx.fillStyle = lineColor;
  ctx.font = font(size, bold);
  ctx.textBaseline = "alphabetic";
  const jitter = num(state.settings.jitter, 0.8);
  const baseR = realism();
  const r = bold ? baseR * 0.55 : baseR;
  const lineCare = 0.65 + rand() * 0.7;
  const rr = clamp(r * lineCare, 0, 1.3);
  const slantDeg = num(state.settings.slant, 0) || 0;
  const globalSlant = (slantDeg * Math.PI) / 180;
  const lineStart = gauss() * rr * 2.8;
  const lineDrift = gauss() * rr * 1.6;
  const lineTilt = gauss() * rr * 0.0016;
  const press = pressure();
  const inkAlpha = 0.72 + press * 0.28;
  const soft = bleed();
  const words = text.split(/ +/);
  let cx = x + lineStart;

  for (let wi = 0; wi < words.length; wi++) {
    const word = words[wi];
    if (wi > 0) {
      const sw = ctx.measureText(" ").width;
      cx += sw * tracking() * wordSpacing() * (1.3 + rand() * 0.35 * rr + (1 - press) * 0.06);
    }
    if (!word) continue;
    const wordDy = gauss() * rr * 1.15;
    const wordRot = (gauss() * rr * 0.55 * Math.PI) / 180;
    const wordScale = 1 + gauss() * rr * 0.009;
    const wordSlant = gauss() * rr * 0.0012;
    const chars = Array.from(word);

    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      ctx.font = font(size, bold);
      const w = ctx.measureText(ch).width;
      const prog = chars.length > 1 ? i / (chars.length - 1) : 0.5;
      const wave = Math.sin(prog * Math.PI * 2 + wi * 0.7 + rand() * 0.2) * rr * 0.8;
      const tremor = gauss() * (0.12 + rr * 0.22);
      const pressureCurve = 0.9 + 0.1 * Math.sin(prog * Math.PI) + (rand() * 2 - 1) * 0.05;
      const alpha = clamp(inkAlpha * pressureCurve * (0.93 + rand() * 0.07), 0.45, 1);
      const rot = wordRot + (gauss() * (jitter * 0.7 + rr * 1.5) * Math.PI) / 180;
      const dx = gauss() * (jitter * 0.35 + rr * 0.55);
      const dy =
        lineDrift + wordDy + wave + tremor + (cx - x) * lineTilt + (cx - x) * wordSlant;
      const sx = wordScale * (1 + gauss() * (0.016 + rr * 0.022));
      const sy = wordScale * (1 + gauss() * (0.018 + rr * 0.02));
      ctx.save();
      ctx.translate(cx + dx, y + dy);
      ctx.rotate(rot + globalSlant);
      ctx.scale(sx, sy);
      ctx.globalAlpha = alpha;
      if (soft > 0.01) {
        ctx.shadowColor = lineColor;
        ctx.shadowBlur = soft * (0.6 + rand() * 0.5);
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
      ctx.fillText(ch, 0, 0);
      if (rr > 0.2 && rand() < 0.1 * rr) {
        ctx.globalAlpha = alpha * (0.1 + rand() * 0.1);
        ctx.fillText(ch, 0.35, 0.45);
      }
      if (/[.,;:!?]/.test(ch) && rr > 0.15) {
        ctx.globalAlpha = clamp(alpha + 0.12, 0, 1);
        ctx.fillText(ch, 0.18, 0.18);
      }
      ctx.restore();
      cx += w * (bold ? 1.02 : tracking()) * (0.992 + gauss() * 0.012 * rr);
    }
  }
}

function drawMathBlock(page, entry, baseSize) {
  const maxWidth = state.frame.width;
  const maxHeight = state.frame.bottom - state.frame.top - baseSize;
  let size = baseSize * 1.08;
  let width = entry.widthEm * size;
  let height = entry.heightEm * size;
  const scale = Math.min(1, maxWidth / Math.max(1, width), maxHeight / Math.max(1, height));
  width *= scale;
  height *= scale;

  if (page.y + height + baseSize * 0.6 > state.frame.bottom && page.y > state.frame.top + 1) {
    page = newColumn(page);
  }
  const x = state.frame.x + Math.max(0, (maxWidth - width) / 2);
  page.ctx.save();
  page.ctx.drawImage(entry.img, x, page.y, width, height);
  page.ctx.restore();
  page.y += height + baseSize * 0.75;
  return page;
}

function newPageIfNeeded(page, needed) {
  if (page.y + needed > state.frame.bottom) {
    return newColumn(page);
  }
  return page;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

/**
 * Reconoce un token de imagen, con colon o barras y sin distinguir mayúsculas.
 * Ejemplos: `[[IMG:1]]`, `[[IMG:1|right|Pie]]`, `[[img | 1 | 60% | Pie]]`.
 */
export function parseImageLine(line) {
  const match = String(line || "")
    .trim()
    .match(/^\[\[\s*img\s*[:|]\s*(\d+)(?:\s*\|([^\]]*))?\s*\]\]$/i);
  if (!match) return null;
  return { id: Number(match[1]), raw: match[2] || "" };
}

/**
 * Interpreta las opciones de un token de imagen.
 *
 * Formatos admitidos:
 *   [[IMG:1]]                         imagen normal
 *   [[IMG:1|Pie]]                     imagen normal con pie
 *   [[IMG:1|right|Pie]]               imagen a la derecha
 *   [[IMG:1|left|40%|Pie]]            imagen a la izquierda, 40 %
 *   [[IMG:1|width=60%|side=right]]    formato explícito
 */
export function parseImageTokenOptions(raw = "") {
  let width = null;
  let side = "full";
  let caption = "";
  const parts = String(raw).split("|");
  for (const part of parts) {
    const value = part.trim();
    if (!value) continue;
    if (/^(width|ancho)\s*=/i.test(value)) {
      const parsed = value.replace(/^(width|ancho)\s*=\s*/i, "").replace("%", "");
      const number = Number.parseFloat(parsed);
      if (Number.isFinite(number)) {
        width = number > 1 ? number / 100 : number;
        width = clamp(width, 0.15, 1);
      }
      continue;
    }
    if (/^(side|lado)\s*=/i.test(value)) {
      const parsed = value.replace(/^(side|lado)\s*=\s*/i, "").toLowerCase();
      side = parsed === "left" || parsed === "izquierda"
        ? "left"
        : parsed === "right" || parsed === "derecha"
          ? "right"
          : "full";
      continue;
    }
    if (/^(left|right|full|center|izquierda|derecha|completo)$/i.test(value)) {
      const parsed = value.toLowerCase();
      side = parsed === "left" || parsed === "izquierda"
        ? "left"
        : parsed === "right" || parsed === "derecha"
          ? "right"
          : "full";
      continue;
    }
    if (/^\d+(?:\.\d+)?%?$/.test(value) || /^\.\d+%?$/.test(value)) {
      const number = Number.parseFloat(value.replace("%", ""));
      if (Number.isFinite(number)) {
        width = number > 1 ? number / 100 : number;
        width = clamp(width, 0.15, 1);
      }
      continue;
    }
    caption = caption ? `${caption} | ${value}` : value;
  }
  if (width == null && (side === "left" || side === "right")) width = 0.45;
  return { width, side, caption };
}

/** Escala una imagen dentro de un ancho y alto máximos. */
function fitImage(entry, maxWidth, maxHeight, requestedWidth = null) {
  const img = entry.img;
  const natural = entry.displayW || img.width || 1;
  let width = requestedWidth ? maxWidth * requestedWidth : Math.min(maxWidth, natural);
  let height = (width * img.height) / img.width;
  if (height > maxHeight) {
    height = maxHeight;
    width = (height * img.width) / img.height;
  }
  return { width, height };
}

function drawImageEntry(page, entry, caption, options = {}) {
  const maxWidth = state.frame.width;
  const maxHeight = state.frame.bottom - state.frame.top - 20;
  if (!entry || !entry.img) {
    state.warnings.add("Hay una imagen que no se pudo cargar.");
    drawMissingBox(page, "Imagen no encontrada", "Inserta de nuevo la imagen o revisa el token.");
    return page;
  }
  const { width: requestedWidth = null, side = "full" } = options;
  const { width, height } = fitImage(entry, maxWidth, maxHeight, requestedWidth);
  if (page.y + height + 20 > state.frame.bottom) {
    page = newColumn(page);
  }
  const x = state.frame.x + Math.max(0, (maxWidth - width) / 2);
  page.ctx.drawImage(entry.img, x, page.y, width, height);
  page.y += height + 16;
  if (caption) {
    drawLine(page.ctx, cleanText(caption), state.frame.x, page.y + 22, 20, false);
    page.y += 34;
  }
  page.y += 12;
  return page;
}

/**
 * Dibuja una imagen flotante con texto al otro lado.
 * El texto se toma de las líneas entre el token y `[[/IMG]]`.
 */
function drawSideImage(page, entry, textLines, options, baseSize, lead) {
  const gap = Math.max(14, Math.round(baseSize * 0.7));
  const ratio = clamp(options.width ?? 0.45, 0.2, 0.7);
  const imageWidth = Math.round(state.frame.width * ratio);
  const textWidth = state.frame.width - imageWidth - gap;
  const maxHeight = state.frame.bottom - state.frame.top - baseSize * 2;
  const { width, height } = fitImage(entry, imageWidth, maxHeight, 1);
  const caption = cleanText(options.caption || "");
  const captionLines = caption
    ? wrap(page.ctx, caption, width * 0.96, 16, false)
    : [];
  const captionHeight = captionLines.length ? captionLines.length * 21 + 6 : 0;
  const blockHeight = height + 10 + captionHeight;
  if (page.y + blockHeight > state.frame.bottom && page.y > state.frame.top + 1) {
    page = newColumn(page);
  }

  const imageX =
    options.side === "left"
      ? state.frame.x
      : state.frame.x + state.frame.width - width;
  page.ctx.drawImage(entry.img, imageX, page.y, width, height);
  let imageBottom = page.y + height;
  if (captionLines.length) {
    page.ctx.save();
    page.ctx.fillStyle = "rgba(45,65,90,.78)";
    page.ctx.font = font(16, false);
    page.ctx.textAlign = "left";
    page.ctx.textBaseline = "alphabetic";
    captionLines.forEach((line, index) => {
      page.ctx.fillText(line, imageX, imageBottom + 20 + index * 21);
    });
    page.ctx.restore();
    imageBottom += captionHeight;
  }

  const textX =
    options.side === "left" ? state.frame.x + width + gap : state.frame.x;
  const fs = Math.round(baseSize * 0.92);
  const lh = fs * lead;
  let textY = page.y;
  const availableBottom = state.frame.bottom;
  let truncated = false;
  for (const rawLine of textLines) {
    const value = rawLine.trim();
    if (!value) {
      textY += lh * 0.5;
      continue;
    }
    const content = cleanText(injectInlineMath(value));
    const lines = wrap(page.ctx, content, textWidth * 0.96, fs, false);
    for (const line of lines) {
      if (textY + lh > availableBottom) {
        truncated = true;
        break;
      }
      drawLine(page.ctx, line, textX, textY + fs * 0.82, fs, false);
      textY += lh;
    }
    if (truncated) break;
  }
  if (truncated) {
    state.warnings.add("El texto junto a una imagen es demasiado largo y se cortó.");
  }

  page.y =
    Math.max(imageBottom, textY) + baseSize * 0.65;
  return page;
}

function drawPlaceholderBox(page, title, detail, tone = "error") {
  const maxWidth = state.frame.width;
  const height = 108;
  if (page.y + height > state.frame.bottom) page = newColumn(page);
  const x = state.frame.x;
  const y = page.y;
  const accent =
    tone === "pending" ? "rgba(29,111,220,.5)" : "rgba(165,42,42,.45)";
  const fill =
    tone === "pending" ? "rgba(29,111,220,.035)" : "rgba(165,42,42,.035)";
  page.ctx.save();
  page.ctx.fillStyle = fill;
  page.ctx.strokeStyle = accent;
  page.ctx.setLineDash([7, 5]);
  page.ctx.lineWidth = 1.4;
  roundedRect(page.ctx, x, y, maxWidth, height, 10);
  page.ctx.fill();
  page.ctx.stroke();
  page.ctx.setLineDash([]);
  page.ctx.fillStyle = tone === "pending" ? inkColor() : headingColor();
  page.ctx.font = font(18, true);
  page.ctx.fillText(title, x + 18, y + 32);
  page.ctx.fillStyle = "rgba(80,95,115,.9)";
  page.ctx.font = "13px system-ui, sans-serif";
  page.ctx.fillText(detail, x + 18, y + 58);
  page.ctx.restore();
  page.y = y + height + 18;
  return page;
}

function drawMissingBox(page, title, detail) {
  return drawPlaceholderBox(page, title, detail, "error");
}

function drawPendingBox(page) {
  return drawPlaceholderBox(
    page,
    "Diagrama en preparación",
    "Se dibujará automáticamente en segundo plano.",
    "pending"
  );
}

function roundedRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function calloutStyle(type) {
  const red = ["IMPORTANT", "WARNING", "CAUTION"].includes(type);
  const labels = {
    NOTE: "NOTA",
    TIP: "TIP",
    IMPORTANT: "IMPORTANTE",
    WARNING: "ATENCIÓN",
    CAUTION: "CUIDADO",
    EXAMPLE: "EJEMPLO",
  };
  return {
    label: labels[type] || "NOTA",
    border: red ? "rgba(165,42,42,.65)" : "rgba(23,54,93,.55)",
    fill: red ? "rgba(165,42,42,.045)" : "rgba(23,54,93,.035)",
    ink: red ? headingColor() : inkColor(),
  };
}

function drawCallout(page, type, customTitle, content, baseSize, lead, maxWidth) {
  const style = calloutStyle(type);
  const label = (customTitle || style.label).slice(0, 48);
  const padX = 18;
  const padY = 14;
  const labelH = 22;
  const boxW = maxWidth;
  const textW = boxW - padX * 2;
  const fs = Math.round(baseSize * 0.9);
  const lh = fs * lead;
  const items = [];
  for (const raw of content) {
    if (!raw.trim()) {
      items.push({ blank: true });
      continue;
    }
    let text = raw;
    let indent = 0;
    if (/^[-*]\s+/.test(text)) {
      text = `- ${text.replace(/^[-*]\s+/, "")}`;
      indent = baseSize * 0.35;
    } else if (/^\d+\.\s+/.test(text)) {
      indent = baseSize * 0.35;
    }
    text = cleanText(injectInlineMath(text));
    const lines = wrap(page.ctx, text, (textW - indent) * 0.94, fs, false);
    for (const line of lines) items.push({ text: line, indent });
  }
  if (!items.length) items.push({ text: "", indent: 0 });
  const itemH = (it) => (it.blank ? lh * 0.45 : lh);
  const maxContentH = state.frame.bottom - state.frame.top - padY * 2 - labelH - baseSize * 0.5;
  const chunks = [];
  let current = [];
  let curH = 0;
  for (const item of items) {
    const h = itemH(item);
    if (curH + h > maxContentH && current.length) {
      chunks.push(current);
      current = [];
      curH = 0;
    }
    current.push(item);
    curH += h;
  }
  if (current.length) chunks.push(current);
  if (!chunks.length) chunks.push([]);

  chunks.forEach((chunk, ci) => {
    const chunkH = chunk.reduce((a, it) => a + itemH(it), 0);
    const boxH = padY * 2 + labelH + chunkH;
    if (page.y + boxH > state.frame.bottom && page.y > state.frame.top + 1) page = newColumn(page);
    const x = state.frame.x;
    const y = page.y;
    page.ctx.save();
    page.ctx.fillStyle = style.fill;
    page.ctx.strokeStyle = style.border;
    page.ctx.lineWidth = 1.5;
    roundedRect(page.ctx, x, y, boxW, boxH, 8);
    page.ctx.fill();
    page.ctx.stroke();
    page.ctx.restore();

    page.ctx.save();
    page.ctx.font = font(15, true);
    page.ctx.fillStyle = style.ink;
    page.ctx.globalAlpha = 0.85;
    page.ctx.fillText(ci === 0 ? label : `${label} (cont.)`, x + padX, y + padY + 12);
    page.ctx.restore();

    let cy = y + padY + labelH;
    for (const item of chunk) {
      if (item.blank) {
        cy += lh * 0.45;
        continue;
      }
      drawLine(page.ctx, item.text, x + padX + item.indent, cy + fs * 0.82, fs, false);
      cy += lh;
    }
    page.y = y + boxH + baseSize * 0.5;
  });
  return page;
}

function isTableSeparator(line) {
  const t = line.trim();
  return t.includes("|") && /^[\s|:-]+$/.test(t) && t.includes("-");
}

function parseTableCells(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((cell) => cleanText(cell.trim()));
}

function drawTable(page, header, rows, baseSize, lead, maxWidth) {
  const n = Math.max(1, header.length);
  const fs = Math.round(baseSize * 0.74);
  const lh = fs * lead;
  const padX = 8;
  const padY = 6;
  const measure = (txt, size) => {
    page.ctx.save();
    page.ctx.font = font(size, false);
    const width = page.ctx.measureText(txt).width;
    page.ctx.restore();
    return width;
  };
  const minW = [];
  const prefLen = [];
  for (let i = 0; i < n; i++) {
    let maxWord = 0;
    let maxLen = 6;
    const headCell = header[i] || "";
    maxLen = Math.max(maxLen, headCell.length);
    for (const word of headCell.split(/\s+/).filter(Boolean)) {
      maxWord = Math.max(maxWord, measure(word, fs + 1));
    }
    for (const row of rows) {
      const cell = row[i] || "";
      maxLen = Math.max(maxLen, cell.length);
      for (const word of cell.split(/\s+/).filter(Boolean)) {
        maxWord = Math.max(maxWord, measure(word, fs));
      }
    }
    minW[i] = maxWord + padX * 2 + 4;
    prefLen[i] = Math.min(40, maxLen);
  }
  const totalMin = minW.reduce((a, b) => a + b, 0);
  const totalLen = prefLen.reduce((a, b) => a + b, 0) || 1;
  let colW;
  if (totalMin <= maxWidth) {
    const extra = maxWidth - totalMin;
    colW = minW.map((w, i) => w + extra * (prefLen[i] / totalLen));
  } else {
    colW = minW.map((w) => (maxWidth * w) / totalMin);
  }
  const wrapCell = (text, width, size, bold) => {
    const lines = wrap(page.ctx, text, width, size, bold);
    const out = [];
    for (const line of lines) {
      page.ctx.save();
      page.ctx.font = font(size, bold);
      if (measureLine(page.ctx, line, size, bold) <= width) {
        out.push(line);
        page.ctx.restore();
        continue;
      }
      let chunk = "";
      for (const char of line) {
        const test = chunk + char;
        if (measureLine(page.ctx, test, size, bold) > width && chunk) {
          out.push(chunk);
          chunk = char;
        } else {
          chunk = test;
        }
      }
      if (chunk) out.push(chunk);
      page.ctx.restore();
    }
    return out.length ? out : [""];
  };
  const wrapRow = (cells, isHeader) => {
    const wrapped = [];
    for (let i = 0; i < n; i++) {
      const txt = cells[i] || "";
      const lines = wrapCell(
        txt,
        Math.max(20, colW[i] - padX * 2) * 0.96,
        isHeader ? fs + 1 : fs,
        isHeader
      );
      wrapped.push(lines);
    }
    const h = Math.max(1, ...wrapped.map((l) => l.length)) * lh + padY * 2;
    return { wrapped, h };
  };
  const head = wrapRow(header, true);
  const body = rows.map((r) => wrapRow(r, false));
  const headH = head.h;
  const maxRowH = state.frame.bottom - state.frame.top - headH - baseSize * 2;

  const drawChunk = (chunk) => {
    const totalH = headH + chunk.reduce((a, r) => a + r.h, 0);
    if (page.y + totalH > state.frame.bottom && page.y > state.frame.top + 1) {
      page = newColumn(page);
    }
    const x = state.frame.x;
    const y = page.y;
    let cy = y;

    page.ctx.save();
    page.ctx.fillStyle = "rgba(23,54,93,.05)";
    page.ctx.fillRect(x, y, maxWidth, headH);
    page.ctx.restore();

    let cx = x;
    for (let i = 0; i < n; i++) {
      page.ctx.save();
      page.ctx.font = font(fs + 1, true);
      page.ctx.fillStyle = headingColor();
      page.ctx.globalAlpha = 0.9;
      let ty = y + padY + (fs + 1) * 0.82;
      for (const line of head.wrapped[i]) {
        page.ctx.fillText(line, cx + padX, ty);
        ty += lh;
      }
      page.ctx.restore();
      cx += colW[i];
    }
    cy += headH;

    for (const row of chunk) {
      cx = x;
      for (let i = 0; i < n; i++) {
        page.ctx.save();
        page.ctx.font = font(fs, false);
        page.ctx.fillStyle = inkColor();
        page.ctx.globalAlpha = 0.9;
        let ty = cy + padY + fs * 0.82;
        for (const line of row.wrapped[i]) {
          page.ctx.fillText(line, cx + padX, ty);
          ty += lh;
        }
        page.ctx.restore();
        cx += colW[i];
      }
      cy += row.h;
    }

    page.ctx.save();
    page.ctx.strokeStyle = "rgba(80,100,130,.30)";
    page.ctx.lineWidth = 1;
    let hy = y;
    page.ctx.beginPath();
    page.ctx.moveTo(x, hy);
    page.ctx.lineTo(x + maxWidth, hy);
    page.ctx.stroke();
    hy += headH;
    page.ctx.beginPath();
    page.ctx.moveTo(x, hy);
    page.ctx.lineTo(x + maxWidth, hy);
    page.ctx.stroke();
    for (const row of chunk) {
      hy += row.h;
      page.ctx.beginPath();
      page.ctx.moveTo(x, hy);
      page.ctx.lineTo(x + maxWidth, hy);
      page.ctx.stroke();
    }
    page.ctx.strokeStyle = "rgba(80,100,130,.22)";
    let vx = x;
    for (let i = 0; i <= n; i++) {
      page.ctx.beginPath();
      page.ctx.moveTo(vx, y);
      page.ctx.lineTo(vx, cy);
      page.ctx.stroke();
      if (i < n) vx += colW[i];
    }
    page.ctx.restore();
    page.y = cy + baseSize * 0.6;
  };

  let chunk = [];
  let chunkH = 0;
  for (const row of body) {
    if (chunkH + row.h > maxRowH && chunk.length) {
      drawChunk(chunk);
      chunk = [];
      chunkH = 0;
    }
    chunk.push(row);
    chunkH += row.h;
  }
  if (chunk.length || !body.length) drawChunk(chunk);
  return page;
}

function codeLabel(lang) {
  const map = {
    py: "PYTHON",
    python: "PYTHON",
    js: "JAVASCRIPT",
    javascript: "JAVASCRIPT",
    c: "C",
    asm: "ASM",
    yaml: "YAML",
    yml: "YAML",
    html: "HTML",
    bash: "BASH",
    sh: "BASH",
    text: "TEXTO",
    txt: "TEXTO",
    rust: "RUST",
    sql: "SQL",
    json: "JSON",
    mermaid: "MERMAID",
  };
  return map[lang] || (lang ? lang.toUpperCase() : "CÓDIGO");
}

function drawCodeBlock(page, lang, lines, baseSize, lead, maxWidth) {
  const padX = 14;
  const padY = 12;
  const labelH = 20;
  const boxW = maxWidth;
  const fs = Math.round(baseSize * 0.8);
  const lh = fs * lead;
  const maxCodeW = boxW - padX * 2;
  const out = [];
  for (const raw of lines) {
    const text = cleanCode(raw.replace(/\s+$/, ""));
    if (!text.length) {
      out.push("");
      continue;
    }
    let rest = text;
    while (rest.length) {
      page.ctx.save();
      page.ctx.font = monoFont(fs);
      let cut = rest.length;
      while (cut > 0 && page.ctx.measureText(rest.slice(0, cut)).width > maxCodeW) cut--;
      page.ctx.restore();
      if (cut <= 0) cut = 1;
      out.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
  }
  if (!out.length) out.push("");
  const maxContentH = state.frame.bottom - state.frame.top - padY * 2 - labelH - baseSize * 0.5;
  const chunks = [];
  let cur = [];
  let curH = 0;
  for (const line of out) {
    if (curH + lh > maxContentH && cur.length) {
      chunks.push(cur);
      cur = [];
      curH = 0;
    }
    cur.push(line);
    curH += lh;
  }
  if (cur.length) chunks.push(cur);
  if (!chunks.length) chunks.push([]);
  const label = codeLabel(lang);
  chunks.forEach((chunk, ci) => {
    const boxH = padY * 2 + labelH + chunk.length * lh;
    if (page.y + boxH > state.frame.bottom && page.y > state.frame.top + 1) page = newColumn(page);
    const x = state.frame.x;
    const y = page.y;
    page.ctx.save();
    page.ctx.fillStyle = "rgba(18,53,91,.035)";
    page.ctx.strokeStyle = "rgba(18,53,91,.20)";
    page.ctx.lineWidth = 1;
    roundedRect(page.ctx, x, y, boxW, boxH, 8);
    page.ctx.fill();
    page.ctx.stroke();
    page.ctx.restore();

    page.ctx.save();
    page.ctx.font = monoFont(11);
    page.ctx.fillStyle = "rgba(18,53,91,.62)";
    page.ctx.fillText(ci === 0 ? label : `${label} (cont.)`, x + padX, y + padY + 10);
    page.ctx.restore();

    page.ctx.save();
    page.ctx.font = monoFont(fs);
    page.ctx.fillStyle = inkColor();
    let cy = y + padY + labelH;
    for (const line of chunk) {
      page.ctx.fillText(line, x + padX, cy + fs * 0.82);
      cy += lh;
    }
    page.ctx.restore();
    page.y = y + boxH + baseSize * 0.6;
  });
  return page;
}

function layoutPass(markdown, { prepass, toc }) {
  state.pages = [];
  state.mathTokens = new Map();
  state.mathTokenSeq = 0;
  state.currentFont = state.settings.font || "Papernotes";
  state.sectionFont = state.currentFont;
  state.sectionIndex = 0;
  state.lineIndex = 0;
  state.sectionFont = pickMixedFont(0);
  seedRng(num(state.settings.seed, 1847));
  applyMetrics();

  const baseSize = num(state.settings.size, 26);
  const lead = num(state.settings.leading, 1.32);
  const useMd = state.settings.markdown !== false;
  const maxW = state.columnWidth;
  const drawNumbers = state.settings.numberPages !== false && !prepass;
  const tocPages = toc || null;

  let page = newPage();
  let raw = String(markdown ?? "");

  if (useMd) {
    raw = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
    raw = raw.replace(/<!--[\s\S]*?-->/g, "");
  }

  const srcLines = raw.split(/\r?\n/);
  let inCode = false;

  for (let li = 0; li < srcLines.length; li++) {
    const rawLine = srcLines[li];
    const line = rawLine.replace(/\s+$/, "");
    if (!line.trim()) {
      page.y += baseSize * lead * (inCode ? 0.35 : 0.55);
      continue;
    }

    state.currentFont =
      state.settings.mixFonts && state.settings.mixMode === "line"
        ? pickMixedFont(++state.lineIndex)
        : state.sectionFont;

    if (useMd && line.trim().startsWith("```")) {
      const info = line.trim().slice(3).trim();
      const lang = info.split(/\s+/)[0].toLowerCase();
      const codeLines = [];
      let lj = li + 1;
      while (lj < srcLines.length && !srcLines[lj].trim().startsWith("```")) {
        codeLines.push(srcLines[lj].replace(/\s+$/, ""));
        lj++;
      }
      if (lj < srcLines.length) lj++;
      if (lang === "mermaid") {
        const code = codeLines.join("\n").trim();
        const entry = state.mermaid.get(code);
        if (entry) {
          page = drawImageEntry(page, entry, "");
        } else if (state.pendingMermaid.has(code)) {
          page = drawPendingBox(page);
        } else {
          state.warnings.add(
            "Un diagrama Mermaid no se pudo renderizar. Revisa su sintaxis."
          );
          page = drawMissingBox(
            page,
            "Diagrama Mermaid pendiente",
            "Corrige la sintaxis y vuelve a compilar."
          );
        }
      } else {
        page = drawCodeBlock(page, lang, codeLines, baseSize, lead, maxW);
      }
      li = lj - 1;
      continue;
    }

    if (useMd && state.settings.mathEnabled !== false && (line.trim().startsWith("$$") || line.trim().startsWith("\\["))) {
      const first = line.trim();
      const open = first.startsWith("\\[") ? "\\[" : "$$";
      const close = open === "\\[" ? "\\]" : "$$";
      let code = "";
      if (first.length > open.length + close.length && first.endsWith(close)) {
        code = first.slice(open.length, -close.length);
      } else {
        const parts = [first.slice(open.length)];
        let lj = li + 1;
        while (lj < srcLines.length && !srcLines[lj].includes(close)) {
          parts.push(srcLines[lj]);
          lj++;
        }
        if (lj < srcLines.length) {
          const last = srcLines[lj];
          parts.push(last.slice(0, last.indexOf(close)));
          li = lj;
        } else {
          li = srcLines.length;
        }
        code = parts.join("\n");
      }
      const formula = code.trim();
      const entry = state.mathImages.get(`D:${formula}`);
      if (entry) {
        page = drawMathBlock(page, entry, baseSize);
      } else {
        state.warnings.add("Una fórmula no se pudo renderizar. Revisa la sintaxis LaTeX.");
        page = drawMissingBox(page, "Fórmula no disponible", "Revisa la sintaxis e indica el modo de fórmulas.");
      }
      continue;
    }

    if (/^\[\[COLUMNBREAK\]\]$/i.test(line.trim())) {
      page = newColumn(page);
      continue;
    }

    if (/^\[\[PAGEBREAK\]\]$/i.test(line.trim())) {
      page = newPage();
      continue;
    }

    if (/^\[\[\/IMG\]\]$/i.test(line.trim())) {
      continue;
    }

    const imageToken = parseImageLine(line);
    if (imageToken) {
      const options = parseImageTokenOptions(imageToken.raw);
      const entry = state.images.get(imageToken.id);
      if (options.side === "left" || options.side === "right") {
        const textLines = [];
        let lj = li + 1;
        let hasClosing = false;
        while (lj < srcLines.length && !/^\[\[\/IMG\]\]$/i.test(srcLines[lj].trim())) {
          textLines.push(srcLines[lj]);
          lj++;
        }
        if (lj < srcLines.length) {
          hasClosing = true;
          li = lj;
        } else {
          // Sin cierre explícito, se usa el párrafo inmediato como texto lateral.
          textLines.length = 0;
          lj = li + 1;
          while (
            lj < srcLines.length &&
            srcLines[lj].trim() &&
            !/^(#{1,6}\s|\[\[|```|\|)/.test(srcLines[lj].trim())
          ) {
            textLines.push(srcLines[lj]);
            lj++;
          }
          li = Math.max(li, lj - 1);
        }
        if (!hasClosing && !textLines.length) {
          state.warnings.add("La imagen lateral no tiene texto; agrega líneas o [[/IMG]].");
        }
        page = drawSideImage(page, entry, textLines, options, baseSize, lead);
      } else {
        page = drawImageEntry(page, entry, options.caption, options);
      }
      continue;
    }

    if (useMd && line.trim().startsWith("|")) {
      const tableLines = [line];
      let lj = li + 1;
      while (lj < srcLines.length && srcLines[lj].trim().startsWith("|")) {
        tableLines.push(srcLines[lj].replace(/\s+$/, ""));
        lj++;
      }
      if (tableLines.length >= 2 && isTableSeparator(tableLines[1])) {
        const header = parseTableCells(tableLines[0]);
        const rows = tableLines.slice(2).map(parseTableCells);
        state.currentFont = state.settings.font || "Papernotes";
        page = drawTable(page, header, rows, baseSize, lead, maxW);
        li = lj - 1;
        continue;
      }
    }

    if (useMd) {
      const callout = line
        .trim()
        .match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|EXAMPLE)\]\s*(.*)$/i);
      if (callout) {
        const type = callout[1].toUpperCase();
        const title = callout[2].trim();
        const content = [];
        let lj = li + 1;
        while (lj < srcLines.length && /^\s*>/.test(srcLines[lj])) {
          content.push(srcLines[lj].replace(/^\s*>\s?/, "").replace(/\s+$/, ""));
          lj++;
        }
        page = drawCallout(page, type, title, content, baseSize, lead, maxW);
        li = lj - 1;
        continue;
      }
    }

    let size = baseSize;
    let bold = false;
    let indent = 0;
    let text = line;
    let isCode = inCode;
    let tocTarget = null;
    let headingKey = null;

    if (useMd) {
      let m;
      if (isCode) {
        indent = baseSize * 0.6;
        size = baseSize * 0.85;
      } else if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
        const level = m[1].length;
        text = m[2];
        headingKey = m[2].trim();
        state.currentFont = state.settings.font || "Papernotes";
        let nextLine = "";
        for (let probe = li + 1; probe < srcLines.length; probe++) {
          if (srcLines[probe].trim()) {
            nextLine = srcLines[probe].trim();
            break;
          }
        }
        let reserve = baseSize * 3;
        if (nextLine.startsWith("|")) reserve = baseSize * 10;
        else if (nextLine.startsWith("```")) reserve = baseSize * 10;
        else if (/^>\s*\[!/.test(nextLine)) reserve = baseSize * 8;
        if (page.y + reserve > state.frame.bottom && page.y > state.frame.top + 1) {
          page = newColumn(page);
        }
        if (level <= 2) {
          state.sectionIndex += 1;
          state.sectionFont = pickMixedFont(1000 + state.sectionIndex);
        }
        const custom = state.settings.font === "MiLetra";
        if (custom) {
          size =
            baseSize *
            (level === 1 ? 1.38 : level === 2 ? 1.22 : level === 3 ? 1.08 : level === 4 ? 1.05 : 1);
        } else {
          size =
            baseSize *
            (level === 1 ? 1.65 : level === 2 ? 1.35 : level === 3 ? 1.15 : level === 4 ? 1.05 : 1);
        }
        bold = true;
        if (level >= 5) indent = baseSize * 0.3;
        page.y += baseSize * (level <= 2 ? 0.25 : 0.1);
      } else if ((m = line.match(/^\s*[-*]\s+\[\[#([^\]|]+)\|([^\]]+)\]\]\s*$/))) {
        tocTarget = m[1];
        text = `- ${m[2]}`;
        indent = baseSize * 0.65;
      } else if ((m = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/))) {
        const leadSpaces = m[1].replace(/\t/g, "  ").length;
        let content = m[3];
        content = content.replace(/^\[([ xX])\]\s*/, (_, c) => (c.trim() ? "[x] " : "[ ] "));
        indent = baseSize * 0.65 + Math.floor(leadSpaces / 2) * baseSize * 0.45;
        text = `${m[2]} ${content}`;
      } else if ((m = line.match(/^>\s?(.*)$/))) {
        text = m[1];
        indent = baseSize * 0.55;
      } else if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
        page = newPageIfNeeded(page, baseSize * 2);
        page.ctx.strokeStyle = "rgba(80,100,130,.35)";
        page.ctx.lineWidth = 1;
        page.ctx.beginPath();
        page.ctx.moveTo(state.frame.x, page.y);
        page.ctx.lineTo(state.frame.x + state.frame.width, page.y);
        page.ctx.stroke();
        page.y += baseSize * lead;
        continue;
      } else if (line.trim().startsWith("|")) {
        if (/^\|?[\s:|-]+\|?$/.test(line.trim()) && line.includes("-")) continue;
        const cells = line
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim())
          .filter((c) => c !== "");
        text = cells.join("  ·  ");
        indent = baseSize * 0.35;
      }
    }

    if (isCode) {
      text = cleanCode(text);
      const fs = Math.round(size);
      const lh = fs * lead;
      page.ctx.font = monoFont(fs);
      page.ctx.fillStyle = inkColor();
      const maxCodeW = maxW - indent;
      let rest = text;
      while (rest.length) {
        let cut = rest.length;
        while (cut > 0 && page.ctx.measureText(rest.slice(0, cut)).width > maxCodeW) cut--;
        if (cut <= 0) cut = 1;
        page = newPageIfNeeded(page, lh);
        page.ctx.font = monoFont(fs);
        page.ctx.fillStyle = inkColor();
        page.ctx.fillText(rest.slice(0, cut), state.frame.x + indent, page.y + fs * 0.82);
        page.y += lh;
        rest = rest.slice(cut);
      }
      page.y += fs * 0.05;
      continue;
    }

    text = cleanText(injectInlineMath(text));
    const fs = Math.round(size);
    const lh = fs * lead;
    const lines = wrap(page.ctx, text, (maxW - indent) * 0.94, fs, bold);
    let lastBaseline = 0;
    for (const ln of lines) {
      const extents = lineMathExtents(ln, fs);
      const extraAbove = Math.max(0, extents.above - fs * 0.82);
      const extraBelow = Math.max(0, extents.below - fs * 0.18);
      const lineH = lh + extraAbove + extraBelow;
      page = newPageIfNeeded(page, lineH);
      if (headingKey && prepass && tocPages && tocPages[headingKey] == null) {
        tocPages[headingKey] = state.pages.length;
      }
      const baseline = page.y + fs * 0.82 + extraAbove;
      drawLine(page.ctx, ln, state.frame.x + indent, baseline, fs, bold);
      lastBaseline = baseline;
      page.y += lineH;
    }
    if (tocTarget && tocPages && tocPages[tocTarget] != null) {
      page.ctx.save();
      page.ctx.font = font(18, false);
      page.ctx.fillStyle = "rgba(40,65,95,.75)";
      page.ctx.textAlign = "right";
      page.ctx.textBaseline = "alphabetic";
      page.ctx.fillText(String(tocPages[tocTarget]), state.frame.x + state.frame.width - 12, lastBaseline);
      page.ctx.restore();
    }
    page.y += bold ? fs * 0.18 : fs * 0.05;
  }

  if (drawNumbers) {
    state.currentFont = state.settings.font || "Papernotes";
    state.pages.forEach((p, i) => {
      const label = `${i + 1} / ${state.pages.length}`;
      p.ctx.save();
      p.ctx.font = font(16, false);
      p.ctx.fillStyle = "rgba(40,65,95,.65)";
      p.ctx.textAlign = "center";
      p.ctx.textBaseline = "alphabetic";
      p.ctx.fillText(label, state.W / 2, state.H - Math.max(18, state.M.bottom * 0.45));
      p.ctx.restore();
    });
  }

  return state.pages;
}

function disposePages(pages) {
  for (const page of pages) {
    page.canvas.width = 0;
    page.canvas.height = 0;
  }
}

/**
 * Renderiza un documento completo.
 * @param {object} options
 * @param {string} options.markdown
 * @param {object} options.settings
 * @param {Map<number, {img: HTMLImageElement, displayW?: number}>} options.images
 * @param {Map<string, {img: HTMLImageElement, displayW?: number}>} options.mermaidImages
 * @param {Set<string>} [options.pendingMermaid] Códigos que se están preparando en segundo plano.
 * @returns {{pages: HTMLCanvasElement[], pageWidth:number, pageHeight:number, mmWidth:number, mmHeight:number, warnings:string[]}}
 */
export function renderDocument({
  markdown,
  settings,
  images = new Map(),
  mermaidImages = new Map(),
  pendingMermaid = new Set(),
  mathImages = new Map(),
}) {
  state.settings = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  state.images = images;
  state.mermaid = mermaidImages;
  state.pendingMermaid = pendingMermaid;
  state.mathImages = mathImages;
  state.mathTokens = new Map();
  state.mathTokenSeq = 0;
  state.warnings = new Set();
  applyMetrics();

  const useNumbering = state.settings.numberPages !== false;
  const hasToc =
    useNumbering &&
    /^##\s+Contenido\s*$/m.test(markdown || "") &&
    /\[\[#[^\]|]+\|[^\]]+\]\]/.test(markdown || "");

  let toc = null;
  if (hasToc) {
    toc = {};
    const prepassPages = layoutPass(markdown, { prepass: true, toc });
    disposePages(prepassPages);
  }

  const pages = layoutPass(markdown, { prepass: false, toc });
  applyMetrics();

  return {
    pages: pages.map((p) => p.canvas),
    pageWidth: state.W,
    pageHeight: state.H,
    mmWidth: state.mmW,
    mmHeight: state.mmH,
    warnings: Array.from(state.warnings),
  };
}

export function pageDimensions(settings) {
  const cfg = PAGE_SIZES[settings?.pageSize] || PAGE_SIZES.a4;
  const landscape = settings?.layout === "columns";
  return {
    ...cfg,
    w: landscape ? cfg.h : cfg.w,
    h: landscape ? cfg.w : cfg.h,
    mmW: landscape ? cfg.mmH : cfg.mmW,
    mmH: landscape ? cfg.mmW : cfg.mmH,
    landscape,
    columns: landscape ? 3 : 1,
  };
}

export { loadImage };
