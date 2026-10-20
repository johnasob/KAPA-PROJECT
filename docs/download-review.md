# Revisión de la descarga de KAPA 3D

## Estado: detección pendiente de resolver

El 20 de octubre de 2026 el usuario aportó una captura de Microsoft Defender con la detección **Trojan:Script/Ulthar.A!ml**, severidad grave y estado **Error en la cuarentena / Corrección incompleta**, para `KAPA-3D-web.zip`. No se ha confirmado ni descartado un falso positivo. La captura documenta la detección de los archivos descargados; no permite determinar si se ejecutó código en el equipo.

Se retiró el ZIP de la rama principal para detener su distribución recomendada. El historial de Git conserva versiones anteriores; su disponibilidad no constituye una validación de seguridad. No se ofrece un ZIP alternativo ni se recomienda desplegar el mismo contenido por otra vía para evitar el bloqueo.

## Muestra identificada

Commit que publicó la muestra: `c883cbb5eaa7fd1b75f936d7d9ebaec6ba465048`.

SHA-256 del ZIP de 201.838 bytes:

```text
7ae3bfbd4a208679067b7ffa1c4da379479e926a12cf36600fb07090dc7e8f75
```

Los nombres indicados en la captura corresponden a estos archivos de la muestra conservada en Git:

| Archivo dentro de KAPA-3D | SHA-256 |
| --- | --- |
| `assets/AuditPage-BEZ4Wm6x.js` | `a085a103fa61fcb1f8403827b514c71866dacacdc3306cca27aa06604821c220` |
| `assets/AuthScreen-COPOL3vN.js` | `ad0e5900be8ff29acb3ca29bd5beab1b684ff1c39af9f7deadb390b1a7bae370` |
| `index.html` | `59a2578221599855af9c9fa0c88b3ae87086da7341d7c694969b1eff905013de` |

No se ha recibido una copia del archivo del equipo del usuario para comparar su hash. Los hashes de esta tabla corresponden al paquete publicado, no a un análisis remoto de ese equipo.

## Comprobaciones realizadas

1. Se extrajo el commit publicado en una carpeta temporal independiente, sin copiar `node_modules` ni `dist` del checkout de trabajo. No se creó otro worktree.
2. Se ejecutó `npm ci --ignore-scripts --no-audit --no-fund` con el lockfile versionado. No se ejecutaron scripts de instalación de dependencias. Se ejecutó después el comando versionado `npm run build:deploy` con la misma configuración pública de Supabase.
3. El conjunto completo de archivos generados y sus bytes coinciden con los 14 archivos del ZIP, incluidos los tres indicados por Defender. El [registro de comparación](./download-review-build.json) contiene sus hashes. Esto demuestra que el paquete se reproduce desde el código y dependencias fijadas; no equivale a un resultado antivirus.
4. La revisión manual del HTML y los dos módulos señalados muestra la carga de recursos de la web, la consulta de auditoría mediante Supabase y los formularios de acceso, registro y recuperación. No se identificó en esos archivos código ajeno a esas funciones. El código fuente de auditoría no cambió respecto a la versión anterior; sus referencias al módulo compartido sí cambiaron en la compilación.
5. El `package-lock.json` es idéntico al de la versión anterior (`953e02c7`). Su SHA-256 es `570ba63aaec80de0e9cd63fbd500a38eed6349fbcb04430ebcf96af13cd5add9`. `npm audit --json` terminó correctamente con cero vulnerabilidades conocidas reportadas, incluidas las dependencias de desarrollo. Ese análisis tampoco detecta ni descarta malware.
6. El ZIP no contiene rutas de extracción fuera de la carpeta, enlaces simbólicos ni archivos cifrados. Las comprobaciones previas de integridad ZIP no eran análisis antivirus.

## Limitaciones y siguiente comprobación

Este entorno Linux no tiene Microsoft Defender ni otro motor antivirus instalado. Los intentos de acceder a las descargas oficiales de ClamAV y a las páginas de análisis de Microsoft encontraron bloqueos de red 403. No se obtuvo un resultado antivirus independiente, no se envió la muestra a terceros y no se modificó el contenido para cambiar su detección.

Para resolver el bloqueo falta analizar esta muestra exacta con Defender actualizado y, si persiste la detección, solicitar su revisión al analista mediante el [portal oficial de Microsoft](https://www.microsoft.com/en-us/wdsi/filesubmission). Conservar el nombre de la amenaza, la versión del motor y de la inteligencia de seguridad, los hashes y el resultado del análisis. No presentar el paquete como seguro ni reanudar su distribución antes de aclarar ese resultado.

## En el equipo del usuario

Mantener la protección activada. En el aviso de Defender, usar **Quitar** si está disponible, sin restaurar ni permitir la amenaza. Si falla, eliminar el ZIP de Descargas si Windows lo permite, reiniciar, actualizar la inteligencia de seguridad y ejecutar un análisis. Si sigue apareciendo un error de corrección, usar el análisis sin conexión de Microsoft Defender desde Opciones de examen. No recuperar el ZIP para repetir pruebas en el equipo de uso diario.
