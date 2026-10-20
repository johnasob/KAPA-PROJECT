# Verificación de KAPA 3D

Validado el 20 de octubre de 2026 en el entorno local de Codex con Node 24, Chromium y Supabase real: Auth, PostgREST, Storage y PostgreSQL 17. Los recorridos de integración no simulan respuestas de la aplicación.

| Comprobación                                                                                              | Resultado                   |
| --------------------------------------------------------------------------------------------------------- | --------------------------- |
| TypeScript estricto y compilación de producción                                                           | Aprobados                   |
| Vitest: configuración, registro, costos decimales, precios, Excel/CSV y enlaces                           | 45 pruebas                  |
| pgTAP: permisos, fundamentos, registro y operaciones                                                      | 252 pruebas                 |
| Playwright: acceso, sesión, configuración, móvil y auditoría                                              | Aprobado                    |
| Playwright: registro de tres campos, protección y aprobación de cuenta                                    | Aprobado                    |
| Playwright: idempotencia, conflicto entre socios y recuperación por correo local                          | Aprobado                    |
| Playwright: compra financiada → cotización → reserva → producción → cobros → deuda → liquidación → retiro | Aprobado                    |
| Subida y descarga real de adjunto privado; rechazo de lectura anónima                                     | Aprobados                   |
| Excel/CSV descargados y PDF generado por Chromium con filas reales del reporte                            | Aprobados                   |
| Quince reportes y seis gráficos consultados desde el navegador                                            | Aprobados                   |
| Navegación por los ocho módulos desde móvil de 390 px sin desbordamiento de documento                     | Aprobada                    |
| Total de recorridos Playwright                                                                            | 9                           |
| Instalación nueva, repetición y actualización con administrador y datos existentes                        | Aprobadas en bases aisladas |
| Instalación parcial: rechazo y rollback completo                                                          | Aprobado                    |
| Reinicio de Supabase con volúmenes conservados y Storage habilitado                                       | Aprobado                    |

## Invariantes verificados en PostgreSQL

- Reintentar una operación no duplica dinero, producción, gramos ni horas. Reutilizar UUID con otros datos o usuario se rechaza.
- Comprar a crédito registra solo el pago inicial en caja y la diferencia como deuda; pagar principal no vuelve a generar gasto. Los intereses se registran aparte y los abonos se imputan a cuotas.
- Material, soporte y purga se incluyen en costo y reservas. Cotizar y reservar no consumen existencias. La producción consume solo gramos reales y respeta las reservas ajenas. Un error de stock revierte toda la producción.
- Margen y recargo usan denominadores diferentes; pintado y personalización se contabilizan una vez. Los costos guardados se conservan.
- Anticipos y saldos no superan ni duplican la venta. Entrega con saldo y producción sin anticipo requieren autorización. Cancelar con cobros exige devolución real y libera reservas.
- Solo una entrega totalmente cobrada produce utilidad realizada del pedido. Capital y préstamos no generan utilidad. Amortización, asignaciones y reservas no descuentan caja.
- Liquidaciones 50/50, reservas, adelantos compensados y retiros mantienen saldos independientes; no se liquida dos veces la misma ganancia. Las pérdidas posteriores limitan liberar reservas.
- Retiros superiores al saldo y caja negativa requieren autorización expresa y motivo. NaN y stock negativo se rechazan.
- Ajustes, producción y compras se compensan conservando el original. Un rollo consumido no puede devolverse como compra intacta.
- Pagar o comprar un concepto ya incluido en producción no vuelve a reducir utilidad cuando se indica esa imputación.
- Anónimos y cuentas ajenas no leen ni operan el negocio. Los administradores no pueden eludir las RPC para escribir directamente.

Las pruebas SQL se revierten. El navegador crea cuentas, compras y movimientos temporales, verifica sus resultados y los elimina al terminar; los parámetros se restauran. No se trasladan los importes de prueba al negocio del usuario. Las bases del instalador se crean con prefijo propio y se eliminan al terminar.

## Alcance de los resultados

El usuario informó que ya entra al sitio de Netlify y a su cuenta. Codex no tiene acceso administrativo a ese sitio ni a la base alojada; sus dominios responden con bloqueo del proxy 403 desde esta máquina. Los cambios no se han aplicado en esos servicios. El propietario debe ejecutar el instalador actualizado y desplegar main en Netlify. Los resultados locales no prueban que el sitio publicado tenga los módulos nuevos.

La alerta de Microsoft Defender sobre el ZIP anterior sigue pendiente. Las pruebas funcionales y la auditoría de dependencias no son análisis antivirus. No se generó ni publicó un nuevo ZIP para esta entrega; [el informe anterior](download-review.md) mantiene la identificación de la muestra.

Los límites de catálogos (1.000 opciones), exportación (50.000 filas), PDF por impresión y estimaciones continuas de cola están documentados en [arquitectura](architecture.md). No se implementaron modo oscuro, calendario laboral por turnos ni un servicio externo de PDF; no se presentan como funcionalidades existentes.

## Casos adicionales de la actualización

- Crédito con tarjeta y pago inicial cero sin caja negativa; identidad de financiación en compra y deuda.
- Hora y media y cuarto de hora desde horas/minutos; extras con cantidad/precio y varias piezas sin catálogo.
- Cotización editable con versión; orden estable de piezas y original conservado al convertir.
- Edición de pedido, cantidades y precios, adición y retirada de piezas; protección de producción, entregas y cobros existentes.
- Asignación de anticipos por pieza; entrega parcial pagada o a crédito; cartera entregada y cobro posterior.
- Saldos iniciales independientes de caja, control de versión y actualización por PostgREST con safeupdate activo.
- Conteo directo de stock con detección de cambios simultáneos; prueba/fallo sin venta y compensación que no puede ejecutarse por dos módulos.
- Cuotas pagadas/pendientes y presupuesto después de capital/interés sin duplicar costos.
- Eliminación visible con historial financiero conservado y protección de cartera.
- Pedidos sin iniciar por más de tres días y retiro de esa alerta tras producir.
- XLSX real descargado en Chromium; apertura de su contenido OpenXML en pruebas, importes numéricos, caracteres especiales y texto que parece fórmula sin fórmulas ejecutables.
- Instalador sobre la versión operativa anterior, incluyendo cobro, compensación y nuevo cobro con el mismo timestamp; conserva el saldo y reconstruye asignaciones usando la auditoría. Repetición sin duplicar datos ni auditoría.

El noveno recorrido conecta el frontend con la función de lectura de la versión anterior real, comprueba las instrucciones de actualización y recupera el espacio al restaurar el esquema vigente; no simula respuestas HTTP.
