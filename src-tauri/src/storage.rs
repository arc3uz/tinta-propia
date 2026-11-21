use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
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
    fs::create_dir_all(dir.join("trash"))
        .map_err(|e| format!("No se pudo crear la carpeta de papelera: {e}"))?;
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
    pub inherited_tags: Vec<String>,
    pub updated_at: u64,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryFolder {
    pub path: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibrarySnapshot {
    pub projects: Vec<LibraryProject>,
    pub folders: Vec<LibraryFolder>,
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
            inherited_tags: Vec::new(),
            updated_at,
            size: meta.len(),
        });
    }
}

fn collect_library_folders(root: &Path, dir: &Path, out: &mut Vec<String>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(meta) = entry.metadata() else {
            continue;
        };
        if !meta.is_dir() || meta.file_type().is_symlink() {
            continue;
        }
        let hidden = path
            .file_name()
            .and_then(|name| name.to_str())
            .map(|name| name.starts_with('.'))
            .unwrap_or(true);
        if hidden {
            continue;
        }
        let folder = path
            .strip_prefix(root)
            .ok()
            .map(|relative| {
                relative
                    .components()
                    .filter_map(|part| part.as_os_str().to_str())
                    .collect::<Vec<_>>()
                    .join("/")
            })
            .unwrap_or_default();
        if !folder.is_empty() {
            out.push(folder);
        }
        collect_library_folders(root, &path, out);
    }
}

fn folder_tags_file(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(ensure_dirs(app)?
        .join("projects")
        .join(".tinta-folders.json"))
}

fn read_folder_tags(app: &AppHandle) -> BTreeMap<String, Vec<String>> {
    let Ok(path) = folder_tags_file(app) else {
        return BTreeMap::new();
    };
    let Some(value) = read_json(&path) else {
        return BTreeMap::new();
    };
    value
        .as_object()
        .map(|object| {
            object
                .iter()
                .filter_map(|(folder, tags)| {
                    let tags = tags
                        .as_array()?
                        .iter()
                        .filter_map(|tag| tag.as_str())
                        .map(str::to_string)
                        .collect::<Vec<_>>();
                    Some((folder.clone(), clean_tags(&tags)))
                })
                .collect()
        })
        .unwrap_or_default()
}

fn write_folder_tags(app: &AppHandle, tags: &BTreeMap<String, Vec<String>>) -> Result<(), String> {
    let path = folder_tags_file(app)?;
    write_json(&path, &serde_json::json!(tags))
}

fn inherited_tags(folder: &str, tags: &BTreeMap<String, Vec<String>>) -> Vec<String> {
    let mut inherited = Vec::new();
    let mut current = String::new();
    for part in folder.split('/').filter(|part| !part.is_empty()) {
        current = if current.is_empty() {
            part.to_string()
        } else {
            format!("{current}/{part}")
        };
        if let Some(values) = tags.get(&current) {
            inherited.extend(values.iter().cloned());
        }
    }
    clean_tags(&inherited)
}

pub fn set_folder_tags(app: &AppHandle, folder: &str, tags: Vec<String>) -> Result<(), String> {
    let relative = safe_relative_folder(folder)?;
    if relative.as_os_str().is_empty() {
        return Err("Elige una carpeta dentro de la biblioteca.".into());
    }
    let target = ensure_dirs(app)?.join("projects").join(&relative);
    if !target.is_dir() {
        return Err("La carpeta ya no existe.".into());
    }
    let normalized = relative
        .components()
        .filter_map(|part| part.as_os_str().to_str())
        .collect::<Vec<_>>()
        .join("/");
    let mut all = read_folder_tags(app);
    let tags = clean_tags(&tags);
    if tags.is_empty() {
        all.remove(&normalized);
    } else {
        all.insert(normalized, tags);
    }
    write_folder_tags(app, &all)
}

