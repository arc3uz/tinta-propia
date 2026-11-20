# Política de seguridad

Tinta Propia es una aplicación local: no tiene servidor, cuentas, telemetría ni conexión a internet. Aun así, procesa archivos del usuario (Markdown, fuentes, imágenes y proyectos) y genera PDF, así que los errores de validación o de rutas también son relevantes.

## Versiones soportadas

| Versión | Soporte |
|---|---|
| `0.1.x` | Sí |

## Reportar una vulnerabilidad

**No abras un issue público con detalles explotables.**

Usa la pestaña **Security → Report a vulnerability** del repositorio:

```text
https://github.com/arc3uz/tinta-propia/security/advisories/new
```

Si esa opción no está disponible, contacta a [@arc3uz](https://github.com/arc3uz) por GitHub indicando solo que necesitas un canal privado.

Incluye, si puedes:

- Versión de Tinta Propia y sistema operativo.
- Forma de instalación: AppImage, `.deb`, `.rpm`, NSIS, MSI o navegador.
- Pasos para reproducirlo.
- Impacto que crees que tiene.
- Un archivo Markdown, fuente o proyecto mínimo que lo active.
- Capturas o trazas, evitando datos personales.

## Alcance

Se consideran relevantes, entre otros:

- Ejecución de código o escape del sandbox a través de documentos, fuentes, imágenes o diagramas Mermaid.
- Rutas de archivos manipuladas por un proyecto o un nombre de fuente.
- Fallos en los comandos de Tauri que permitan leer o escribir archivos fuera de lo esperado.
- Inyección en el PDF o en la vista previa.
- Evasión de la política de seguridad del webview (CSP).

Quedan fuera del alcance:

- Que un documento malicioso contenga texto ofensivo.
- Problemas del sistema operativo o del webview fuera del control de la app.
- Pérdida de datos por errores del usuario sin una causa técnica reproducible.
- Ataques que requieran acceso físico o una cuenta ya comprometida.

## Modelo de seguridad

- La aplicación se ejecuta localmente y no envía datos a ningún servicio.
- Los archivos solo se abren o guardan mediante acciones explícitas del usuario.
- Las fuentes importadas se copian a la carpeta de datos de la aplicación.
- Mermaid renderiza en el webview con `securityLevel: 'strict'` y sin etiquetas HTML externas.
- El PDF se construye en Rust con imágenes rasterizadas localmente.
- Las dependencias se actualizan mediante Dependabot y CI en Linux y Windows.

## Respuesta

El mantenimiento es de mejor esfuerzo. Se intentará confirmar el reporte, preparar una corrección y coordinar la divulgación antes de publicar detalles.
