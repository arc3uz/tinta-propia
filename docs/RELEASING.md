# Publicar una versión

Guía para mantener los workflows, generar instaladores y publicar una versión de Tinta Propia.

## Workflows

El repositorio incluye tres workflows en `.github/workflows/`:

| Workflow | Cuándo se ejecuta | Qué hace |
|---|---|---|
| `ci.yml` | En pull requests, push a `main` y ejecuciones manuales. | Formato, Clippy, pruebas Rust y build del frontend. En ejecuciones manuales permite generar instaladores con la casilla **Generar instaladores**. |
| `release.yml` | Al empujar un tag `v*`. | Compila en Ubuntu, Windows y macOS y publica un **draft release** con los instaladores. |
| `cleanup.yml` | Todos los días a las 05:00 UTC y a mano. | Borra artefactos de Actions con más de 2 días; acepta `days` y `dry_run`. |

Los paquetes de CI se generan solo a pedido y con retención de 1 día para no agotar la cuota de almacenamiento de Actions. Los assets de un GitHub Release no consumen esa cuota.

## Publicar una versión

1. Actualiza la versión en todos los archivos:

   ```bash
   npm run version:bump -- 0.2.0
   cargo check --manifest-path src-tauri/Cargo.toml
   ```

2. Haz commit y push:

   ```bash
   git add .
   git commit -m "chore: versión 0.2.0"
   git push origin main
   ```

3. Crea el tag y súbelo:

   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

4. Revisa el **draft release** en GitHub. Comprueba que estén todos los assets:

   - Linux: AppImage, `.deb`, `.rpm`.
   - Windows: NSIS `.exe`, `.msi`.
   - macOS: DMG universal.

5. Prueba los instaladores y publica el release. Si es una versión de prueba, marca **Pre-release**.

## Firma de macOS

El DMG se firma en modo **ad-hoc** (`signingIdentity: "-"` en `src-tauri/tauri.macos.conf.json`). No está notarizado, así que Gatekeeper puede pedir confirmación.

Para distribuir sin advertencias hace falta una cuenta de Apple Developer, un certificado **Developer ID Application** y notarización. Configura `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_PASSWORD` y `APPLE_TEAM_ID` en el repositorio.

## Artefactos y limpieza

- La cuota de artefactos de Actions es de 2 GB. Los instaladores de Windows pesan ~300 MB cada uno, así que conviene generarlos solo cuando haga falta.
- `cleanup.yml` borra artefactos antiguos; también se puede ejecutar con **Run workflow**.
- GitHub tarda entre 6 y 12 horas en recalcular la cuota después de borrar artefactos.
- Para probar una versión sin gastar cuota, usa el **draft release**: sus assets no cuentan como artefactos de Actions.
