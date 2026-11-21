# Arquitectura de Tinta Propia

Tinta Propia es una aplicación Tauri 2. El frontend es JavaScript nativo y el
backend Rust se encarga de archivos, fuentes y PDF. No hay framework de UI ni
servicios externos.

## Organización del frontend

```text
src/
  main.js              arranque, editor, compilación, proyectos y ajustes
  engine.js            motor canvas: texto, fórmulas, tablas, columnas y papel
  editor.js            CodeMirror 6
  math.js              extracción y render de fórmulas con MathJax/Unicode
  mermaid.js           render de diagramas Mermaid
  fonts.css            fuentes locales
  styles.css           estilos de la interfaz

  core/
    state.js           estado compartido, claves de persistencia y constantes
    utils.js           DOM, formato de fechas/tamaños y utilidades de archivos
    modal.js           modales, avisos, confirmaciones y progreso

  features/
    library.js         inicio, biblioteca, etiquetas y carpetas
    formulas.js        paleta rápida de fórmulas y frecuencia de uso
    export.js          exportación a PDF, PNG y Markdown
    outline.js         esquema y estadísticas del documento
```

### Responsabilidades

- **`main.js`** es el orquestador. No debería contener utilidades genéricas ni
  código de una sola pantalla si puede vivir en `core/` o `features/`.
- **`core/state.js`** es la única fuente del estado mutable de la aplicación.
  Los módulos lo importan en lugar de recibir copias del estado.
- **`core/utils.js`** no conoce proyectos, compilación ni ajustes.
- **`core/modal.js`** concentra la pila de modales para que `Escape` cierre
  siempre el diálogo correcto.
- **`features/library.js`** recibe las acciones de proyecto como dependencias.
  Así no importa `main.js` ni crea un ciclo de módulos.
- **`features/formulas.js`** mantiene la paleta y el historial local de fórmulas;
  la inserción final se delega a `main.js` mediante un callback.
- **`engine.js`** no toca el DOM de la interfaz: recibe ajustes, imágenes y
  fórmulas, y devuelve canvas.

## Flujo de compilación

```text
editor
  → compile()
    → prepareMath()
    → render Mermaid pendiente
    → renderDocument()
    → mountPreview()
```

1. El editor avisa de un cambio y programa una compilación con retardo.
2. Las fórmulas se preparan y se cachean por modo, fuente y tinta.
3. Los diagramas Mermaid se renderizan en segundo plano y se cachean por código.
4. El motor recorre el Markdown y dibuja cada hoja en un canvas.
5. La vista previa monta los canvas y calcula el zoom.

## Persistencia

- `autosave.json`: sesión actual.
- `settings.json`: ajustes globales.
- `recent.json`: últimos proyectos abiertos.
- `projects/`: biblioteca de proyectos, organizada en carpetas.
- Cada `.papernotes` guarda documento, ajustes, imágenes, etiquetas y fecha.

Los proyectos antiguos se normalizan al abrirlos. En particular, el nombre
interno de la fuente calibrada se migra de forma automática.

## Convenciones

- Los módulos nuevos deben documentar su responsabilidad con un comentario de
  cabecera.
- Las funciones con lógica no evidente llevan JSDoc breve.
- Las utilidades compartidas no deben depender de `main.js`.
- Las acciones que cruzan módulos se pasan como dependencias explícitas.
- Los listeners se concentran en `bind*` y las funciones de render no mutan el
  estado global salvo que sea parte de su responsabilidad.
- Para listas largas se usa `DocumentFragment` antes de insertar en el DOM.

## Optimización

- Las estadísticas y el esquema se recalculan con retardo (220 ms).
- Mermaid y MathJax tienen caché en memoria.
- La compilación descarta resultados de generaciones anteriores.
- La biblioteca se lee solo al abrir el menú de inicio o al refrescar tras una
  acción, no en cada pulsación.
- Las hojas se liberan cuando se reemplaza la vista previa.

## Próximos pasos posibles

- Extraer los ajustes a `features/settings.js` con callbacks para compilación y
  autoguardado.
- Extraer los flujos de proyecto a `features/projects.js`.
- Añadir pruebas de interfaz con Playwright para los flujos principales.
