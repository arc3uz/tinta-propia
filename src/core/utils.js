import { app } from "./state.js";

/**
 * Utilidades compartidas de interfaz y formato.
 *
 * Este módulo no conoce la lógica de proyectos ni de compilación: solo ayuda a
 * crear nodos, formatear valores y resolver rutas de descarga.
 */

export const $ = (id) => document.getElementById(id);

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Convierte un título en un nombre de archivo seguro. */
export function slugify(text) {
  return (
    String(text || "documento")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "documento"
  );
}

export function displayFileName() {
  return `${slugify(app.title)}.md`;
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatRelative(seconds) {
  if (!seconds) return "";
  const diff = Math.max(0, Date.now() / 1000 - seconds);
  if (diff < 90) return "hace un momento";
  if (diff < 3600) return `hace ${Math.round(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.round(diff / 3600)} h`;
  if (diff < 86400 * 30) return `hace ${Math.round(diff / 86400)} d`;
  return new Date(seconds * 1000).toLocaleDateString("es-CL");
}

/** Cede el hilo para que el navegador pinte antes de una tarea pesada. */
export function yieldFrame() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function base64ToBuffer(base64) {
  const clean = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Crea un elemento con atributos, clases, eventos y hijos en una sola llamada.
 * Los valores `null`/`undefined` se omiten para facilitar contenido condicional.
 */
export function createEl(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "html") node.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value !== undefined && value !== null) {
      node.setAttribute(key, value);
    }
  }
  for (const child of children) {
    if (child == null) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Referencia un icono del sprite SVG incluido en `index.html`. */
export function svgIcon(name, className = "") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  if (className) svg.setAttribute("class", className);
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  return svg;
}
