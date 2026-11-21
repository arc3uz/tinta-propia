/**
 * Tinta Propia — punto de entrada de la interfaz.
 *
 * Este archivo orquesta el editor, la compilación del manuscrito, los ajustes
 * y los flujos de proyecto. Las piezas reutilizables viven en:
 *
 *   core/state.js      estado compartido y claves de persistencia
 *   core/utils.js      utilidades de DOM y formato
 *   core/modal.js      modales, avisos y progreso
 *   features/library.js biblioteca, etiquetas y carpetas
 *   features/export.js  PDF, PNG y Markdown
 *   features/outline.js esquema y estadísticas del documento
 *
 * Las acciones de proyecto se inyectan en la biblioteca para mantener ese
 * módulo independiente del ciclo de compilación.
 */
import "./fonts.css";
import "./styles.css";
import iconUrl from "./assets/brand/icon.png";
import exampleMd from "./assets/example.md?raw";
import { MarkdownEditor } from "./editor.js";
import { initMermaid, renderSingleMermaid, extractMermaidBlocks } from "./mermaid.js";
import { prepareMath } from "./math.js";
import {
  renderDocument,
  pageDimensions,
  DEFAULT_SETTINGS,
  PRESETS,
  loadImage,
  parseImageTokenOptions,
} from "./engine.js";
import { invoke } from "@tauri-apps/api/core";
import { open as openFileDialog, save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";

import {
  AUTOSAVE_KEY,
  EDITOR_WIDTH_KEY,
  SETTINGS_KEY,
  SIDEBAR_KEY,
  app,
} from "./core/state.js";
import {
  $,
  base64ToBuffer,
  clamp,
  createEl,
  displayFileName,
  fileToDataURL,
  formatBytes,
  slugify,
  svgIcon,
  yieldFrame,
} from "./core/utils.js";
import { showModal, toast } from "./core/modal.js";
import { openFolder } from "./core/system.js";
import { openHomeView, showRecentProjects } from "./features/library.js";
import { openFormulaModal } from "./features/formulas.js";
import {
  scheduleOutline,
  scheduleStats,
  setActiveOutline,
  updateDocStats,
  updateOutline,
} from "./features/outline.js";
import { exportMarkdown, exportPDF, exportPagePNG } from "./features/export.js";

const SETTING_IDS = [
  "font",
  "size",
  "leading",
  "tracking",
  "wordSpacing",
  "jitter",
  "realism",
  "pressure",
  "slant",
  "bleed",
  "seed",
  "paper",
  "paperColor",
  "ink",
  "headingInk",
  "margins",
  "pageSize",
  "layout",
  "columnGuides",
  "markdown",
  "numberPages",
  "mathEnabled",
  "mathMode",
  "mixFonts",
  "mixStrength",
  "mixMode",
  "mixFont1",
  "mixFont2",
  "mixFont3",
];
const NUMERIC_IDS = new Set([
  "size",
  "leading",
  "tracking",
  "wordSpacing",
  "jitter",
  "realism",
  "pressure",
  "slant",
  "bleed",
  "seed",
  "mixStrength",
]);
const BOOL_IDS = new Set(["markdown", "numberPages", "mathEnabled", "mixFonts", "columnGuides"]);

/* ───────────────────────── Carga inicial ───────────────────────── */

function fallbackBootstrap() {
  return {
    version: "0.9.0",
    dataDir: null,
    documentsDir: null,
    projectsDir: null,
    fontsDir: null,
    autosave: null,
    settings: null,
    recent: [],
    customFonts: [],
  };
}

async function readBootstrap() {
  if (!app.isTauri) return fallbackBootstrap();
  try {
    return await invoke("bootstrap");
  } catch (error) {
    console.error(error);
    app.bootError = error;
    return fallbackBootstrap();
  }
}

function readLocalAutosave() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readLocalSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function registerFont(name, base64) {
  const buffer = base64ToBuffer(base64);
  const face = new FontFace(name, buffer);
  await face.load();
  document.fonts.add(face);
  if (!app.fontList.some((font) => font.value === name)) {
    app.fontList.push({ value: name, label: name });
  }
}

async function ensureFont(family) {
  const families = [
    family,
    app.settings.mixFont1,
    app.settings.mixFont2,
    app.settings.mixFont3,
  ].filter(Boolean);
  try {
    await Promise.all(
      [...new Set(families)].flatMap((name) => [
        document.fonts.load(`400 26px "${name}"`).catch(() => null),
        document.fonts.load(`700 26px "${name}"`).catch(() => null),
      ])
    );
    await document.fonts.ready;
  } catch {
    /* si la fuente no está, el canvas usará la cursiva del sistema */
  }
}

function computeImageSeq(assets) {
  let max = 0;
  for (const key of Object.keys(assets || {})) {
    const n = parseInt(key, 10);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  return max;
}

function normalizeSettings(settings) {
  const next = { ...settings };
  for (const key of ["font", "mixFont1", "mixFont2", "mixFont3"]) {
    if (next[key] === "MiLetra IIC2531") next[key] = "MiLetra";
  }
  return next;
}

function applyPayloadToState(payload) {
  app.title = payload.title || "Sin título";
  app.projectPath = payload.path || null;
  app.settings = normalizeSettings({ ...DEFAULT_SETTINGS, ...(payload.settings || {}) });
  app.tags = Array.isArray(payload.tags)
    ? payload.tags.filter((tag) => typeof tag === "string" && tag.trim())
    : [];
  app.assets = payload.assets || {};
  app.imageSeq = Math.max(
    Number(payload.imageSeq) || 0,
    computeImageSeq(app.assets)
  );
  app.lastSavedAt = Number(payload.updatedAt) || 0;
  app.dirty = false;
  return payload.document ?? payload.markdown ?? "";
}

async function hydrateAssets(assets) {
  const next = new Map();
  for (const [key, value] of Object.entries(assets || {})) {
    const data = typeof value === "string" ? value : value?.data;
    if (!data) continue;
    try {
      const img = await loadImage(data);
      next.set(Number(key), {
        img,
        displayW: (typeof value === "object" && value.displayW) || img.width,
        data,
      });
    } catch {
      console.warn(`No se pudo cargar la imagen ${key}`);
    }
  }
  app.images = next;
}

/* ───────────────────────── Editor ───────────────────────── */

function handleEditorChange() {
  markDirty();
  scheduleStats();
  scheduleOutline();
  scheduleCompile(900);
  scheduleAutosave(2000);
}

function handleCursor(cursor) {
  const selected = cursor.selected ? ` · ${cursor.selected} sel.` : "";
  $("cursorState").textContent = `Ln ${cursor.line}, Col ${cursor.col}${selected}`;
  setActiveOutline(cursor.line);
}

/* ───────────────────────── Ajustes ───────────────────────── */

function fillFontSelect(select, selected) {
  if (!select) return;
  select.innerHTML = "";
  for (const font of app.fontList) {
    const option = document.createElement("option");
    option.value = font.value;
    option.textContent = font.label;
    select.append(option);
  }
  if (selected && !app.fontList.some((font) => font.value === selected)) {
    const option = document.createElement("option");
    option.value = selected;
    option.textContent = selected;
    select.append(option);
  }
  if (selected) select.value = selected;
}

function populateFontSelect(selected) {
  fillFontSelect($("font"), selected);
  fillFontSelect($("mixFont1"), app.settings.mixFont1 || "Papernotes");
  fillFontSelect($("mixFont2"), app.settings.mixFont2 || "Caveat");
  fillFontSelect($("mixFont3"), app.settings.mixFont3 || "Kalam");
}

function syncSettingsControls() {
  for (const id of SETTING_IDS) {
    const el = $(id);
    if (!el) continue;
    const value = app.settings[id];
    if (BOOL_IDS.has(id)) el.checked = value !== false;
    else {
      el.value = value ?? "";
    }
  }
  populateFontSelect(app.settings.font);
  updateConditionalControls();
  const custom = $("preset").querySelector('option[value="custom"]');
  if (custom) {
    const ignore = new Set(["pageSize", "layout", "columnGuides", "markdown", "numberPages"]);
    const matchesApunte = Object.entries(PRESETS.apunte.values).every(
      ([key, value]) => ignore.has(key) || app.settings[key] === value
    );
    $("preset").value = matchesApunte ? "apunte" : "custom";
  }
  syncRangeOutputs();
  updatePrintStyle();
  updatePreviewMeta();
}

function readSettingsFromControls() {
  const next = { ...app.settings };
  for (const id of SETTING_IDS) {
    const el = $(id);
    if (!el) continue;
    if (BOOL_IDS.has(id)) next[id] = el.checked;
    else if (NUMERIC_IDS.has(id)) next[id] = parseFloat(el.value);
    else next[id] = el.value;
  }
  if (!Number.isFinite(next.seed)) next.seed = DEFAULT_SETTINGS.seed;
  return next;
}

function syncRangeOutputs() {
  const formats = {
    size: (v) => `${Math.round(v)} px`,
    leading: (v) => `${parseFloat(v).toFixed(2)}×`,
    jitter: (v) => parseFloat(v).toFixed(1),
    realism: (v) => `${Math.round(v)} %`,
    pressure: (v) => `${Math.round(v)} %`,
    slant: (v) => `${parseFloat(v).toFixed(1)}°`,
    bleed: (v) => parseFloat(v).toFixed(1),
    tracking: (v) => `${parseFloat(v).toFixed(2)}×`,
    wordSpacing: (v) => `${parseFloat(v).toFixed(2)}×`,
    mixStrength: (v) => `${Math.round(v)} %`,
  };
  for (const [id, formatter] of Object.entries(formats)) {
    const input = $(id);
    const output = $(`${id}Val`);
    if (input && output) output.textContent = formatter(parseFloat(input.value) || 0);
  }
  syncChips();
}

function syncChips() {
  const wordSpacing = parseFloat($("wordSpacing")?.value);
  document.querySelectorAll("[data-word]").forEach((button) => {
    const active = Math.abs(wordSpacing - parseFloat(button.dataset.word)) < 0.001;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const size = Math.round(parseFloat($("size")?.value));
  document.querySelectorAll("[data-size]").forEach((button) => {
    const active = size === parseInt(button.dataset.size, 10);
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function updateConditionalControls() {
  const mixOptions = $("mixOptions");
  if (mixOptions) mixOptions.hidden = !$("mixFonts")?.checked;
  const columnOptions = $("columnOptions");
  if (columnOptions) columnOptions.hidden = $("layout")?.value !== "columns";
  const mathOptions = $("mathOptions");
  if (mathOptions) mathOptions.hidden = !$("mathEnabled")?.checked;
}

function updatePrintStyle() {
  const cfg = pageDimensions(app.settings);
  let style = document.getElementById("dynamicPrintStyle");
  if (!style) {
    style = document.createElement("style");
    style.id = "dynamicPrintStyle";
    document.head.append(style);
  }
  style.textContent = `
@media print {
  @page { size: ${cfg.mmW}mm ${cfg.mmH}mm; margin: 0; }
  .page-wrap { width: ${cfg.mmW}mm; height: ${cfg.mmH}mm; }
  .page-wrap canvas { width: ${cfg.mmW}mm !important; height: ${cfg.mmH}mm !important; }
}`;
}

function onSettingsChanged(event) {
  const id = event?.target?.id;
  app.settings = readSettingsFromControls();
  updateConditionalControls();
  syncRangeOutputs();
  if (id === "pageSize" || id === "layout") updatePrintStyle();
  updatePreviewMeta();
  const preset = $("preset");
  const structural = new Set(["pageSize", "layout", "columnGuides", "markdown", "numberPages"]);
  if (preset && id !== "preset" && !structural.has(id)) {
    const custom = preset.querySelector('option[value="custom"]');
    if (custom) preset.value = "custom";
  }
  markDirty();
  scheduleCompile(id === "seed" ? 80 : 320);
  scheduleAutosave(1600);
  scheduleGlobalSettings();
}

function applyPreset(name) {
  const preset = PRESETS[name];
  if (!preset) return;
  app.settings = {
    ...app.settings,
    ...preset.values,
    pageSize: app.settings.pageSize,
    layout: app.settings.layout,
    columnGuides: app.settings.columnGuides,
    markdown: app.settings.markdown,
    numberPages: app.settings.numberPages,
  };
  syncSettingsControls();
  markDirty();
  scheduleCompile(120);
  scheduleAutosave(1500);
  scheduleGlobalSettings();
}

function scheduleGlobalSettings() {
  clearTimeout(app.settingsTimer);
  app.settingsTimer = setTimeout(async () => {
    if (!app.ready) return;
    try {
      if (app.isTauri) await invoke("save_settings", { settings: app.settings });
      else localStorage.setItem(SETTINGS_KEY, JSON.stringify(app.settings));
    } catch (error) {
      console.warn("No se pudieron guardar los ajustes globales", error);
    }
  }, 700);
}

/* ───────────────────────── Estado y guardado ───────────────────────── */

function markDirty() {
  app.dirty = true;
  updateDirtyUI();
  setSaveState("dirty", "Sin guardar");
}

function updateDirtyUI() {
  $("tabDot").hidden = !app.dirty;
  $("dirtyDot").hidden = !app.dirty;
}

function setSaveState(state, text) {
  const el = $("saveState");
  el.classList.remove("dirty", "saving", "error");
  if (state === "dirty") el.classList.add("dirty");
  if (state === "saving") el.classList.add("saving");
  if (state === "error") el.classList.add("error");
  el.querySelector("span").textContent = text;
  if (state === "saved" && app.lastSavedAt) {
    el.title = `Guardado a las ${new Date(app.lastSavedAt).toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } else {
    el.title = text;
  }
}

function buildProject() {
  return {
    version: 1,
    title: app.title || "Sin título",
    path: app.projectPath || null,
    document: app.editor ? app.editor.getValue() : "",
    settings: { ...app.settings },
    tags: [...app.tags],
    assets: app.assets || {},
    imageSeq: app.imageSeq,
    updatedAt: Date.now(),
  };
}

function scheduleAutosave(delay = 1800) {
  clearTimeout(app.autosaveTimer);
  app.autosaveTimer = setTimeout(() => persistAutosave(), delay);
}

async function persistAutosave({ silent = false } = {}) {
  if (!app.ready || !app.editor) return;
  if (app.autosaveRunning) {
    app.autosavePending = true;
    return;
  }
  app.autosaveRunning = true;
  const snapshot = buildProject();
  const snapshotText = snapshot.document;
  setSaveState("saving", "Guardando…");
  try {
    if (app.isTauri) {
      await invoke("save_autosave", { project: snapshot });
      if (snapshot.path && snapshotText === app.editor.getValue()) {
        await invoke("autosave_project", {
          path: snapshot.path,
          project: snapshot,
        });
      }
    } else {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(snapshot));
    }
    app.lastSavedAt = Date.now();
    if (app.editor.getValue() === snapshotText) {
      app.dirty = false;
      updateDirtyUI();
      setSaveState("saved", "Guardado");
    } else {
      setSaveState("dirty", "Sin guardar");
      scheduleAutosave(900);
    }
  } catch (error) {
    console.error(error);
    setSaveState("error", "Error al guardar");
    if (!silent) {
      toast("No se pudo guardar la sesión. Revisa los permisos de la carpeta.", {
        type: "error",
        title: "Error de guardado",
      });
    }
  } finally {
    app.autosaveRunning = false;
    if (app.autosavePending) {
      app.autosavePending = false;
      scheduleAutosave(350);
    }
  }
}

async function flushForClose() {
  if (!app.editor) return;
  const snapshot = buildProject();
  if (app.isTauri) {
    try {
      await invoke("save_autosave", { project: snapshot });
      if (snapshot.path) {
        await invoke("autosave_project", {
          path: snapshot.path,
          project: snapshot,
        });
      }
    } catch (error) {
      console.warn("No se pudo guardar al cerrar", error);
    }
  } else {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(snapshot));
    } catch {
      /* sin espacio */
    }
  }
}

function updateTitleUI() {
  const input = $("projectTitle");
  if (document.activeElement !== input) {
    input.value = app.title || "Sin título";
  }
  const file = displayFileName();
  $("tabTitle").textContent = file;
  $("mainFileName").textContent = file;
  $("sbFile").textContent = file;
  $("sbPath").textContent = app.projectPath || (app.isTauri ? "autoguardado local" : "navegador");
  $("sbPath").title = app.projectPath || "";
}

/* ───────────────────────── Compilación ───────────────────────── */

function scheduleCompile(delay = 800) {
  clearTimeout(app.compileTimer);
  app.compileTimer = setTimeout(() => compile(), delay);
}

function setCompileBusy(busy) {
  const button = $("compileBtn");
  button.classList.toggle("loading", busy);
  button.disabled = busy;
  button.querySelector(".compile-label").textContent = busy ? "Compilando…" : "Recompilar";
  $("compileProgress").classList.toggle("active", busy);
}

function setCompileState(kind, text) {
  const el = $("compileState");
  el.innerHTML = "";
  el.append(createEl("span", { class: `status-dot ${kind}` }));
  el.append(document.createTextNode(` ${text}`));
}

/**
 * Compila el documento completo.
 *
 * Orquesta el render de fórmulas y Mermaid, la paginación del motor y el
 * montaje de las hojas en la vista previa. Si cambia la generación de
 * compilación, descarta el resultado anterior para evitar parpadeos.
 */
async function compile({ initial = false, preservePage = true } = {}) {
  if (!app.editor) return;
  if (app.compiling) {
    app.pendingCompile = true;
    return;
  }
  app.compiling = true;
  app.pendingCompile = false;
  const gen = ++app.compileGen;
  const started = performance.now();
  const markdown = app.editor.getValue();

  setCompileBusy(true);
  setCompileState("busy", "Compilando…");
  if (!app.pages.length) $("previewLoading").hidden = false;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  try {
    if (!markdown.trim()) {
      const oldPages = app.pages;
      app.pages = [];
      app.result = null;
      app.currentPage = 1;
      clearPreview();
      releasePages(oldPages);
      $("previewEmpty").hidden = false;
      $("previewLoading").hidden = true;
      updatePreviewMeta();
      updateDocStats();
      setCompileState("ok", "Sin contenido");
      $("sbCompile").textContent = "Documento vacío";
      return;
    }

    const mathResult = await prepareMath(
      markdown,
      app.settings,
      app.mathCache,
      (done, total) => {
        if (gen === app.compileGen) {
          setCompileState("busy", total ? `Fórmulas ${done}/${total}…` : "Compilando…");
        }
      }
    );
    if (gen !== app.compileGen) return;

    const usedCodes = new Set(extractMermaidBlocks(markdown).map((block) => block.code));
    for (const key of Array.from(app.mermaidCache.keys())) {
      if (!usedCodes.has(key)) app.mermaidCache.delete(key);
    }
    for (const key of Array.from(app.mermaidErrors.keys())) {
      if (!usedCodes.has(key)) app.mermaidErrors.delete(key);
    }
    const pendingCodes = [...usedCodes].filter(
      (code) => !app.mermaidCache.has(code) && !app.mermaidErrors.has(code)
    );
    const pendingSet = new Set(pendingCodes);

    await ensureFont(app.settings.font);
    if (gen !== app.compileGen) return;

    const oldPages = app.pages;
    const result = renderDocument({
      markdown,
      settings: app.settings,
      images: app.images,
      mermaidImages: app.mermaidCache,
      pendingMermaid: pendingSet,
      mathImages: mathResult.images,
    });
    if (gen !== app.compileGen) {
      releasePages(result.pages);
      return;
    }
    app.result = result;
    app.pages = result.pages;
    mountPreview(result, { preservePage });
    releasePages(oldPages);
    updatePreviewMeta();
    updateDocStats();
    if (pendingCodes.length) ensureMermaidDiagrams(pendingCodes);

    const warnings = [
      ...mathResult.errors.map((error) => error.message),
      ...result.warnings,
    ];
    if (warnings.length) {
      setCompileState("warn", "Listo con avisos");
      const key = warnings.join("|").slice(0, 240);
      if (key !== app.lastWarningKey) {
        app.lastWarningKey = key;
        toast(warnings[0], {
          type: "warn",
          title: "Revisa el documento",
          timeout: 6500,
        });
      }
    } else if (pendingCodes.length) {
      setCompileState("busy", `${pendingCodes.length} diagrama(s) en preparación…`);
    } else {
      app.lastWarningKey = "";
      setCompileState("ok", "Listo");
    }
    const elapsed = Math.round(performance.now() - started);
    const unit = app.settings.layout === "columns" ? "hojas" : "pág.";
    $("sbCompile").textContent = `Compilado en ${elapsed} ms · ${app.pages.length} ${unit}`;
  } catch (error) {
    console.error(error);
    setCompileState("error", "Error de compilación");
    $("sbCompile").textContent = "Error de compilación";
    toast(error?.message || "Ocurrió un error al dibujar el manuscrito.", {
      type: "error",
      title: "No se pudo compilar",
    });
  } finally {
    app.compiling = false;
    setCompileBusy(false);
    $("previewLoading").hidden = true;
    if (app.pendingCompile) {
      app.pendingCompile = false;
      scheduleCompile(160);
    }
  }
}

async function ensureMermaidDiagrams(codes) {
  for (const code of codes) app.mermaidQueue.add(code);
  if (app.mermaidJobRunning) return;
  app.mermaidJobRunning = true;
  let done = 0;
  let failures = 0;
  const initialTotal = app.mermaidQueue.size;
  try {
    while (app.mermaidQueue.size) {
      const code = app.mermaidQueue.values().next().value;
      app.mermaidQueue.delete(code);
      if (app.mermaidCache.has(code) || app.mermaidErrors.has(code)) {
        done++;
        continue;
      }
      const total = Math.max(initialTotal, done + app.mermaidQueue.size + 1);
      setCompileState("busy", `Diagramas ${done + 1}/${total}…`);
      try {
        const entry = await renderSingleMermaid(code);
        app.mermaidCache.set(code, entry);
      } catch (error) {
        failures++;
        console.error("Mermaid:", error);
        app.mermaidErrors.set(code, error?.message || "Error al renderizar Mermaid.");
      }
      done++;
      if (done < total) setCompileState("busy", `Diagramas ${done}/${total}…`);
      await yieldFrame();
    }
  } finally {
    app.mermaidJobRunning = false;
    if (done && !failures) {
      toast(
        done === 1 ? "1 diagrama listo." : `${done} diagramas listos.`,
        { title: "Mermaid", timeout: 2400 }
      );
    }
    if (app.mermaidQueue.size) {
      ensureMermaidDiagrams([]);
    } else {
      scheduleCompile(180);
    }
  }
}

function releasePages(pages) {
  for (const canvas of pages || []) {
    canvas.width = 0;
    canvas.height = 0;
  }
}

function clearPreview() {
  $("previewPages").innerHTML = "";
  app.pageEls = [];
  $("pageTotal").textContent = "/ 0";
  app.currentPage = 1;
  updatePageNavigation();
}

function mountPreview(result, { preservePage = true } = {}) {
  const container = $("previewPages");
  const anchor = preservePage ? app.currentPage : 1;
  container.innerHTML = "";
  app.pageEls = [];
  $("previewEmpty").hidden = true;
  if (!result || !result.pages.length) {
    clearPreview();
    return;
  }

  const fragment = document.createDocumentFragment();
  result.pages.forEach((canvas, index) => {
    const wrap = createEl("div", { class: "page-wrap" });
    wrap.dataset.page = String(index + 1);
    wrap.append(canvas);
    wrap.append(
      createEl("span", {
        class: "page-label",
        text: `${app.settings.layout === "columns" ? "Hoja" : "Página"} ${index + 1}`,
      })
    );
    const actions = createEl("div", { class: "page-actions" }, [
      createEl(
        "button",
        {
          class: "page-action",
          title: "Descargar esta página como PNG",
          onclick: (event) => {
            event.stopPropagation();
            exportPagePNG(canvas, index + 1);
          },
        },
        [svgIcon("download")]
      ),
    ]);
    wrap.append(actions);
    wrap.addEventListener("click", () => setCurrentPage(index + 1));
    app.pageEls.push(wrap);
    fragment.append(wrap);
  });
  container.append(fragment);

  if (app.zoomMode === "fit") app.zoom = fitZoom();
  applyZoom(false);
  requestAnimationFrame(() => {
    if (preservePage && anchor > 1) scrollToPage(anchor, { smooth: false });
    else $("previewScroll").scrollTop = 0;
    updateCurrentPageFromScroll();
  });
  updatePageNavigation();
}

function fitZoom() {
  if (!app.result) return 1;
  const available = $("previewScroll").clientWidth - 76;
  return clamp(available / app.result.pageWidth, 0.18, 1.25);
}

function applyZoom(keepPage = true) {
  if (!app.result) return;
  const width = Math.max(120, Math.round(app.result.pageWidth * app.zoom));
  for (const wrap of app.pageEls) {
    const canvas = wrap.querySelector("canvas");
    if (!canvas) continue;
    canvas.style.width = `${width}px`;
    canvas.style.height = "auto";
  }
  $("zoomLabel").textContent = `${Math.round(app.zoom * 100)} %`;
  if (keepPage && app.currentPage) scrollToPage(app.currentPage, { smooth: false });
}

function setZoom(zoom, mode = "manual") {
  app.zoomMode = mode;
  app.zoom = clamp(zoom, 0.18, 2.5);
  applyZoom();
}

function scrollToPage(page, { smooth = true } = {}) {
  const wrap = app.pageEls[page - 1];
  if (!wrap) return;
  const top = Math.max(0, wrap.offsetTop - 24);
  $("previewScroll").scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
  setCurrentPage(page, { scroll: false });
}

function setCurrentPage(page, { scroll = false } = {}) {
  const total = app.pages.length;
  if (!total) {
    app.currentPage = 1;
    $("pageInput").value = "0";
    updatePageNavigation();
    return;
  }
  app.currentPage = clamp(page, 1, total);
  $("pageInput").value = String(app.currentPage);
  app.pageEls.forEach((el, index) =>
    el.classList.toggle("current", index + 1 === app.currentPage)
  );
  updatePageNavigation();
  if (scroll) scrollToPage(app.currentPage);
}

function updateCurrentPageFromScroll() {
  if (!app.pageEls.length) return;
  const scrollTop = $("previewScroll").scrollTop;
  let current = 1;
  for (let i = 0; i < app.pageEls.length; i++) {
    if (app.pageEls[i].offsetTop <= scrollTop + 90) current = i + 1;
    else break;
  }
  setCurrentPage(current);
}

function updatePageNavigation() {
  const total = app.pages.length;
  $("pageTotal").textContent = `/ ${total}`;
  $("pageInput").max = String(Math.max(total, 1));
  $("prevPage").disabled = app.currentPage <= 1 || !total;
  $("nextPage").disabled = app.currentPage >= total || !total;
  if (total) $("pageInput").value = String(app.currentPage);
}

function updatePreviewMeta() {
  const cfg = pageDimensions(app.settings);
  const count = app.pages.length;
  const unit = cfg.columns > 1 ? "hoja" : "página";
  const units = cfg.columns > 1 ? "hojas" : "páginas";
  $("previewSize").textContent = `${cfg.label}${cfg.columns > 1 ? " · 3 col" : ""}`;
  $("paperInfo").textContent = `${cfg.label} · ${cfg.mmW} × ${cfg.mmH} mm${cfg.columns > 1 ? " · 3 columnas" : ""}`;
  $("pageCountStatus").textContent = `${count} ${count === 1 ? unit : units}`;
  $("pageTotal").textContent = `/ ${count}`;
  if (count) {
    $("pageInput").value = String(app.currentPage);
    $("pageInput").max = String(count);
  }
  const text = app.editor ? app.editor.getValue() : "";
  const bytes = new TextEncoder().encode(text).length;
  $("fileMeta").textContent = `Markdown · ${formatBytes(bytes)}${count ? ` · ${count} ${cfg.columns > 1 ? "hojas" : "pág."}` : ""}`;
}

/* ───────────────────────── Imágenes y Mermaid ───────────────────────── */

async function insertImages(files) {
  if (!app.editor || !files?.length) return;
  const tokens = [];
  let rejected = 0;
  for (const file of Array.from(files)) {
    if (!file.type.startsWith("image/")) continue;
    if (file.size > 16 * 1024 * 1024) {
      rejected++;
      continue;
    }
    try {
      const data = await fileToDataURL(file);
      const img = await loadImage(data);
      const id = ++app.imageSeq;
      app.images.set(id, { img, displayW: img.width, data });
      app.assets[id] = { data, displayW: img.width };
      tokens.push(`[[IMG:${id}]]`);
    } catch (error) {
      console.warn("Imagen no válida", error);
      rejected++;
    }
  }
  if (tokens.length) {
    app.editor.insertText(`\n${tokens.join("\n")}\n`, { block: true });
    markDirty();
    scheduleCompile(220);
    scheduleAutosave(1200);
    updateDocStats();
    toast(
      `${tokens.length} ${tokens.length === 1 ? "imagen insertada" : "imágenes insertadas"}.`,
      { title: "Imagen" }
    );
  }
  if (rejected) {
    toast(`${rejected} archivo(s) no se pudieron insertar (máximo 16 MB).`, {
      type: "warn",
      title: "Imagen omitida",
    });
  }
}

function findCurrentImageBlock() {
  if (!app.editor) return null;
  const cursor = app.editor.getCursor();
  const lines = app.editor.getValue().split(/\r?\n/);
  let index = cursor.line - 1;
  let line = lines[index] || "";
  if (!line.trim()) {
    let probe = index - 1;
    while (probe >= 0 && !lines[probe].trim()) probe--;
    if (probe >= 0 && /^\[\[IMG:(\d+)(?:\|([^\]]+))?\]\]$/.test(lines[probe].trim())) {
      index = probe;
      line = lines[probe];
    }
  }
  const match = line.match(/^\[\[IMG:(\d+)(?:\|([^\]]+))?\]\]$/);
  if (!match) return null;
  const id = parseInt(match[1], 10);
  const options = parseImageTokenOptions(match[2] || "");
  let endLine = index + 1;
  let sideText = "";
  let hasBlock = false;
  let probe = index + 1;
  const content = [];
  while (probe < lines.length && !/^\[\[\/IMG\]\]$/i.test(lines[probe].trim())) {
    content.push(lines[probe]);
    probe++;
  }
  if (probe < lines.length) {
    hasBlock = true;
    sideText = content.join("\n");
    endLine = probe + 1;
  }
  return { id, options, lineNumber: index + 1, endLine, sideText, hasBlock };
}

function openImageOptionsModal() {
  const block = findCurrentImageBlock();
  if (!block) {
    toast("Coloca el cursor en una línea [[IMG:n]] para ajustar la imagen.", {
      type: "warn",
      title: "Sin imagen seleccionada",
    });
    return;
  }
  const entry = app.images.get(block.id);
  const preview = createEl("div", { class: "image-options-preview" });
  if (entry?.img?.src) {
    preview.append(
      createEl("img", {
        src: entry.img.src,
        alt: "Vista previa de la imagen",
      })
    );
  }
  const width = createEl("input", {
    type: "range",
    min: "20",
    max: "100",
    step: "1",
    value: String(Math.round((block.options.width ?? 1) * 100)),
  });
  const widthOutput = createEl("output", {
    text: `${Math.round((block.options.width ?? 1) * 100)} %`,
  });
  const side = createEl("select", {}, [
    createEl("option", { value: "full", text: "Ancho completo" }),
    createEl("option", { value: "left", text: "Imagen a la izquierda" }),
    createEl("option", { value: "right", text: "Imagen a la derecha" }),
  ]);
  side.value = block.options.side || "full";
  const caption = createEl("input", { type: "text", placeholder: "Pie de imagen (opcional)" });
  caption.value = block.options.caption || "";
  const sideText = createEl("textarea", {
    class: "image-side-text",
    placeholder: "Texto que irá al otro lado de la imagen…",
  });
  sideText.value = block.sideText || "";
  const sideBox = createEl("div", { class: "image-side-box" }, [
    createEl("label", { class: "select-label", for: "image-side-text", text: "Texto al lado" }),
    sideText,
    createEl("p", {
      class: "setting-hint small",
      text: "Solo se usa cuando la imagen va a la izquierda o a la derecha.",
    }),
  ]);
  sideText.id = "image-side-text";
  const toggleSide = () => {
    sideBox.hidden = side.value === "full";
  };
  side.addEventListener("change", toggleSide);
  width.addEventListener("input", () => {
    widthOutput.textContent = `${width.value} %`;
  });
  const body = createEl("div", { class: "image-options" }, [
    preview,
    createEl("div", { class: "control-row" }, [
      createEl("label", { for: "image-width", text: "Ancho" }),
      widthOutput,
    ]),
    width,
    createEl("label", { class: "select-label", for: "image-side", text: "Posición" }),
    side,
    createEl("label", { class: "select-label", for: "image-caption", text: "Pie de imagen" }),
    caption,
    sideBox,
  ]);
  width.id = "image-width";
  side.id = "image-side";
  caption.id = "image-caption";
  toggleSide();
  const modal = showModal({
    title: "Ajustar imagen",
    subtitle: "Redimensiona o coloca texto al otro lado.",
    body,
    actions: [
      { label: "Cancelar", kind: "ghost", onClick: (close) => close() },
      {
        label: "Aplicar",
        kind: "primary",
        onClick: (close) => {
          const ratio = clamp(parseFloat(width.value) / 100, 0.2, 1);
          const imageSide = side.value;
          const cleanCaption = caption.value.trim().replace(/\|/g, "·");
          const parts = [`width=${Math.round(ratio * 100)}%`];
          if (imageSide !== "full") parts.push(`side=${imageSide}`);
          if (cleanCaption) parts.push(cleanCaption);
          const token = `[[IMG:${block.id}|${parts.join("|")}]]`;
          const content =
            imageSide === "full"
              ? token
              : `${token}\n${sideText.value.trim()}\n[[/IMG]]`;
          app.editor.replaceLines(block.lineNumber, block.endLine, content);
          close();
          markDirty();
          scheduleCompile(180);
          scheduleAutosave(1000);
        },
      },
    ],
  });
  return modal;
}

function openMermaidModal() {
  const textarea = createEl("textarea", {
    class: "mermaid-input",
    spellcheck: "false",
    placeholder: "flowchart LR\n  A[Cliente] --> B[Servidor]\n  B --> C[Base de datos]",
  });
  const body = createEl("div", {}, [
    textarea,
    createEl("p", {
      class: "modal-hint",
      text:
        "El diagrama se guarda como bloque de código dentro del documento y se vuelve a dibujar al compilar. Tema redux-color, igual que mermaid.live.",
    }),
  ]);
  const modal = showModal({
    title: "Insertar diagrama Mermaid",
    subtitle: "Se renderiza automáticamente al recompilar.",
    body,
    actions: [
      { label: "Cancelar", kind: "ghost", onClick: (close) => close() },
      {
        label: "Insertar diagrama",
        kind: "primary",
        onClick: (close) => {
          const code = textarea.value.trim();
          if (!code) {
            toast("Escribe el código Mermaid primero.", { type: "warn" });
            return;
          }
          close();
          const block = "```mermaid\n" + code + "\n```\n";
          app.editor.insertText(`\n${block}`, { block: true });
          markDirty();
          scheduleCompile(180);
          scheduleAutosave(1200);
        },
      },
    ],
  });
  setTimeout(() => textarea.focus(), 40);
  return modal;
}

/* ───────────────────────── Proyectos ───────────────────────── */

async function confirmDiscard() {
  if (!app.dirty) return true;
  return new Promise((resolve) => {
    let decided = false;
    showModal({
      title: "Cambios sin guardar",
      subtitle: "Puedes guardar antes de abrir otro documento.",
      body: createEl("p", {
        class: "confirm-text",
        text: "El documento tiene cambios que todavía no están en el archivo del proyecto. ¿Qué quieres hacer?",
      }),
      narrow: true,
      actions: [
        {
          label: "Cancelar",
          kind: "ghost",
          onClick: (close) => {
            decided = true;
            close();
            resolve(false);
          },
        },
        {
          label: "Descartar",
          kind: "danger",
          onClick: (close) => {
            decided = true;
            close();
            resolve(true);
          },
        },
        {
          label: "Guardar y continuar",
          kind: "primary",
          onClick: async (close) => {
            decided = true;
            close();
            if (app.projectPath) await saveProject();
            else await saveProjectAs();
            resolve(!app.dirty);
          },
        },
      ],
      onClose: () => {
        if (!decided) resolve(false);
      },
    });
  });
}

async function applyRuntimePayload(payload, path = null) {
  app.compileGen += 1;
  const markdown = applyPayloadToState(payload);
  if (path) app.projectPath = path;
  app.editor.setValue(markdown);
  app.mermaidErrors.clear();
  app.mermaidQueue.clear();
  await hydrateAssets(app.assets);
  app.zoomMode = "fit";
  app.currentPage = 1;
  syncSettingsControls();
  updateTitleUI();
  updateDirtyUI();
  setSaveState("saved", "Guardado");
  updateOutline();
  updateDocStats();
  $("previewScroll").scrollTop = 0;
  await compile({ preservePage: false });
  scheduleAutosave(400);
}

async function loadExampleTemplate() {
  const ok = await confirmDiscard();
  if (!ok) return;
  app.compileGen += 1;
  app.title = "Plantilla de ejemplo";
  app.projectPath = null;
  app.tags = [];
  app.assets = {};
  app.images = new Map();
  app.imageSeq = 0;
  app.mermaidErrors.clear();
  app.mermaidQueue.clear();
  app.editor.setValue(exampleMd);
  app.zoomMode = "fit";
  app.currentPage = 1;
  syncSettingsControls();
  updateTitleUI();
  updateOutline();
  updateDocStats();
  markDirty();
  await compile({ preservePage: false });
  scheduleAutosave(500);
  toast("Plantilla cargada. Edítala o bórrala para empezar tu manuscrito.", {
    title: "Plantilla de ejemplo",
  });
}

/** Crea un documento vacío y limpia la sesión anterior. */
async function newProject() {
  const ok = await confirmDiscard();
  if (!ok) return;
  if (app.isTauri) {
    try {
      await invoke("clear_autosave");
    } catch {
      /* noop */
    }
  }
  app.compileGen += 1;
  app.title = "Sin título";
  app.projectPath = null;
  app.tags = [];
  app.settings = { ...DEFAULT_SETTINGS };
  app.assets = {};
  app.images = new Map();
  app.imageSeq = 0;
  app.mermaidCache.clear();
  app.mermaidErrors.clear();
  app.mermaidQueue.clear();
  app.editor.setValue("");
  app.zoomMode = "fit";
  app.currentPage = 1;
  syncSettingsControls();
  updateTitleUI();
  updateOutline();
  updateDocStats();
  markDirty();
  await compile({ preservePage: false });
  scheduleAutosave(500);
  toast("Proyecto nuevo. Empieza a escribir o importa un Markdown.", {
    title: "Nuevo proyecto",
  });
}

/** Abre un `.papernotes` desde una ruta conocida y actualiza recientes. */
async function openProjectPath(path) {
  const ok = await confirmDiscard();
  if (!ok) return;
  try {
    const payload = await invoke("load_project", { path });
    if (!payload || typeof payload !== "object") throw new Error("Proyecto inválido.");
    await applyRuntimePayload(payload, path);
    try {
      await invoke("touch_recent", { path, title: app.title });
    } catch {
      /* el proyecto ya quedó abierto */
    }
    toast("Proyecto abierto.", { title: "Listo" });
  } catch (error) {
    console.error(error);
    toast(`No se pudo abrir el proyecto: ${error}`, {
      type: "error",
      title: "Error al abrir",
    });
  }
}

async function chooseProjectFile() {
  const path = await openFileDialog({
    title: "Abrir proyecto Tinta Propia",
    multiple: false,
    filters: [{ name: "Proyecto Tinta Propia", extensions: ["papernotes", "json"] }],
  });
  if (typeof path === "string") await openProjectPath(path);
}

function pickBrowserFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.addEventListener("change", () => {
      resolve(input.files?.[0] || null);
    });
    input.click();
  });
}

async function openProjectFlow() {
  if (!app.isTauri) {
    const file = await pickBrowserFile(".papernotes,.json,application/json");
    if (!file) return;
    const ok = await confirmDiscard();
    if (!ok) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      await applyRuntimePayload(payload, null);
      toast("Proyecto abierto desde el navegador.", { title: "Listo" });
    } catch (error) {
      toast("El archivo no es un proyecto Tinta Propia válido.", {
        type: "error",
        title: "Error al abrir",
      });
    }
    return;
  }
  await showRecentProjects({ openProjectPath, chooseProjectFile });
}

function openLibrary() {
  return openHomeView({
    newProject,
    openProjectFlow,
    chooseProjectFile,
    openMarkdownFlow,
    loadExampleTemplate,
    saveProjectAs,
    openProjectPath,
    scheduleAutosave,
    updateTitleUI,
  });
}

async function openMarkdownFlow() {
  const ok = await confirmDiscard();
  if (!ok) return;
  try {
    let content = null;
    let name = "documento.md";
    if (app.isTauri) {
      const path = await openFileDialog({
        title: "Importar Markdown",
        multiple: false,
        filters: [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }],
      });
      if (!path) return;
      content = await invoke("read_text_file", { path });
      name = path.split(/[\\/]/).pop() || name;
    } else {
      const file = await pickBrowserFile(".md,.markdown,.txt,text/markdown,text/plain");
      if (!file) return;
      content = await file.text();
      name = file.name;
    }
    app.compileGen += 1;
    app.title = name.replace(/\.[^.]+$/, "") || "Sin título";
    app.projectPath = null;
    app.tags = [];
    app.assets = {};
    app.images = new Map();
    app.imageSeq = 0;
    app.mermaidCache.clear();
    app.mermaidErrors.clear();
    app.mermaidQueue.clear();
    app.editor.setValue(content);
    app.zoomMode = "fit";
    app.currentPage = 1;
    updateTitleUI();
    updateOutline();
    updateDocStats();
    markDirty();
    await compile({ preservePage: false });
    scheduleAutosave(500);
    toast(
      "Markdown importado. Guarda como proyecto para conservar imágenes y ajustes.",
      { title: "Documento abierto", timeout: 6000 }
    );
  } catch (error) {
    console.error(error);
    toast(`No se pudo importar el documento: ${error}`, {
      type: "error",
      title: "Error al importar",
    });
  }
}

/** Guarda el proyecto actual; si no tiene ruta, delega en “Guardar como”. */
async function saveProject() {
  if (!app.editor) return;
  if (!app.isTauri || !app.projectPath) return saveProjectAs();
  const snapshot = buildProject();
  try {
    setSaveState("saving", "Guardando…");
    await invoke("save_project", {
      path: app.projectPath,
      project: snapshot,
    });
    app.lastSavedAt = Date.now();
    app.dirty = false;
    updateDirtyUI();
    setSaveState("saved", "Guardado");
    toast("Proyecto guardado.", { title: "Listo" });
  } catch (error) {
    console.error(error);
    setSaveState("error", "Error al guardar");
    toast(`No se pudo guardar: ${error}`, { type: "error", title: "Error" });
  }
}

async function saveProjectAs({ defaultDir = null } = {}) {
  if (!app.editor) return;
  const snapshot = buildProject();
  if (!app.isTauri) {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slugify(app.title)}.papernotes`;
    anchor.click();
    URL.revokeObjectURL(url);
    app.lastSavedAt = Date.now();
    app.dirty = false;
    updateDirtyUI();
    setSaveState("saved", "Guardado");
    toast("Proyecto descargado.", { title: "Listo" });
    return;
  }
  try {
    const baseDir = defaultDir || app.boot?.projectsDir || app.boot?.documentsDir;
    const separator = baseDir?.includes("\\") ? "\\" : "/";
    const defaultPath = baseDir
      ? `${baseDir.replace(/[\\/]$/, "")}${separator}${slugify(app.title)}.papernotes`
      : `${slugify(app.title)}.papernotes`;
    const path = await saveFileDialog({
      title: "Guardar proyecto Tinta Propia",
      defaultPath,
      filters: [
        { name: "Proyecto Tinta Propia", extensions: ["papernotes"] },
        { name: "JSON", extensions: ["json"] },
      ],
    });
    if (!path) return;
    setSaveState("saving", "Guardando…");
    snapshot.path = path;
    await invoke("save_project", { path, project: snapshot });
    app.projectPath = path;
    app.lastSavedAt = Date.now();
    app.dirty = false;
    updateDirtyUI();
    updateTitleUI();
    setSaveState("saved", "Guardado");
    await invoke("save_autosave", { project: { ...snapshot, path } });
    toast("Proyecto guardado.", { title: "Listo" });
  } catch (error) {
    console.error(error);
    setSaveState("error", "Error al guardar");
    toast(`No se pudo guardar: ${error}`, { type: "error", title: "Error" });
  }
}

/* ───────────────────────── Externos ───────────────────────── */

async function toggleFullscreen() {
  try {
    if (!app.isTauri) {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      return;
    }
    const win = getCurrentWindow();
    const full = await win.isFullscreen();
    await win.setFullscreen(!full);
  } catch (error) {
    console.error(error);
    toast("No se pudo cambiar la pantalla completa.", { type: "error" });
  }
}

async function quitApp() {
  if (!app.isTauri) {
    window.close();
    return;
  }
  try {
    await flushForClose();
    await getCurrentWindow().close();
  } catch (error) {
    console.error(error);
    toast(`No se pudo cerrar la aplicación: ${error}`, { type: "error" });
  }
}

function openDataDirectory() {
  if (!app.isTauri || !app.boot?.dataDir) {
    toast("La carpeta de datos solo existe en la aplicación de escritorio.", {
      type: "info",
    });
    return;
  }
  openFolder(app.boot.dataDir);
}

function showAbout() {
  const body = createEl("div");
  const hero = createEl("div", { class: "about-hero" }, [
    createEl("div", { class: "brand-mark" }, [
      createEl("img", { src: iconUrl, alt: "Tinta Propia" }),
    ]),
    createEl("div", {}, [
      createEl("h3", { text: "Tinta Propia" }),
      createEl("p", { text: "Manuscritos con tu propia letra, 100 % locales." }),
    ]),
  ]);
  const grid = createEl("dl", { class: "about-grid" });
  const rows = [
    ["Versión", app.boot?.version || "0.9.0"],
    ["Motor", "Canvas 2D + Mermaid 12 + MathJax 3"],
    ["Plataforma", app.isTauri ? "Tauri 2 + Rust" : "Navegador"],
    ["Datos", app.boot?.dataDir || "Almacenamiento local del navegador"],
    ["Privacidad", "Sin red, sin cuentas, sin telemetría"],
  ];
  for (const [key, value] of rows) {
    grid.append(createEl("dt", { text: key }), createEl("dd", { text: value }));
  }
  body.append(hero, grid);
  showModal({
    title: "Acerca de",
    body,
    narrow: true,
    actions: [{ label: "Cerrar", kind: "primary", onClick: (close) => close() }],
  });
}

function openFormulaPalette() {
  openFormulaModal({
    onInsert: (code, type) => {
      const formula = type === "block" ? `$$\n${code}\n$$` : `$${code}$`;
      app.editor.insertText(`\n${formula}\n`, { block: true });
      markDirty();
      scheduleCompile(220);
      scheduleAutosave(1200);
    },
  });
}

function showShortcuts() {
  const shortcuts = [
    ["Recompilar manuscrito", "Ctrl + Enter"],
    ["Guardar proyecto", "Ctrl + S"],
    ["Guardar como…", "Ctrl + Shift + S"],
    ["Abrir proyecto", "Ctrl + O"],
    ["Nuevo proyecto", "Ctrl + N"],
    ["Ajustes del manuscrito", "Ctrl + ,"],
    ["Mostrar u ocultar panel", "Ctrl + \\"],
    ["Negrita / cursiva / código", "Ctrl + B / I / E"],
    ["Buscar en el editor", "Ctrl + F"],
    ["Exportar PDF", "Ctrl + Shift + E"],
    ["Insertar fórmula rápida", "Ctrl + Shift + F"],
    ["Cerrar ventanas y menús", "Esc"],
  ];
  const grid = createEl("div", { class: "shortcut-grid" });
  for (const [label, key] of shortcuts) {
    grid.append(createEl("div", { text: label }), createEl("div", { text: key }));
  }
  showModal({
    title: "Atajos de teclado",
    subtitle: "Todo funciona sin conexión.",
    body: grid,
    actions: [{ label: "Cerrar", kind: "primary", onClick: (close) => close() }],
  });
}

/* ───────────────────────── Ajustes de interfaz ───────────────────────── */

function openSettings() {
  $("menuPopover").hidden = true;
  $("brandMenuBtn").setAttribute("aria-expanded", "false");
  $("settingsDrawer").classList.add("open");
  $("drawerOverlay").hidden = false;
  setTimeout(() => $("drawerClose").focus(), 120);
}

function closeSettings() {
  $("settingsDrawer").classList.remove("open");
  $("drawerOverlay").hidden = true;
}

function toggleSidebar(force) {
  const sidebar = $("sidebar");
  const collapsed =
    typeof force === "boolean" ? !force : !sidebar.classList.contains("collapsed");
  sidebar.classList.toggle("collapsed", collapsed);
  localStorage.setItem(SIDEBAR_KEY, collapsed ? "0" : "1");
  setTimeout(() => {
    if (app.zoomMode === "fit" && app.result) {
      app.zoom = fitZoom();
      applyZoom(false);
    }
  }, 210);
}

function applyEditorWidth(px) {
  const workspace = $("workspace");
  const sidebar = $("sidebar");
  const available = workspace.clientWidth - sidebar.offsetWidth - 5;
  const minEditor = 330;
  const minPreview = 330;
  const width = clamp(px, minEditor, Math.max(minEditor, available - minPreview));
  $("editorPane").style.width = `${width}px`;
  $("editorPane").style.flexBasis = `${width}px`;
  if (app.zoomMode === "fit" && app.result) {
    app.zoom = fitZoom();
    applyZoom(false);
  }
  return width;
}

function setupSplitter() {
  const splitter = $("splitter");
  let dragging = false;
  splitter.addEventListener("pointerdown", (event) => {
    dragging = true;
    splitter.classList.add("dragging");
    document.body.classList.add("resizing");
    splitter.setPointerCapture(event.pointerId);
  });
  splitter.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const workspace = $("workspace");
    const rect = workspace.getBoundingClientRect();
    const sidebar = $("sidebar");
    const width = event.clientX - rect.left - sidebar.offsetWidth - 2;
    applyEditorWidth(width);
  });
  const stop = () => {
    if (!dragging) return;
    dragging = false;
    splitter.classList.remove("dragging");
    document.body.classList.remove("resizing");
    const workspace = $("workspace");
    const sidebar = $("sidebar");
    const fraction =
      $("editorPane").offsetWidth / Math.max(1, workspace.clientWidth - sidebar.offsetWidth);
    localStorage.setItem(EDITOR_WIDTH_KEY, fraction.toFixed(3));
  };
  splitter.addEventListener("pointerup", stop);
  splitter.addEventListener("pointercancel", stop);
  splitter.addEventListener("dblclick", () => {
    const workspace = $("workspace");
    const sidebar = $("sidebar");
    applyEditorWidth((workspace.clientWidth - sidebar.offsetWidth) * 0.46);
    localStorage.setItem(EDITOR_WIDTH_KEY, "0.46");
  });
}

function restoreEditorWidth() {
  const saved = parseFloat(localStorage.getItem(EDITOR_WIDTH_KEY));
  const fraction = Number.isFinite(saved) && saved > 0 ? saved : 0.46;
  const workspace = $("workspace");
  const sidebar = $("sidebar");
  applyEditorWidth((workspace.clientWidth - sidebar.offsetWidth) * fraction);
}

/* ───────────────────────── Acciones de formato ───────────────────────── */

function handleFormat(action) {
  if (!app.editor) return;
  switch (action) {
    case "h2":
      app.editor.prefixLine("## ");
      break;
    case "bold":
      app.editor.wrapSelection("**", "**", "texto");
      break;
    case "italic":
      app.editor.wrapSelection("_", "_", "texto");
      break;
    case "strike":
      app.editor.wrapSelection("~~", "~~", "texto");
      break;
    case "code":
      app.editor.wrapSelection("`", "`", "código");
      break;
    case "link":
      app.editor.wrapSelection("[", "](https://)", "texto");
      break;
    case "list":
      app.editor.prefixLine("- ");
      break;
    case "check":
      app.editor.prefixLine("- [ ] ");
      break;
    case "quote":
      app.editor.prefixLine("> ");
      break;
    case "callout":
      app.editor.insertText(
        "\n> [!NOTE] Idea clave\n> Escribe aquí el contenido del callout.\n",
        { block: true }
      );
      break;
    case "table":
      app.editor.insertText(
        "\n| Columna 1 | Columna 2 |\n|---|---|\n| Dato | Dato |\n",
        { block: true }
      );
      break;
    case "image":
      if (findCurrentImageBlock()) openImageOptionsModal();
      else $("hiddenImageInput").click();
      return;
    case "formula":
      openFormulaPalette();
      return;
    case "mermaid":
      openMermaidModal();
      return;
    case "pagebreak":
      app.editor.insertText("\n[[PAGEBREAK]]\n", { block: true });
      break;
    case "columnbreak":
      app.editor.insertText("\n[[COLUMNBREAK]]\n", { block: true });
      break;
    default:
      return;
  }
  markDirty();
  scheduleCompile(260);
  scheduleAutosave(1200);
}

/* ───────────────────────── Eventos ───────────────────────── */

function bindSettingsEvents() {
  const ids = [...SETTING_IDS, "preset"];
  for (const id of ids) {
    const el = $(id);
    if (!el) continue;
    el.addEventListener("input", (event) => {
      if (id === "preset") return;
      onSettingsChanged(event);
    });
    el.addEventListener("change", (event) => {
      if (id === "preset") {
        applyPreset(el.value);
        return;
      }
      onSettingsChanged(event);
    });
  }
  document.querySelectorAll("[data-word]").forEach((button) => {
    button.addEventListener("click", () => {
      $("wordSpacing").value = button.dataset.word;
      syncRangeOutputs();
      onSettingsChanged({ target: $("wordSpacing") });
    });
  });
  document.querySelectorAll("[data-size]").forEach((button) => {
    button.addEventListener("click", () => {
      $("size").value = button.dataset.size;
      syncRangeOutputs();
      onSettingsChanged({ target: $("size") });
    });
  });
  $("regenSeed").addEventListener("click", () => {
    $("seed").value = String(Math.floor(Math.random() * 999999));
    onSettingsChanged({ target: $("seed") });
  });
  $("resetSettings").addEventListener("click", () => {
    app.settings = { ...DEFAULT_SETTINGS };
    syncSettingsControls();
    markDirty();
    scheduleCompile(120);
    scheduleAutosave(1200);
    scheduleGlobalSettings();
  });
  $("applyApunte").addEventListener("click", () => applyPreset("apunte"));
  $("importFontBtn").addEventListener("click", importFont);
  $("fontFile")?.addEventListener("change", handleBrowserFont);
  $("hiddenFontInput").addEventListener("change", handleBrowserFont);
  $("drawerClose").addEventListener("click", closeSettings);
  $("drawerOverlay").addEventListener("click", closeSettings);
  $("openSettingsBtn").addEventListener("click", openSettings);
  $("previewSettingsBtn").addEventListener("click", openSettings);
}

async function importFont() {
  if (!app.editor) return;
  try {
    if (app.isTauri) {
      const path = await openFileDialog({
        title: "Importar fuente manuscrita",
        multiple: false,
        filters: [
          { name: "Fuentes", extensions: ["ttf", "otf", "woff", "woff2"] },
        ],
      });
      if (!path) return;
      const font = await invoke("import_font", { path });
      await registerFont(font.name, font.data);
      app.settings.font = font.name;
      syncSettingsControls();
      markDirty();
      scheduleCompile(100);
      scheduleAutosave(900);
      toast(`Fuente agregada: ${font.name}`, { title: "Fuente importada" });
    } else {
      $("hiddenFontInput").click();
    }
  } catch (error) {
    console.error(error);
    toast("No se pudo importar la fuente. Prueba con TTF u OTF.", {
      type: "error",
      title: "Fuente no válida",
    });
  }
}

async function handleBrowserFont(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const buffer = await file.arrayBuffer();
    const name = file.name.replace(/\.[^.]+$/, "").replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]/g, "").trim() || "Mi fuente";
    const face = new FontFace(name, buffer);
    await face.load();
    document.fonts.add(face);
    if (!app.fontList.some((font) => font.value === name)) {
      app.fontList.push({ value: name, label: name });
    }
    app.settings.font = name;
    syncSettingsControls();
    markDirty();
    scheduleCompile(100);
    scheduleAutosave(900);
    toast(`Fuente agregada: ${name}. En el navegador dura solo esta sesión.`, {
      title: "Fuente importada",
      timeout: 5500,
    });
  } catch (error) {
    console.error(error);
    toast("No se pudo cargar esa fuente.", { type: "error" });
  } finally {
    event.target.value = "";
  }
}

function bindEditorEvents() {
  $("editorToolbar").addEventListener("click", (event) => {
    const button = event.target.closest("[data-format]");
    if (button) handleFormat(button.dataset.format);
  });
  $("hiddenImageInput").addEventListener("change", (event) => {
    insertImages(event.target.files);
    event.target.value = "";
  });
  $("mainFile").addEventListener("click", () => app.editor?.focus());
  $("addMdBtn").addEventListener("click", openMarkdownFlow);
  $("emptyOpenBtn").addEventListener("click", openProjectFlow);
  $("emptyExampleBtn").addEventListener("click", loadExampleTemplate);

  $("compileBtn").addEventListener("click", () => compile());
  $("fullscreenBtn").addEventListener("click", toggleFullscreen);
  $("exportPdfBtn").addEventListener("click", exportPDF);
  $("exportPdfBtn2").addEventListener("click", exportPDF);

  $("zoomIn").addEventListener("click", () =>
    setZoom(app.zoom + (app.zoom < 1 ? 0.1 : 0.15), "manual")
  );
  $("zoomOut").addEventListener("click", () =>
    setZoom(app.zoom - (app.zoom <= 1 ? 0.1 : 0.15), "manual")
  );
  $("zoomLabel").addEventListener("click", () => setZoom(1, "manual"));
  $("fitWidth").addEventListener("click", () => {
    app.zoomMode = "fit";
    app.zoom = fitZoom();
    applyZoom();
  });

  $("prevPage").addEventListener("click", () =>
    scrollToPage(Math.max(1, app.currentPage - 1))
  );
  $("nextPage").addEventListener("click", () =>
    scrollToPage(Math.min(app.pages.length, app.currentPage + 1))
  );
  $("pageInput").addEventListener("change", () => {
    const value = parseInt($("pageInput").value, 10);
    if (Number.isFinite(value)) scrollToPage(clamp(value, 1, app.pages.length));
  });
  $("pageInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      $("pageInput").blur();
      const value = parseInt($("pageInput").value, 10);
      if (Number.isFinite(value)) scrollToPage(clamp(value, 1, app.pages.length));
    }
  });

  $("previewScroll").addEventListener("scroll", () => {
    if (app.scrollRaf) return;
    app.scrollRaf = requestAnimationFrame(() => {
      app.scrollRaf = 0;
      updateCurrentPageFromScroll();
    });
  });

  $("previewScroll").addEventListener("dragover", (event) => {
    if (event.dataTransfer?.types?.includes("Files")) event.preventDefault();
  });
  $("previewScroll").addEventListener("drop", (event) => {
    const files = Array.from(event.dataTransfer?.files || []).filter((file) =>
      file.type.startsWith("image/")
    );
    if (!files.length) return;
    event.preventDefault();
    insertImages(files);
  });

  window.addEventListener("paste", (event) => {
    if (!event.target.closest?.(".cm-editor")) return;
    const files = Array.from(event.clipboardData?.items || [])
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter(Boolean);
    if (!files.length) return;
    event.preventDefault();
    insertImages(files);
  });

  $("projectTitle").addEventListener("input", (event) => {
    app.title = event.target.value.trim() || "Sin título";
    updateTitleUI();
    markDirty();
    scheduleAutosave(1400);
  });
  $("projectTitle").addEventListener("blur", (event) => {
    if (!event.target.value.trim()) event.target.value = "Sin título";
  });

  $("sidebarToggle").addEventListener("click", () => toggleSidebar());
  $("newBtn").addEventListener("click", newProject);
  $("openBtn").addEventListener("click", openProjectFlow);
  $("saveBtn").addEventListener("click", saveProject);
  $("brandMenuBtn").addEventListener("click", (event) => {
    event.stopPropagation();
    const menu = $("menuPopover");
    menu.hidden = !menu.hidden;
    $("brandMenuBtn").setAttribute("aria-expanded", String(!menu.hidden));
  });

  $("menuPopover").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    $("menuPopover").hidden = true;
    $("brandMenuBtn").setAttribute("aria-expanded", "false");
    switch (button.dataset.action) {
      case "welcome":
        await openLibrary();
        break;
      case "new":
        await newProject();
        break;
      case "example":
        await loadExampleTemplate();
        break;
      case "open":
        await openProjectFlow();
        break;
      case "open-md":
        await openMarkdownFlow();
        break;
      case "save":
        await saveProject();
        break;
      case "save-as":
        await saveProjectAs();
        break;
      case "export-md":
        await exportMarkdown();
        break;
      case "insert-image":
        $("hiddenImageInput").click();
        break;
      case "image-options":
        openImageOptionsModal();
        break;
      case "insert-formula":
        openFormulaPalette();
        break;
      case "insert-mermaid":
        openMermaidModal();
        break;
      case "page-break":
        handleFormat("pagebreak");
        break;
      case "column-break":
        handleFormat("columnbreak");
        break;
      case "settings":
        openSettings();
        break;
      case "data-dir":
        openDataDirectory();
        break;
      case "shortcuts":
        showShortcuts();
        break;
      case "about":
        showAbout();
        break;
      case "quit":
        await quitApp();
        break;
    }
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest("#menuPopover") && !event.target.closest("#brandMenuBtn")) {
      $("menuPopover").hidden = true;
      $("brandMenuBtn").setAttribute("aria-expanded", "false");
    }
  });

  setupSplitter();
  restoreEditorWidth();
  if (localStorage.getItem(SIDEBAR_KEY) === "0") toggleSidebar(false);

  const resizeObserver = new ResizeObserver(() => {
    if (app.zoomMode !== "fit" || !app.result) return;
    clearTimeout(app.fitTimer);
    app.fitTimer = setTimeout(() => {
      app.zoom = fitZoom();
      applyZoom(false);
    }, 70);
  });
  resizeObserver.observe($("previewScroll"));
  resizeObserver.observe($("workspace"));

  window.addEventListener("resize", () => {
    const workspace = $("workspace");
    const sidebar = $("sidebar");
    const minEditor = 330;
    const minPreview = 330;
    const current = $("editorPane").offsetWidth;
    const available = workspace.clientWidth - sidebar.offsetWidth;
    if (current > available - minPreview) {
      applyEditorWidth(Math.max(minEditor, available - minPreview));
    }
  });
}

