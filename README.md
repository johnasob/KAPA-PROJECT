# KAPA 3D

**Descarga suspendida:** el ZIP fue retirado de la rama principal tras una alerta de Microsoft Defender `Trojan:Script/Ulthar.A!ml`. La detección sigue pendiente de resolver. Consulta el [informe de revisión](docs/download-review.md) antes de descargar o publicar una compilación. No desactives la protección para abrir el paquete.

Aplicación web para el negocio colombiano de impresión 3D de John y Sebas. Incluye inventario por lotes, reservas, impresoras, mantenimiento, costos decimales, cotizaciones con costos conservados, clientes, pedidos, producción real, cobros parciales, caja, compras financiadas, deudas, liquidaciones 50/50, indicadores, gráficos y reportes Excel/CSV/PDF. La actualización incluye identidad vinotinto y crema, tarjeta de crédito, presupuesto mensual después de cuotas, piezas personalizadas, tiempo en horas/minutos, insumos detallados, edición de cotizaciones y pedidos, entregas y cobros por pieza, saldos iniciales y pruebas/fallos sin venta. Todos los datos operativos se guardan en Supabase; no se crean saldos, existencias o ganancias de demostración.

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
2. En SQL Editor, ejecuta `release/KAPA-3D-instalacion.sql`. Instala los fundamentos, el registro y todos los módulos; puede repetirse y conserva los datos existentes. Alternativamente, aplica las migraciones versionadas con Supabase CLI. No ejecutes `db reset` contra un proyecto con datos.
3. En Authentication, habilita el proveedor Email y **Allow new users to sign up**. Crear una cuenta no concede acceso al negocio: RLS mantiene la protección. Configura la Site URL del despliegue y permite tanto su origen como `<origen>/actualizar-clave` para las confirmaciones y recuperación. Si exiges confirmación de correo, usa un proveedor de correo adecuado y considera sus límites de envío.
4. Copia `.env.example` a `.env.local` y completa únicamente la URL y la clave **pública publishable/anon**:

```dotenv
VITE_SUPABASE_URL=https://<proyecto>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<clave-publica>
```

También se admite `VITE_SUPABASE_ANON_KEY` por compatibilidad; la clave publishable tiene prioridad. Nunca usar `service_role` o una clave `sb_secret_` en el frontend. El archivo local está ignorado por Git. En el entorno cloud se pueden configurar estas dos variables públicas en los ajustes del entorno; al compilar Vite quedan incorporadas al bundle.

5. Si existe una lista de acceso de red, añade **el hostname exacto de tu proyecto** (`<proyecto>.supabase.co`) sin reemplazar otros dominios permitidos. El navegador del usuario también debe poder alcanzar ese dominio.
6. Ejecuta `npm run dev` o publica la web. En la pantalla de acceso pulsa **Crear cuenta**: solo se piden nombre, correo y contraseña. Confirma el correo si el proyecto lo requiere.
7. Solo para la primera cuenta administradora, el propietario del proyecto ejecuta `supabase/activate-first-admin.sql` desde SQL Editor cambiando únicamente `owner_email` por su correo registrado. No hay que copiar UUID ni compartir contraseñas. El script se niega a reemplazar cuentas existentes. Si ya existe un administrador, se omite este paso.
8. El administrador abre **Socios y equipo → Solicitudes de acceso**, verifica el correo y habilita al segundo socio. Un usuario externo nunca obtiene administración por registrarse primero, llamarse John/Sebas o enviar metadatos con roles.
9. Comprueba el acceso de ambos socios, una modificación persistente y su historial. Para revocar un acceso, actualiza `user_profiles.active` desde SQL Editor. Los enlaces PKCE de confirmación o recuperación deben abrirse en el navegador que los solicitó.

### Supabase local (sin proyecto externo)

```sh
npm run db:start
npm run env:local
npm run dev
```

`db:start` descarga la CLI oficial fijada (2.76.4), verifica el SHA-256 publicado y usa las imágenes oficiales del registro Docker. No desactiva TLS ni verifica checksums contra valores inventados. Los binarios van en `.tools/`, ignorado por Git. Se inician PostgreSQL, Auth, PostgREST, Storage, Kong y el buzón de desarrollo; los servicios adicionales no usados se excluyen. Docker necesita varios GB de disco en la primera ejecución. No se instalan herramientas globales.

