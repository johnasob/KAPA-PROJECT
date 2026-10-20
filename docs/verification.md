# Verificación de la fase 1

Validación actualizada el 20 de octubre de 2026 en el entorno cloud, con Node 24.19.0, Chromium y Supabase local real (Auth, PostgREST y PostgreSQL 17). No se usaron respuestas de API simuladas en las pruebas de integración.

| Comprobación | Resultado |
| --- | --- |
| Instalación desde `package-lock.json` con `npm ci` | Aprobada |
| TypeScript estricto y compilación de producción | Aprobados |
| Vitest: configuración pública, parámetros, registro, confirmación y errores | 24 pruebas aprobadas |
| pgTAP: permisos, RLS, registro, aprobación, auditoría, versiones e idempotencia | 45 pruebas aprobadas |
| Playwright: sesión persistente, configuración e historial | Aprobado |
| Playwright: vista móvil de Sebas, navegación y ausencia de desbordamiento horizontal | Aprobado |
| Playwright: bloqueo de terceros autenticados | Aprobado |
| Playwright: registro con tres campos y habilitación del segundo socio desde la app | Aprobado |
| Playwright: cambios compartidos, reintentos y conflicto entre socios | Aprobado |
| Playwright: correo de recuperación local y cambio de contraseña | Aprobado |
| Total de flujos reales en Playwright | 6 aprobados |
| Detención y nuevo arranque de Supabase conservando los volúmenes | Aprobados |
| Regeneración segura de tipos desde PostgreSQL | Aprobada |

La API devuelve `PT409` (HTTP 409) cuando el otro socio ya cambió la configuración. Este conflicto de negocio no usa el error de serialización `40001`, que el cliente puede tratar como un fallo temporal y reintentar innecesariamente.

Las cuentas temporales se eliminaron y los parámetros originales se restauraron. Se confirmó que no quedan perfiles, solicitudes ni cuentas `@kapa.test`. No se crearon saldos, ventas, pedidos ni inventario. Las tablas financieras aún no forman parte de esta fase.

Se probó el instalador SQL en una base PostgreSQL aislada con las dependencias de esquema de Auth: instalación inicial, repetición preservando parámetros existentes y activación del primer administrador por correo. Se comprobó que la activación no puede reemplazar cuentas ya asignadas. Las pruebas de registro y aprobación con Auth real se ejecutaron por separado en la instancia local completa.

El proyecto alojado de Supabase y sus variables públicas ya fueron configurados por el usuario, pero la conexión desde Codex encontró un bloqueo del proxy (403). No están verificados su migración, cuentas reales ni correo; no se aplicaron cambios privilegiados en él. El usuario debe aplicar el instalador y habilitar el registro en Supabase. Tampoco se ha verificado una URL pública de Netlify ni la restauración en otra tarea.

Para conectar el proyecto alojado, sigue el README y configura la URL y clave pública. Las instrucciones de instalación e inicio y los nombres de ambas variables se guardaron en el borrador del entorno; guardar ese borrador no ejecuta scripts ni publica la configuración.
