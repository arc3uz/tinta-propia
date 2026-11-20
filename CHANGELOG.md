# Historial de cambios

Todos los cambios relevantes se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa versionado semántico.

## [Unreleased]

## [0.1.1] - 2026-11-20

### Added

- Documentación de seguridad, código de conducta, changelog y avisos de terceros.
- Plantillas de issues y pull requests.
- Dependabot para npm, Cargo y GitHub Actions.
- Acción **Menú → Cargar plantilla de ejemplo**.

### Changed

- La app ya no incluye el resumen de I2 como documento inicial.
- El primer arranque carga una plantilla genérica de ejemplo.
- El comando **Nuevo proyecto** queda completamente en blanco.

### Removed

- `src/assets/starter.md` y el manuscrito de ejemplo dentro del repositorio.

## [0.1.0] - 2026-11-20

### Added

- Aplicación de escritorio **Tinta Propia** con Tauri 2 y Rust.
- Interfaz tipo Overleaf: archivos y esquema, editor Markdown y vista previa paginada.
- Motor de manuscrito sobre canvas con fuente calibrada `MiLetra IIC2531`.
- Tamaños de hoja A4, Carta, Legal, A5 y Oficio.
- Ajustes de espaciado entre palabras y letras, tinta, márgenes, realismo y semilla.
- Diagramas Mermaid con render en segundo plano y tema `redux-color`.
- Tablas, callouts, listas, citas, código en cajas, imágenes e índice automático.
- Proyectos `.papernotes`, autoguardado, recientes y restauración de sesión.
- Exportación PDF nativa con Rust y exportación PNG por página.
- Importación de Markdown y fuentes TTF/OTF/WOFF.
- Instaladores para Linux (AppImage, `.deb`, `.rpm`) y Windows (NSIS, MSI con WebView2 offline).
- Iconos y logo de Tinta Propia.

### Changed

- La aplicación pasó de llamarse **Papernotes Studio** a **Tinta Propia**.
- El identificador Tauri pasó a `io.github.arc3uz.tintapropia`.
- La carpeta de datos pasó a `io.github.arc3uz.tintapropia`.
- Se mantiene la extensión `.papernotes` por compatibilidad.

### Fixed

- Exportación bloqueada mientras hay diagramas Mermaid pendientes.
- Escritura atómica de proyectos y autosave.
- Cierre con `Ctrl+Q` guardando la sesión.
- Codificación UTF-16 del título en los metadatos del PDF.
