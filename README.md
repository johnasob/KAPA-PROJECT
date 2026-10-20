# KAPA 3D

Aplicación web para el negocio colombiano de impresión 3D de John y Sebas. **Fase 1: fundamentos.** Incluye acceso privado, recuperación de contraseña, socios 50/50, configuración persistente con validaciones y confirmación, auditoría paginada y navegación móvil. Inventario, costos, pedidos, caja y reportes se implementarán en las fases siguientes; no se muestran saldos o ventas inventados.

## Requisitos

- Node 24 (ver `.nvmrc`), npm y un proyecto gratuito de Supabase.
- Para desarrollo y pruebas locales de integración: Docker, curl, tar y sha256sum (Linux/macOS; en macOS instalar coreutils o usar Supabase CLI oficial manualmente).
- Usar este checkout existente. Cada tarea en la nube ya está aislada; no crear worktrees.

## Instalación

```sh
cd /workspace/KAPA-PROJECT
npm --cache /workspace/.npm-cache ci
```

Fuera del entorno cloud se puede usar simplemente `npm ci`.

### Conectar el proyecto gratuito

1. Crea un proyecto en Supabase. No necesitas una suscripción de pago.
2. En SQL Editor, ejecuta `supabase/migrations/20261019000100_foundations.sql` una sola vez. Alternativamente, usa Supabase CLI y `db push` después de vincular explícitamente tu proyecto. No ejecutes `db reset` contra un proyecto con datos.
3. En Authentication, deshabilita registros públicos, configura la Site URL del despliegue y permite `<origen>/actualizar-clave` como URL de redirección. El entorno local incluye esta configuración.
4. Crea las cuentas reales de John y Sebas en Authentication > Users. Configura sus contraseñas de forma privada o utiliza invitaciones. Un usuario invitado puede establecer su contraseña visitando `/actualizar-clave` después de abrir su enlace.
5. Copia los UUID de ambas cuentas en `supabase/bootstrap-admins.sql` y ejecútalo desde SQL Editor. No reutilices UUID de pruebas. No es necesario exponer claves administrativas. Para revocar un acceso, actualiza `user_profiles.active` desde SQL Editor; RLS lo aplica inmediatamente.
6. Copia `.env.example` a `.env.local` y completa únicamente la URL y la clave **pública publishable/anon**:

```dotenv
VITE_SUPABASE_URL=https://<proyecto>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<clave-publica>
```

También se admite `VITE_SUPABASE_ANON_KEY` por compatibilidad; la clave publishable tiene prioridad. Nunca usar `service_role` o una clave `sb_secret_` en el frontend. El archivo local está ignorado por Git. En el entorno cloud se pueden configurar estas dos variables públicas en los ajustes del entorno; al compilar Vite quedan incorporadas al bundle.

7. Si existe una lista de acceso de red, añade **el hostname exacto de tu proyecto** (`<proyecto>.supabase.co`) sin reemplazar otros dominios permitidos. No es necesario habilitar todos los proyectos de Supabase. El navegador del usuario también debe poder alcanzar ese dominio.
8. Ejecuta `npm run dev`. Comprueba el acceso de ambos socios, una modificación de configuración y su historial. Las solicitudes de recuperación usan el proveedor de correo de Supabase y sus límites. Los enlaces PKCE deben abrirse en el mismo navegador que solicitó la recuperación.

### Supabase local (sin proyecto externo)

```sh
npm run db:start
npm run env:local
npm run dev
```

`db:start` descarga la CLI oficial fijada (2.76.4), verifica el SHA-256 publicado y usa las imágenes oficiales del registro Docker. No desactiva TLS ni verifica checksums contra valores inventados. Los binarios van en `.tools/`, ignorado por Git. Se inician PostgreSQL, Auth, PostgREST, Kong y el buzón de desarrollo; los servicios adicionales no usados se excluyen. Docker necesita varios GB de disco en la primera ejecución. No se instalan herramientas globales.

En este entorno Docker usa VFS. Para evitar que las copias sucesivas de capas agoten el disco, `prepare-local-db.mjs` utiliza crane oficial (también con SHA-256 verificado) para exportar la imagen de PostgreSQL desde su digest y cargar una sola capa local con los mismos archivos, entorno y comandos de inicio. La imagen local tiene un ID diferente del registro. Este paso se omite si la imagen ya existe o Docker utiliza otro almacenamiento.

`env:local` crea `.env.local` únicamente si no existe y escribe solo la URL y la clave pública local. No sobrescribe una conexión existente ni escribe la clave administrativa. Reinicia Vite si cambias estas variables.

No se crean usuarios ni contraseñas predeterminadas. Para el uso manual local, crea cuentas con Supabase Auth Admin API desde una herramienta confiable del backend y vincula sus UUID con `bootstrap-admins.sql`. La suite E2E crea y elimina sus propias cuentas temporales; nunca las uses como usuarios reales. Los correos locales de recuperación permanecen en Mailpit y no se envían a personas.

Las bases de datos locales se conservan en volúmenes de Docker. `npm run db:stop` detiene servicios conservando datos. Los procesos no sobreviven necesariamente a una nueva tarea cloud: vuelve a ejecutar `db:start` y `dev`. No dependas de que un proceso iniciado durante la instalación siga vivo.

## Validación

```sh
npm test                 # Configuración pública, formulario y estados sin conexión
npm run build            # TypeScript estricto y bundle de producción
npm run db:test          # pgTAP: RLS, auditoría, versiones e idempotencia (Supabase local)
npm run test:e2e         # Chromium + Auth/PostgREST/PostgreSQL reales, solo base local vacía
```

E2E requiere Supabase local iniciado y `.env.local` configurado. Usa Chromium del sistema (`/usr/bin/chromium` en cloud); en otro sistema configura `CHROMIUM_PATH` o instala el navegador de Playwright. La suite se niega a usar una URL externa o perfiles de socios ya asignados. Crea cuentas temporales de John, Sebas y un usuario sin permisos; valida persistencia de sesión, configuración, auditoría, bloqueo de terceros, versión concurrente e interfaz móvil. Restaura los parámetros originales y elimina sus cuentas al terminar. Las pruebas SQL usan una transacción revertida. No ejecutar E2E contra producción.

`npm run db:types` regenera los tipos del esquema local después de una migración. Los comandos de prueba no validan el proyecto alojado: después de conectarlo hay que comprobar su migración, políticas, cuentas, recuperación y origen HTTPS de forma independiente.

## Parámetros iniciales

COP, America/Bogota, socios John y Sebas 50/50, anticipo 50 %, referencia de filamento $90.000/kg, alerta amarilla por debajo de 200 g y roja en 100 g o menos. Energía y mano de obra comienzan sin configurar. Ninguno de estos valores genera un movimiento financiero o de inventario.

## Documentación

Para obtener una URL que puedas abrir y usar fuera de Codex, sigue `docs/deployment.md`. La publicación del entorno cloud y el despliegue de la aplicación web son operaciones distintas.

Consulta `docs/architecture.md` para la separación de responsabilidades, permisos y alcance de las siguientes fases. `docs/product-brief.md` conserva la especificación entregada por el usuario. Las instrucciones cloud reutilizables se guardan también en el borrador del entorno. Guardar el borrador no publica el código ni crea un proyecto Supabase.
