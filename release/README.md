# Paquete web de KAPA 3D

`KAPA-3D-web.zip` contiene la compilación de la interfaz conectada al proyecto alojado de Supabase. Incluye únicamente archivos públicos del frontend; no incluye `.env.local`, claves privadas, usuarios, contraseñas ni copias de la base de datos.

El paquete puede descargarse desde [su vista en GitHub](https://github.com/johnasob/KAPA-PROJECT/blob/main/release/KAPA-3D-web.zip) usando **Download raw file**. Si GitHub solicita autenticación, inicia sesión con una cuenta que tenga acceso al repositorio. Al descomprimirlo aparece la carpeta `KAPA-3D`, que contiene directamente `index.html`, `assets` y `_redirects`. Esa carpeta es la que se sube a Netlify Drop.

La clave pública de Supabase forma parte del frontend por diseño. La seguridad del negocio depende de las políticas RLS y de la asignación de las cuentas reales. El paquete no crea tablas ni usuarios y no supone que el backend alojado ya esté configurado o validado.

Para reconstruirlo con otro proyecto, configura las variables públicas y ejecuta `npm run build:deploy`. Consulta `docs/deployment.md` antes de publicarlo.

## Registro de usuarios

Esta versión incluye **Crear cuenta** con solo nombre, correo y contraseña. Para actualizar Supabase, ejecuta también [`KAPA-3D-instalacion.sql`](./KAPA-3D-instalacion.sql) en SQL Editor y activa **Allow new users to sign up** en Authentication. La cuenta creada queda pendiente de acceso al negocio hasta que un socio la habilite desde la app. La primera cuenta administradora se activa una sola vez con su correo usando [`activate-first-admin.sql`](../supabase/activate-first-admin.sql); no se necesitan UUID ni contraseñas en el SQL.
