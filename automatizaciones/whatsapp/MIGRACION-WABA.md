# WhatsApp en el portafolio viejo: plan para dejarlo administrable

Escrito el 2026-11-12. Plan para aprobar; nada de lo que está **pendiente**
se ejecuta sin que el propietario lo apruebe. Contexto en `ESTADO.md`
§ «Migración a la cuenta personal» → *P1 · WhatsApp*.

## La decisión, en corto

**No se migra el número. Se recuperó el acceso al portafolio donde vive.**

El 2026-11-10 se rehízo Meta desde el perfil personal del dueño (portafolio
`1157598043799973`, página `1434133013118298`, cuenta `1683479286750530`,
píxel `2005297310144764`). WhatsApp se quedó en el portafolio viejo
`1499356148452488`, sin nadie que pudiera administrarlo:

- la app `AGENTE CLAUDE` (`1910139459666391`);
- la WABA `1868981540432885`;
- el número +57 301 899 0672 (Phone Number ID `990934840764558`);
- los usuarios del sistema que firman los tokens.

Antes de investigar la migración se preguntó lo único que la podía evitar:
¿alguien entra todavía al portafolio viejo? **Sí: el perfil «Zephora Charms 1»
es admin.** Desde ahí, la noche del 11-nov:

| Paso | Estado |
|---|---|
| Invitar al perfil personal «Martin Daza» con **acceso total** al portafolio `1499356148452488` | ✅ hecho y aceptado (11-nov, 23:56) |
| Activos asignados a «Martin Daza» con acceso total: página vieja «Zephora Charms», «cuenta publicitaria 1 ZC», 2 catálogos y las 2 cuentas de WhatsApp («Zephora Charms» y «Test WhatsApp Business Account») | ✅ confirmado con captura |
| App `AGENTE CLAUDE` asignada a «Martin Daza» | ⏳ bloqueado: Meta exige que primero se registre como desarrollador (ver Fase A2) |

Con eso **la WABA dejó de estar huérfana sin un segundo de bot caído**.
Mover el número a otro portafolio (Fase C) queda como plan B: cuesta tiempo
caído, puede costar las plantillas aprobadas y obliga a rehacer app, token,
webhook y credenciales de n8n. Hoy no hay nada que lo justifique.

## Fase A · Dejarlo administrable donde está (sin tiempo caído)

Todo esto lo hace el propietario con el perfil «Martin Daza». Ningún paso
toca el token, el webhook ni n8n, así que el bot `74TjEtDnn940jh9k` no se
entera.

### A1 · Admin del portafolio viejo, hecho

Ver tabla de arriba. **No sacar todavía a «Zephora Charms 1»**: es la llave
de respaldo hasta que A2 y A3 estén hechos.

### A2 · Registro de desarrollador y rol en la app

Sin esto, «Martin Daza» administra la WABA pero no la app: no puede ver ni
tocar el webhook ni `subscribed_apps`, ni generar un token nuevo.

1. developers.facebook.com con «Martin Daza» → **Comenzar** → verificar con
   el celular. El número tiene que estar en el Centro de cuentas **ligado al
   perfil de Facebook** (ya lo está).
   - **Trampa que ya se pisó (11-nov):** tras varios intentos seguidos Meta
     responde *«Te recomendamos reducir la frecuencia…»*. **No reintentar esa
     noche.** Esperar de 12 a 24 h y pedir **un solo** SMS. Si vuelve a salir
     el aviso, usar *«agregar una tarjeta de crédito para verificar la
     cuenta»* (verifica sin cobrar). Insistir arriesga una restricción sobre el
     perfil que hoy sostiene **todo** el portafolio nuevo.
2. Con «Zephora Charms 1»: portafolio viejo → **Usuarios → Personas → Martin
   Daza → Asignar activos → Apps → `AGENTE CLAUDE` → control total**.
3. Confirmar en developers.facebook.com → `AGENTE CLAUDE` → **Roles de la
   app** que «Martin Daza» figura como **Administrador**. Si no aparece,
   agregarlo ahí.

### A3 · Un segundo admin de respaldo

Lo que dejó huérfano todo fue depender de **un** perfil. Agregar una segunda
persona de confianza como admin en los **dos** portafolios (viejo y nuevo).
Cuando esté hecho, decidir si «Zephora Charms 1» se queda o sale. Que salga
solo después de comprobar que «Martin Daza» entra solo a todo, incluido
developers.

### A4 · Medio de pago de WhatsApp

