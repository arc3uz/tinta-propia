# Historial de cambios

Todos los cambios relevantes se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa versionado semántico.

## [Unreleased]

## [0.9.2] - 2026-11-21

### Performance

- MathJax se carga solo cuando el documento contiene fórmulas.
- Mermaid se importa dinámicamente y solo se descarga si hay diagramas.
- Las fuentes ya cargadas no se vuelven a comprobar en cada compilación.
- La caché de fórmulas tiene un límite para evitar crecer indefinidamente.
- El paquete inicial de JavaScript se redujo alrededor de un 17 %.

## [0.9.1] - 2026-11-21

### Added

- Ayuda de sintaxis dentro del diálogo **Ajustar imagen**.
- Formato abreviado `[[IMG:1|right|Pie]]` y variantes con espacios, minúsculas y nombres en español.

### Changed

- El ancho es opcional en el token; si la imagen va a un lado, se usa 45 % por defecto.
- Si no se escribe `[[/IMG]]`, se usa el párrafo siguiente como texto lateral.
- El editor genera tokens abreviados al ajustar una imagen.

## [0.9.0] - 2026-11-21

### Added

- Redimensionamiento de imágenes desde **Ajustar imagen**.
- Diseño de imagen con texto al lado: imagen a la izquierda o a la derecha.
- Pie de imagen opcional.
- Vista previa de la imagen al ajustarla.

### Changed

- Los tokens de imagen admiten `width=`, `side=` y pie de imagen.
- El botón de imagen del editor ajusta la imagen si el cursor está sobre su token.
- El bloque de imagen lateral se cierra con `[[/IMG]]`.

## [0.8.0] - 2026-11-21

### Added

- Menú contextual en la biblioteca al hacer clic derecho sobre una carpeta, un proyecto o el fondo.
- Crear un proyecto `.papernotes` directamente dentro de cualquier carpeta.
- Mover un proyecto a cualquier ubicación del equipo mediante el diálogo nativo.
- El logotipo de la barra superior abre el menú del proyecto.

### Changed

- **Guardar como** propone por defecto la carpeta de la biblioteca de la aplicación.
- El botón **Menú** independiente se eliminó; ahora el acceso es el logotipo.
- La biblioteca permite crear archivos dentro de la carpeta seleccionada sin salir de Inicio.

## [0.7.1] - 2026-11-21

### Fixed

- Las carpetas vacías de la biblioteca se muestran aunque todavía no haya proyectos guardados.
- Crear una carpeta desde la interfaz actualiza el árbol inmediatamente.

## [0.7.0] - 2026-11-20

### Added

- Buscador de proyectos por título o etiqueta.
- Filtros por etiqueta y orden por nombre o fecha.
- Renombrar, duplicar y eliminar proyectos desde la biblioteca.
- Crear, renombrar y eliminar carpetas, incluidas carpetas vacías.
- Acción para abrir la carpeta contenedora de un proyecto.
- Papelera interna para los proyectos eliminados.

### Changed

- La biblioteca incluye todas las carpetas dentro de `projects/`, aunque estén vacías.
- El árbol se actualiza al buscar, filtrar u ordenar sin recargar la página.

## [0.6.2] - 2026-11-20

### Added

- Vista previa MathJax en vivo dentro de la paleta de fórmulas.
- Las fracciones manuscritas se dibujan apiladas, con numerador, barra y denominador.

### Changed

- La vista previa se actualiza al escribir o al insertar una fórmula rápida.

## [0.6.1] - 2026-11-20

### Changed

- **Guardar como** abre el diálogo nativo en la carpeta estándar de Documentos; el botón de la biblioteca sigue guardando ahí cuando se usa desde Inicio.

### Fixed

- **Abrir carpeta** ahora usa un comando nativo de Rust y abre correctamente la carpeta de proyectos y la carpeta de datos.

## [0.6.0] - 2026-11-20

### Added

- **Inicio** como vista propia dentro de la aplicación, no como ventana flotante.
- Biblioteca a página completa con acciones rápidas, árbol de carpetas y recientes.
- Paleta de inserción rápida de fórmulas con categorías, más usadas y recientes.
- Atajo `Ctrl + Shift + F` para abrir la paleta de fórmulas.

### Changed

- El botón `ƒx` y la opción **Insertar fórmula** abren la nueva paleta rápida.
- Las fórmulas usadas se recuerdan en el equipo para ordenar la paleta.
- Los ajustes y el documento permanecen cargados al entrar y salir de Inicio.

## [0.5.1] - 2026-11-20

### Changed

- El botón **Menú** pasó a la esquina superior izquierda, antes del título del proyecto.
- El desplegable del menú se alinea a la izquierda, debajo del botón.
- La pantalla de inicio vuelve a mostrarse como diálogo central; el panel lateral queda reservado para los ajustes.

## [0.5.0] - 2026-11-20

### Added

- Documentación de arquitectura del frontend en `docs/ARCHITECTURE.md`.

### Changed

- El menú de inicio y la biblioteca ahora se abren como panel lateral derecho.
- El código se dividió en módulos `core/` y `features/`, con comentarios de responsabilidad y JSDoc en las funciones compartidas.
- La biblioteca recibe las acciones de proyecto como dependencias explícitas.
- El esquema y la biblioteca usan `DocumentFragment` para insertar listas de una sola vez.

### Fixed

- El panel de inicio ya no queda centrado: sigue la convención de los paneles laterales de la aplicación.

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
