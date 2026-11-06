# Financia — requisitos de producto y seguridad

Estado: objetivos de producto, no funcionalidades ya publicadas.

## Producto
- Aplicación web progresiva instalable en móviles y escritorio; publicación en tiendas como fase posterior.
- Multiusuario: cada cuenta tiene un identificador único y acceso solo a sus datos.
- Multibanco e internacional: bancos y monedas por país según cobertura real de proveedores.
- Idioma y moneda local configurables.
- Plan Gratis: ingresos/gastos manuales, presupuestos y estadísticas básicas.
- Plan Premium: precio base **2.000 CLP/mes**, convertido a moneda local; impuestos, comisiones y tipo de cambio pueden modificar el total.
- Premium previsto: sincronización automática de movimientos bancarios compatibles, múltiples cuentas y análisis avanzado.
- Validar costos unitarios de conectividad antes de comprometer bancos ilimitados al precio base.

## Seguridad: requisitos obligatorios antes de lanzar importaciones
1. Nunca pedir ni guardar claves bancarias, PIN ni códigos de autenticación.
2. Acceso bancario solo mediante autorización explícita y revocable del usuario con proveedores confiables.
3. Inicio de sesión con correo no otorga acceso automático a Gmail ni a cuentas bancarias.
4. Verificar la identidad del usuario en el **servidor** en cada operación; no confiar en uid enviado por el navegador.
5. Cada movimiento, cuenta, autorización y regla de comercio debe tener owner_uid; denegar accesos cruzados.
6. Guardar tokens de proveedores solo en servidor, cifrados y con permisos mínimos; no exponer secretos en HTML/JS.
7. Distinguir importación de movimientos de obtención de cartolas completas; cobertura según país, banco y proveedor.
8. Idempotencia por proveedor, cuenta y transaction_id; no depender solo de la descripción o el monto.
9. Movimientos importados entran como pendientes y no modifican saldos hasta la aprobación.
10. Revisión de permisos, auditoría, eliminación de datos, retención y requisitos legales antes de lanzamiento internacional.

## Arquitectura existente y límites
- Firebase Authentication y Firestore: aplicación principal.
- Cloudflare Worker y D1: prototipo de recepción de compras.
- Google Apps Script + Gmail: prueba con correos de Banco de Chile de una cuenta.
- **El endpoint actual con secreto compartido y tabla D1 sin owner_uid NO es apto para uso multiusuario.**
- No habilitar importación real ni lecturas de D1 desde clientes hasta implementar autorización por usuario.
- La integración de Gmail debe verificar los resultados de autenticación del servidor receptor y requerir consentimiento individual.

## Próximos hitos
1. Completar PWA con íconos PNG y pruebas de instalación Android/iOS/escritorio.
2. Modelo de datos multiusuario y autorización por usuario en backend.
3. Importación y conciliación segura de movimientos.
4. Integraciones bancarias por país con consentimiento.
5. Facturación internacional Gratis/Premium y control de permisos de suscripción.
6. Pruebas de seguridad, privacidad y publicación.
