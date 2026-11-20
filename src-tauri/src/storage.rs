use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentProject {
    pub path: String,
    pub title: String,
    pub opened_at: u64,
}

pub fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub fn app_data(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("No se pudo obtener la carpeta de datos: {e}"))
}

pub fn ensure_dirs(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app_data(app)?;
    fs::create_dir_all(dir.join("projects"))
        .map_err(|e| format!("No se pudo crear la carpeta de proyectos: {e}"))?;
    fs::create_dir_all(dir.join("fonts"))
        .map_err(|e| format!("No se pudo crear la carpeta de fuentes: {e}"))?;
    Ok(dir)
}

pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("No se pudo crear la carpeta destino: {e}"))?;
    }
    let file_name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("tinta-propia");
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let tmp = path.with_file_name(format!(".{file_name}.{stamp}.tmp"));
    fs::write(&tmp, bytes).map_err(|e| format!("No se pudo escribir el archivo temporal: {e}"))?;
    if path.exists() {
        fs::remove_file(path).map_err(|e| format!("No se pudo reemplazar el archivo: {e}"))?;
    }
    fs::rename(&tmp, path).map_err(|e| format!("No se pudo guardar el archivo: {e}"))?;
    Ok(())
}

pub fn write_json(path: &Path, value: &Value) -> Result<(), String> {
    let text = serde_json::to_vec_pretty(value)
        .map_err(|e| format!("No se pudo serializar el proyecto: {e}"))?;
    atomic_write(path, &text)
}

pub fn read_json(path: &Path) -> Option<Value> {
    let text = fs::read_to_string(path).ok()?;
    serde_json::from_str(&text).ok()
}

pub fn recent_projects(app: &AppHandle) -> Vec<RecentProject> {
    let Ok(dir) = app_data(app) else {
        return Vec::new();
    };
    let path = dir.join("recent.json");
    let Some(value) = read_json(&path) else {
        return Vec::new();
    };
    serde_json::from_value(value).unwrap_or_default()
}

pub fn touch_recent(app: &AppHandle, path: &str, title: &str) -> Result<(), String> {
    let dir = ensure_dirs(app)?;
    let mut list = recent_projects(app);
    list.retain(|r| r.path != path);
    list.insert(
        0,
        RecentProject {
            path: path.to_string(),
            title: title.to_string(),
            opened_at: now_secs(),
        },
    );
    list.truncate(12);
    let value = serde_json::to_value(&list)
        .map_err(|e| format!("No se pudo serializar la lista de recientes: {e}"))?;
    write_json(&dir.join("recent.json"), &value)
}

pub fn remove_recent(app: &AppHandle, path: &str) -> Result<(), String> {
    let dir = ensure_dirs(app)?;
    let mut list = recent_projects(app);
    list.retain(|r| r.path != path);
    let value = serde_json::to_value(&list)
        .map_err(|e| format!("No se pudo serializar la lista de recientes: {e}"))?;
    write_json(&dir.join("recent.json"), &value)
}