pub fn list_library(app: &AppHandle) -> Result<LibrarySnapshot, String> {
    let root = ensure_dirs(app)?.join("projects");
    let mut projects = Vec::new();
    let mut folders = Vec::new();
    collect_library_projects(&root, &root, &mut projects);
    collect_library_folders(&root, &root, &mut folders);
    let folder_tags = read_folder_tags(app);
    for project in &mut projects {
        project.inherited_tags = inherited_tags(&project.folder, &folder_tags);
    }
    projects.sort_by(|a, b| {
        a.folder
            .to_lowercase()
            .cmp(&b.folder.to_lowercase())
            .then_with(|| a.title.to_lowercase().cmp(&b.title.to_lowercase()))
    });
    folders.sort_by_key(|folder| folder.to_lowercase());
    Ok(LibrarySnapshot {
        projects,
        folders: folders
            .into_iter()
            .map(|path| LibraryFolder {
                tags: folder_tags.get(&path).cloned().unwrap_or_default(),
                path,
            })
            .collect(),
    })
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

pub fn create_library_folder(app: &AppHandle, folder: &str) -> Result<String, String> {
    let data_dir = ensure_dirs(app)?;
    let relative = safe_relative_folder(folder)?;
    if relative.as_os_str().is_empty() {
        return Err("Escribe un nombre de carpeta.".into());
    }
    let target = data_dir.join("projects").join(&relative);
    if target.exists() {
        return Err("Esa carpeta ya existe.".into());
    }
    fs::create_dir_all(&target).map_err(|e| format!("No se pudo crear la carpeta: {e}"))?;
    Ok(relative
        .components()
        .filter_map(|part| part.as_os_str().to_str())
        .collect::<Vec<_>>()
        .join("/"))
}

pub fn rename_library_folder(
    app: &AppHandle,
    old_folder: &str,
    new_folder: &str,
) -> Result<(), String> {
    let data_dir = ensure_dirs(app)?;
    let projects_dir = data_dir.join("projects");
    let old_relative = safe_relative_folder(old_folder)?;
    let new_relative = safe_relative_folder(new_folder)?;
    if old_relative.as_os_str().is_empty() || new_relative.as_os_str().is_empty() {
        return Err("El nombre de la carpeta no es válido.".into());
    }
    let source = projects_dir.join(&old_relative);
    let target = projects_dir.join(&new_relative);
    if !source.is_dir() {
        return Err("La carpeta ya no existe.".into());
    }
    if target.exists() {
        return Err("Ya existe una carpeta con ese nombre.".into());
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("No se pudo crear la carpeta destino: {e}"))?;
    }
    fs::rename(&source, &target).map_err(|e| format!("No se pudo renombrar la carpeta: {e}"))?;

    let old_prefix = source.to_string_lossy().to_string();
    let new_prefix = target.to_string_lossy().to_string();
    let mut recent = recent_projects(app);
    let mut changed = false;
    for item in &mut recent {
        if let Some(rest) = item.path.strip_prefix(&old_prefix) {
            if rest.starts_with('/') || rest.starts_with('\\') {
                item.path = format!("{new_prefix}{rest}");
                changed = true;
            }
        }
    }
    if changed {
        let value = serde_json::to_value(&recent)
            .map_err(|e| format!("No se pudo actualizar la lista de recientes: {e}"))?;
        write_json(&data_dir.join("recent.json"), &value)?;
    }

    let old_folder = old_relative
        .components()
        .filter_map(|part| part.as_os_str().to_str())
        .collect::<Vec<_>>()
        .join("/");
    let new_folder = new_relative
        .components()
        .filter_map(|part| part.as_os_str().to_str())
        .collect::<Vec<_>>()
        .join("/");
    let tags = read_folder_tags(app);
    let mut renamed = BTreeMap::new();
    for (folder, values) in tags {
        if folder == old_folder {
            renamed.insert(new_folder.clone(), values);
        } else if let Some(rest) = folder.strip_prefix(&format!("{old_folder}/")) {
            renamed.insert(format!("{new_folder}/{rest}"), values);
        } else {
            renamed.insert(folder, values);
        }
    }
    if !renamed.is_empty() {
        write_folder_tags(app, &renamed)?;
    }
    Ok(())
}

pub fn delete_library_folder(app: &AppHandle, folder: &str) -> Result<(), String> {
    let data_dir = ensure_dirs(app)?;
    let relative = safe_relative_folder(folder)?;
    if relative.as_os_str().is_empty() {
        return Err("No se puede eliminar la carpeta raíz.".into());
    }
    let target = data_dir.join("projects").join(&relative);
    if !target.is_dir() {
        return Err("La carpeta ya no existe.".into());
    }
    let mut entries =
        fs::read_dir(&target).map_err(|e| format!("No se pudo revisar la carpeta: {e}"))?;
    if entries.next().is_some() {
        return Err("La carpeta no está vacía. Mueve o elimina sus proyectos primero.".into());
    }
    fs::remove_dir(&target).map_err(|e| format!("No se pudo eliminar la carpeta: {e}"))?;
    let folder_name = relative
        .components()
        .filter_map(|part| part.as_os_str().to_str())
        .collect::<Vec<_>>()
        .join("/");
    let tags = read_folder_tags(app);
    let filtered = tags
        .into_iter()
        .filter(|(key, _)| key != &folder_name && !key.starts_with(&format!("{folder_name}/")))
        .collect::<BTreeMap<_, _>>();
    write_folder_tags(app, &filtered)
}

