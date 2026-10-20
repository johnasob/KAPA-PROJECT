# Arquitectura y alcance

## Fase 1

React 19 + TypeScript estricto + Vite, Tailwind 4, React Router, Lucide, React Hook Form y Zod. Supabase aporta Auth, PostgREST y PostgreSQL. No hay servidor propio, datos ficticios ni persistencia de negocio en localStorage. Supabase Auth almacena únicamente la sesión del usuario mediante su SDK.

- `src/features/auth`: inicio de sesión, recuperación, cambio de contraseña y autorización inicial.
- `src/features/overview`: inicio con parámetros y estado del equipo leídos de PostgreSQL. No presenta indicadores financieros inexistentes.
- `src/features/partners`: participación del 50 % y estado de vinculación de cada socio.
- `src/features/settings`: formulario validado, confirmación y escritura transaccional.
- `src/features/audit`: historial paginado con valores anteriores y nuevos.
- `src/lib`: cliente tipado, configuración pública, errores, formato COP y fechas de Bogotá.
- `supabase/migrations`: esquema y reglas de negocio versionadas.

La UI comprueba el perfil, pero la autoridad es PostgreSQL. Todas las tablas públicas tienen RLS; un usuario autenticado que no esté en `user_profiles` con `active = true` no ve registros. Los clientes no pueden insertar perfiles, editar participaciones, escribir directamente en configuración ni alterar auditoría. No se confía en metadatos editables por usuarios de Auth para asignar roles.

El registro pide únicamente nombre, correo y contraseña mediante Supabase Auth. Un trigger guarda el nombre en `registration_requests`, sin conceder roles. El usuario solo ve su solicitud; únicamente los administradores pueden consultar la cola con correos actuales de Auth y aprobar cuentas con correo confirmado. La RPC de aprobación bloquea el socio, respeta las asignaciones existentes y es idempotente. La aprobación queda en la auditoría del perfil. La activación del primer administrador se realiza una sola vez por el propietario, con su correo, desde SQL Editor; no existe una RPC pública que permita apropiarse del primer puesto.

`update_business_settings` bloquea el único registro de configuración, comprueba la versión esperada y aplica la modificación junto con su auditoría y su clave de idempotencia en una sola transacción. Reintentar la misma solicitud devuelve su resultado original. Reutilizar su UUID con otro contenido o usuario se rechaza. Las restricciones PostgreSQL protegen porcentajes, valores negativos, referencias de costos y umbrales aunque se omita la UI.

Los importes se envían como cadenas decimales y se almacenan como `numeric(14,2)`. En esta fase no hay cálculos contables en JavaScript. `number` se usa únicamente para límites del formulario y presentación. La configuración inicial es una referencia del negocio; no crea caja, ingresos, deuda, inventario ni utilidad.

La auditoría cubre cambios de socios, perfiles y configuración. El registro de eventos de autenticación permanece en Supabase Auth. La provisión desde SQL se registra con actor nulo (sistema), sin copiar credenciales. Los socios consultan el mismo historial. Las cuentas, permisos y secretos se administran fuera del frontend.

## Próximas fases

2. Inventario e impresoras: lotes, movimientos compensatorios, reservas separadas del consumo, mantenimiento. Configurar Bambu Lab A1 Mini sin inventar costos de compra.
3. Costos y cotizaciones: cálculo decimal probado, costos originales inmutables, margen vs. recargo.
4. Clientes y producción: pedidos, estados, pagos parciales y colas sin cambiar fechas comprometidas automáticamente.
5. Finanzas: libro de movimientos, compras a crédito, intereses separados de capital, liquidaciones 50/50 y reservas.
6. Dashboard y reportes: indicadores derivados exclusivamente de las operaciones reales, filtros, CSV/PDF y gráficos.
7. Consolidación: ampliar pruebas de integridad, seguridad y rendimiento.

Cada fase agregará migraciones y sus pruebas antes de habilitar operaciones. No se agregan Recharts, date-fns ni librerías monetarias todavía porque esta fase no necesita gráficos ni cálculo financiero. Las fechas se presentan con `Intl` y zona `America/Bogota`.

## Límites operativos

La clave publishable/anon es pública por diseño. Nunca incluir una clave `service_role`, `sb_secret_`, contraseña de PostgreSQL o token de administración en una variable `VITE_*`. La validación de configuración rechaza claves privadas conocidas, pero la protección real comienza al no ingresarlas en el bundle.

El despliegue debe usar HTTPS, permitir la ruta de recuperación en Auth y resolver las rutas SPA a `index.html`. No se publica automáticamente ni se solicitan servicios de pago. El proyecto gratuito requiere observar los límites y la política de inactividad de Supabase; no se garantiza operación gratuita indefinida si crece el uso.
