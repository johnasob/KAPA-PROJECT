# PROMPT PARA CODEX — SISTEMA INTEGRAL KAPA 3D

## 1. ROL Y OBJETIVO

Actúa como un **ingeniero de software Full Stack Senior**, especializado en React, TypeScript, Supabase, arquitectura de aplicaciones, sistemas de inventario, contabilidad para pequeños negocios, UX/UI y optimización de rendimiento.

Tu objetivo es diseñar y desarrollar **KAPA 3D**, una aplicación web integral para administrar un emprendimiento colombiano de impresión 3D, gestionado por dos socios: **John y Sebas**, con participación del 50 % cada uno.

La aplicación debe ser el centro operativo y financiero del negocio, permitiendo controlar inventarios, impresoras, costos, cotizaciones, pedidos, clientes, compras, deudas, ingresos, gastos, ganancias y distribución de utilidades.

**No desarrolles una simulación conversacional ni una aplicación basada en comandos de texto. Construye una aplicación web real, completamente funcional, con interfaz gráfica, base de datos persistente y operaciones verificables.**

El sistema debe ser gratuito de operar en su etapa inicial, sencillo de mantener, escalable y accesible desde computadores y celulares.

## 2. STACK TECNOLÓGICO

Utiliza preferiblemente:

- Frontend: React + TypeScript + Vite.
- Estilos: Tailwind CSS.
- Backend y base de datos: Supabase + PostgreSQL.
- Autenticación: Supabase Auth.
- Iconografía: Lucide React.
- Gráficos: Recharts.
- Fechas: date-fns.
- Formularios: React Hook Form + Zod.
- Moneda: pesos colombianos (COP).
- Idioma: español de Colombia.
- Zona horaria: America/Bogota.

Si existe un proyecto previamente desarrollado, **analiza su estructura, dependencias, componentes y base de datos antes de modificarlo**. Reutiliza lo que funcione correctamente y evita reconstruir módulos innecesariamente.

Aplica principios SOLID, separación de responsabilidades, componentes reutilizables, tipado estricto y código mantenible.

## 3. USUARIOS Y SEGURIDAD

El sistema tendrá inicialmente dos administradores:

- John: socio y administrador.
- Sebas: socio y administrador.

Ambos tendrán permisos completos y podrán visualizar las operaciones realizadas por el otro.

Implementa:

- Inicio y cierre de sesión.
- Sesiones persistentes y seguras.
- Políticas Row Level Security (RLS).
- Registro de usuario, fecha y tipo de operación.
- Historial de modificaciones financieras y de inventario.
- Validación de permisos desde la base de datos.
- Protección contra operaciones duplicadas.

No expongas claves privadas ni credenciales sensibles en el frontend.

## 4. DASHBOARD PRINCIPAL

La pantalla inicial debe presentar un resumen claro del negocio.

### Indicadores principales

- Dinero disponible en caja.
- Ventas cobradas del mes.
- Cuentas por cobrar.
- Ganancia neta estimada y realizada.
- Gastos operativos.
- Deudas pendientes.
- Pedidos activos.
- Pedidos pendientes de entrega.
- Pedidos atrasados.
- Pedidos completados.
- Valor del inventario disponible.
- Alertas de filamento.

### Resumen de socios

Mostrar una tarjeta individual para John y Sebas con:

- Participación del 50 %.
- Utilidades acumuladas asignadas.
- Adelantos recibidos.
- Retiros de utilidades.
- Saldo pendiente por cobrar.

### Visualizaciones

Incluir gráficos de:

- Ventas mensuales.
- Ingresos frente a gastos.
- Ganancias mensuales.
- Productos más vendidos.
- Consumo de filamento.
- Evolución de pedidos.

Permitir filtrar por fecha, mes y año.

Todos los indicadores deben calcularse desde datos reales, nunca desde valores estáticos.

## 5. INVENTARIO DE FILAMENTOS

Crear un módulo completo para administrar materiales.

### Datos de cada filamento

- ID único.
- Marca.
- Material: PLA, PETG, TPU, ABS u otros.
- Color.
- Peso inicial del rollo.
- Peso disponible en gramos.
- Peso reservado para pedidos.
- Costo total del rollo.
- Costo por gramo.
- Fecha de compra.
- Proveedor.
- Método de pago.
- Número de cuotas, si aplica.
- Saldo pendiente.
- Estado del material.

