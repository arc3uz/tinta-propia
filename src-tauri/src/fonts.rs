use crate::storage;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FontPayload {
    pub name: String,
    pub file_name: String,
    pub data: String,
}

fn allowed_extension(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_ascii_lowercase())
            .as_deref(),
        Some("ttf" | "otf" | "woff" | "woff2")
    )
}

fn clean_family(stem: &str) -> String {
    let mut out = String::new();
    for ch in stem.chars() {
        if ch.is_alphanumeric() || ch == ' ' || ch == '-' || ch == '_' || ch == '.' {
            out.push(ch);
        }
    }
    let out = out.trim().trim_matches('.').trim().to_string();
    if out.is_empty() {
        "Mi fuente".to_string()
    } else {
        out
    }
}

fn readable(path: &Path, file_name: String) -> Result<FontPayload, String> {
    let bytes = fs::read(path).map_err(|e| format!("No se pudo leer la fuente: {e}"))?;
    let name = clean_family(
        path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Mi fuente"),
    );
    Ok(FontPayload {
        name,
        file_name,
        data: STANDARD.encode(bytes),
    })
}

pub fn fonts_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(storage::ensure_dirs(app)?.join("fonts"))
}

pub fn list_custom_fonts(app: &AppHandle) -> Vec<FontPayload> {
    let Ok(dir) = fonts_dir(app) else {
        return Vec::new();
    };
    let Ok(entries) = fs::read_dir(&dir) else {
        return Vec::new();
    };
    let mut fonts = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() || !allowed_extension(&path) {
            continue;
        }
        let file_name = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("fuente.ttf")
            .to_string();
        if let Ok(font) = readable(&path, file_name) {
            fonts.push(font);
        }
    }
    fonts.sort_by_key(|font| font.name.to_lowercase());
    fonts
}

pub fn import_font(app: &AppHandle, source: &str) -> Result<FontPayload, String> {
    let source_path = Path::new(source);
    if !source_path.is_file() {
        return Err("La fuente seleccionada no existe.".to_string());
    }
    if !allowed_extension(source_path) {
        return Err("Formato no compatible. Usa TTF, OTF, WOFF o WOFF2.".to_string());
    }

    let dir = fonts_dir(app)?;
    let base_name = clean_family(
        source_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Mi fuente"),
    );
    let ext = source_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("ttf")
        .to_ascii_lowercase();

    let mut candidate = format!("{base_name}.{ext}");
    let mut n = 2;
    while dir.join(&candidate).exists() {
        candidate = format!("{base_name} {n}.{ext}");
        n += 1;
    }

    let dest = dir.join(&candidate);
    fs::copy(source_path, &dest).map_err(|e| format!("No se pudo copiar la fuente: {e}"))?;
    readable(&dest, candidate)
}
