# Paquete web de KAPA 3D

**Distribución del ZIP suspendida.** Microsoft Defender detectó `Trojan:Script/Ulthar.A!ml` en el paquete publicado. Se retiró `KAPA-3D-web.zip` de la rama principal mientras se aclara la detección. No se ha confirmado un falso positivo. Consulta el [informe de revisión](../docs/download-review.md).

No descargar versiones del historial para evitar la alerta, desactivar el antivirus ni desplegar el contenido señalado por otra vía. Una compilación nueva reprodujo exactamente los archivos señalados; recompilar no resuelve por sí solo la detección.

El paquete retirado contenía la compilación de la interfaz conectada al proyecto alojado de Supabase: archivos públicos del frontend, sin `.env.local`, claves privadas, usuarios, contraseñas ni copias de la base de datos.

La clave pública de Supabase forma parte del frontend por diseño. La seguridad del negocio depende de las políticas RLS y de la asignación de las cuentas reales. El paquete no crea tablas ni usuarios y no supone que el backend alojado ya esté configurado o validado.

El código y el instalador SQL se conservan para revisión. `npm run build:deploy` y `npm run release` siguen siendo herramientas de desarrollo; una compilación correcta no autoriza a considerar resuelta la detección ni a redistribuir el ZIP. Consulta `docs/deployment.md` antes de publicar.

## Registro de usuarios

Esta versión incluye **Crear cuenta** con solo nombre, correo y contraseña. Para actualizar Supabase, ejecuta también [`KAPA-3D-instalacion.sql`](./KAPA-3D-instalacion.sql) en SQL Editor y activa **Allow new users to sign up** en Authentication. La cuenta creada queda pendiente de acceso al negocio hasta que un socio la habilite desde la app. La primera cuenta administradora se activa una sola vez con su correo usando [`activate-first-admin.sql`](../supabase/activate-first-admin.sql); no se necesitan UUID ni contraseñas en el SQL.