Permitir registrar:

- Compra de nuevos rollos.
- Consumo por impresión.
- Reservas para pedidos.
- Desperdicio y purgado.
- Mermas.
- Devoluciones de material.
- Ajustes manuales.
- Historial completo de movimientos.

### Alertas automáticas

- Amarilla: menos de 200 g y más de 100 g disponibles.
- Roja: 100 g o menos.
- Sin stock: 0 g disponibles.

El stock disponible debe descontar las reservas activas.

**Regla importante:** registrar un pedido no significa necesariamente consumir filamento. Primero debe reservarse y posteriormente descontarse al registrar la producción real. Evita duplicar consumos.

Cada movimiento debe ser trazable y reversible mediante un movimiento compensatorio autorizado.

## 6. GESTIÓN DE IMPRESORAS

Permitir administrar varias impresoras.

### Datos

- ID.
- Nombre y modelo.
- Precio de adquisición.
- Fecha de compra.
- Vida útil estimada en horas.
- Horas acumuladas de funcionamiento.
- Costo de amortización por hora.
- Consumo eléctrico estimado.
- Costo de energía por kWh.
- Estado: disponible, imprimiendo, mantenimiento o inactiva.
- Cuotas de financiación.
- Saldo de deuda.
- Historial de mantenimiento.

Registrar inicialmente como referencia una **Bambu Lab A1 Mini**, con valores editables.

Permitir agregar futuras impresoras, incluidas máquinas multicolor o con múltiples cabezales.

Registrar costos de mantenimiento, repuestos y reparaciones.

La amortización debe ser un costo económico calculado, no una salida automática de dinero de caja.

## 7. MOTOR DE COSTOS Y COTIZACIONES

Implementa un sistema automático y configurable para calcular cuánto cuesta fabricar una pieza y cuánto debería cobrarse.

### Variables

- Impresora utilizada.
- Filamento y color.
- Gramos estimados de la pieza.
- Gramos de soportes.
- Gramos de purgado y desperdicio.
- Tiempo de impresión.
- Consumo eléctrico.
- Costo de amortización.
- Insumos adicionales.
- Mano de obra.
- Personalización.
- Pintado.
- Empaque.
- Otros costos directos.

### Fórmulas

Costo de material = gramos totales consumidos × costo por gramo.

Costo de amortización = horas de impresión × amortización por hora.

Costo energético = consumo eléctrico estimado en kW × horas × tarifa por kWh.

Costo de pintado = horas de trabajo × tarifa de mano de obra + materiales utilizados.

Costo total de producción = material + amortización + energía + insumos + mano de obra + pintado + empaque + otros costos.

Mostrar automáticamente precios sugeridos con multiplicadores:

- x2
- x3
- x4

Permitir seleccionar un multiplicador o introducir un precio manual.

**Precio sugerido = costo total de producción × multiplicador.**

Evita cobrar dos veces los conceptos de personalización o pintado: si ya están incluidos en el costo total, no deben volver a sumarse.

Mostrar:

- Costo de producción.
- Precio de venta.
- Ganancia bruta estimada.
- Margen porcentual.
- Porcentaje de recargo.
- Precio mínimo de referencia.

Distingue claramente margen de ganancia y multiplicador de precio.

Permitir guardar una cotización, convertirla en pedido y conservar los costos originales aunque posteriormente cambien los precios del filamento.

## 8. PEDIDOS Y PRODUCCIÓN

Crear un módulo de pedidos con seguimiento completo.

### Datos del pedido

- Código único.
- Cliente.
- Teléfono y WhatsApp.
- Producto o descripción.
- Imágenes de referencia.
- Enlace al modelo STL/3MF.
- Archivo adjunto opcional.
- Cantidad.
- Colores.
- Materiales.
- Impresora asignada.
- Gramos estimados.
- Tiempo estimado.
- Costo calculado.
- Precio final.
- Anticipo.
- Saldo pendiente.
- Fecha de creación.
- Fecha comprometida de entrega.
- Prioridad.
- Estado.
- Observaciones.

