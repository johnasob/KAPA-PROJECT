// Docker VFS duplica capas completas y no puede extraer la imagen de Supabase
// en el disco cloud. Exporta las mismas capas oficiales a una sola capa local.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
const run = (command, args, options = {}) =>
  execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    ...options,
  });
const image = "supabase/postgres:17.6.1.081"; // Imagen de PostgreSQL 17 fijada por CLI 2.76.4.
if (run("docker", ["info", "--format", "{{.Driver}}"]).trim() !== "vfs")
  process.exit(0);
try {
  run("docker", ["image", "inspect", image], { stdio: "ignore" });
  process.exit(0);
} catch {
  /* Preparar imagen ausente. */
}
if (process.platform !== "linux" || !["x64", "arm64"].includes(process.arch))
  throw new Error(
    "Usa un almacenamiento Docker compatible o prepara la imagen oficial manualmente.",
  );
const arch = process.arch === "x64" ? "x86_64" : "arm64";
const platform = process.arch === "x64" ? "linux/amd64" : "linux/arm64";
const dir = resolve(".tools/crane-0.20.3");
mkdirSync(dir, { recursive: true });
const crane = resolve(dir, "crane");
function download(url, path) {
  run("curl", [
    "--fail",
    "--silent",
    "--show-error",
    "--location",
    "--retry",
    "2",
    url,
    "-o",
    path,
  ]);
}
if (!existsSync(crane)) {
  const base =
    "https://github.com/google/go-containerregistry/releases/download/v0.20.3";
  const archive = `go-containerregistry_Linux_${arch}.tar.gz`;
  download(`${base}/checksums.txt`, resolve(dir, "checksums.txt"));
  download(`${base}/${archive}`, resolve(dir, archive));
  const expected = readFileSync(resolve(dir, "checksums.txt"), "utf8")
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .find((parts) => parts[1] === archive)?.[0];
  const actual = createHash("sha256")
    .update(readFileSync(resolve(dir, archive)))
    .digest("hex");
  if (!expected || actual !== expected)
    throw new Error("La suma SHA-256 oficial de crane no coincide.");
  run("tar", ["-xzf", resolve(dir, archive), "-C", dir, "crane"]);
}
console.log(
  "Docker VFS: preparando una capa local a partir de la imagen oficial verificada…",
);
const source = `registry-1.docker.io/${image}`;
const digest = run(crane, ["digest", "--platform", platform, source]).trim();
if (!/^sha256:[a-f0-9]{64}$/.test(digest))
  throw new Error("Digest de imagen inválido.");
const pinned = `registry-1.docker.io/supabase/postgres@${digest}`;
const config = JSON.parse(
  run(crane, ["config", "--platform", platform, pinned]),
).config;
const rootfs = resolve(dir, "postgres-rootfs.tar");
try {
  // crane verifica los digests de las capas del registro. No se omite TLS.
  run(crane, ["export", "--platform", platform, pinned, rootfs], {
    stdio: "inherit",
  });
  const changes = [];
  for (const item of config.Env ?? []) changes.push("--change", `ENV ${item}`);
  for (const [key, directive] of [
    ["Entrypoint", "ENTRYPOINT"],
    ["Cmd", "CMD"],
  ]) {
    if (config[key] != null)
      changes.push("--change", `${directive} ${JSON.stringify(config[key])}`);
  }
  for (const [key, directive] of [
    ["User", "USER"],
    ["WorkingDir", "WORKDIR"],
  ]) {
    if (config[key]) changes.push("--change", `${directive} ${config[key]}`);
  }
  for (const port of Object.keys(config.ExposedPorts ?? {}))
    changes.push("--change", `EXPOSE ${port}`);
  changes.push("--change", `LABEL org.kapa.source-image-digest=${digest}`);
  run("docker", ["import", "--platform", platform, ...changes, rootfs, image], {
    stdio: "inherit",
  });
} finally {
  rmSync(rootfs, { force: true });
}
