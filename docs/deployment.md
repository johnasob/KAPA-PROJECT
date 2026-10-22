# Actualizar el sitio existente de KAPA 3D

El usuario ya accede a https://vocal-stardust-0c7960.netlify.app/. Esta actualización limita la amortización al 10 % del material y corrige registros guardados, permite corregir compras a tarjeta y planes de deudas, agrega resumen por color, clientes dentro del pedido, pedidos sin anticipo y estados directos, repetición de impresiones y tablero visual; conserva los módulos operativos y necesita actualizar tanto Supabase como el frontend. La sesión de Codex no tiene acceso administrativo a Netlify ni a SQL del proyecto alojado; no se han aplicado los cambios en esos servicios. Las consultas a sus dominios desde esta máquina encontraron un bloqueo de red 403.

## 1. Actualizar Supabase conservando la cuenta

En el proyecto que utiliza KAPA, abre **SQL Editor → New query**. Copia todo el archivo [release/KAPA-3D-instalacion.sql](../release/KAPA-3D-instalacion.sql), pégalo y pulsa **Run**. Debe terminar con Success y mostrar `actualizacion_de_registros`, con los conteos de costos corregidos. Las nuevas pantallas requieren esquema 3; si falta la actualización, la aplicación muestra el enlace al SQL.

El instalador conserva las cuentas, el perfil de John, la configuración y los datos ya existentes. Agrega módulos y políticas de Storage en una transacción. Puede repetirse; si detecta una instalación parcial, revierte los cambios y explica qué falta. Está probado como instalación nueva, actualización de fundamentos con administrador existente y actualización de la versión operativa y de la versión completa anterior, con pedidos entregados, cobros, compensaciones, deudas e inventario. Incluye una prueba de amortización antigua excesiva: corrige costos y borradores automáticos conservando precios pactados y pagos. No ejecutar `db reset` contra el proyecto alojado.

Si ya puedes entrar, conserva tu usuario y contraseña; no vuelvas a ejecutar la activación inicial. Si es una instalación nueva, sigue la activación por correo del README.

## 2. Actualizar el frontend desde GitHub

En Netlify abre el proyecto **vocal-stardust-0c7960**. En la configuración de despliegue continuo, vincula **johnasob/KAPA-PROJECT**, rama **main**, y ejecuta un nuevo despliegue. Si el proyecto era un despliegue manual, la opción está en **Project configuration → Build & deploy → Continuous deployment → Repository → Link repository**; los rótulos pueden variar según la versión del panel.

`netlify.toml` incluye Node 24, comando `npm run build:deploy`, publicación de `dist` y los dos valores públicos de conexión del proyecto de KAPA. No hace falta copiar claves privadas ni descargar un ZIP. La URL y la clave publishable/anon son públicas por diseño, ya formaban parte del frontend; las políticas RLS protegen los datos. Si cambias de proyecto Supabase, actualiza estos dos valores públicos en la configuración de compilación. Nunca usar service_role ni sb_secret_.

Los encabezados y `public/_redirects` conservan la navegación SPA. Al completar el despliegue, abre el sitio y comprueba «Resumen por color» en Inventario, «Nuevo pedido» y «Todos los saldos» en Pedidos, «Editar compra» en Finanzas y el desglose de amortización máxima del 10 % en cotizaciones. Si ves las pantallas anteriores, el sitio todavía sirve el despliegue anterior.

Configura en Supabase Auth la Site URL con la dirección pública del sitio y permite su origen y `/actualizar-clave`. Las confirmaciones y recuperación PKCE deben abrirse en el navegador donde se solicitaron.

## 3. Verificar la actualización alojada

Comprueba el acceso de ambos socios, la configuración y los datos conservados y el bucket privado. Revisa los conteos del instalador: los pedidos mantienen sus precios y cobros; solo se corrigen costos excesivos y precios automáticos de borradores. La clasificación de cada compra a tarjeta requiere indicar el origen real del pago desde su editor; no se adivina por tener caja negativa. Registra solo compras, cobros y saldos reales; no copies los datos de las pruebas locales al negocio. Revisa que una recarga directa de `/pedidos` y `/reportes` funcione.

La compilación y las pruebas locales no demuestran que el despliegue alojado esté actualizado. Publicar el entorno cloud tampoco actualiza Netlify ni ejecuta SQL en Supabase.

## Descarga anterior

El ZIP del commit c883cbb5 fue retirado por la detección Trojan:Script/Ulthar.A!ml. La alerta sigue pendiente de revisión con Microsoft Defender; el trabajo funcional actual no la declara resuelta. No se ofrece otro ZIP ni se propone cambiar nombres o desactivar protecciones para evitarla. Consulta [el informe](download-review.md). El código nuevo incorpora funcionalidades solicitadas y se entrega como código versionado; no cuenta con una certificación antivirus.