### Estados

1. Pendiente de anticipo.
2. Confirmado.
3. En diseño.
4. Listo para imprimir.
5. Imprimiendo.
6. En acabado o pintado.
7. Listo para entregar.
8. Entregado.
9. Cancelado.

Permitir registrar pagos parciales, anticipos y saldos pendientes.

El anticipo predeterminado será del **50 %**, pero debe ser editable.

Registrar los ingresos en caja únicamente cuando se reciba efectivamente el dinero.

El valor total de una venta no debe registrarse dos veces cuando se cobra el saldo.

### Prioridades

Permitir marcar pedidos urgentes y reorganizar la cola de producción.

Al priorizar un pedido:

- Mostrar cómo afecta a otros pedidos.
- Recalcular fechas estimadas según la disponibilidad de las impresoras.
- Advertir sobre posibles retrasos.
- Solicitar confirmación antes de modificar fechas comprometidas.

No modificar automáticamente compromisos adquiridos con clientes sin autorización.

### Calendario

Crear vistas de calendario, lista y tablero Kanban.

Mostrar pedidos próximos, atrasados y urgentes.

## 9. CLIENTES E HISTORIAL

Crear fichas individuales con:

- Nombre.
- Teléfono.
- WhatsApp.
- Ciudad.
- Dirección opcional.
- Pedidos realizados.
- Total comprado.
- Pagos pendientes.
- Productos favoritos o frecuentes.
- Notas.
- Fecha de última compra.

Permitir buscar clientes rápidamente y reutilizar su información en nuevos pedidos.

Incluir un acceso para abrir WhatsApp con un mensaje preparado, sin enviar mensajes automáticamente.

## 10. CAJA, INGRESOS Y GASTOS

Crear un módulo financiero que represente fielmente los movimientos del negocio.

### Ingresos

- Anticipos.
- Pagos finales.
- Ventas directas.
- Aportes de capital.
- Otros ingresos.

### Egresos

- Compra de filamentos.
- Insumos.
- Repuestos.
- Mantenimiento.
- Transporte.
- Envíos asumidos por KAPA.
- Energía pagada.
- Cuotas de financiación.
- Gastos operativos.
- Adelantos a socios.
- Retiros de utilidades.

Cada operación debe registrar fecha, valor, responsable, categoría, descripción y medio de pago.

Separar correctamente:

- Flujo de caja.
- Ingresos por ventas.
- Costos de producción.
- Gastos operativos.
- Cuentas por cobrar.
- Cuentas por pagar.
- Utilidad neta.

**Reglas contables fundamentales:**

- Una compra de inventario no debe contarse dos veces como gasto y costo de material consumido.
- Un crédito no representa utilidad.
- Pagar el capital de una deuda reduce caja y deuda, pero no genera nuevamente un gasto.
- Los intereses deben registrarse por separado.
- Los anticipos de clientes aumentan caja, pero no deben confundirse con utilidad realizada.
- Los retiros de socios no son gastos operativos.
- El costo económico por amortización no debe restarse nuevamente de caja.

## 11. FINANZAS DE JOHN Y SEBAS

La participación del negocio será:

- John: 50 %.
- Sebas: 50 %.

Crear cuentas individuales para ambos.

### Adelantos

Registrar dinero entregado a un socio antes de la liquidación de utilidades.

### Retiros de utilidades

Registrar distribuciones de ganancias previamente disponibles.

### Cálculo

Utilidad distribuible = utilidad neta realizada acumulada − reservas empresariales − distribuciones previamente reconocidas, según el periodo de liquidación.

Participación individual = utilidad distribuible correspondiente × 50 %.

Saldo individual = participación acumulada asignada − adelantos imputados − retiros de utilidades realizados.

Evita restar dos veces una distribución.

Los adelantos deben mantenerse como movimientos separados hasta su compensación en una liquidación.

### Reglas

- No permitir retiros superiores al saldo disponible sin autorización explícita.
- No confundir dinero disponible en caja con utilidad repartible.
- Permitir reservar capital para nuevas compras y mantenimiento.
- Mostrar historial de liquidaciones.
- Permitir consultar ganancias por periodos.
- Mostrar cuánto ha recibido cada socio.
- Registrar aportes adicionales de capital sin alterar automáticamente el porcentaje de participación.

