# Paquete web de KAPA 3D

`KAPA-3D-web.zip` contiene la compilación de la interfaz conectada al proyecto alojado de Supabase. Incluye únicamente archivos públicos del frontend; no incluye `.env.local`, claves privadas, usuarios, contraseñas ni copias de la base de datos.

Después de subir este archivo al repositorio de GitHub, puede descargarse desde la vista del archivo usando **Download raw file**. Al descomprimirlo aparece la carpeta `KAPA-3D`, que contiene directamente `index.html`, `assets` y `_redirects`. Esa carpeta es la que se sube a Netlify Drop.

La clave pública de Supabase forma parte del frontend por diseño. La seguridad del negocio depende de las políticas RLS y de la asignación de las cuentas reales. El paquete no crea tablas ni usuarios y no supone que el backend alojado ya esté configurado o validado.

Para reconstruirlo con otro proyecto, configura las variables públicas y ejecuta `npm run build:deploy`. Consulta `docs/deployment.md` antes de publicarlo.
