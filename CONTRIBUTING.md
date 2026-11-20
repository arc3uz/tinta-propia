# Contribuir

Gracias por querer mejorar Tinta Propia. El proyecto es pequeño y prioriza que la aplicación siga siendo local, rápida y fácil de compilar en Linux y Windows.

## Flujo de trabajo

1. Haz un fork o crea una rama:

   ```bash
   git checkout -b feat/mi-cambio
   ```

2. Instala dependencias:

   ```bash
   npm ci
   ```

3. Desarrolla con Tauri:

   ```bash
   npm run app:dev
   ```

4. Antes de abrir el pull request:

   ```bash
   npm run format
   npm run lint
   npm run test:rust
   npm run build
   ```

5. Abre el PR explicando qué cambia y cómo lo probaste.

## Reglas del proyecto

- Todo debe funcionar offline.
- No agregar CDNs, telemetría ni servicios externos.
- Mantener la interfaz y los textos en español.
- El motor de manuscrito está en `src/engine.js`; los cambios de dibujo deben probarse con un documento largo (más de 50 páginas).
- Los cambios de Tauri deben probarse al menos en Linux; el CI compila Linux y Windows.
- No subir `node_modules`, `dist`, `src-tauri/target` ni instaladores.
- Respetar el formato de Rust (`cargo fmt`) y las advertencias de Clippy.

## Reportar errores

Incluye:

- Sistema operativo y versión.
- Si usas el AppImage, el `.deb`, el `.rpm`, el instalador de Windows o `npm run app:dev`.
- Pasos para reproducirlo.
- Texto o captura del error.
- Si es un problema de render, el fragmento Markdown mínimo que lo provoca.