## 12. COMPRAS, CRÉDITOS Y DEUDAS

Permitir registrar compras directas o financiadas.

Cada deuda debe incluir:

- Proveedor.
- Concepto.
- Valor inicial.
- Cuota mensual.
- Número de cuotas.
- Cuotas pagadas.
- Saldo pendiente.
- Fecha de próximo vencimiento.
- Intereses, si aplica.

Mostrar próximas obligaciones y alertas de vencimiento.

Cuando se registre una compra a crédito, aumentar el inventario o activo correspondiente y reconocer la deuda, sin descontar inmediatamente de caja la parte no pagada.

## 13. REPORTES

Crear reportes filtrables y exportables.

Incluir:

- Ventas por periodo.
- Utilidad neta.
- Costos por producto.
- Rentabilidad por pedido.
- Consumo de materiales.
- Inventario valorizado.
- Gastos por categoría.
- Deudas pendientes.
- Movimientos de caja.
- Balance de socios.
- Productos más rentables.
- Clientes frecuentes.

Permitir exportar CSV y PDF cuando sea viable.

## 14. DISEÑO Y EXPERIENCIA DE USUARIO

La aplicación debe sentirse como un producto profesional, no como un formulario administrativo básico.

### Identidad visual

Marca: **KAPA 3D**.

Utilizar un diseño moderno, elegante, limpio y tecnológico, con una identidad visual consistente.

Priorizar:

- Excelente experiencia móvil.
- Navegación intuitiva.
- Tipografía legible.
- Tarjetas informativas.
- Iconos coherentes.
- Gráficos claros.
- Colores funcionales para alertas.
- Formularios rápidos.
- Modales bien diseñados.
- Estados de carga.
- Mensajes de éxito y error.
- Confirmaciones para operaciones críticas.
- Modo claro y oscuro si resulta viable.

### Mobile First

Optimizar especialmente para celulares.

Incluir:

- Menú de navegación inferior o lateral adaptable.
- Botones táctiles cómodos.
- Formularios simplificados.
- Búsqueda rápida.
- Filtros compactos.
- Tablas adaptadas a pantallas pequeñas.
- Acciones frecuentes accesibles con pocos toques.

Evitar desplazamiento horizontal innecesario y pantallas sobrecargadas.

## 15. AUTOMATIZACIONES INTERNAS

Implementar automáticamente:

- Actualización del inventario al consumir material.
- Reservas de filamento al confirmar producción.
- Liberación de reservas al cancelar pedidos.
- Recalcular costos estimados cuando cambien los datos de una cotización.
- Actualización de caja al registrar cobros o pagos.
- Recalcular saldos de clientes.
- Actualización de deudas al pagar cuotas.
- Recalcular saldos de socios.
- Alertas por stock bajo.
- Alertas por pedidos atrasados.
- Alertas por vencimientos.
- Actualización de indicadores del dashboard.

Las operaciones que involucren varias tablas deben ser atómicas para evitar inconsistencias.

Evita duplicar transacciones cuando se presione dos veces un botón o falle una solicitud.

## 16. BASE DE DATOS Y PERSISTENCIA

Diseña una estructura relacional normalizada en PostgreSQL.

Considera entidades para:

- Usuarios.
- Socios.
- Impresoras.
- Mantenimientos.
- Filamentos.
- Lotes de inventario.
- Movimientos de inventario.
- Insumos.
- Clientes.
- Productos.
- Cotizaciones.
- Pedidos.
- Detalles de pedidos.
- Producción.
- Pagos.
- Movimientos de caja.
- Compras.
- Deudas.
- Cuotas.
- Adelantos.
- Distribuciones de utilidades.
- Liquidaciones.
- Configuración.
- Auditoría.

Utiliza claves foráneas, índices, restricciones y validaciones.

Implementa políticas RLS correctamente.

No utilices localStorage como base de datos principal.

No simules persistencia en memoria: todas las operaciones deben almacenarse realmente en Supabase.

## 17. DATOS INICIALES

Prepara datos de ejemplo únicamente para desarrollo.