function bindGlobalKeys() {
  window.addEventListener("keydown", async (event) => {
    const mod = event.ctrlKey || event.metaKey;
    if (event.key === "Escape") {
      if (app.modalStack.length) {
        const close = app.modalStack[app.modalStack.length - 1];
        close("escape");
        event.preventDefault();
        return;
      }
      if ($("settingsDrawer").classList.contains("open")) {
        closeSettings();
        event.preventDefault();
        return;
      }
      if (!$("menuPopover").hidden) {
        $("menuPopover").hidden = true;
        $("brandMenuBtn").setAttribute("aria-expanded", "false");
        event.preventDefault();
        return;
      }
    }
    if (event.key === "F11") {
      event.preventDefault();
      await toggleFullscreen();
      return;
    }
    if (app.modalStack.length) return;
    if (mod && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (event.shiftKey) await saveProjectAs();
      else await saveProject();
      return;
    }
    if (mod && event.key.toLowerCase() === "o") {
      event.preventDefault();
      await openProjectFlow();
      return;
    }
    if (mod && event.key.toLowerCase() === "n") {
      event.preventDefault();
      await newProject();
      return;
    }
    if (mod && event.key.toLowerCase() === "q") {
      event.preventDefault();
      await quitApp();
      return;
    }
    if (mod && event.key === "Enter") {
      event.preventDefault();
      await compile();
      return;
    }
    if (mod && event.key === ",") {
      event.preventDefault();
      openSettings();
      return;
    }
    if (mod && event.shiftKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      openFormulaPalette();
      return;
    }
    if (mod && event.key === "\\") {
      event.preventDefault();
      toggleSidebar();
      return;
    }
    if (mod && event.shiftKey && event.key.toLowerCase() === "e") {
      event.preventDefault();
      await exportPDF();
      return;
    }
    if (
      event.key === "?" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName) &&
      !document.activeElement?.closest?.(".cm-editor")
    ) {
      event.preventDefault();
      showShortcuts();
    }
  });
}

