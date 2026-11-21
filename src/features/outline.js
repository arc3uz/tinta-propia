import { app, numberFmt } from "../core/state.js";
import { $, createEl, displayFileName, formatBytes } from "../core/utils.js";

/**
 * Esquema y estadísticas del documento.
 *
 * El esquema se calcula a partir de los encabezados Markdown y se actualiza con
 * retardo para no recorrer el documento en cada pulsación. Las estadísticas
 * usan la misma estrategia y alimentan la barra inferior del editor.
 */

export function scheduleStats() {
  clearTimeout(app.statsTimer);
  app.statsTimer = setTimeout(updateDocStats, 220);
}

export function updateDocStats() {
  if (!app.editor) return;
  const text = app.editor.getValue();
  const bytes = new TextEncoder().encode(text).length;
  const words = (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu) || []).length;
  $("wordCount").textContent = `${numberFmt.format(words)} palabras`;
  $("fileSize").textContent = formatBytes(bytes);
  const pages = app.pages.length;
  $("fileMeta").textContent = `Markdown · ${formatBytes(bytes)}${pages ? ` · ${pages} pág.` : ""}`;
  $("sbFile").textContent = displayFileName();
}

/** Extrae encabezados Markdown ignorando bloques de código. */
export function parseOutline(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  const items = [];
  let inFence = false;
  lines.forEach((line, index) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!match) return;
    const text = match[2]
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[*_~]/g, "")
      .trim();
    items.push({ level: match[1].length, text, line: index + 1 });
  });
  return items;
}

export function scheduleOutline() {
  clearTimeout(app.outlineTimer);
  app.outlineTimer = setTimeout(updateOutline, 220);
}

export function updateOutline() {
  if (!app.editor) return;
  const items = parseOutline(app.editor.getValue());
  const list = $("outlineList");
  list.innerHTML = "";
  if (!items.length) {
    list.append(
      createEl("div", {
        class: "outline-empty",
        text: "Los títulos del documento aparecerán aquí.",
      })
    );
  } else {
    const fragment = document.createDocumentFragment();
    for (const item of items) {
      const button = createEl("button", {
        class: `outline-item level-${Math.min(item.level, 4)}`,
        title: item.text,
        text: item.text,
      });
      button.dataset.line = String(item.line);
      button.addEventListener("click", () => app.editor.goToLine(item.line));
      fragment.append(button);
    }
    list.append(fragment);
  }
  $("outlineCount").textContent = String(items.length);
  const cursor = app.editor.getCursor();
  setActiveOutline(cursor.line);
}

/** Marca el encabezado activo y lo mantiene visible en el panel. */
export function setActiveOutline(line) {
  const list = $("outlineList");
  const items = Array.from(list.querySelectorAll(".outline-item"));
  let active = null;
  for (const item of items) {
    if (Number(item.dataset.line) <= line) active = item;
    else break;
  }
  for (const item of items) item.classList.toggle("active", item === active);
  if (active) {
    const rect = active.getBoundingClientRect();
    const box = list.getBoundingClientRect();
    if (rect.top < box.top + 4 || rect.bottom > box.bottom - 4) {
      active.scrollIntoView({ block: "nearest" });
    }
  }
}
