import { DEFAULT_SETTINGS, FONTS } from "../engine.js";

/**
 * Estado global de la aplicación.
 *
 * Se mantiene en un módulo aparte para que la biblioteca, las exportaciones y
 * los componentes de interfaz puedan consultar el mismo estado sin depender
 * de `main.js`.
 */

export const isTauri =
  typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);

export const AUTOSAVE_KEY = "tintapropia.autosave.v1";
export const SETTINGS_KEY = "tintapropia.settings.v1";
export const EDITOR_WIDTH_KEY = "tintapropia.editorWidth.v1";
export const SIDEBAR_KEY = "tintapropia.sidebar.v1";

export const numberFmt = new Intl.NumberFormat("es-CL");

export const app = {
  isTauri,
  ready: false,
  boot: null,
  bootError: null,
  editor: null,
  title: "Sin título",
  projectPath: null,
  tags: [],
  settings: { ...DEFAULT_SETTINGS },
  assets: {},
  images: new Map(),
  imageSeq: 0,
  pages: [],
  result: null,
  pageEls: [],
  currentPage: 1,
  zoom: 1,
  zoomMode: "fit",
  dirty: false,
  compiling: false,
  pendingCompile: false,
  compileGen: 0,
  compileTimer: null,
  autosaveTimer: null,
  autosaveRunning: false,
  autosavePending: false,
  settingsTimer: null,
  outlineTimer: null,
  statsTimer: null,
  mermaidCache: new Map(),
  mathCache: new Map(),
  mermaidErrors: new Map(),
  mermaidQueue: new Set(),
  mermaidJobRunning: false,
  fontList: [...FONTS],
  lastSavedAt: 0,
  lastWarningKey: "",
  restored: false,
  modalStack: [],
  scrollRaf: 0,
  fitTimer: null,
  closing: false,
};