pub fn set_project_title(app: &AppHandle, path: &str, title: &str) -> Result<(), String> {
    let file = Path::new(path);
    let title = title.trim();
    if title.is_empty() {
        return Err("El nombre del proyecto no puede quedar vacío.".into());
    }
    if title.len() > 160 {
        return Err("El nombre del proyecto es demasiado largo.".into());
    }
    if file.extension().and_then(|ext| ext.to_str()) != Some("papernotes") {
        return Err("El archivo no es un proyecto .papernotes.".into());
    }
    let mut value = read_json(file).ok_or_else(|| "No se pudo leer el proyecto.".to_string())?;
    let object = value
        .as_object_mut()
        .ok_or_else(|| "El proyecto no tiene el formato esperado.".to_string())?;
    object.insert("title".into(), serde_json::json!(title));
    write_json(file, &value)?;
    touch_recent(app, path, title)
}

pub fn duplicate_project(app: &AppHandle, path: &str) -> Result<String, String> {
    let source = PathBuf::from(path);
    if source.extension().and_then(|ext| ext.to_str()) != Some("papernotes") {
        return Err("El archivo no es un proyecto .papernotes.".into());
    }
    let mut value = read_json(&source).ok_or_else(|| "No se pudo leer el proyecto.".to_string())?;
    let title = value
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Sin título")
        .to_string();
    let new_title = format!("{title} (copia)");
    let parent = source.parent().unwrap_or_else(|| Path::new("."));
    let stem = source
        .file_stem()
        .and_then(|v| v.to_str())
        .unwrap_or("proyecto");
    let mut index = 1;
    let target = loop {
        let suffix = if index == 1 {
            " (copia)".to_string()
        } else {
            format!(" (copia {index})")
        };
        let candidate = parent.join(format!("{stem}{suffix}.papernotes"));
        if !candidate.exists() {
            break candidate;
        }
        index += 1;
    };
    let target_string = target.to_string_lossy().to_string();
    let object = value
        .as_object_mut()
        .ok_or_else(|| "El proyecto no tiene el formato esperado.".to_string())?;
    object.insert("title".into(), serde_json::json!(new_title));
    object.insert("path".into(), serde_json::json!(target_string));
    object.insert(
        "updatedAt".into(),
        serde_json::json!(SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis() as u64)
            .unwrap_or(0)),
    );
    write_json(&target, &value)?;
    touch_recent(app, &target_string, &new_title)?;
    Ok(target_string)
}

fn safe_project_stem(title: &str) -> String {
    let mut out = String::new();
    let mut last_dash = false;
    for ch in title.chars() {
        if ch.is_alphanumeric() {
            for lower in ch.to_lowercase() {
                out.push(lower);
            }
            last_dash = false;
        } else if (ch.is_whitespace() || ch == '-' || ch == '_') && !last_dash && !out.is_empty() {
            out.push('-');
            last_dash = true;
        }
        if out.chars().count() >= 48 {
            break;
        }
    }
    let trimmed = out.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "proyecto".to_string()
    } else {
        trimmed
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

pub fn create_project_in_folder(
    app: &AppHandle,
    folder: &str,
    title: &str,
) -> Result<String, String> {
    let data_dir = ensure_dirs(app)?;
    let relative = safe_relative_folder(folder)?;
    let target_dir = data_dir.join("projects").join(relative);
    fs::create_dir_all(&target_dir).map_err(|e| format!("No se pudo crear la carpeta: {e}"))?;
    let title = title.trim();
    if title.is_empty() {
        return Err("El nombre del proyecto no puede quedar vacío.".into());
    }
    let stem = safe_project_stem(title);
    let mut target = target_dir.join(format!("{stem}.papernotes"));
    let mut counter = 2;
    while target.exists() {
        target = target_dir.join(format!("{stem}-{counter}.papernotes"));
        counter += 1;
    }
    let target_string = target.to_string_lossy().to_string();
    let value = serde_json::json!({
        "version": 1,
        "title": title,
        "path": target_string,
        "document": "",
        "settings": {},
        "tags": [],
        "assets": {},
        "imageSeq": 0,
        "updatedAt": now_ms(),
    });
    write_json(&target, &value)?;
    touch_recent(app, &target_string, title)?;
    Ok(target_string)
}

pub fn move_project_to_path(
    app: &AppHandle,
    path: &str,
    target_path: &str,
) -> Result<String, String> {
    let source = PathBuf::from(path);
    let target = PathBuf::from(target_path);
    if source.extension().and_then(|ext| ext.to_str()) != Some("papernotes")
        || target.extension().and_then(|ext| ext.to_str()) != Some("papernotes")
    {
        return Err("El archivo debe ser un proyecto .papernotes.".into());
    }
    if !source.is_file() {
        return Err("El proyecto ya no existe.".into());
    }
    if source == target {
        return Ok(target.to_string_lossy().to_string());
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("No se pudo crear la carpeta destino: {e}"))?;
    }
    if target.exists() {
        fs::remove_file(&target)
            .map_err(|e| format!("No se pudo reemplazar el archivo destino: {e}"))?;
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
        write_json(&ensure_dirs(app)?.join("recent.json"), &value)?;
    }
    Ok(target_string)
}

