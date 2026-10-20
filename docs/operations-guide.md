# Flujo diario de KAPA 3D

1. **Configuración:** completa tarifa de energía y mano de obra. En **Impresoras**, completa precio de adquisición, vida útil, potencia y horas de uso anteriores. La Bambu Lab A1 Mini inicial es una referencia: no crea una compra, deuda ni valor supuesto.
2. **Caja e inventario:** registra aportes reales si corresponden. Compra cada rollo indicando peso, costo, pago inicial y financiación. Solo la parte pagada sale de caja; el saldo crea deuda y cuotas. Disponible = físico menos reservado.
3. **Cliente y cotización:** guarda el cliente, agrega uno o varios productos y colores. Por unidad incluye pieza, soportes, purga, horas, trabajo, pintado, personalización, empaque y otros costos. El motor muestra costo, ×2/×3/×4, precio manual, ganancia, margen y recargo. Pintado y personalización se incluyen una sola vez. La cotización guarda sus costos originales.
4. **Pedido:** convierte la cotización, indica fecha prometida y prioridad. Registra el anticipo realmente recibido. Al confirmar, se reserva el material estimado sin consumirlo. Se puede autorizar expresamente confirmar sin el anticipo requerido o editar el porcentaje del pedido.
5. **Producción:** registra unidades buenas, horas reales, materiales y costos realmente utilizados. Se consume el material, se libera la reserva utilizada y se acumulan horas. Una impresión fallida puede tener cero unidades buenas y conservar sus consumos. Un registro incorrecto puede compensarse antes de cerrar el pedido; no representa recuperar plástico realmente gastado.
6. **Entrega:** termina producción, pasa por acabado o listo para entregar y registra los cobros restantes. Entregar con saldo requiere autorización expresa. Las cuentas por cobrar se recalculan sin registrar dos veces la venta. Los adjuntos son privados y WhatsApp solo prepara el mensaje.
7. **Finanzas:** registra compras operativas, gastos pagados y cuotas de deuda. Capital e intereses se separan. Si un pago o compra corresponde a un costo ya incluido en producción (energía, trabajo, pintado o insumos), marca esa opción para mover caja y deuda sin descontarlo de nuevo de la utilidad. Usa gastos adicionales para costos que todavía no estén contabilizados.
8. **Socios:** registra adelantos separados. Liquida la utilidad realizada disponible, reserva la parte que quieras mantener en el negocio y asigna el resto 50/50. La liquidación compensa adelantos pendientes; el retiro paga la utilidad asignada. Reservar y asignar ganancias no mueve caja. Las pérdidas posteriores limitan la liberación de reservas.
9. **Reportes:** filtra las fechas y exporta todo el reporte en CSV o utiliza Imprimir/PDF y «Guardar como PDF». Caja, stock, deudas y saldos de socios son actuales. Ventas y clientes se filtran por creación del pedido; los productos rentables, por entrega. La utilidad realizada requiere pedido entregado y completamente cobrado.

## Reglas de control

- Las compras de inventario no se descuentan también como gasto: el costo se reconoce al consumir material para una entrega o registrar una merma.
- Adquirir una impresora no reconoce su precio completo como gasto y tampoco vuelve a descontar su amortización de caja.
- Un préstamo o aporte no es ganancia. Pagar capital reduce deuda y caja; el interés es gasto.
- Los anticipos aumentan caja y reducen el saldo del cliente, pero no generan por sí solos utilidad realizada.
- Los retiros y adelantos de socios no son gastos operativos. Un adelanto se imputa una sola vez durante una liquidación.
- Las mitades se asignan en centavos exactos; un centavo residual queda en la reserva empresarial. No se repite la misma utilidad en otra liquidación.
- Caja insuficiente y retiros superiores al saldo se bloquean salvo autorización explícita con motivo. El stock físico y las reservas no pueden quedar negativos.
- Una devolución de compra exige rollo completo sin reservas o una adquisición no usada, cancela su deuda pendiente y registra el reembolso realmente recibido. Los intereses ya pagados no se recuperan automáticamente.
- Ajustes, compensaciones, reintentos y cambios de estado conservan responsable e historial. No se borran los registros originales.
- La cola muestra el efecto de cambiar prioridades y estimaciones por impresora. Las promesas a clientes solo cambian con autorización expresa.

Los indicadores salen de datos reales. Las pruebas automáticas usan cuentas y movimientos temporales, se limpian al terminar y no constituyen datos iniciales del negocio.
