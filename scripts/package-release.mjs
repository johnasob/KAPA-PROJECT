import { spawnSync } from "node:child_process";
import "./build-installer.mjs";
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
