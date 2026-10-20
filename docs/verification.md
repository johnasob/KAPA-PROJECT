# Verificación de la fase 1

Validación realizada el 19 de octubre de 2026 en el entorno cloud, con Node 24.19.0, Chromium y Supabase local real (Auth, PostgREST y PostgreSQL 17). No se usaron respuestas de API simuladas en las pruebas de integración.

| Comprobación | Resultado |
| --- | --- |
| Instalación desde `package-lock.json` con `npm ci` | Aprobada |
| TypeScript estricto y compilación de producción | Aprobados |
| Vitest: configuración pública, validación de parámetros y estado sin conexión | 15 pruebas aprobadas |
| pgTAP: permisos, RLS, validaciones, auditoría, versiones e idempotencia | 26 pruebas aprobadas |
| Playwright: sesión persistente, configuración e historial | Aprobado |
| Playwright: vista móvil de Sebas, navegación y ausencia de desbordamiento horizontal | Aprobado |
| Playwright: bloqueo de terceros autenticados y del registro público | Aprobado |
| Playwright: cambios compartidos, reintentos y conflicto entre socios | Aprobado |
| Playwright: correo de recuperación local y cambio de contraseña | Aprobado |
| Revisión del historial con nombres de campos y valores en español | Flujo de navegador repetido y aprobado |
| Detención y nuevo arranque de Supabase conservando los volúmenes | Aprobados |
| Regeneración segura de tipos desde PostgreSQL | Aprobada |

La API devuelve `PT409` (HTTP 409) cuando el otro socio ya cambió la configuración. Este conflicto de negocio no usa el error de serialización `40001`, que el cliente puede tratar como un fallo temporal y reintentar innecesariamente.

Las cuentas temporales se eliminaron y los parámetros originales se restauraron. Se confirmó que no quedan perfiles ni cuentas `@kapa.test`. No se crearon saldos, ventas, pedidos ni inventario. Las tablas financieras aún no forman parte de esta fase.

El proyecto alojado de Supabase sigue pendiente de creación por el usuario. No están verificados su conexión, migración, cuentas reales, correo ni reglas de red. Tampoco se ha desplegado la aplicación, publicado el entorno o comprobado su restauración en otra tarea.

Para conectar el proyecto alojado, sigue el README y configura la URL y clave pública. Las instrucciones de instalación e inicio y los nombres de ambas variables se guardaron en el borrador del entorno; guardar ese borrador no ejecuta scripts ni publica la configuración.
