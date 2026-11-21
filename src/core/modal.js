import { app } from "./state.js";
import { $, clamp, createEl, svgIcon } from "./utils.js";

/**
 * Sistema de modales, avisos y progreso.
 *
 * Todos los modales comparten el mismo contenedor y una pila común. Así,
 * `Escape` cierra siempre el último diálogo abierto y los modales anidados
 * (por ejemplo, etiquetas sobre la biblioteca) no se pisan entre sí.
 */

/** Muestra un aviso temporal en la esquina inferior derecha. */
export function toast(message, options = {}) {
  const type = options.type || "ok";
  const title = options.title || "";
  const iconName =
    type === "error" ? "alert" : type === "warn" ? "alert" : type === "info" ? "info" : "check";
  const root = $("toastRoot");
  const el = createEl("div", { class: `toast ${type}` }, [
    createEl("span", { class: "toast-icon" }, [svgIcon(iconName)]),
    createEl("div", {}, [
      title ? createEl("strong", { text: title }) : null,
      createEl("span", { text: message }),
    ]),
  ]);
  root.append(el);
  const timeout = options.timeout ?? (type === "error" ? 7000 : 4300);
  const hide = () => {
    el.classList.add("hide");
    setTimeout(() => el.remove(), 230);
  };
  const timer = setTimeout(hide, timeout);
  el.addEventListener("click", () => {
    clearTimeout(timer);
    hide();
  });
  return el;
}

/**
 * Abre un modal genérico.
 *
 * @param {object} options
 * @param {string} options.title
 * @param {string} [options.subtitle]
 * @param {Node|string} [options.body]
 * @param {Array<{label:string, kind?:string, onClick?:(close:Function)=>void}>} [options.actions]
 * @param {boolean} [options.narrow] Ancho compacto para formularios.
 * @param {boolean} [options.wide] Ancho amplio para contenido tabular.
 * @param {boolean} [options.dismissible]
 * @param {Function} [options.onClose]
 */
export function showModal({
  title,
  subtitle = "",
  body = null,
  actions = [],
  narrow = false,
  wide = false,
  dismissible = true,
  onClose = null,
}) {
  const root = $("modalRoot");
  const backdrop = createEl("div", { class: "modal-backdrop" });
  const head = createEl("div", { class: "modal-head" }, [
    createEl("div", {}, [
      createEl("h2", { text: title }),
      subtitle ? createEl("p", { text: subtitle }) : null,
    ]),
    dismissible
      ? createEl(
          "button",
          {
            class: "icon-btn",
            title: "Cerrar",
            "aria-label": "Cerrar",
            onclick: () => close(),
          },
          [svgIcon("x")]
        )
      : null,
  ]);
  const bodyEl = createEl("div", { class: "modal-body" });
  if (body instanceof Node) bodyEl.append(body);
  else if (typeof body === "string") bodyEl.innerHTML = body;
  const foot = createEl("div", { class: "modal-foot" });
  const modal = createEl(
    "div",
    {
      class: `modal${narrow ? " narrow" : ""}${wide ? " wide" : ""}`,
      role: "dialog",
      "aria-modal": "true",
      "aria-label": title,
    },
    [head, bodyEl]
  );
  if (actions.length) {
    for (const action of actions) {
      foot.append(
        createEl(
          "button",
          {
            class: `btn ${action.kind || "ghost"}`,
            text: action.label,
            onclick: () => action.onClick?.(close),
          }
        )
      );
    }
    modal.append(foot);
  }
  backdrop.append(modal);
  root.append(backdrop);

  let closed = false;
  const close = (reason = "close") => {
    if (closed) return;
    closed = true;
    backdrop.remove();
    const idx = app.modalStack.indexOf(close);
    if (idx >= 0) app.modalStack.splice(idx, 1);
    onClose?.(reason);
  };
  if (dismissible) app.modalStack.push(close);
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop && dismissible) close("backdrop");
  });
  setTimeout(() => {
    const target = modal.querySelector("textarea, input, button");
    target?.focus();
  }, 30);
  return { close, modal, body: bodyEl, footer: foot };
}

/** Diálogo de confirmación con resultado `Promise<boolean>`. */
export function confirmAction({ title, message, confirmLabel = "Continuar", danger = false }) {
  return new Promise((resolve) => {
    let decided = false;
    const modal = showModal({
      title,
      body: createEl("p", { class: "confirm-text", text: message }),
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
          label: confirmLabel,
          kind: danger ? "danger" : "primary",
          onClick: (close) => {
            decided = true;
            close();
            resolve(true);
          },
        },
      ],
      onClose: () => {
        if (!decided) resolve(false);
      },
    });
    modal.modal.querySelector(".modal-foot .btn.primary, .modal-foot .btn.danger")?.focus();
  });
}

/** Modal bloqueante con barra de progreso para tareas largas. */
export function showProgress(title, subtitle) {
  const text = createEl("p", { class: "progress-text", text: "Preparando…" });
  const bar = createEl("span");
  const body = createEl("div", { class: "progress-box" }, [
    createEl("div", { class: "progress-track" }, [bar]),
    text,
  ]);
  const modal = showModal({
    title,
    subtitle,
    body,
    narrow: true,
    dismissible: false,
  });
  return {
    update(progress, label) {
      bar.style.width = `${Math.round(clamp(progress, 0, 1) * 100)}%`;
      if (label) text.textContent = label;
    },
    close() {
      modal.close();
    },
  };
}

/**
 * Confirma un formulario simple al pulsar Enter.
 * Ignora Enter durante la composición de texto (IME).
 */
export function submitOnEnter(input, callback) {
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      callback();
    }
  });
}

/**
 * Pide un valor de texto en un modal.
 * @returns {Promise<string|null>} El texto limpio o `null` si se cancela.
 */
export function promptText({
  title,
  subtitle = "",
  label,
  value = "",
  placeholder = "",
  confirmLabel = "Guardar",
}) {
  return new Promise((resolve) => {
    const input = createEl("input", { type: "text", placeholder });
    input.value = value;
    const body = createEl("div", {}, [
      createEl("label", { class: "select-label", for: "prompt-text-input", text: label }),
      input,
    ]);
    input.id = "prompt-text-input";
    let decided = false;
    const submit = (close) => {
      if (decided) return;
      decided = true;
      const text = input.value.trim();
      close();
      resolve(text || null);
    };
    const modal = showModal({
      title,
      subtitle,
      body,
      narrow: true,
      actions: [
        {
          label: "Cancelar",
          kind: "ghost",
          onClick: (close) => {
            decided = true;
            close();
            resolve(null);
          },
        },
        {
          label: confirmLabel,
          kind: "primary",
          onClick: (close) => submit(close),
        },
      ],
      onClose: () => {
        if (!decided) resolve(null);
      },
    });
    submitOnEnter(input, () => submit(modal.close));
    setTimeout(() => {
      input.focus();
      input.select();
    }, 40);
  });
}
