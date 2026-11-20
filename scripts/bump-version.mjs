import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("Uso: npm run version:bump -- 0.2.0");
  process.exit(1);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(path.join(root, file), `${JSON.stringify(value, null, 2)}\n`);
}

const pkg = readJson("package.json");
pkg.version = version;
writeJson("package.json", pkg);

const lock = readJson("package-lock.json");
if (lock.packages?.[""]) lock.packages[""].version = version;
lock.version = version;
writeJson("package-lock.json", lock);

const tauri = readJson("src-tauri/tauri.conf.json");
tauri.version = version;
writeJson("src-tauri/tauri.conf.json", tauri);

const cargoPath = path.join(root, "src-tauri/Cargo.toml");
const cargo = fs.readFileSync(cargoPath, "utf8").replace(
  /^version = "[^"]+"$/m,
  `version = "${version}"`
);
fs.writeFileSync(cargoPath, cargo);

console.log(`Versión actualizada a ${version}.`);
console.log("Recuerda ejecutar `cargo check` o `npm run app:build` para actualizar Cargo.lock.");
