# Abrir KAPA 3D desde un navegador propio

**Publicación pendiente de revisión de seguridad:** Microsoft Defender detectó `Trojan:Script/Ulthar.A!ml` en el ZIP. Se retiró la descarga de la rama principal y se pausó la recomendación de desplegar este contenido. Una compilación nueva reproduce los archivos señalados; importar el repositorio a un alojamiento no resuelve la detección. Consulta el [informe](./download-review.md). Las instrucciones siguientes describen la configuración técnica para cuando se aclare el resultado.

## Estado actual

La aplicación funciona dentro de la máquina privada de Codex y se probó con Supabase local. Esa máquina no tiene una dirección pública configurada. Los enlaces de archivos y las capturas no abren una aplicación interactiva. Publicar el entorno de desarrollo tampoco publica el sitio web.

Ya se configuraron la URL y la clave pública del proyecto alojado en el entorno de Codex y se compiló el frontend con esos valores. Falta verificar/aplicar el esquema y las cuentas de John y Sebas, además de publicar el frontend. No hay una cuenta de alojamiento conectada a esta sesión ni una URL pública de KAPA 3D.

El ZIP previamente publicado se retiró de la rama principal tras la detección indicada. No se recomienda recuperar copias del historial. La compilación web genera `index.html`, `assets`, `_redirects` y el icono; que esos archivos se generen correctamente no demuestra su seguridad frente a antivirus.

La comprobación de la API alojada desde Codex encontró un bloqueo de red (CONNECT 403). Se guardó en el borrador la adición del hostname exacto del proyecto. Hasta aplicar ese cambio y repetir la comprobación no se afirma que la base alojada esté verificada. Esta restricción de la máquina de Codex es independiente del acceso desde el navegador del usuario.

## 1. Preparar Supabase

1. Crea el proyecto gratuito en `https://supabase.com/dashboard`.
2. Copia su Project URL y su clave pública publishable/anon. Completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. No uses claves privadas ni una URL de localhost.
3. Ejecuta `release/KAPA-3D-instalacion.sql` en SQL Editor: instala o actualiza las tablas sin borrar datos. En Authentication habilita Email y **Allow new users to sign up**. El formulario de KAPA pide solo nombre, correo y contraseña; las cuentas registradas esperan autorización antes de ver el negocio.
4. En los ajustes de red del entorno cloud añade el hostname exacto del proyecto sin reemplazar los dominios existentes. La configuración del entorno y las variables de Netlify son independientes.

Si estás viendo la ventana «Configurar variables de entorno» de Codex, «Valor» es un campo vacío, no el contenido que debes escribir. Usa los valores de tu proyecto. Si todavía no existe el proyecto, puedes omitir esa revisión; omitirla no despliega la aplicación ni sustituye las credenciales que necesita la versión alojada.

## 2. Preparar el sitio gratuito

Se incluye configuración para Netlify. `netlify.toml` fija Node 24, la carpeta `dist` y el comando `npm run build:deploy`. `public/_redirects` permite recargar rutas como `/configuracion` sin obtener un error 404.

La compilación para despliegue se detiene si faltan las variables o apuntan a Supabase local. No subas el `dist` generado previamente para desarrollo local: el navegador de otro equipo no puede alcanzar ese backend.

Con las variables públicas reales configuradas:

```sh
cd /workspace/KAPA-PROJECT
npm run build:deploy
```

El comando acepta los proyectos gratuitos alojados en `*.supabase.co`. Los dominios personalizados de Supabase requerirían ampliar deliberadamente esa validación.

Para regenerar además el ZIP y el instalador SQL, ejecuta `npm run release`.

## 3. Publicar el frontend

Una vez aclarada la detección, Netlify permite desplegar el contenido de `dist` o importar la rama `main` de [johnasob/KAPA-PROJECT](https://github.com/johnasob/KAPA-PROJECT). La vía de publicación elegida no sustituye el análisis pendiente de la muestra.

En un despliegue conectado a Git, configura las dos variables públicas también en Netlify antes de compilar. No subas `.env.local`, el proyecto completo con sus cachés ni claves administrativas.

Netlify asignará una URL HTTPS al sitio. Añade esa dirección como Site URL de Supabase Auth y permite `<origen>/actualizar-clave` como ruta de recuperación. Después verifica en esa URL el acceso de John y Sebas, una modificación persistente de configuración y su historial. Comprueba también que una recarga directa de `/configuracion` funciona.

Desde el enlace publicado, pulsa **Crear cuenta**. Si todavía no hay administrador, el propietario de Supabase ejecuta una sola vez `supabase/activate-first-admin.sql` indicando su correo registrado y confirmado; no necesita UUID ni contraseñas. Después se habilita al segundo socio desde **Socios y equipo → Solicitudes de acceso**. No se concede administración automática a quien se registre primero.

No se requiere contratar un plan de pago para esta preparación. Al crear las cuentas, elige las opciones gratuitas y revisa los límites vigentes de cada proveedor. La sesión de Codex no puede crear esas cuentas personales ni aceptar sus condiciones en nombre del usuario.
