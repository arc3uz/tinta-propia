import { INKS, loadImage } from "./engine.js";

/**
 * Fórmulas de Tinta Propia.
 *
 * - $$...$$ o \[...\] → bloque centrado.
 * - $...$ o \(...\) → fórmula en línea.
 * - Modo "typeset": MathJax 3 (SVG) para LaTeX completo.
 * - Modo "handwritten": conversión simple a Unicode con la letra calibrada.
 * - Modo "auto": bloque con MathJax; en línea con escritura manual.
 */

const MATHJAX_TIMEOUT = 12000;
let mathJaxPromise = null;

function waitForMathJax() {
  if (window.MathJax?.tex2svg && window.MathJax?.startup?.promise) {
    return window.MathJax.startup.promise;
  }
  if (mathJaxPromise) return mathJaxPromise;
  mathJaxPromise = new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (window.MathJax?.tex2svg && window.MathJax?.startup?.promise) {
        window.MathJax.startup.promise.then(resolve).catch(reject);
        return;
      }
      if (Date.now() - started > MATHJAX_TIMEOUT) {
        reject(new Error("MathJax no terminó de cargar."));
        return;
      }
      setTimeout(tick, 50);
    };
    tick();
  });
  return mathJaxPromise;
}

export function extractMath(markdown) {
  const source = String(markdown || "")
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/`[^`\n]*`/g, " ");

  const display = [];
  const inline = [];
  let rest = source;

  const takeDisplay = (re) => {
    rest = rest.replace(re, (_, code) => {
      const tex = code.trim();
      if (tex) display.push(tex);
      return " ";
    });
  };

  takeDisplay(/\$\$([\s\S]*?)\$\$/g);
  takeDisplay(/\\\[([\s\S]*?)\\\]/g);

  const takeInline = (re) => {
    rest = rest.replace(re, (match, prefix, code) => {
      if (prefix === "\\") return match;
      const tex = code.trim();
      if (tex) inline.push(tex);
      return prefix;
    });
  };

  takeInline(/(^|[^\\])\$([^$\n]+)\$/g);
  takeInline(/(^|[^\\])\\\(([^)\n]+)\\\)/g);

  return {
    display: [...new Set(display)],
    inline: [...new Set(inline)],
  };
}

function parseGroup(source, index) {
  if (source[index] !== "{") {
    return { value: source[index] || "", next: index + 1 };
  }
  let depth = 0;
  for (let i = index; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) {
        return { value: source.slice(index + 1, i), next: i + 1 };
      }
    }
  }
  return { value: source.slice(index + 1), next: source.length };
}

const SUPER = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵",
  "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "=": "⁼",
  "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ", x: "ˣ", y: "ʸ",
};
const SUB = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅",
  "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", "=": "₌",
  "(": "₍", ")": "₎", a: "ₐ", e: "ₑ", o: "ₒ", x: "ₓ", i: "ᵢ", j: "ⱼ", n: "ₙ",
};

const SYMBOLS = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε",
  zeta: "ζ", eta: "η", theta: "θ", vartheta: "ϑ", iota: "ι", kappa: "κ",
  lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ",
  tau: "τ", upsilon: "υ", phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π",
  Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
  infty: "∞", to: "→", rightarrow: "→", leftarrow: "←", leftrightarrow: "↔",
  le: "≤", leq: "≤", ge: "≥", geq: "≥", ne: "≠", neq: "≠", approx: "≈",
  equiv: "≡", pm: "±", mp: "∓", times: "×", cdot: "·", div: "÷",
  sum: "∑", prod: "∏", int: "∫", oint: "∮", partial: "∂", nabla: "∇",
  in: "∈", notin: "∉", subset: "⊂", subseteq: "⊆", cup: "∪", cap: "∩",
  forall: "∀", exists: "∃", neg: "¬", land: "∧", lor: "∨",
  sin: "sin", cos: "cos", tan: "tan", log: "log", ln: "ln", exp: "exp",
  max: "max", min: "min", lim: "lim", det: "det", gcd: "gcd",
  ldots: "…", dots: "…", cdots: "⋯", therefore: "∴", because: "∵",
  mid: "|", vert: "|", Vert: "‖", setminus: "\\",
  lbrace: "{", rbrace: "}", langle: "⟨", rangle: "⟩",
};

function convertScripts(content, map, marker) {
  const converted = [...content].map((ch) => map[ch] ?? null);
  if (converted.every((ch) => ch !== null)) return converted.join("");
  return `${marker}(${content})`;
}

function texToUnicode(tex) {
  const source = String(tex || "");
  let out = "";
  let i = 0;

  while (i < source.length) {
    const ch = source[i];

    if (ch === "\\") {
      const rest = source.slice(i + 1);
      const commandMatch = rest.match(/^[A-Za-z]+/);
      if (commandMatch) {
        const command = commandMatch[0];
        i += command.length + 1;

        if (command === "frac") {
          while (source[i] === " ") i++;
          const numerator = parseGroup(source, i);
          i = numerator.next;
          while (source[i] === " ") i++;
          const denominator = parseGroup(source, i);
          i = denominator.next;
          out += `(${texToUnicode(numerator.value)})/(${texToUnicode(denominator.value)})`;
          continue;
        }
        if (command === "sqrt") {
          while (source[i] === " ") i++;
          const body = parseGroup(source, i);
          i = body.next;
          out += `√(${texToUnicode(body.value)})`;
          continue;
        }
        if (command === "text" || command === "mathrm" || command === "operatorname") {
          while (source[i] === " ") i++;
          const body = parseGroup(source, i);
          i = body.next;
          out += texToUnicode(body.value);
          continue;
        }
        if (["left", "right", "big", "Big", "bigl", "bigr", "quad", "qquad"].includes(command)) {
          if (["quad", "qquad"].includes(command)) out += " ";
          continue;
        }
        if (command === "\\") {
          out += " ";
          continue;
        }
        out += SYMBOLS[command] ?? command;
        continue;
      }
      i += 1;
      if (["{", "}", "_", "^", "%", "$", "&", "#"].includes(source[i])) {
        out += source[i];
        i += 1;
      } else {
        out += " ";
      }
      continue;
    }

    if (ch === "^" || ch === "_") {
      i += 1;
      while (source[i] === " ") i++;
      const body = parseGroup(source, i);
      i = body.next;
      out += convertScripts(
        texToUnicode(body.value).replace(/\s+/g, ""),
        ch === "^" ? SUPER : SUB,
        ch
      );
      continue;
    }

    if (ch === "{") {
      const group = parseGroup(source, i);
      out += texToUnicode(group.value);
      i = group.next;
      continue;
    }
    if (ch === "}") {
      i += 1;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out.replace(/\s+/g, " ").trim();
}

function colorFor(settings) {
  return (INKS[settings.ink] || INKS.blue).value;
}

async function renderTypeset(tex, display, settings) {
  await waitForMathJax();
  const container = window.MathJax.tex2svg(tex, { display });
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("MathJax no devolvió un SVG.");

  const color = colorFor(settings);
  let serialized = new XMLSerializer()
    .serializeToString(svg)
    .replace(/currentColor/g, color);

  const viewBox = (svg.getAttribute("viewBox") || "").split(/[ ,]+/).map(Number);
  const valid = viewBox.length === 4 && viewBox[2] > 0 && viewBox[3] > 0;
  const vbX = valid ? viewBox[0] : 0;
  const vbY = valid ? viewBox[1] : -800;
  const vbW = valid ? viewBox[2] : 1000;
  const vbH = valid ? viewBox[3] : 1200;

  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
  const img = await loadImage(url);
  return {
    img,
    widthEm: vbW / 1000,
    heightEm: vbH / 1000,
    baselineEm: -vbY / 1000,
    color,
    mode: "typeset",
  };
}

/**
 * Renderiza una fórmula con MathJax para la vista previa del editor.
 * Devuelve el SVG sin depender del canvas del manuscrito.
 */
export async function renderMathPreview(tex, { display = true } = {}) {
  await waitForMathJax();
  const container = window.MathJax.tex2svg(tex, { display });
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("MathJax no devolvió una vista previa.");
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.style.maxWidth = "100%";
  svg.style.height = "auto";
  svg.style.display = "block";
  return svg;
}

async function renderHandwritten(tex, settings) {
  const text = texToUnicode(tex);
  if (!text) throw new Error("La fórmula quedó vacía.");

  const fontPx = 80;
  const fracPx = Math.round(fontPx * 0.78);
  const family = settings.font || "MiLetra";
  try {
    await document.fonts.load(`400 ${fontPx}px "${family}"`);
    await document.fonts.load(`400 ${fracPx}px "${family}"`);
  } catch {
    /* fallback a la cursiva del sistema */
  }

  const probe = document.createElement("canvas");
  const pctx = probe.getContext("2d");
  const baseFont = `400 ${fontPx}px "${family}", cursive`;
  const fracFont = `400 ${fracPx}px "${family}", cursive`;
  pctx.font = baseFont;

  const measure = (value, size, font) => {
    pctx.font = font;
    const metrics = pctx.measureText(value);
    const ascent = Math.ceil(metrics.actualBoundingBoxAscent || size * 0.8);
    const descent = Math.ceil(metrics.actualBoundingBoxDescent || size * 0.25);
    return {
      width: Math.max(1, metrics.width),
      ascent,
      descent,
      height: ascent + descent,
    };
  };

  // Separa los \frac de nivel superior para dibujarlos como fracciones
  // apiladas, con numerador, barra y denominador.
  const segments = [];
  let pending = "";
  let index = 0;
  while (index < tex.length) {
    const match = tex.slice(index).match(/^\\(dfrac|tfrac|frac)/);
    if (match) {
      let cursor = index + match[0].length;
      while (tex[cursor] === " ") cursor++;
      if (tex[cursor] === "{") {
        const numerator = parseGroup(tex, cursor);
        cursor = numerator.next;
        while (tex[cursor] === " ") cursor++;
        if (tex[cursor] === "{") {
          const denominator = parseGroup(tex, cursor);
          if (pending.trim()) segments.push({ type: "text", value: pending });
          pending = "";
          segments.push({
            type: "fraction",
            numerator: numerator.value,
            denominator: denominator.value,
          });
          index = denominator.next;
          continue;
        }
      }
    }
    pending += tex[index];
    index++;
  }
  if (pending.trim()) segments.push({ type: "text", value: pending });

  const items = [];
  const padding = 14;
  for (const segment of segments) {
    if (segment.type === "text") {
      const value = texToUnicode(segment.value);
      if (!value) continue;
      const metrics = measure(value, fontPx, baseFont);
      items.push({
        ...metrics,
        draw(ctx, x, baseline) {
          ctx.font = baseFont;
          ctx.fillText(value, x, baseline);
        },
      });
      continue;
    }

    const numeratorText = texToUnicode(segment.numerator);
    const denominatorText = texToUnicode(segment.denominator);
    const numerator = measure(numeratorText, fracPx, fracFont);
    const denominator = measure(denominatorText, fracPx, fracFont);
    const gap = Math.max(2, Math.round(fontPx * 0.05));
    const axis = Math.round(fontPx * 0.3);
    const barThickness = Math.max(2, Math.round(fontPx * 0.04));
    const barPadding = Math.max(2, Math.round(fontPx * 0.04));
    const width = Math.max(numerator.width, denominator.width) + barPadding * 2;
    const ascent = axis + gap + numerator.height;
    const descent = gap + denominator.height - axis;
    items.push({
      width,
      ascent,
      descent,
      draw(ctx, x, baseline) {
        const barY = baseline - axis;
        ctx.font = fracFont;
        ctx.fillRect(
          x + (width - Math.max(numerator.width, denominator.width)) / 2,
          barY - barThickness / 2,
          Math.max(numerator.width, denominator.width),
          barThickness
        );
        ctx.fillText(
          numeratorText,
          x + (width - numerator.width) / 2,
          barY - gap - numerator.descent
        );
        ctx.fillText(
          denominatorText,
          x + (width - denominator.width) / 2,
          barY + gap + denominator.ascent
        );
      },
    });
  }

  if (!items.length) throw new Error("La fórmula quedó vacía.");

  const contentWidth = items.reduce((sum, item) => sum + item.width, 0);
  const ascent = Math.max(...items.map((item) => item.ascent), Math.ceil(fontPx * 0.8));
  const descent = Math.max(...items.map((item) => item.descent), Math.ceil(fontPx * 0.25));
  const width = Math.ceil(contentWidth + padding * 2);
  const height = Math.ceil(ascent + descent + padding * 2);
  const baseline = padding + ascent;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = colorFor(settings);
  ctx.textBaseline = "alphabetic";
  let x = padding;
  for (const item of items) {
    item.draw(ctx, x, baseline);
    x += item.width;
  }

  const img = await loadImage(canvas.toDataURL("image/png"));
  return {
    img,
    widthEm: width / fontPx,
    heightEm: height / fontPx,
    baselineEm: baseline / fontPx,
    color: colorFor(settings),
    mode: "handwritten",
    text,
  };
}

function resolveMode(display, settings) {
  const mode = settings.mathMode || "auto";
  if (mode === "typeset") return "typeset";
  if (mode === "handwritten") return "handwritten";
  return display ? "typeset" : "handwritten";
}

export async function prepareMath(markdown, settings, cache, onProgress) {
  if (settings.mathEnabled === false) {
    return { images: new Map(), errors: [], count: 0 };
  }

  const formulas = extractMath(markdown);
  const jobs = [
    ...formulas.display.map((code) => ({ code, display: true })),
    ...formulas.inline.map((code) => ({ code, display: false })),
  ];
  const images = new Map();
  const errors = [];
  let done = 0;

  for (const job of jobs) {
    const requested = resolveMode(job.display, settings);
    const modes = [requested];
    if (requested === "typeset") modes.push("handwritten");
    let rendered = null;

    for (const mode of modes) {
      const key = `${mode}|${job.display ? "D" : "I"}|${settings.font}|${settings.ink}|${job.code}`;
      if (cache.has(key)) {
        rendered = cache.get(key);
        break;
      }
      try {
        rendered =
          mode === "typeset"
            ? await renderTypeset(job.code, job.display, settings)
            : await renderHandwritten(job.code, settings);
        cache.set(key, rendered);
        break;
      } catch (error) {
        console.warn(`Fórmula (${mode}):`, job.code, error);
        if (mode === modes[modes.length - 1]) {
          errors.push({
            code: job.code.slice(0, 160),
            message: error?.message || "No se pudo renderizar la fórmula.",
          });
        }
      }
    }

    if (rendered) {
      images.set(`${job.display ? "D" : "I"}:${job.code}`, rendered);
    }
    done++;
    onProgress?.(done, jobs.length, job.code);
  }

  return { images, errors, count: jobs.length };
}

export { texToUnicode };
