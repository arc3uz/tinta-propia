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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryProject {
    pub path: String,
    pub title: String,
    pub folder: String,
    pub tags: Vec<String>,
    pub updated_at: u64,
    pub size: u64,
}

fn project_folder(root: &Path, path: &Path) -> String {
    path.parent()
        .and_then(|parent| parent.strip_prefix(root).ok())
        .map(|relative| {
            relative
                .components()
                .filter_map(|part| part.as_os_str().to_str())
                .collect::<Vec<_>>()
                .join("/")
        })
        .unwrap_or_default()
}

fn clean_tags(tags: &[String]) -> Vec<String> {
    let mut out = Vec::new();
    for tag in tags {
        let value = tag.trim();
        if value.is_empty() || value.len() > 32 {
            continue;
        }
        if !out
            .iter()
            .any(|existing: &String| existing.eq_ignore_ascii_case(value))
        {
            out.push(value.to_string());
        }
        if out.len() >= 12 {
            break;
        }
    }
    out
}

fn collect_library_projects(root: &Path, dir: &Path, out: &mut Vec<LibraryProject>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(meta) = entry.metadata() else {
            continue;
        };
        if meta.file_type().is_symlink() {
            continue;
        }
        if meta.is_dir() {
            let hidden = path
                .file_name()
                .and_then(|name| name.to_str())
                .map(|name| name.starts_with('.'))
                .unwrap_or(true);
            if !hidden {
                collect_library_projects(root, &path, out);
            }
            continue;
        }
        if !meta.is_file() || path.extension().and_then(|ext| ext.to_str()) != Some("papernotes") {
            continue;
        }
        let value = read_json(&path);
        let fallback_title = path
            .file_stem()
            .and_then(|name| name.to_str())
            .unwrap_or("Sin título")
            .to_string();
        let title = value
            .as_ref()
            .and_then(|v| v.get("title"))
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|title| !title.is_empty())
            .unwrap_or(&fallback_title)
            .to_string();
        let tags = value
            .as_ref()
            .and_then(|v| v.get("tags"))
            .and_then(|v| v.as_array())
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.as_str())
                    .map(str::to_string)
                    .collect::<Vec<_>>()
            })
            .map(|items| clean_tags(&items))
            .unwrap_or_default();
        let updated_at = value
            .as_ref()
            .and_then(|v| v.get("updatedAt"))
            .and_then(|v| v.as_u64())
            .map(|ms| ms / 1000)
            .or_else(|| {
                meta.modified()
                    .ok()
                    .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                    .map(|duration| duration.as_secs())
            })
            .unwrap_or(0);
        out.push(LibraryProject {
            path: path.to_string_lossy().to_string(),
            title,
            folder: project_folder(root, &path),
            tags,
            updated_at,
            size: meta.len(),
        });
    }
}

pub fn list_library(app: &AppHandle) -> Result<Vec<LibraryProject>, String> {
    let root = ensure_dirs(app)?.join("projects");
    let mut projects = Vec::new();
    collect_library_projects(&root, &root, &mut projects);
    projects.sort_by(|a, b| {
        a.folder
            .to_lowercase()
            .cmp(&b.folder.to_lowercase())
            .then_with(|| a.title.to_lowercase().cmp(&b.title.to_lowercase()))
    });
    Ok(projects)
}

pub fn set_project_tags(path: &str, tags: Vec<String>) -> Result<(), String> {
    let file = Path::new(path);
    if file.extension().and_then(|ext| ext.to_str()) != Some("papernotes") {
        return Err("El archivo no es un proyecto .papernotes.".into());
    }
    let mut value = read_json(file).ok_or_else(|| "No se pudo leer el proyecto.".to_string())?;
    let object = value
        .as_object_mut()
        .ok_or_else(|| "El proyecto no tiene el formato esperado.".to_string())?;
    let tags = clean_tags(&tags);
    object.insert("tags".into(), serde_json::json!(tags));
    write_json(file, &value)
}

fn safe_relative_folder(folder: &str) -> Result<PathBuf, String> {
    let mut out = PathBuf::new();
    for part in folder.split(['/', '\\']) {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }
        if part == "." || part == ".." || part.contains(':') || part.starts_with('.') {
            return Err("El nombre de la carpeta no es válido.".into());
        }
        out.push(part);
    }
    Ok(out)
}

pub fn move_project_to_folder(app: &AppHandle, path: &str, folder: &str) -> Result<String, String> {
    let source = PathBuf::from(path);
    if source.extension().and_then(|ext| ext.to_str()) != Some("papernotes") {
        return Err("El archivo no es un proyecto .papernotes.".into());
    }
    if !source.is_file() {
        return Err("El proyecto ya no existe en esa ruta.".into());
    }
    let data_dir = ensure_dirs(app)?;
    let projects_dir = data_dir.join("projects");
    let relative = safe_relative_folder(folder)?;
    let target_dir = projects_dir.join(relative);
    fs::create_dir_all(&target_dir)
        .map_err(|e| format!("No se pudo crear la carpeta destino: {e}"))?;
    let name = source
        .file_name()
        .ok_or_else(|| "El proyecto no tiene un nombre de archivo válido.".to_string())?;
    let target = target_dir.join(name);
    if target == source {
        return Ok(source.to_string_lossy().to_string());
    }
    if target.exists() {
        return Err("Ya existe un proyecto con ese nombre en la carpeta destino.".into());
    }
    if let Err(rename_error) = fs::rename(&source, &target) {
        fs::copy(&source, &target).map_err(|e| format!("No se pudo mover el proyecto: {e}"))?;
        fs::remove_file(&source).map_err(|e| {
            format!(
                "El proyecto se copió, pero no se pudo quitar el original: {e} ({rename_error})"
            )
        })?;
    }
    let target_string = target.to_string_lossy().to_string();
    let mut recent = recent_projects(app);
    let mut changed = false;
    for item in &mut recent {
        if item.path == path {
            item.path = target_string.clone();
            changed = true;
        }
    }
    if changed {
        let value = serde_json::to_value(&recent)
            .map_err(|e| format!("No se pudo actualizar la lista de recientes: {e}"))?;
        write_json(&data_dir.join("recent.json"), &value)?;
    }
    Ok(target_string)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_nested_library_folders() {
        let folder = safe_relative_folder("Universidad/Cálculo").unwrap();
        assert_eq!(folder, PathBuf::from("Universidad").join("Cálculo"));
        assert!(safe_relative_folder("").unwrap().as_os_str().is_empty());
    }

    #[test]
    fn rejects_parent_folder_segments() {
        assert!(safe_relative_folder("../fuera").is_err());
        assert!(safe_relative_folder("Universidad/../../fuera").is_err());
        assert!(safe_relative_folder("C:/Windows").is_err());
    }

    #[test]
    fn normalizes_tags() {
        let tags = clean_tags(&[
            " examen ".into(),
            "repaso".into(),
            "EXAMEN".into(),
            "".into(),
            "x".repeat(40),
        ]);
        assert_eq!(tags, vec!["examen".to_string(), "repaso".to_string()]);
    }
}
