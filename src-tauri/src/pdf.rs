use base64::{engine::general_purpose::STANDARD, Engine as _};
use lopdf::content::{Content, Operation};
use lopdf::{dictionary, Dictionary, Document, Object, Stream};
use serde::Deserialize;
use std::path::Path;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfPage {
    /// JPEG codificado en base64, sin el prefijo data:.
    pub image_base64: String,
    /// Ancho de la página en puntos PDF (1/72 de pulgada).
    pub width_pt: f64,
    /// Alto de la página en puntos PDF.
    pub height_pt: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfExportRequest {
    pub path: String,
    pub title: String,
    pub pages: Vec<PdfPage>,
}

pub fn export_pdf(req: PdfExportRequest) -> Result<String, String> {
    if req.pages.is_empty() {
        return Err("No hay páginas para exportar.".to_string());
    }
    if req.pages.len() > 500 {
        return Err("El documento supera el máximo de 500 páginas.".to_string());
    }

    let path = Path::new(&req.path);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("No se pudo crear la carpeta destino: {e}"))?;
    }

    let mut doc = Document::with_version("1.6");
    let pages_id = doc.new_object_id();
    let mut page_ids: Vec<Object> = Vec::with_capacity(req.pages.len());

    for (index, page) in req.pages.iter().enumerate() {
        let raw = if let Some(pos) = page.image_base64.find(',') {
            &page.image_base64[pos + 1..]
        } else {
            page.image_base64.as_str()
        };
        let jpeg = STANDARD
            .decode(raw)
            .map_err(|e| format!("La imagen de la página {} no es válida: {e}", index + 1))?;
        if jpeg.len() < 4 || jpeg[0..2] != [0xFF, 0xD8] {
            return Err(format!(
                "La imagen de la página {} no es un JPEG válido.",
                index + 1
            ));
        }

        let width = page.width_pt.clamp(1.0, 20_000.0) as f32;
        let height = page.height_pt.clamp(1.0, 20_000.0) as f32;

        let image_dict = dictionary! {
            "Type" => Object::Name(b"XObject".to_vec()),
            "Subtype" => Object::Name(b"Image".to_vec()),
            "Width" => Object::Integer(jpeg_dimension(&jpeg, true).unwrap_or(1) as i64),
            "Height" => Object::Integer(jpeg_dimension(&jpeg, false).unwrap_or(1) as i64),
            "ColorSpace" => Object::Name(b"DeviceRGB".to_vec()),
            "BitsPerComponent" => Object::Integer(8),
            "Filter" => Object::Name(b"DCTDecode".to_vec()),
        };
        let image_id = doc.add_object(Stream::new(image_dict, jpeg));

        let content = Content {
            operations: vec![
                Operation::new("q", vec![]),
                Operation::new(
                    "cm",
                    vec![
                        Object::Real(width),
                        Object::Real(0.0),
                        Object::Real(0.0),
                        Object::Real(height),
                        Object::Real(0.0),
                        Object::Real(0.0),
                    ],
                ),
                Operation::new("Do", vec![Object::Name(b"Im0".to_vec())]),
                Operation::new("Q", vec![]),
            ],
        };
        let content_bytes = content
            .encode()
            .map_err(|e| format!("No se pudo construir la página {}: {e}", index + 1))?;
        let content_id = doc.add_object(Stream::new(Dictionary::new(), content_bytes));

        let page_dict = dictionary! {
            "Type" => Object::Name(b"Page".to_vec()),
            "Parent" => Object::Reference(pages_id),
            "MediaBox" => Object::Array(vec![
                Object::Integer(0),
                Object::Integer(0),
                Object::Real(width),
                Object::Real(height),
            ]),
            "Resources" => dictionary! {
                "XObject" => dictionary! {
                    "Im0" => Object::Reference(image_id),
                },
                "ProcSet" => Object::Array(vec![
                    Object::Name(b"PDF".to_vec()),
                    Object::Name(b"ImageC".to_vec()),
                ]),
            },
            "Contents" => Object::Reference(content_id),
        };
        let page_id = doc.add_object(page_dict);
        page_ids.push(Object::Reference(page_id));
    }

    let page_count = page_ids.len() as i64;
    doc.objects.insert(
        pages_id,
        Object::Dictionary(dictionary! {
            "Type" => Object::Name(b"Pages".to_vec()),
            "Kids" => Object::Array(page_ids),
            "Count" => Object::Integer(page_count),
        }),
    );

    let catalog_id = doc.add_object(dictionary! {
        "Type" => Object::Name(b"Catalog".to_vec()),
        "Pages" => Object::Reference(pages_id),
    });

    let info_id = doc.add_object(dictionary! {
        "Title" => pdf_text(&req.title),
        "Producer" => Object::string_literal("Papernotes Studio"),
        "Creator" => Object::string_literal("Papernotes Studio"),
    });

    doc.trailer.set("Root", Object::Reference(catalog_id));
    doc.trailer.set("Info", Object::Reference(info_id));
    doc.save(path)
        .map_err(|e| format!("No se pudo escribir el PDF: {e}"))?;
    Ok(req.path)
}