En este entorno Docker usa VFS. Para evitar que las copias sucesivas de capas agoten el disco, `prepare-local-db.mjs` utiliza crane oficial (también con SHA-256 verificado) para exportar la imagen de PostgreSQL desde su digest y cargar una sola capa local con los mismos archivos, entorno y comandos de inicio. La imagen local tiene un ID diferente del registro. Este paso se omite si la imagen ya existe o Docker utiliza otro almacenamiento.

`env:local` crea `.env.local` únicamente si no existe y escribe solo la URL y la clave pública local. No sobrescribe una conexión existente ni escribe la clave administrativa. Reinicia Vite si cambias estas variables.

No se crean usuarios ni contraseñas predeterminadas. El registro está habilitado localmente: crea tu cuenta desde la app y usa la activación inicial por correo para el primer administrador. La suite E2E crea y elimina sus cuentas temporales; nunca las uses como usuarios reales. Los correos locales permanecen en Mailpit y no se envían a personas.

Las bases de datos locales se conservan en volúmenes de Docker. `npm run db:stop` detiene servicios conservando datos. Los procesos no sobreviven necesariamente a una nueva tarea cloud: vuelve a ejecutar `db:start` y `dev`. No dependas de que un proceso iniciado durante la instalación siga vivo.

## Validación

```sh
npm test                 # Configuración, registro, costos decimales y exportaciones Excel/CSV seguras
npm run build            # TypeScript estricto y bundle de producción
npm run db:test          # pgTAP: permisos, stock, costos, cobros, caja, deuda y 50/50
npm run test:e2e         # Chromium + Auth/PostgREST/Storage/PostgreSQL reales, solo base local vacía
npm run db:test:installer # Instalación nueva, actualización y repetición en bases temporales
```

E2E requiere Supabase local iniciado. Usa Chromium del sistema (`/usr/bin/chromium` en cloud); en otro sistema configura `CHROMIUM_PATH` o instala el navegador de Playwright. El runner inicia su propio frontend en el puerto 5174 con la conexión pública local, incluso si las variables normales apuntan al proyecto alojado. Se niega a usar una base externa o perfiles de socios ya asignados. Crea cuentas temporales y valida registro, aprobación, sesión, configuración, auditoría, bloqueo de terceros, el flujo completo de compra a liquidación, adjuntos privados, entregas parciales, corrección de compras a tarjeta, límite de amortización, alta de cliente dentro del pedido, estados directos sin anticipo, repetición de impresiones, saldos iniciales, Excel/CSV/PDF e interfaz móvil. Restaura los parámetros y elimina sus cuentas. Las pruebas SQL usan transacciones revertidas. No ejecutar E2E contra producción.

`npm run db:installer` regenera el instalador SQL sin crear un ZIP. `npm run build:deploy` genera el frontend de producción. La herramienta local `npm run release` sigue disponible para empaquetado técnico con Python 3, pero los ZIP están ignorados por Git y su distribución permanece suspendida por la alerta pendiente; no se ha usado para entregar esta actualización.

`npm run db:types` regenera los tipos del esquema local después de una migración. Los comandos de prueba no validan el proyecto alojado: después de conectarlo hay que comprobar su migración, políticas, cuentas, recuperación y origen HTTPS de forma independiente.

## Parámetros iniciales

COP, America/Bogota, socios John y Sebas 50/50, anticipo 50 %, referencia de filamento $90.000/kg, alerta amarilla por debajo de 200 g y roja en 100 g o menos. Energía y mano de obra comienzan sin configurar. Se incluye una Bambu Lab A1 Mini como referencia, con adquisición, vida útil y potencia sin configurar. Ninguno de estos valores genera un movimiento financiero o de inventario.

## Documentación

Para actualizar el sitio existente en Netlify, sigue `docs/deployment.md`. La publicación del entorno cloud y el despliegue de la aplicación web son operaciones distintas.

Consulta `docs/operations-guide.md` para el flujo diario y las reglas de costos, caja y utilidades; `docs/architecture.md` describe módulos, permisos y transacciones. `docs/product-brief.md` conserva la especificación entregada por el usuario. Las instrucciones cloud reutilizables se guardan también en el borrador del entorno. Guardar el borrador no publica el código ni crea un proyecto Supabase.


La actualización actual aplica una amortización máxima del **10 % del costo de material** y corrige los costos excesivos ya guardados sin cambiar precios pactados, cobros ni existencias. Incluye resumen de filamento por color, corrección de compras y deudas, pedidos sin anticipo con avisos de saldo, estados directos y repetición de impresiones. Consulta [el flujo diario](docs/operations-guide.md#corrección-de-costos-y-registro-simplificado) y [cómo actualizar Supabase y Netlify](docs/deployment.md).
