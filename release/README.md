# Actualización de KAPA 3D

`KAPA-3D-instalacion.sql` instala o actualiza fundamentos, registro y todos los módulos operativos: inventario, impresoras, costos, cotizaciones, clientes, pedidos, producción, caja, compras, deudas, socios y reportes. Conserva la cuenta administradora y los datos existentes. Está probado como instalación nueva, actualización y repetición; rechaza estados parciales con rollback.

Si ya puedes entrar, ejecuta este SQL actualizado una vez desde el SQL Editor de tu proyecto Supabase y actualiza el frontend en Netlify desde el repositorio. Consulta [las instrucciones de despliegue](../docs/deployment.md) y [el flujo diario](../docs/operations-guide.md).

`npm run db:installer` regenera este archivo sin crear un ZIP. No requiere contraseñas ni claves privadas.

La descarga del ZIP anterior está retirada por una detección de Microsoft Defender. No se ofrece un reemplazo ni se ha declarado resuelta la alerta; [el informe](../docs/download-review.md) conserva sus hashes y comprobaciones. No recuperar copias antiguas para evitar el bloqueo ni desactivar la protección.

El registro sigue pidiendo solo nombre, correo y contraseña. En una instalación nueva el propietario activa el primer administrador por correo con [activate-first-admin.sql](../supabase/activate-first-admin.sql). Las instalaciones que ya tienen administrador omiten esa activación. El segundo socio se habilita desde Socios y equipo.
