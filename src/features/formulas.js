import { app } from "../core/state.js";
import { createEl } from "../core/utils.js";
import { showModal, toast } from "../core/modal.js";
import { renderMathPreview } from "../math.js";

/**
 * Paleta de inserción rápida de fórmulas.
 *
 * Guarda en `localStorage` las fórmulas más usadas y las recientes. Los chips
 * insertan el código LaTeX en el cursor del campo, sin cerrar el diálogo. Al
 * confirmar, `onInsert` recibe el código y el tipo (`inline` o `block`).
 */

const USAGE_KEY = "tintapropia.formulaUsage.v1";
const RECENT_KEY = "tintapropia.formulaRecent.v1";

const FORMULA_GROUPS = [
  {
    name: "Básicas",
    items: [
      { label: "x²", code: "x^2", title: "Potencia" },
      { label: "xᵢ", code: "x_i", title: "Subíndice" },
      { label: "a/b", code: "\\frac{a}{b}", title: "Fracción" },
      { label: "√x", code: "\\sqrt{x}", title: "Raíz cuadrada" },
      { label: "ⁿ√x", code: "\\sqrt[n]{x}", title: "Raíz n-ésima" },
      { label: "f(x)", code: "f(x)", title: "Función" },
      { label: "|x|", code: "\\left|x\\right|", title: "Valor absoluto" },
    ],
  },
  {
    name: "Cálculo",
    items: [
      { label: "∑", code: "\\sum_{i=1}^{n}", title: "Sumatoria" },
      { label: "∫", code: "\\int_{a}^{b}", title: "Integral" },
      { label: "lim", code: "\\lim_{x \\to 0}", title: "Límite" },
      { label: "∂", code: "\\partial", title: "Derivada parcial" },
      { label: "∞", code: "\\infty", title: "Infinito" },
      { label: "d/dx", code: "\\frac{d}{dx}", title: "Derivada" },
    ],
  },
  {
    name: "Relaciones",
    items: [
      { label: "≤", code: "\\le", title: "Menor o igual" },
      { label: "≥", code: "\\ge", title: "Mayor o igual" },
      { label: "≠", code: "\\neq", title: "Distinto" },
      { label: "≈", code: "\\approx", title: "Aproximado" },
      { label: "→", code: "\\to", title: "Flecha" },
      { label: "∈", code: "\\in", title: "Pertenece" },
      { label: "⊆", code: "\\subseteq", title: "Subconjunto" },
    ],
  },
  {
    name: "Probabilidad",
    items: [
      { label: "P(A)", code: "P(A)", title: "Probabilidad" },
      { label: "P(A|B)", code: "P(A \\mid B)", title: "Probabilidad condicional" },
      { label: "P(A∩B)", code: "P(A \\cap B)", title: "Intersección" },
      { label: "P(A∪B)", code: "P(A \\cup B)", title: "Unión" },
      { label: "E[X]", code: "E[X]", title: "Esperanza" },
      { label: "σ²", code: "\\sigma^2", title: "Varianza" },
    ],
  },
  {
    name: "Griegas",
    items: [
      { label: "α", code: "\\alpha" },
      { label: "β", code: "\\beta" },
      { label: "γ", code: "\\gamma" },
      { label: "δ", code: "\\delta" },
      { label: "θ", code: "\\theta" },
      { label: "λ", code: "\\lambda" },
      { label: "μ", code: "\\mu" },
      { label: "π", code: "\\pi" },
      { label: "σ", code: "\\sigma" },
      { label: "φ", code: "\\phi" },
      { label: "ω", code: "\\omega" },
    ],
  },
  {
    name: "Matrices",
    items: [
      {
        label: "2×2",
        code: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}",
        title: "Matriz 2×2",
      },
      {
        label: "vector",
        code: "\\begin{pmatrix} x \\\\ y \\end{pmatrix}",
        title: "Vector columna",
      },
      { label: "det", code: "\\det(A)", title: "Determinante" },
    ],
  },
];

const SNIPPET_LABELS = new Map(
  FORMULA_GROUPS.flatMap((group) => group.items.map((item) => [item.code, item.label]))
);

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* el almacenamiento puede estar lleno o deshabilitado */
  }
}

function loadUsage() {
  const value = readJSON(USAGE_KEY, {});
  return value && typeof value === "object" ? value : {};
}