Desde el 1-oct, Meta cobra también los mensajes de servicio y las respuestas
de un agente de IA. Si la tarjeta de la WABA falla, el bot deja de enviar.

1. Portafolio viejo → **Administrador de WhatsApp** → cuenta «Zephora Charms»
   → **Configuración de pagos** (o, en Configuración del negocio: **Pagos /
   Facturación**).
2. Ver qué medio hay, de quién es y si está **activo**. Si no hay o es de
   alguien que ya no está, agregar la tarjeta del negocio con «Martin Daza».
3. Sobre el portafolio nuevo: **un medio de pago no viaja entre portafolios**.
   El que pague WhatsApp tiene que estar en el portafolio dueño de la WABA, hoy
   el viejo. Solo hace falta uno en el nuevo si se ejecuta la Fase C.

### A5 · Ligar el número a la Página nueva (anuncios a WhatsApp)

Sin esto no hay anuncios Click-to-WhatsApp (CTWA) desde la cuenta
`1683479286750530`, ni botón de WhatsApp en la Página nueva.

1. Con «Martin Daza», admin de la Página nueva, ir a la Página `1434133013118298`
   → **Configuración → Cuentas vinculadas → WhatsApp → Conectar** → +57 301 899 0672.
2. **Trampa de este proyecto:** el número está en **otro** portafolio, así
   que Meta pide un código de confirmación y lo manda **al número**. El número
   es de la API, no tiene app abierta en ningún celular. El código entra por el
   webhook a n8n como un mensaje más:
   - Buscarlo en **Ejecuciones** del workflow `74TjEtDnn940jh9k`, en el
     payload del trigger.
   - La asesora va a intentar contestarle. Es inofensivo, pero no hay que
     asustarse por la respuesta.
   - Si el código no llega a n8n (tiene que verse la ejecución), la otra ruta
     es el botón de acción de la Página: **«Enviar mensaje de WhatsApp»** con
     el número. Ese botón no habilita CTWA.
3. Comprobar en el Administrador de anuncios, al crear un anuncio con destino
   WhatsApp en `1683479286750530` y la Página nueva, que el número aparece
   para elegir. **No publicar nada:** crear anuncios sigue la regla de mostrar
   el payload antes (CLAUDE.md, *Modo de operación acordado*).

### A6 · Lo que NO se toca en esta fase

- Los usuarios del sistema del portafolio viejo: «Conversions API System
  User», que firma el token del bot (`SKILL.md` § *Este proyecto*), y
  «Netlify CAPI». Quitarles activos apaga el bot o la medición sin ningún
  error visible.
- El webhook de la app, `subscribed_apps` y la verificación en dos pasos
  (PIN) del número.
- Las credenciales de n8n.

### A7 · Opcional, con A2 hecho: rotar el token

Hoy el token no caduca y nadie sabe si alguna vez se pegó en un chat
(pendiente 6 de CLAUDE.md). Con acceso a la app se puede generar uno nuevo
para el mismo usuario del sistema y **actualizar la credencial existente**
`WhatsApp Zephora (Envío)` (`eLTQVkWNRXyRbSCz`), en el mismo minuto. No hace
falta tocar el trigger: recibir no usa el token. Va en la misma ventana que
cualquier otro cambio de credenciales; no antes de A2.

## Fase B · Cuándo sí migrar

Quedarse en el portafolio viejo es aceptable mientras siga sano. Se pasa a la
Fase C si pasa **cualquiera** de estas:

- Meta restringe o pide verificar el portafolio `1499356148452488`, o el
  perfil «Zephora Charms» al que estaba atado, y eso alcanza a la WABA.
- Hace falta **verificación del negocio** para algo de WhatsApp (subir el
  límite de mensajes, cuenta oficial con insignia) y el portafolio viejo no se
  puede verificar.
- Se quiere un solo portafolio por orden y hay una semana tranquila. Nunca
  cerca de una fecha comercial.

Antes de migrar conviene probar una alternativa más barata: **compartir la
WABA como socio** con el portafolio nuevo (Cuentas de WhatsApp → la WABA →
**Asignar socio** → ID `1157598043799973`). No mueve el número ni causa tiempo
caído, y deja que el portafolio nuevo la administre. No cambia de quién es la
WABA, así que no resuelve el primer disparador.

## Fase C · Plan B: migrar el número a una WABA del portafolio nuevo

