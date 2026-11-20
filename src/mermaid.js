import mermaid from "mermaid";
import { loadImage } from "./engine.js";

let initialized = false;

export function initMermaid() {
  if (initialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "redux-color",
    securityLevel: "strict",
    htmlLabels: false,
    flowchart: { htmlLabels: false },
    sequence: { useMaxWidth: false },
    gantt: { useMaxWidth: false },
    mindmap: { useMaxWidth: false },
  });
  initialized = true;
}

export function extractMermaidBlocks(markdown) {
  const re = /```mermaid[ \t]*\r?\n([\s\S]*?)```/g;
  const blocks = [];
  let match;
  while ((match = re.exec(markdown)) !== null) {
    blocks.push({
      code: match[1].trim(),
      start: match.index,
      end: re.lastIndex,
      raw: match[0],
    });
  }
  return blocks;
}

function svgToImage(svgText) {
  const safeSvg = svgText
    .replace(/<br\s*\/?>/gi, "<br/>")
    .replace(/<hr\s*\/?>/gi, "<hr/>")
    .replace(/&nbsp;/gi, "&#160;")
    .replace(/&mdash;/gi, "&#8212;")
    .replace(/&ndash;/gi, "&#8211;")
    .replace(/&hellip;/gi, "&#8230;")
    .replace(/&lsquo;/gi, "&#8216;")
    .replace(/&rsquo;/gi, "&#8217;")
    .replace(/&ldquo;/gi, "&#8220;")
    .replace(/&rdquo;/gi, "&#8221;");

  return new Promise((resolve, reject) => {
    const doc = new DOMParser().parseFromString(safeSvg, "image/svg+xml");
    const el = doc.documentElement;
    if (el.nodeName.toLowerCase() === "parsererror") {
      reject(new Error(`Mermaid generó un SVG no válido: ${el.textContent.slice(0, 160)}`));
      return;
    }
    const vb = (el.getAttribute("viewBox") || "").split(/\s+/).map(Number);
    const vw = vb.length === 4 && vb[2] ? vb[2] : 800;
    const vh = vb.length === 4 && vb[3] ? vb[3] : 600;
    const displayW = Math.max(360, vw * 1.28);
    const rasterW = Math.min(2000, Math.max(900, Math.round(displayW * 1.8)));
    el.setAttribute("width", String(rasterW));
    el.setAttribute("height", String(Math.round((rasterW * vh) / vw)));
    const str = new XMLSerializer().serializeToString(el);
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(str)}`;
    loadImage(url)
      .then((img) => resolve({ img, displayW, viewBoxWidth: vw, viewBoxHeight: vh }))
      .catch(reject);
  });
}

let renderSeq = 0;

export async function renderSingleMermaid(code) {
  initMermaid();
  const id = `papernotes-mmd-${Date.now()}-${++renderSeq}`;
  const result = await mermaid.render(id, code);
  return svgToImage(result.svg);
}

/**
 * Renderiza (y cachea) todos los bloques Mermaid de un documento.
 * @param {string} markdown
 * @param {Map<string, {img: HTMLImageElement, displayW: number}>} cache
 * @param {(done:number,total:number,code:string)=>void} onProgress
 */
export async function prepareMermaid(markdown, cache, onProgress) {
  initMermaid();
  const blocks = extractMermaidBlocks(markdown);
  const unique = new Map();
  for (const block of blocks) {
    if (!unique.has(block.code)) unique.set(block.code, block.code);
  }
  const errors = [];
  let done = 0;
  for (const code of unique.keys()) {
    if (cache.has(code)) {
      done++;
      onProgress?.(done, unique.size, code);
      continue;
    }
    try {
      const entry = await renderSingleMermaid(code);
      cache.set(code, entry);
    } catch (error) {
      console.error("Mermaid:", error);
      errors.push({
        code: code.slice(0, 200),
        message: error?.message || "Error desconocido al renderizar Mermaid.",
      });
    }
    done++;
    onProgress?.(done, unique.size, code);
  }
  return { errors, count: unique.size };
}