function loadRecent() {
  const value = readJSON(RECENT_KEY, []);
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function recordUsage(code) {
  const usage = loadUsage();
  usage[code] = (Number(usage[code]) || 0) + 1;
  writeJSON(USAGE_KEY, usage);
}

function recordRecent(code) {
  const recent = loadRecent().filter((item) => item !== code);
  recent.unshift(code);
  writeJSON(RECENT_KEY, recent.slice(0, 8));
}

function popularFormulas() {
  return Object.entries(loadUsage())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([code]) => ({ code, label: SNIPPET_LABELS.get(code) || code }));
}

function recentFormulas() {
  return loadRecent().map((code) => ({
    code,
    label: SNIPPET_LABELS.get(code) || code,
  }));
}

function insertAtCursor(textarea, text) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? start;
  textarea.setRangeText(text, start, end, "end");
  textarea.focus();
}

/**
 * Abre la paleta de fórmulas.
 * @param {{onInsert:(code:string, type:"inline"|"block")=>void}} options
 */
export function openFormulaModal({ onInsert }) {
  const textarea = createEl("textarea", {
    class: "mermaid-input formula-input",
    spellcheck: "false",
    placeholder: "E = mc^2\n\\frac{a}{b}\n\\sum_{i=1}^{n} p_i",
  });
  const type = createEl("select", {}, [
    createEl("option", { value: "inline", text: "En línea ($...$)" }),
    createEl("option", { value: "block", text: "Bloque centrado ($$...$$)" }),
  ]);
  type.id = "formula-type";

  const quick = createEl("div", { class: "formula-quick" });
  const preview = createEl("div", {
    class: "formula-preview",
    "aria-live": "polite",
    "aria-label": "Vista previa de la fórmula",
  });
  const previewHint = createEl("span", {
    class: "formula-preview-hint",
    text: "La vista previa aparecerá aquí.",
  });
  preview.append(previewHint);
  const editor = createEl("div", { class: "formula-editor" }, [
    createEl("label", { class: "select-label", for: "formula-type", text: "Tipo de fórmula" }),
    type,
    textarea,
    preview,
    createEl("p", {
      class: "modal-hint",
      text:
        "Haz clic en una fórmula para insertarla en el campo. El modo Mixto escribe las fórmulas en línea con tu letra y usa MathJax para los bloques.",
    }),
  ]);

  const addGroup = (title, items) => {
    if (!items.length) return;
    const chips = createEl("div", { class: "formula-chips" });
    for (const item of items) {
      const chip = createEl(
        "button",
        {
          class: "formula-chip",
          type: "button",
          title: item.title || item.code,
          "aria-label": item.title || item.label,
          text: item.label,
        }
      );
      chip.addEventListener("click", () => {
        insertAtCursor(textarea, item.code);
        recordUsage(item.code);
        renderQuick();
        updatePreview();
      });
      chips.append(chip);
    }
    quick.append(
      createEl("div", { class: "formula-group" }, [
        createEl("div", { class: "formula-group-title", text: title }),
        chips,
      ])
    );
  };

  const renderQuick = () => {
    quick.innerHTML = "";
    const popular = popularFormulas();
    const recent = recentFormulas();
    if (popular.length) addGroup("Más usadas", popular);
    if (recent.length) addGroup("Recientes", recent);
    for (const group of FORMULA_GROUPS) addGroup(group.name, group.items);
  };
  renderQuick();

  let previewTimer = 0;
  let previewSeq = 0;
  function updatePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(async () => {
      const code = textarea.value.trim();
      const seq = ++previewSeq;
      preview.innerHTML = "";
      if (!code) {
        preview.append(previewHint);
        return;
      }
      try {
        const svg = await renderMathPreview(code, { display: true });
        if (seq !== previewSeq) return;
        preview.append(svg);
      } catch (error) {
        if (seq !== previewSeq) return;
        preview.append(
          createEl("span", {
            class: "formula-preview-error",
            text: "Revisa la sintaxis LaTeX.",
          })
        );
      }
    }, 180);
  }
  textarea.addEventListener("input", updatePreview);
  type.addEventListener("change", updatePreview);
  updatePreview();

  const body = createEl("div", { class: "formula-layout" }, [quick, editor]);
  showModal({
    title: "Insertar fórmula",
    subtitle: "LaTeX simple o completo. Usa Ctrl + Shift + F para abrir esta paleta.",
    body,
    actions: [
      { label: "Cancelar", kind: "ghost", onClick: (close) => close() },
      {
        label: "Insertar fórmula",
        kind: "primary",
        onClick: (close) => {
          const code = textarea.value.trim();
          if (!code) {
            toast("Escribe una fórmula primero.", { type: "warn" });
            return;
          }
          recordRecent(code);
          close();
          onInsert(code, type.value);
        },
      },
    ],
  });
  setTimeout(() => textarea.focus(), 50);
}