pub fn trash_project(app: &AppHandle, path: &str) -> Result<String, String> {
    let source = PathBuf::from(path);
    if source.extension().and_then(|ext| ext.to_str()) != Some("papernotes") {
        return Err("El archivo no es un proyecto .papernotes.".into());
    }
    if !source.is_file() {
        return Err("El proyecto ya no existe.".into());
    }
    let data_dir = ensure_dirs(app)?;
    let trash_dir = data_dir.join("trash");
    fs::create_dir_all(&trash_dir).map_err(|e| format!("No se pudo crear la papelera: {e}"))?;
    let name = source
        .file_name()
        .ok_or_else(|| "El proyecto no tiene un nombre válido.".to_string())?;
    let target = trash_dir.join(format!(
        "{}-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_secs())
            .unwrap_or(0),
        name.to_string_lossy()
    ));
    if let Err(rename_error) = fs::rename(&source, &target) {
        fs::copy(&source, &target).map_err(|e| format!("No se pudo mover a la papelera: {e}"))?;
        fs::remove_file(&source).map_err(|e| {
            format!(
                "Se copió a la papelera, pero no se pudo quitar el original: {e} ({rename_error})"
            )
        })?;
    }
    remove_recent(app, path)?;
    Ok(target.to_string_lossy().to_string())
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

    fn temp_dir(name: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        std::env::temp_dir().join(format!("tinta-propia-{name}-{stamp}"))
    }

    #[test]
    fn inherits_tags_from_parent_folders() {
        let mut tags = BTreeMap::new();
        tags.insert("Universidad".to_string(), vec!["facultad".to_string()]);
        tags.insert(
            "Universidad/Cálculo".to_string(),
            vec!["matemática".to_string()],
        );
        let inherited = inherited_tags("Universidad/Cálculo/Semana 1", &tags);
        assert_eq!(inherited, vec!["facultad", "matemática"]);
    }

    #[test]
    fn lists_empty_library_folders() {
        let root = temp_dir("empty-folders");
        std::fs::create_dir_all(root.join("Universidad").join("Cálculo")).unwrap();
        let mut folders = Vec::new();
        collect_library_folders(&root, &root, &mut folders);
        assert!(folders.contains(&"Universidad".to_string()));
        assert!(folders.contains(&"Universidad/Cálculo".to_string()));
        std::fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn reads_library_metadata_and_tags() {
        let root = temp_dir("library");
        let folder = root.join("Universidad").join("Cálculo");
        std::fs::create_dir_all(&folder).unwrap();
        let file = folder.join("Repaso.papernotes");
        std::fs::write(
            &file,
            r#"{"title":"Repaso de derivadas","tags":["examen","repaso"],"updatedAt":1760000000000}"#,
        )
        .unwrap();
        let mut projects = Vec::new();
        collect_library_projects(&root, &root, &mut projects);
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].title, "Repaso de derivadas");
        assert_eq!(projects[0].folder, "Universidad/Cálculo");
        assert_eq!(projects[0].tags, vec!["examen", "repaso"]);
        assert_eq!(projects[0].updated_at, 1760000000);
        std::fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn writes_tags_inside_project_file() {
        let root = temp_dir("tags");
        std::fs::create_dir_all(&root).unwrap();
        let file = root.join("Proyecto.papernotes");
        std::fs::write(&file, r##"{"title":"Proyecto","document":"# Hola"}"##).unwrap();
        set_project_tags(
            file.to_str().unwrap(),
            vec![" examen ".into(), "repaso".into(), "EXAMEN".into()],
        )
        .unwrap();
        let value = read_json(&file).unwrap();
        assert_eq!(value["tags"], serde_json::json!(["examen", "repaso"]));
        std::fs::remove_dir_all(&root).unwrap();
    }
}
