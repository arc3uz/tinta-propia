import { invoke } from "@tauri-apps/api/core";
import { save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { pageDimensions } from "../engine.js";
import { extractMermaidBlocks } from "../mermaid.js";
import { app } from "../core/state.js";
import { createEl, slugify, svgIcon, yieldFrame } from "../core/utils.js";
import { showModal, showProgress, toast } from "../core/modal.js";

/**
 * Exportación de páginas y documentos.
 *
 * PDF, PNG y Markdown comparten la misma regla: en Tauri se usan diálogos y
 * comandos nativos; en el navegador se descarga un archivo desde el blob.
 */

/** Exporta una hoja ya renderizada como PNG. */
export async function exportPagePNG(canvas, pageNumber) {
  try {
    const dataUrl = canvas.toDataURL("image/png");
    const name = `${slugify(app.title)}-pagina-${pageNumber}.png`;
    if (app.isTauri) {
      const path = await saveFileDialog({
        title: "Guardar página como PNG",
        defaultPath: name,
        filters: [{ name: "Imagen PNG", extensions: ["png"] }],
      });
      if (!path) return;
      await invoke("save_binary_file", { path, dataBase64: dataUrl });
      toast("Página exportada como PNG.", { title: "Listo" });
    } else {
      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = name;
      anchor.click();
    }
  } catch (error) {
    console.error(error);
    toast("No se pudo exportar la página.", { type: "error" });
  }
}

/** Exporta el Markdown activo sin las imágenes incrustadas. */
export async function exportMarkdown() {
  if (!app.editor) return;
  const content = app.editor.getValue();
  const name = `${slugify(app.title)}.md`;
  try {
    if (app.isTauri) {
      const path = await saveFileDialog({
        title: "Exportar Markdown",
        defaultPath: name,
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (!path) return;
      await invoke("save_text_file", { path, content });
    } else {
      const blob = new Blob([content], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = name;
      anchor.click();
      URL.revokeObjectURL(url);
    }
    toast("Markdown exportado. Las imágenes viven solo en el proyecto .papernotes.", {
      title: "Listo",
      timeout: 5500,
    });
  } catch (error) {
    console.error(error);
    toast("No se pudo exportar el Markdown.", { type: "error" });
  }
}

/**
 * Exporta todas las hojas a PDF.
 *
 * En Tauri cada hoja se rasteriza a 1,5× y Rust arma el PDF con dimensiones
 * exactas; en el navegador se delega al diálogo de impresión.
 */
export async function exportPDF() {
  if (!app.editor) return;
  if (!app.pages.length) {
    toast("El documento todavía no tiene páginas para exportar.", {
      type: "warn",
      title: "Nada que exportar",
    });
    return;
  }
  const missingDiagrams = extractMermaidBlocks(app.editor.getValue()).some(
    (block) => !app.mermaidCache.has(block.code) && !app.mermaidErrors.has(block.code)
  );
  if (missingDiagrams || app.mermaidJobRunning || app.mermaidQueue.size) {
    toast(
      "Todavía hay diagramas Mermaid en preparación. Espera unos segundos y vuelve a exportar.",
      { type: "warn", title: "Diagramas pendientes", timeout: 5000 }
    );
    return;
  }
  if (!app.isTauri) {
    window.print();
    return;
  }
  let progress = null;
  try {
    const path = await saveFileDialog({
      title: "Exportar PDF",
      defaultPath: `${slugify(app.title)}.pdf`,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!path) return;
    const cfg = app.result
      ? { mmW: app.result.mmWidth, mmH: app.result.mmHeight }
      : pageDimensions(app.settings);
    const widthPt = (cfg.mmW / 25.4) * 72;
    const heightPt = (cfg.mmH / 25.4) * 72;
    const total = app.pages.length;
    progress = showProgress(
      "Exportando PDF",
      "Cada página se rasteriza a alta calidad y Rust arma el documento final."
    );
    const scale = 1.5;
    const pages = [];
    for (let i = 0; i < total; i++) {
      const source = app.pages[i];
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(source.width * scale));
      canvas.height = Math.max(1, Math.round(source.height * scale));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.91);
      canvas.width = 0;
      canvas.height = 0;
      pages.push({
        imageBase64: dataUrl,
        widthPt,
        heightPt,
      });
      progress.update((i + 1) / total, `Página ${i + 1} de ${total}`);
      await yieldFrame();
    }
    progress.update(1, "Escribiendo el archivo…");
    await invoke("export_pdf", {
      request: { path, title: app.title, pages },
    });
    progress.close();
    showExportSuccess(path);
  } catch (error) {
    console.error(error);
    progress?.close();
    toast(`No se pudo exportar el PDF: ${error}`, {
      type: "error",
      title: "Error al exportar",
    });
  }
}

function showExportSuccess(path) {
  const body = createEl("div", { class: "export-success" }, [
    createEl("div", { class: "export-success-icon" }, [svgIcon("check")]),
    createEl("p", { text: "El PDF quedó guardado en:" }),
    createEl("code", { text: path }),
  ]);
  showModal({
    title: "PDF exportado",
    body,
    narrow: true,
    actions: [
      { label: "Cerrar", kind: "ghost", onClick: (close) => close() },
      {
        label: "Abrir PDF",
        kind: "primary",
        onClick: (close) => {
          close();
          openPath(path).catch(() => toast("No se pudo abrir el PDF.", { type: "warn" }));
        },
      },
    ],
  });
}
