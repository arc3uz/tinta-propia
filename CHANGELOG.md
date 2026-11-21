# Historial de cambios

Todos los cambios relevantes se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa versionado semántico.

## [Unreleased]

## [0.4.0] - 2026-11-20

### Added

- Biblioteca de proyectos en la pantalla de inicio, con árbol de carpetas ordenado.
- Etiquetas por proyecto, guardadas dentro del archivo `.papernotes`.
- Acción **Mover a carpeta** para organizar proyectos dentro de la biblioteca.
- Acceso directo a la carpeta de la biblioteca desde la pantalla de inicio.
- Botón de pantalla completa y atajo `F11`.

### Changed

- **Guardar como** propone por defecto la carpeta de la biblioteca.
- Los proyectos recientes que están fuera de la biblioteca se muestran aparte.
- El proyecto abierto se marca como **Actual** dentro de la biblioteca.

### Fixed

- El botón de pantalla completa ahora cambia el estado real de la ventana.
- Se separó el icono de ajustar al ancho del de pantalla completa.

## [0.3.0] - 2026-11-20

### Added

- Pantalla de inicio con accesos a proyecto nuevo, abrir, importar Markdown, plantilla y proyectos recientes.
- Acceso **Menú → Inicio** para volver a la pantalla de inicio.
- Tamaños de letra desde 12 px, con atajos de 12, 14, 16, 20 y 26 px.
- Estado visual en los botones de tamaño y espaciado seleccionados.

### Changed

- El menú de ajustes muestra solo las opciones que corresponden al modo activo: mezcla de fuentes, columnas y fórmulas.
- El tamaño de letra se movió junto a la fuente manuscrita, en **Letra y tinta**.
- Los nombres visibles son genéricos: **Apunte clásico**, **Mi letra (calibrada)** y **Aplicar apunte**.
- Se unificó el anillo de foco de botones y controles desplegables.

### Removed

- Las referencias al código de curso en la interfaz y en la documentación de usuario.

## [0.2.1] - 2026-11-20

### Added

- Margen **Ninguno (0,1 cm)** para aprovechar al máximo la hoja.

### Changed

- Las guías de columna son más visibles en pantalla, impresión y PDF.
- La casilla de guías ahora se llama **Mostrar guías de columna**.

### Removed

- El recordatorio fijo **“100 % local · sin internet”** del panel lateral.

## [0.2.0] - 2026-11-20

### Added

- Fórmulas LaTeX en línea con `$...$` y en bloque con `$$...$$`.
- MathJax 3.2.2 incluido en la aplicación para renderizar fórmulas sin conexión.
- Tres modos de fórmulas: mixto, tipográfico y manuscrito.
- Botón `ƒx`, menú **Insertar fórmula** y fórmula de ejemplo en la plantilla.
- Mezcla de hasta cuatro fuentes manuscritas, por sección o por línea, con intensidad ajustable.
- Diseño de hoja en **3 columnas horizontales** para A4, Carta, Legal, A5 y Oficio.
- Guías punteadas entre columnas y salto de columna con `[[COLUMNBREAK]]`.
- Numeración por hoja, impresión horizontal y PDF con las mismas dimensiones.
- Sección de fórmulas, hoja y mezcla de fuentes en los ajustes.
- Documentación de fórmulas, fuentes y columnas en el README y en los avisos de terceros.

### Changed

- La plantilla de ejemplo incluye fórmulas y muestra los saltos de columna.
- El zoom, el estado y el contador distinguen hojas de páginas cuando hay columnas.
- La versión visible se sincroniza desde los metadatos de la aplicación.

### Fixed

- El render de fórmulas ya no intenta cargar el worker de accesibilidad de MathJax.
- Las fórmulas en bloque admiten también la sintaxis `\[...\]`.
- Los títulos no quedan solos al final de una columna si el siguiente bloque no cabe.

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
- Motor de manuscrito sobre canvas con fuente calibrada incluida.
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