> **Sin verificar contra la documentación oficial vigente.** Desde esta sesión
> no hay acceso a `developers.facebook.com` (bloqueado por la red del
> entorno). Lo de abajo sale de las guías de Meta citadas por proveedores
> (360dialog, YCloud, respond.io) y **hay contradicciones entre ellas** en dos
> puntos clave, marcados ⚠. Antes de ejecutar, leer las páginas oficiales:
> *Migrate phone to a different WABA* y *Migrating phone numbers between
> WABAs programmatically* (Business Management API).

### Lo que dicen las fuentes

| Tema | Qué se sabe |
|---|---|
| Entre portafolios distintos | ⚠ 360dialog: se puede. respond.io: ambas WABA en el mismo portafolio. La guía de Meta habla de origen y destino «asociados a negocios» de dos formas: confirmar cuál aplica |
| Qué se conserva | Número, nombre visible, **calificación de calidad**, **límite de mensajes**, estado de cuenta oficial y plantillas aprobadas de alta calidad (guía de Meta para partners) |
| Plantillas | ⚠ 360dialog: **no** migran entre portafolios. **Asumir que hay que rehacerlas** y tenerlas aprobadas en la WABA nueva antes de migrar |
| Historial de chats | **No** se migra |
| Verificación en dos pasos | Hay que **desactivarla** en el origen antes de migrar (la desactiva el dueño de la WABA de origen: hoy se puede, gracias a A1) |
| Requisitos | Portafolio verificado, WABA de origen y destino aprobadas, nombre visible aprobado, **medio de pago válido**, sitio web en línea (Meta puede revisarlo: zephoracharms.com) |
| Código de verificación | Llega por **SMS o llamada al número**. ⚠ **Hay que confirmar quién tiene la SIM de +57 301 899 0672** y que recibe SMS/llamadas |
| Tiempo caído | Ninguna fuente lo cuantifica. Desde que el número se registra en la WABA nueva hasta que la app nueva queda suscrita, los mensajes entrantes **no llegan a n8n**. Planear 1–2 h en horario muerto |
| Después | Registrar el número en Cloud API (`/register` con PIN nuevo) y suscribir la app a la WABA nueva |

### ¿Hay que recrear la app?

**Sí, en este caso.** El token del bot es app + usuario del sistema, y los
dos son del portafolio viejo. Un usuario del sistema del portafolio nuevo solo
puede generar tokens para apps de su portafolio. Mantener `AGENTE CLAUDE`
obligaría a que el portafolio viejo siga existiendo y sano, y eso es justo lo
que la migración quiere dejar de necesitar. Entonces:

- App nueva en `1157598043799973` (tipo Negocio, producto WhatsApp), con su
  App ID y App Secret.
- Usuario del sistema nuevo con la WABA nueva asignada y token sin caducidad
  (`whatsapp_business_messaging` + `whatsapp_business_management`). Proceso
  en `SKILL.md` § *El token*.

### Orden, pensado para el mínimo tiempo caído

**Preparación (días antes, bot funcionando):**

1. Verificar el portafolio nuevo y ponerle **medio de pago de WhatsApp**.
2. Crear la WABA nueva en `1157598043799973` (Administrador de WhatsApp), con
   el mismo nombre visible.
3. Crear la app nueva y el usuario del sistema nuevo; generar el token.
4. **Rehacer las plantillas** en la WABA nueva y esperar la aprobación:
   `actualizacion_envio` (Skydropx) y las de rescate (`automatizaciones/conversion/PLANTILLA-WHATSAPP.md`).
   Antes, listar las aprobadas en la WABA vieja para no olvidar ninguna.
5. En n8n, crear las **credenciales nuevas, con nombres nuevos** (ver la
   sección n8n). No editar las existentes.
6. Duplicar los workflows de Zephora con WhatsApp, sin publicar, apuntando a
   las credenciales nuevas, o dejar anotado nodo por nodo qué cambia.
7. Confirmar quién tiene la SIM del número y que recibe SMS.

**Ventana (horario muerto, el propietario presente):**

8. Desactivar la verificación en dos pasos del número en la WABA vieja.
9. `POST /{WABA_NUEVA}/phone_numbers` con `cc=57`,
   `phone_number=3018990672`, `migrate_phone_number=true`.
10. `POST /{PHONE_ID}/request_code` (SMS) → `POST /{PHONE_ID}/verify_code`.
11. `POST /{PHONE_ID}/register` con `messaging_product: whatsapp` y un **PIN
    nuevo de 6 dígitos**. Guardarlo fuera del repo. **Aquí empieza el tiempo
    caído real.**
12. Publicar el workflow del bot con la credencial de trigger nueva y luego
    configurar Meta, en el orden de `SKILL.md`: URL de producción + token de
    verificación (id del nodo) → campo `messages` → `POST /{WABA_NUEVA}/subscribed_apps`.