Configuración inicial sugerida:

- Nombre del negocio: KAPA 3D.
- Socios: John y Sebas.
- Participación: 50 % cada uno.
- Moneda: COP.
- Impresora inicial: Bambu Lab A1 Mini.
- Material inicial: PLA.
- Costo de referencia: $90.000 COP por kilogramo.
- Anticipo predeterminado: 50 %.
- Alerta amarilla: menos de 200 g.
- Alerta roja: 100 g o menos.

Los valores de amortización, electricidad, mano de obra, capital inicial y financiación deben ser configurables, sin asumir valores definitivos.

No inventes saldos reales, pagos recibidos, deudas ni ganancias.

Separa claramente los datos de demostración de los datos reales del negocio.

## 18. REQUISITOS DE CALIDAD

- Código limpio y modular.
- TypeScript con tipado estricto.
- Componentes reutilizables.
- Manejo centralizado de errores.
- Validaciones en frontend y backend.
- Protección contra saldos e inventarios negativos no autorizados.
- Cálculos monetarios con precisión decimal.
- Operaciones transaccionales.
- Consultas optimizadas.
- Paginación para historiales extensos.
- Estados vacíos bien diseñados.
- Accesibilidad básica.
- Buen rendimiento en celulares.
- Seguridad de información financiera.
- Historial de auditoría.

Implementa pruebas para cálculos de costos, stock, cobros parciales, caja, deudas y distribución de utilidades.

## 19. METODOLOGÍA DE IMPLEMENTACIÓN

Trabaja por fases, garantizando que cada módulo quede funcional antes de avanzar.

**Fase 1 — Fundamentos**

Analizar el proyecto existente, definir arquitectura, configurar Supabase, autenticación, usuarios, seguridad, navegación y diseño base.

**Fase 2 — Inventario e impresoras**

Crear gestión de filamentos, movimientos, alertas, impresoras y mantenimiento.

**Fase 3 — Costos y cotizaciones**

Implementar motor de cálculo, precios sugeridos y almacenamiento de cotizaciones.

**Fase 4 — Clientes y pedidos**

Implementar clientes, pedidos, producción, anticipos, calendario y prioridades.

**Fase 5 — Finanzas**

Implementar caja, gastos, compras, deudas, utilidades y balances individuales de socios.

**Fase 6 — Dashboard y reportes**

Crear indicadores, gráficos, filtros, reportes y exportaciones.

**Fase 7 — Pruebas y optimización**

Revisar seguridad, cálculos, rendimiento, responsive, errores y consistencia de datos.

## 20. INSTRUCCIONES FINALES PARA CODEX

1. Primero inspecciona el repositorio y determina qué está implementado y qué falta.
2. Presenta un plan breve de implementación basado en el estado real del proyecto.
3. Conserva la estructura y funcionalidades existentes cuando sean correctas.
4. Implementa código real, no pseudocódigo ni pantallas decorativas.
5. No dejes botones sin funcionalidad.
6. No utilices datos ficticios para aparentar que las operaciones funcionan.
7. No modifiques ni elimines datos existentes sin una estrategia segura de migración.
8. Mantén sincronizados frontend, base de datos y reglas de negocio.
9. Prioriza precisión financiera y trazabilidad por encima de funcionalidades secundarias.
10. Ejecuta las pruebas y compilación disponibles al finalizar cada fase.
11. Informa qué archivos modificaste, qué funcionalidades implementaste, qué pruebas realizaste y qué falta.
12. No afirmes que algo funciona si no ha sido probado.
13. Si falta una credencial, configuración o decisión imprescindible, solicítala en lugar de inventarla.
14. No introduzcas servicios de pago ni dependencias innecesarias.
15. Documenta las variables configurables y las instrucciones mínimas de instalación.

**RESULTADO ESPERADO**

Una aplicación web real llamada **KAPA 3D**, lista para administrar las operaciones diarias de un emprendimiento de impresión 3D desde un celular o computador, con inventario confiable, cotizaciones precisas, seguimiento de pedidos, control financiero, gestión de deudas y distribución transparente de utilidades entre John y Sebas.

**Comienza analizando el proyecto existente y ejecuta la primera fase de implementación.**
