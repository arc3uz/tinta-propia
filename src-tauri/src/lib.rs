mod fonts;
mod pdf;
mod storage;

use fonts::FontPayload;
use pdf::PdfExportRequest;
use serde::Serialize;
use serde_json::Value;
use std::path::Path;
use storage::{LibrarySnapshot, RecentProject};
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Bootstrap {
    version: String,
    data_dir: String,
    documents_dir: String,
    projects_dir: String,
    fonts_dir: String,
    autosave: Option<Value>,
    settings: Option<Value>,
    recent: Vec<RecentProject>,
    custom_fonts: Vec<FontPayload>,
}

#[tauri::command]
fn bootstrap(app: AppHandle) -> Result<Bootstrap, String> {
    let dir = storage::ensure_dirs(&app)?;
    let documents_dir = app
        .path()
        .document_dir()
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_else(|_| dir.join("projects").to_string_lossy().to_string());
    Ok(Bootstrap {
        version: app.package_info().version.to_string(),
        data_dir: dir.to_string_lossy().to_string(),
        documents_dir,
        projects_dir: dir.join("projects").to_string_lossy().to_string(),
        fonts_dir: dir.join("fonts").to_string_lossy().to_string(),
        autosave: storage::read_json(&dir.join("autosave.json")),
        settings: storage::read_json(&dir.join("settings.json")),
        recent: storage::recent_projects(&app),
        custom_fonts: fonts::list_custom_fonts(&app),
    })
}

#[tauri::command]
fn load_project(path: String) -> Result<Value, String> {
    let p = Path::new(&path);
    storage::read_json(p).ok_or_else(|| format!("No se pudo leer el proyecto: {path}"))
}

#[tauri::command]
fn save_project(app: AppHandle, path: String, project: Value) -> Result<(), String> {
    let p = Path::new(&path);
    storage::write_json(p, &project)?;
    let title = project
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Sin título");
    storage::touch_recent(&app, &path, title)
}

#[tauri::command]
fn autosave_project(path: String, project: Value) -> Result<(), String> {
    storage::write_json(Path::new(&path), &project)
}

#[tauri::command]
fn load_autosave(app: AppHandle) -> Option<Value> {
    let dir = storage::app_data(&app).ok()?;
    storage::read_json(&dir.join("autosave.json"))
}

#[tauri::command]
fn save_autosave(app: AppHandle, project: Value) -> Result<(), String> {
    let dir = storage::ensure_dirs(&app)?;
    storage::write_json(&dir.join("autosave.json"), &project)
}