async function setupTauriCloseHandler() {
  if (!app.isTauri) return;
  try {
    const win = getCurrentWindow();
    await win.onCloseRequested(async (event) => {
      if (app.closing) return;
      event.preventDefault();
      app.closing = true;
      await flushForClose();
      await win.destroy();
    });
  } catch (error) {
    console.warn("No se pudo registrar el cierre de ventana", error);
  }
}

/* ───────────────────────── Arranque ───────────────────────── */

/**
 * Arranque de la aplicación.
 *
 * Restaura la sesión, registra fuentes, crea el editor y enlaza los eventos.
 * La pantalla de inicio se abre después del primer render para no bloquear el
 * arranque con la lectura de la biblioteca.
 */
async function boot() {
  initMermaid();
  app.boot = await readBootstrap();
  if (app.boot?.version) $("sbVersion").textContent = `v${app.boot.version}`;
  if (app.boot.customFonts?.length) {
    for (const font of app.boot.customFonts) {
      try {
        await registerFont(font.name, font.data);
      } catch (error) {
        console.warn("No se pudo registrar la fuente", font.name, error);
      }
    }
  }

  const autosave = app.isTauri ? app.boot.autosave : readLocalAutosave();
  const globalSettings = app.boot.settings || readLocalSettings();
  if (autosave) {
    const markdown = applyPayloadToState(autosave);
    app.initialDocument = markdown;
    app.restored = true;
  } else {
    app.initialDocument = exampleMd;
    app.title = "Plantilla de ejemplo";
    app.projectPath = null;
    app.settings = normalizeSettings({ ...DEFAULT_SETTINGS, ...(globalSettings || {}) });
    app.assets = {};
    app.imageSeq = 0;
  }

  const preset = $("preset");
  const customOption = document.createElement("option");
  customOption.value = "custom";
  customOption.textContent = "Personalizado";
  customOption.disabled = true;
  preset.append(customOption);

  await hydrateAssets(app.assets);
  await ensureFont(app.settings.font);
  populateFontSelect(app.settings.font);
  syncSettingsControls();
  updateTitleUI();

  app.editor = new MarkdownEditor($("editorHost"), {
    doc: app.initialDocument,
    onChange: handleEditorChange,
    onCursor: handleCursor,
    onDropFiles: insertImages,
    onCompile: () => compile(),
  });

  bindSettingsEvents();
  bindEditorEvents();
  bindGlobalKeys();
  updateOutline();
  updateDocStats();
  updateDirtyUI();
  setSaveState("saved", app.restored ? "Sesión restaurada" : "Guardado");

  await compile({ initial: true, preservePage: false });
  app.ready = true;
  setTimeout(() => $("bootScreen").classList.add("hidden"), 250);
  setTimeout(() => $("bootScreen").remove(), 900);
  setTimeout(() => openLibrary(), 1000);

  if (app.bootError) {
    toast(
      "La app abrió en modo navegador porque no pudo comunicarse con Rust. Tus archivos siguen a salvo.",
      { type: "warn", title: "Modo limitado", timeout: 8000 }
    );
  }
  setupTauriCloseHandler();
  scheduleAutosave(1500);
}

window.addEventListener("beforeunload", () => {
  if (!app.isTauri && app.editor) {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(buildProject()));
    } catch {
      /* sin espacio */
    }
  }
});

boot().catch((error) => {
  console.error(error);
  const boot = $("bootScreen");
  if (boot) {
    boot.querySelector("p").textContent = "No se pudo iniciar la aplicación.";
    boot.querySelector(".boot-bar")?.remove();
  }
  const message = document.createElement("pre");
  message.style.cssText =
    "color:#ffd7d2;font-size:11px;max-width:80vw;white-space:pre-wrap;margin-top:14px;text-align:left";
  message.textContent = error?.stack || String(error);
  boot?.querySelector(".boot-card")?.append(message);
  toast("No se pudo iniciar Tinta Propia.", {
    type: "error",
    title: "Error de arranque",
    timeout: 10000,
  });
});
