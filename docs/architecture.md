# Arquitectura de KAPA 3D

React 19, TypeScript estricto, Vite, Tailwind, React Router, Lucide, React Hook Form, Zod, decimal.js, date-fns, Recharts y write-excel-file (XLSX bajo demanda). Supabase aporta Auth, PostgREST, PostgreSQL y Storage. La base de negocio no usa localStorage: el SDK lo utiliza únicamente para la sesión.

## Módulos

- `features/auth`: registro con nombre, correo y contraseña; sesión, recuperación y aprobación de acceso.
- `features/inventory`: compra de rollos, financiación, existencias, reservas, movimientos y compensaciones.
- `features/printers`: adquisición y financiación opcionales, horas anteriores, horas de producción, amortización, estado y mantenimiento.
- `features/quotes`: motor de costos por unidad, varios productos y colores, multiplicadores y precio manual; copia inmutable de costos.
- `features/customers`: contacto, WhatsApp preparado, historial, favoritos y saldos.
- `features/orders`: conversión de cotización, cobros parciales, estados, reservas, producción, cancelación, adjuntos, lista, Kanban, calendario y cola.
- `features/finance`: caja, compras, préstamos, cuotas, intereses, adelantos, reservas y utilidades 50/50.
- `features/overview` y `features/reports`: indicadores, seis gráficos y quince reportes desde registros reales.
- `features/partners`, `settings`, `audit`: cuentas y aprobación, parámetros y auditoría paginada.
- `components/business.tsx`: formularios validados, modales accesibles, búsqueda, filtros, paginación y estados de lectura.
- `lib/operations.ts`: tipos del dominio, consultas, solicitudes idempotentes, cálculo decimal, exportación y enlaces permitidos.

## Autoridad y transacciones

RLS protege todas las tablas operativas. Solo perfiles activos de `user_profiles` pueden leerlas. Los clientes no tienen permisos de escritura directa, incluso si son socios. `business_operate` valida al usuario, ejecuta la operación y registra auditoría e idempotencia en una transacción. Se usa un bloqueo transaccional común para serializar las escrituras de los dos administradores. Editar clientes, impresoras, cotizaciones, pedidos y saldos iniciales requiere la versión vigente. El conteo de stock comprueba la cantidad anterior.

Las solicitudes se identifican por UUID y guardan usuario, acción, datos y respuesta en `private.mutation_requests`. Un reintento idéntico devuelve el resultado original. Reutilizarlo con otro usuario o contenido falla. El frontend conserva el UUID mientras reintenta y bloquea envíos simultáneos. Las restricciones y claves foráneas siguen protegiendo datos aunque se omita la interfaz.

`business_read`, `business_report`, `preview_production_cost` y `preview_order_priority` comprueban permisos en PostgreSQL. Las funciones privadas están revocadas para clientes. Las funciones con privilegios elevados fijan `search_path` vacío y califican las tablas. El SQL dinámico de reportes usa consultas elegidas en el servidor y parámetros, sin interpolar entradas del usuario.

## Modelo relacional

Clientes, proveedores, productos y materiales se vinculan con lotes, impresoras, cotizaciones y sus líneas. Los pedidos copian líneas y costos originales. Las reservas separan material comprometido del físico. Las producciones y movimientos registran cantidades y costos reales, con compensaciones que preservan el original. Las compras vinculan inventario o activos y deuda. Pagos de deuda separan capital e interés. Caja es un libro de movimientos; liquidaciones, asignaciones, adelantos, compensaciones y retiros son entidades distintas.

Los importes se almacenan como `numeric(16,2)`, las cantidades y horas con tres decimales, y las tasas de costo por gramo conservan precisión numérica. La interfaz calcula con decimal.js; PostgreSQL vuelve a calcular y valida el resultado que se guarda. Las fechas de negocio se interpretan en America/Bogota. Las cotizaciones guardadas no cambian al editar tarifas. Una edición explícita de una cotización todavía no convertida recalcula una nueva versión y conserva la anterior en auditoría. Las convertidas conservan su original; la edición posterior ocurre en el pedido.

La auditoría cubre inserciones y cambios de todas las entidades operativas, además de perfiles y configuración. El usuario y la fecha provienen del servidor. Las claves y contraseñas no forman parte de las operaciones ni de la auditoría.

## Acceso y archivos

Registrarse no concede permisos. Un trigger registra la solicitud; el propietario activa una sola vez al primer socio por correo confirmado y este aprueba al segundo. No se confía en roles enviados en metadatos de Auth.

Los adjuntos están en el bucket privado `kapa-order-files`, con límite de 10 MB y tipos permitidos. Las políticas comprueban que exista el pedido y el usuario sea administrador activo. Los enlaces firmados duran 60 segundos. La UI acepta imágenes, PDF, STL y 3MF; WhatsApp solo abre un mensaje preparado y no lo envía automáticamente.

## Consultas y límites

Historiales y tablas usan páginas de 50 registros, índices para relaciones y filtros de búsqueda en el servidor. Los catálogos de formularios admiten los primeros 1.000 recursos y avisan si se supera ese límite. La exportación toma una sola instantánea SQL e incluye todas las filas, hasta 50.000; por encima exige reducir el periodo. Calendario se filtra por mes en el servidor. La cola estima trabajo continuo por impresora; no incluye turnos ni pausas no registradas y nunca cambia promesas automáticamente.

Se usa PDF mediante impresión del navegador, con todas las filas del reporte y CSS de impresión; no requiere un servicio de pago. El modo visual es claro. La revisión antivirus del ZIP anterior sigue pendiente y no se confunde con las pruebas funcionales actuales.

## Refinamientos de octubre

La migración `20261022000100_workflow_refinements.sql` agrega columnas y cuatro tablas: `order_line_payments`, `order_deliveries`, `opening_balances` y `print_experiments`. El instalador detecta la versión anterior y aplica el cambio una vez dentro de su transacción. No sustituye cuentas ni elimina tablas.

Las líneas conservan un orden explícito desde cotización a pedido y en el reparto automático de cobros. Las asignaciones históricas se reconstruyen a partir de caja y de la secuencia de auditoría, incluyendo cobros y compensaciones con igual fecha/hora. Cada asignación apunta al movimiento real; no crea otro ingreso. Entregas parciales mantienen un historial de cantidades y protegen producción ya entregada. Los pedidos eliminados conservan un marcador y permanecen en reportes históricos y cálculos financieros.

`financing` separa contado, crédito de proveedor y tarjeta de crédito del método usado para pagar el dinero propio. Las cuotas son compromisos; solo `debt_pay` mueve caja. El presupuesto mensual es informativo y no cambia utilidad realizada, liquidaciones ni retiros. Los saldos iniciales son un único registro versionado: caja inicial se suma al libro, ingresos menos gastos iniciales al resultado, ambos desde su fecha efectiva.

Los experimentos sin pedido cargan consumo físico y gasto material a movimientos enlazados. No se agregan de nuevo sus costos al resultado ni generan efectivo o ventas. Su compensación se ejecuta exclusivamente desde ese módulo para impedir doble restitución de stock.

Excel se genera en el navegador con `write-excel-file`, cargado al exportar (~70 KB sin comprimir en la compilación verificada). Las celdas de texto tienen tipo explícito String; no se interpreta contenido del cliente como fórmula. Se mantienen el límite de 50.000 filas y la misma instantánea SQL de CSV/PDF.

Al iniciar el espacio se consulta la versión del esquema antes de mostrar los módulos. Una base anterior muestra instrucciones y enlaces al instalador; no permite guardar cotizaciones con un cálculo que todavía ignore insumos nuevos.