/// Texto PDF con BOM UTF-16BE para que títulos con acentos y guiones largos
/// se lean correctamente en cualquier visor.
fn pdf_text(text: &str) -> Object {
    let mut bytes = vec![0xFE, 0xFF];
    for unit in text.encode_utf16() {
        bytes.extend_from_slice(&unit.to_be_bytes());
    }
    Object::String(bytes, lopdf::StringFormat::Hexadecimal)
}

/// Obtiene ancho/alto reales de un JPEG recorriendo sus marcadores SOF.
fn jpeg_dimension(bytes: &[u8], want_width: bool) -> Option<u32> {
    let mut i = 2usize;
    while i + 9 < bytes.len() {
        if bytes[i] != 0xFF {
            i += 1;
            continue;
        }
        let marker = bytes[i + 1];
        i += 2;
        if marker == 0xD8 || marker == 0xD9 {
            continue;
        }
        if i + 2 > bytes.len() {
            break;
        }
        let len = ((bytes[i] as usize) << 8) | bytes[i + 1] as usize;
        if len < 2 || i + len > bytes.len() {
            break;
        }
        let is_sof = matches!(
            marker,
            0xC0 | 0xC1
                | 0xC2
                | 0xC3
                | 0xC5
                | 0xC6
                | 0xC7
                | 0xC9
                | 0xCA
                | 0xCB
                | 0xCD
                | 0xCE
                | 0xCF
        );
        if is_sof && len >= 7 {
            let height = ((bytes[i + 3] as u32) << 8) | bytes[i + 4] as u32;
            let width = ((bytes[i + 5] as u32) << 8) | bytes[i + 6] as u32;
            return Some(if want_width { width } else { height });
        }
        i += len;
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    const TINY_RGB_JPEG: &str = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAAIAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/ALLAB//Z";

    #[test]
    fn writes_a_pdf_with_embedded_jpeg() {
        let path = std::env::temp_dir().join("papernotes-rust-pdf-test.pdf");
        let req = PdfExportRequest {
            path: path.to_string_lossy().to_string(),
            title: "Prueba".to_string(),
            pages: vec![PdfPage {
                image_base64: TINY_RGB_JPEG.to_string(),
                width_pt: 595.28,
                height_pt: 841.89,
            }],
        };
        export_pdf(req).expect("el PDF debe generarse");
        let bytes = std::fs::read(&path).expect("el PDF debe existir");
        assert!(bytes.starts_with(b"%PDF"));
        assert!(bytes.len() > 200);
        let text = String::from_utf8_lossy(&bytes);
        assert!(text.contains("/DCTDecode"));
        assert!(text.contains("/MediaBox"));
        assert!(text.contains("/Count 1"));
        let _ = std::fs::remove_file(path);
    }
}
