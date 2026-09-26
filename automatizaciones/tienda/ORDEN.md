# Encargos para la sesión de la tienda — en este orden

Todos aprobados por el propietario. Cada uno trae su especificación y pruebas.
Salen idealmente en **un solo despliegue** (~15 créditos cualquiera sea el
tamaño), con la edición grande en curso.

| # | Encargo | Archivo | Quién | Bloqueado por |
|---|---|---|---|---|
| 1 | Registrar ventas hechas fuera del checkout (`registrar-venta.mjs`) | `automatizaciones/ventas-manuales/BRIEF.md` | Tienda; luego la sesión de pauta arma el formulario de n8n | Nada |
| 2 | Suscripción por correo con charm de regalo | `automatizaciones/suscripcion/BRIEF.md` | Tienda | Nada |
| 3 | Ficha de producto que vende más | `automatizaciones/tienda/ENCARGO-FICHA.md` | Tienda | Parcial: Addi (credenciales) y 24 h Bogotá (hora de corte, mensajería) |
| 4 | Ficha, segunda parte: 4 bloques con video, fotos del carrito, reseñas con multimedia, relacionados que abren ficha, menú de categorías y «Más vendidos» | `automatizaciones/tienda/ENCARGO-FICHA-2.md` | Tienda | Parcial: certificado de níquel del proveedor, contenido real del empaque, almacenamiento para videos de reseñas |

**Por qué este orden:** el 1 arregla el inventario, y el 3 muestra disponibilidad
real: sin el 1, la ficha mostraría piezas vendidas por WhatsApp como disponibles.
El 2 va antes del 3 porque la ficha enlaza la suscripción. El 4 se apoya en la
ficha del 3. **Excepción:** el arreglo de fotos del carrito (4, § 2) es un
error visible hoy; puede ir primero.

**Lo que falta del propietario** (lo demás se construye sin esperar):
- Addi: cuenta de aliado y credenciales.
- 24 h en Bogotá: hora de corte, días, mensajería y costo.
- Qué pieza se regala a suscriptores.
- Certificado del proveedor de que la plata es libre de níquel (si no hay, no
  se escribe «hipoalergénica»).
- Qué trae exactamente el empaque.
- Dónde alojar videos de reseñas, si se quieren videos largos.
- Si «+2.400 pulseras creadas» y las reseñas fijas con «Compra verificada» se
  pueden sostener.

**Después de desplegar:** crear en Netlify `VENTA_MANUAL_KEY`,
`SUSCRIPCION_SECRETO` y `SUSCRIPTORES_KEY` (nunca en un chat), y avisar a la
sesión de pauta para el formulario de n8n y para verificar los precios de los
anuncios contra los paquetes nuevos.