13. Mandar un WhatsApp de verdad y ver el doble check. **Fin del tiempo caído.**
14. Comprobar si el Phone Number ID cambió. Si cambió, actualizarlo donde se
    use (ver n8n) y en `SKILL.md`.

**Después:**

15. Volver a ligar el número a la Página nueva (A5): ahora el número está en
    el mismo portafolio, así que el enlace debería ser directo.
16. Republicar los demás workflows (Skydropx, avisos) y probar una plantilla.
17. Actualizar `SKILL.md` § *Este proyecto*, `ESTADO.md` y este archivo.
18. Dejar la WABA vieja quieta unas semanas antes de limpiar nada.

## n8n: qué depende de WhatsApp y qué habría que rehacer

**En la Fase A no se cambia nada en n8n.** Esta sección es para A7 (rotar
token) y para la Fase C.

### Credenciales

| Credencial | Id | Tipo | Qué lleva |
|---|---|---|---|
| WhatsApp Zephora (Trigger) | `QXq0xmqYb8X870KO` | `whatsAppTriggerApi` | App ID + App Secret de `AGENTE CLAUDE` |
| WhatsApp Zephora (Envío) | `eLTQVkWNRXyRbSCz` | `whatsAppApi` | Token del usuario del sistema + WABA `1868981540432885` |

<!-- INVENTARIO-N8N -->

### Bendito Hogar: no romper a ninguno de los dos

`BH · 4 WhatsApp entrante` (`kRQSErWAkWoAApFk`) es de **otro negocio** y n8n
le asignó sola la credencial de trigger de Zephora. Está **sin publicar**, y
su descripción ya avisa que no se publique así. El riesgo es concreto: una
app de Meta tiene **una sola** URL de webhook, y el nodo WhatsApp Trigger la
reescribe al publicarse. Si BH se publica con la credencial de Zephora, el
webhook de `AGENTE CLAUDE` pasa a apuntar al flujo de BH y **la asesora de
Zephora deja de recibir mensajes** sin ningún error.

Reglas:

1. **Nunca editar en su lugar** las credenciales `QXq0xmqYb8X870KO` y
   `eLTQVkWNRXyRbSCz` para meter datos de otra app: cualquier workflow que
   las tenga se lleva el cambio. Para la Fase C, credenciales **nuevas** con
   nombre nuevo («WhatsApp Zephora v2 (Trigger)», etc.), y se cambian nodo por
   nodo solo en los workflows de Zephora.
2. Antes de publicar cualquier `BH ·` con WhatsApp, su nodo tiene que tener
   una credencial **de la app de Bendito Hogar**. Revisar el nodo, no el
   nombre del workflow.
3. Después de cualquier cambio de credenciales, abrir las dos listas, Zephora
   y BH, y confirmar qué credencial tiene cada nodo de WhatsApp.

## Fuentes

- [Meta · Migrating phone numbers between WABAs programmatically](https://developers.secure.facebook.com/docs/whatsapp/business-management-api/guides/migrating-phone-numbers-between-wabas-programmatically) (no se pudo abrir desde la sesión)
- [Meta · Migrate phone to different WABA](https://developers.secure.facebook.com/docs/whatsapp/business-management-api/guides/migrate-phone-to-different-waba) (ídem)
- [Meta · Migrating phone numbers among Solution Partners programmatically](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/support/migrating-phone-numbers-among-solution-partners-programmatically)
- [360dialog · Migrate a phone number to a new WABA](https://docs.360dialog.com/docs/waba-management/migrating-phone-numbers/migrate-a-phone-number-to-a-new-waba)
- [360dialog · Moving numbers between Business Managers](https://docs.360dialog.com/docs/hub/migrations/moving-numbers-between-business-managers)
- [respond.io · Phone number migration to WhatsApp Cloud API](https://respond.io/help/whatsapp/phone-number-migration-to-whatsapp-cloud-api)
- [YCloud · Number migration](https://helpdocs.ycloud.com/help-center/whatsapp-accounts-management/create-a-whatsapp-api-account/number-migration)
- [360dialog · How to add a WhatsApp number to your Facebook Page](https://docs.360dialog.com/performance-messaging/setting-up/how-to-add-a-whatsapp-number-to-your-facebook-page)
- [Blip · How to connect your WhatsApp number to your Facebook Page](https://help.blip.ai/hc/en-us/articles/4474390954263-How-to-connect-your-WhatsApp-number-to-your-Facebook-Page)