#[tauri::command]
fn clear_autosave(app: AppHandle) -> Result<(), String> {
    let dir = storage::ensure_dirs(&app)?;
    let path = dir.join("autosave.json");
    if path.exists() {
        std::fs::remove_file(path)
            .map_err(|e| format!("No se pudo borrar el autoguardado: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
fn load_settings(app: AppHandle) -> Option<Value> {
    let dir = storage::app_data(&app).ok()?;
    storage::read_json(&dir.join("settings.json"))
}

#[tauri::command]
fn save_settings(app: AppHandle, settings: Value) -> Result<(), String> {
    let dir = storage::ensure_dirs(&app)?;
    storage::write_json(&dir.join("settings.json"), &settings)
}

#[tauri::command]
fn list_library(app: AppHandle) -> Result<LibrarySnapshot, String> {
    storage::list_library(&app)
}

#[tauri::command]
fn create_library_folder(app: AppHandle, folder: String) -> Result<String, String> {
    storage::create_library_folder(&app, &folder)
}

#[tauri::command]
fn rename_library_folder(
    app: AppHandle,
    old_folder: String,
    new_folder: String,
) -> Result<(), String> {
    storage::rename_library_folder(&app, &old_folder, &new_folder)
}

#[tauri::command]
fn delete_library_folder(app: AppHandle, folder: String) -> Result<(), String> {
    storage::delete_library_folder(&app, &folder)
}

#[tauri::command]
fn set_folder_tags(app: AppHandle, folder: String, tags: Vec<String>) -> Result<(), String> {
    storage::set_folder_tags(&app, &folder, tags)
}

#[tauri::command]
fn set_project_title(app: AppHandle, path: String, title: String) -> Result<(), String> {
    storage::set_project_title(&app, &path, &title)
}

#[tauri::command]
fn duplicate_project(app: AppHandle, path: String) -> Result<String, String> {
    storage::duplicate_project(&app, &path)
}

#[tauri::command]
fn trash_project(app: AppHandle, path: String) -> Result<String, String> {
    storage::trash_project(&app, &path)
}

#[tauri::command]
fn create_project_in_folder(
    app: AppHandle,
    folder: String,
    title: String,
) -> Result<String, String> {
    storage::create_project_in_folder(&app, &folder, &title)
}

#[tauri::command]
fn move_project_to_path(app: AppHandle, path: String, target: String) -> Result<String, String> {
    storage::move_project_to_path(&app, &path, &target)
}

#[tauri::command]
fn set_project_tags(path: String, tags: Vec<String>) -> Result<(), String> {
    storage::set_project_tags(&path, tags)
}

#[tauri::command]
fn move_project_to_folder(app: AppHandle, path: String, folder: String) -> Result<String, String> {
    storage::move_project_to_folder(&app, &path, &folder)
}

#[tauri::command]
fn recent_projects(app: AppHandle) -> Vec<RecentProject> {
    storage::recent_projects(&app)
}

#[tauri::command]
fn touch_recent(app: AppHandle, path: String, title: String) -> Result<(), String> {
    storage::touch_recent(&app, &path, &title)
}

#[tauri::command]
fn remove_recent(app: AppHandle, path: String) -> Result<(), String> {
    storage::remove_recent(&app, &path)
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("No se pudo leer el archivo: {e}"))
}

#[tauri::command]
fn save_text_file(path: String, content: String) -> Result<(), String> {
    storage::atomic_write(Path::new(&path), content.as_bytes())
}

#[tauri::command]
fn save_binary_file(path: String, data_base64: String) -> Result<(), String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    let raw = if let Some(pos) = data_base64.find(',') {
        &data_base64[pos + 1..]
    } else {
        data_base64.as_str()
    };
    let bytes = STANDARD
        .decode(raw)
        .map_err(|e| format!("El archivo no es válido: {e}"))?;
    storage::atomic_write(Path::new(&path), &bytes)
}

#[tauri::command]
fn import_font(app: AppHandle, path: String) -> Result<FontPayload, String> {
    fonts::import_font(&app, &path)
}

#[tauri::command]
fn list_custom_fonts(app: AppHandle) -> Vec<FontPayload> {
    fonts::list_custom_fonts(&app)
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    let dir = Path::new(&path);
    if !dir.is_dir() {
        return Err("La carpeta no existe.".to_string());
    }
    open::that(dir).map_err(|e| format!("No se pudo abrir la carpeta: {e}"))
}

#[tauri::command]
fn export_pdf(request: PdfExportRequest) -> Result<String, String> {
    pdf::export_pdf(request)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if let Err(err) = storage::ensure_dirs(&app.handle().clone()) {
                eprintln!("Tinta Propia: {err}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            bootstrap,
            load_project,
            save_project,
            load_autosave,
            save_autosave,
            autosave_project,
            clear_autosave,
            load_settings,
            save_settings,
            recent_projects,
            list_library,
            create_library_folder,
            rename_library_folder,
            delete_library_folder,
            set_folder_tags,
            set_project_tags,
            set_project_title,
            duplicate_project,
            trash_project,
            create_project_in_folder,
            move_project_to_path,
            move_project_to_folder,
            touch_recent,
            remove_recent,
            read_text_file,
            save_text_file,
            save_binary_file,
            import_font,
            list_custom_fonts,
            open_folder,
            export_pdf
        ])
        .run(tauri::generate_context!())
        .expect("Error al iniciar Tinta Propia");
}
