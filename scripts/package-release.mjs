import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const body = (path) =>
  readFileSync(path, "utf8")
    .replace(/^begin;\s*/i, "")
    .replace(/\s*commit;\s*$/i, "");
const foundations = body("supabase/migrations/20261019000100_foundations.sql");
const registration = body(
  "supabase/migrations/20261020000100_registration.sql",
);
const installer = `-- Instalación o actualización de KAPA 3D. Ejecutar en SQL Editor de Supabase.
-- Conserva los datos existentes y puede repetirse. No contiene contraseñas.
begin;
do $kapa_install$
begin
  if to_regclass('public.business_settings') is null then
    if to_regclass('public.partners') is not null or to_regclass('public.user_profiles') is not null or to_regclass('public.audit_log') is not null then
      raise exception 'Hay una instalación inicial incompleta. No se modificó la base de datos.';
    end if;
    execute $kapa_foundations$${foundations}$kapa_foundations$;
  end if;
  if to_regprocedure('private.is_admin()') is null or to_regclass('public.user_profiles') is null then
    raise exception 'La base de datos no tiene los fundamentos completos de KAPA.';
  end if;
  if to_regclass('public.registration_requests') is null then
    execute $kapa_registration$${registration}$kapa_registration$;
  end if;
end;
$kapa_install$;
commit;
`;
mkdirSync("release", { recursive: true });
writeFileSync("release/KAPA-3D-instalacion.sql", installer);
const result = spawnSync(
  "python3",
  [
    "-c",
    `
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root=Path('dist')
assert (root/'index.html').is_file()
assert (root/'_redirects').read_text().strip()=='/* /index.html 200'
with ZipFile('release/KAPA-3D-web.zip','w',ZIP_DEFLATED) as archive:
 for path in sorted(root.rglob('*')):
  if path.is_file(): archive.write(path,Path('KAPA-3D')/path.relative_to(root))
with ZipFile('release/KAPA-3D-web.zip') as archive:
 assert archive.testzip() is None
 assert all('.env' not in name for name in archive.namelist())
print('Paquete web e instalación SQL preparados en release/.')
`,
  ],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
