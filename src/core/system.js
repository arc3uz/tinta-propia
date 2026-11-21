import { invoke } from "@tauri-apps/api/core";
import { app } from "./state.js";
import { toast } from "./modal.js";

/**
 * Acciones del sistema operativo.
 *
 * Abrir carpetas se hace en Rust para evitar diferencias de permisos entre
 * plataformas y para que funcione igual con rutas con espacios o acentos.
 */
export async function openFolder(path) {
  if (!app.isTauri || !path) return false;
  try {
    await invoke("open_folder", { path });
    return true;
  } catch (error) {
    console.error(error);
    toast(`No se pudo abrir la carpeta: ${error}`, { type: "error" });
    return false;
  }
}
