# Envío-estado (Skydropx → WhatsApp) — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir `netlify/functions/envio-estado.mjs`, el endpoint que n8n
llama después de reconocer un correo de Skydropx, para que WhatsApp pueda
avisarle a la clienta del estado de su envío sin que el endpoint exponga datos
personales a nadie más.

**Architecture:** Un endpoint nuevo, aislado del resto de `netlify/functions/`,
protegido por una clave compartida en un header. Reutiliza `leer()`/`marcar()`
de `_pedidos.mjs` para correlacionar por `referencia` y anotar el historial de
envíos (anti-duplicados), y `enviar()`/`correoTienda()` de `_correo.js` para
avisar a la tienda cuando el evento es una incidencia. El texto que verá la
clienta vive en un módulo nuevo, `_envios.mjs`, separado del endpoint.

**Tech Stack:** Netlify Functions (V2, `export default async (req) => Response`),
Node ESM (`.mjs`) con interop hacia `_correo.js` (CommonJS), sin dependencias
nuevas. Pruebas: scripts Node planos con los mismos helpers `ok`/`mal`/`comprobar`
que ya usa `pruebas/armar-carrito.js`, sin framework de testing.

**Spec:** [`docs/superpowers/specs/2026-09-18-skydropx-whatsapp-design.md`](../specs/2026-09-18-skydropx-whatsapp-design.md)

## Global Constraints

- El endpoint no toca `index.html`, el checkout, ni ningún otro archivo de
  `netlify/functions/` — solo agrega archivos nuevos.
- Requiere una clave compartida por header (`X-Zephora-Automation-Key`) para
  poder devolver `celular`/`nombre` — `_pedidos.mjs` documenta a propósito que
  esos datos no se exponen sin protección. La clave vive en la variable de
  entorno `ENVIO_ESTADO_KEY`.
- `evento` es una lista cerrada de exactamente seis códigos
  (`creada`, `recogido`, `en_transito`, `en_reparto`, `entregado`, `excepcion`)
  — nunca texto libre de Skydropx.
- El texto que lee la clienta (`textoEstado`) vive en código, en `_envios.mjs`
  — nunca se construye en el endpoint ni se espera que n8n lo escriba.
- Reutiliza `leer()`/`marcar()` de `_pedidos.mjs` — nunca un lector o escritor
  de Blobs propio.
- El endpoint **no manda WhatsApp**: solo devuelve los datos que n8n necesita
  para hacerlo con la plantilla ya aprobada.
- Anti-duplicados por `(referencia, evento)`: el mismo evento del mismo pedido
  nunca se anota ni se avisa dos veces.
- `excepcion` dispara además un correo a la tienda, reusando `enviar()`/
  `correoTienda()` de `_correo.js` — nunca un envío de correo aparte.
- Fuera de alcance: pedidos con más de una guía, botón de acción en la
  plantilla de Meta, reintentos automáticos si WhatsApp falla al mandar.
- **Ninguna prueba puede mandar un correo real.** Cualquier prueba que ejerza
  el camino de `excepcion` (que llama a `enviar()`) tiene que forzar
  `process.env.RESEND_API_KEY = ''` primero y restaurar el valor original al
  terminar — igual que ya hacen `pruebas/rescate.js` y `pruebas/checkout.js` —
  porque si quien corre la prueba tiene una llave real puesta en su entorno,
  sin ese cuidado saldría un correo de verdad a la tienda por un pedido de
  prueba.

---

## Task 1: `_envios.mjs` — eventos canónicos y textos para la clienta

**Files:**
- Create: `netlify/functions/_envios.mjs`
- Create: `pruebas/envio-estado.js`
- Modify: `pruebas/correr.sh:39` (agrega `envio-estado` a la lista de baterías, al final)
- Modify: `pruebas/README.md` (agrega una fila a la tabla de baterías)

**Interfaces:**
- Produces: `EVENTOS` (array de 6 strings) y `TEXTOS` (objeto `{ [evento]: string }`)
  desde `netlify/functions/_envios.mjs` — Task 2 los importa.

- [ ] **Step 1: Escribir `netlify/functions/_envios.mjs`**

```js
'use strict';
/* Los seis estados de envío que Skydropx puede reportar, y el texto exacto
 * que lee la clienta por cada uno — en código, no en el workflow de n8n. Así,
 * si Skydropx cambia cómo redacta sus correos, lo que hay que ajustar es el
 * reconocimiento del correo en n8n; lo que la clienta lee no se toca.
 */
const EVENTOS = ['creada', 'recogido', 'en_transito', 'en_reparto', 'entregado', 'excepcion'];

const TEXTOS = {
  creada: 'Tu pedido ya tiene guía de envío y va a ser recogido.',
  recogido: 'Tu pedido fue recogido y va en camino.',
  en_transito: 'Tu pedido está en camino.',
  en_reparto: 'Tu pedido llega hoy — está en la última etapa del envío.',
  entregado: '¡Tu pedido fue entregado! Esperamos que lo disfrutes 💛',
  excepcion: 'Hay una novedad con tu envío. Te contactamos por WhatsApp o correo en breve.',
};

export { EVENTOS, TEXTOS };
```

- [ ] **Step 2: Crear `pruebas/envio-estado.js` con la primera sección**

```js
'use strict';
/* Confirmación y estado de envío por WhatsApp (Skydropx) — el endpoint que
 * llama n8n después de reconocer el correo de cada evento.
 *
 * Lo que hay que demostrar no es solo que responda, sino que protege lo que
 * `_pedidos.mjs` documenta a propósito que no hay que exponer sin más: sin la
 * clave correcta, ni se lee el pedido. Y que nunca manda el mismo aviso dos
 * veces para el mismo evento del mismo pedido.
 */
const path = require('path');
const fs = require('fs');

const RAIZ = path.join(__dirname, '..');

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));

async function main() {
  const { EVENTOS, TEXTOS } = await import('../netlify/functions/_envios.mjs');

  console.log('\n1 · Los seis eventos y sus textos');
  {
    comprobar(EVENTOS.length === 6, 'hay exactamente seis eventos canónicos', EVENTOS.join(', '));
    comprobar(EVENTOS.every(e => typeof TEXTOS[e] === 'string' && TEXTOS[e].length > 10),
      'cada evento tiene un texto real para la clienta, no un placeholder');
  }

  console.log(fallos ? `\nEnvío-estado: ${fallos} en rojo` : '\nEnvío-estado en verde ✓');
}

main().catch(e => { console.log('  ✗ FALLA la batería reventó — ' + e.stack); });
```

- [ ] **Step 3: Correr la prueba**

Run: `node pruebas/envio-estado.js`
Expected: `1 · Los seis eventos y sus textos` con dos `✓`, y termina en
`Envío-estado en verde ✓`.

- [ ] **Step 4: Registrar la batería en `pruebas/correr.sh`**

En la línea del `for BATERIA in …`, agregar `envio-estado` al final de la
lista:

```bash
for BATERIA in regresion stock dudas precios inventario disponibilidad pedidos rescate correo-tienda hoja reponer meta enlace reanudar armar-carrito checkout envio-estado; do
```

- [ ] **Step 5: Agregar la fila a `pruebas/README.md`**

En la tabla de "Qué cubre cada una", después de la fila de `checkout.js`,
agregar:

```markdown
| `envio-estado.js` | El endpoint que llama n8n al reconocer un correo de Skydropx: que sin la clave por header no se lea ni un pedido, que un `evento` fuera de los seis canónicos o una `referencia` que no existe nunca disparen un aviso, que el mismo evento del mismo pedido no se anote ni se avise dos veces, y que una incidencia dispare también un correo a la tienda |
```

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/_envios.mjs pruebas/envio-estado.js pruebas/correr.sh pruebas/README.md
git commit -m "feat: eventos canónicos y textos de envío para WhatsApp (Skydropx)"
```

---

## Task 2: `envio-estado.mjs` — método, clave y validación del cuerpo

**Files:**
- Create: `netlify/functions/envio-estado.mjs`
- Modify: `pruebas/envio-estado.js` (reemplazo completo de `main()`, mostrado abajo)

**Interfaces:**
- Consumes: `EVENTOS` desde `./_envios.mjs` (Task 1).
- Produces: `export default async (req) => Response` — el handler de Netlify,
  con la forma `req = { method, headers, text() }` que ya usan
  `armar-carrito.mjs` y `reanudar.mjs`. Tasks 3 y 4 completan el cuerpo de esta
  misma función.

- [ ] **Step 1: Escribir el test que falla — método y clave**

Reemplazar por completo el cuerpo de `pruebas/envio-estado.js` desde
`async function main() {` hasta el `main().catch(...)` final por esta
versión:

```js
async function main() {
  const { EVENTOS, TEXTOS } = await import('../netlify/functions/_envios.mjs');
  const CLAVE = 'clave-de-prueba-treinta-y-dos-c';
  process.env.ENVIO_ESTADO_KEY = CLAVE;
  const mod = await import('../netlify/functions/envio-estado.mjs');

  const REFERENCIA = 'ZC-260918-TESTCASE';
  const CUERPO_VALIDO = {
    referencia: REFERENCIA, evento: 'creada',
    guia: 'SKX-1', transportadora: 'Interrapidísimo', urlSeguimiento: 'https://x.test/1',
  };

  const pedir = async (cuerpo, { metodo = 'POST', clave = CLAVE } = {}) => {
    const headers = new Headers();
    if (clave !== null) headers.set('x-zephora-automation-key', clave);
    const r = await mod.default({ method: metodo, headers, text: async () => JSON.stringify(cuerpo) });
    const texto = await r.text();
    return { r, d: texto ? JSON.parse(texto) : null };
  };

  console.log('\n1 · Los seis eventos y sus textos');
  {
    comprobar(EVENTOS.length === 6, 'hay exactamente seis eventos canónicos', EVENTOS.join(', '));
    comprobar(EVENTOS.every(e => typeof TEXTOS[e] === 'string' && TEXTOS[e].length > 10),
      'cada evento tiene un texto real para la clienta, no un placeholder');
  }

  console.log('\n2 · Solo POST, y solo con la clave correcta');
  {
    const { r: metodoMalo } = await pedir(CUERPO_VALIDO, { metodo: 'GET' });
    comprobar(metodoMalo.status === 405, 'GET no está permitido', String(metodoMalo.status));

    const { r: sinClave } = await pedir(CUERPO_VALIDO, { clave: null });
    comprobar(sinClave.status === 401, 'sin header de clave, 401', String(sinClave.status));

    const { r: claveMala } = await pedir(CUERPO_VALIDO, { clave: 'otra-clave-cualquiera' });
    comprobar(claveMala.status === 401, 'con la clave equivocada, también 401', String(claveMala.status));
  }

  console.log('\n3 · Validación del cuerpo');
  {
    const { referencia, ...sinReferencia } = CUERPO_VALIDO;
    const { r: faltaCampo, d: dFaltaCampo } = await pedir(sinReferencia);
    comprobar(faltaCampo.status === 400, 'sin referencia, 400', String(faltaCampo.status));
    comprobar(typeof dFaltaCampo.error === 'string', 'con un mensaje de error, no un cuerpo vacío');

    const { r: eventoRaro } = await pedir(Object.assign({}, CUERPO_VALIDO, { evento: 'perdido' }));
    comprobar(eventoRaro.status === 400, 'evento fuera de la lista cerrada, 400', String(eventoRaro.status));

    const headersOk = new Headers();
    headersOk.set('x-zephora-automation-key', CLAVE);
    const rJsonRoto = await mod.default({ method: 'POST', headers: headersOk, text: async () => '{ esto no es json' });
    comprobar(rJsonRoto.status === 400, 'cuerpo que no es JSON válido, 400', String(rJsonRoto.status));
  }

  console.log(fallos ? `\nEnvío-estado: ${fallos} en rojo` : '\nEnvío-estado en verde ✓');
}

main().catch(e => { console.log('  ✗ FALLA la batería reventó — ' + e.stack); });
```

- [ ] **Step 2: Correr la prueba para verificar que falla**

Run: `node pruebas/envio-estado.js`
Expected: FALLA con `Cannot find module '../netlify/functions/envio-estado.mjs'`
(el archivo todavía no existe).

- [ ] **Step 3: Escribir `netlify/functions/envio-estado.mjs` (versión de esta tarea)**

```js
'use strict';
/* Skydropx solo por panel web, sin API ni webhooks — así que el disparador es
 * el correo que manda por cada evento, correlacionado con el pedido por la
 * referencia que ya se pega a mano al crear la guía. Esto es lo que n8n llama
 * después de reconocer ese correo: valida, busca el pedido, evita mandar el
 * mismo aviso dos veces, y devuelve lo que el nodo de WhatsApp necesita para
 * escribirle a la clienta.
 *
 * ── Por qué pide clave por header, a diferencia de disponibilidad/armar-carrito ──
 *
 * Esos dos no devuelven nada personal: precios y existencias ya son públicos
 * en la tienda. Este sí devuelve celular y nombre — exactamente lo que
 * `_pedidos.mjs` dice a propósito que no hay que exponer sin más en un sitio
 * que cobra. De ahí la clave: sin el header correcto, ni se lee el pedido.
 *
 * ── Qué no hace ──
 *
 * No manda el WhatsApp — eso lo hace n8n con la plantilla ya aprobada por
 * Meta. Esto solo decide a quién, con qué texto exacto, y si ya se avisó
 * antes de este mismo evento para no repetirlo.
 */
import crypto from 'node:crypto';
import { EVENTOS } from './_envios.mjs';

const CABECERAS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const responder = (codigo, cuerpo) =>
  new Response(JSON.stringify(cuerpo), { status: codigo, headers: CABECERAS });

/* Comparación en tiempo constante: una clave que protege celular y nombre de
   clientas no debería filtrarse un carácter a la vez por cuánto tarda la
   respuesta. */
function claveValida(req) {
  const esperada = String(process.env.ENVIO_ESTADO_KEY || '');
  const recibida = String(req.headers.get('x-zephora-automation-key') || '');
  if (!esperada || !recibida) return false;
  const a = Buffer.from(esperada);
  const b = Buffer.from(recibida);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export default async (req) => {
  if (req.method !== 'POST') return responder(405, { error: 'Solo POST' });
  if (!claveValida(req)) return responder(401, { error: 'Clave inválida o ausente' });

  let cuerpo;
  try {
    cuerpo = JSON.parse((await req.text()) || '{}');
  } catch (_) {
    return responder(400, { error: 'El cuerpo no llegó en JSON válido' });
  }

  const { referencia, evento, guia, transportadora, urlSeguimiento } = cuerpo;
  if (!referencia || !guia || !transportadora || !urlSeguimiento) {
    return responder(400, { error: 'Falta referencia, guia, transportadora o urlSeguimiento' });
  }
  if (!EVENTOS.includes(evento)) {
    return responder(400, { error: `evento debe ser uno de: ${EVENTOS.join(', ')}` });
  }

  // Task 3 sigue desde aquí: correlación con el pedido y respuesta.
  return responder(500, { error: 'sin implementar todavía' });
};
```

- [ ] **Step 4: Correr la prueba para verificar que pasa**

Run: `node pruebas/envio-estado.js`
Expected: secciones 1 a 3 en verde, termina en `Envío-estado en verde ✓`
(todavía no hay secciones 4 en adelante).

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/envio-estado.mjs pruebas/envio-estado.js
git commit -m "feat: valida método, clave y cuerpo en envio-estado"
```

---

## Task 3: Correlación con el pedido, respuesta y anti-duplicados

**Files:**
- Modify: `netlify/functions/envio-estado.mjs` (reemplaza el `return responder(500, …)` del final)
- Modify: `pruebas/envio-estado.js` (agrega §4 y §5 dentro de `main()`)

**Interfaces:**
- Consumes: `leer(referencia)` y `marcar(referencia, cambios)` de
  `./_pedidos.mjs` — `leer` devuelve el pedido guardado o `null`; `marcar`
  fusiona `cambios` sobre lo que había y no falla si no existía antes.
  `_pedidos.mjs` expone `_interno.usarAlmacen(store | null)` para inyectar un
  almacén falso en pruebas (mismo patrón que usa `pruebas/armar-carrito.js`
  con `_inventario.mjs`). `TEXTOS` de `./_envios.mjs` (Task 1).
- Produces: cuerpo de la respuesta `200` con
  `{ celular, nombre, evento, textoEstado, guia, transportadora, urlSeguimiento, yaEnviado }`
  — Task 4 lo extiende para disparar el aviso de incidencia sin cambiar esta forma.

- [ ] **Step 1: Escribir el test que falla — referencia, respuesta feliz y anti-duplicados**

Reemplazar por completo `pruebas/envio-estado.js` (mismo archivo de Task 2,
con `almacenFalso`, `PEDIDO` y las secciones 4 y 5 agregadas):

```js
'use strict';
/* Confirmación y estado de envío por WhatsApp (Skydropx) — el endpoint que
 * llama n8n después de reconocer el correo de cada evento.
 *
 * Lo que hay que demostrar no es solo que responda, sino que protege lo que
 * `_pedidos.mjs` documenta a propósito que no hay que exponer sin más: sin la
 * clave correcta, ni se lee el pedido. Y que nunca manda el mismo aviso dos
 * veces para el mismo evento del mismo pedido.
 */
const path = require('path');
const fs = require('fs');

const RAIZ = path.join(__dirname, '..');

let fallos = 0;
const ok = (m, d) => console.log(`  ✓ ${m}${d ? ' — ' + d : ''}`);
const mal = (m, d) => { fallos++; console.log(`  ✗ FALLA ${m}${d ? ' — ' + d : ''}`); };
const comprobar = (c, m, d) => (c ? ok(m, d) : mal(m, d));

/* Imita Netlify Blobs en lo poco que `_pedidos.mjs` usa, igual que
   `pruebas/armar-carrito.js` hace con `_inventario.mjs`. */
function almacenFalso(inicial) {
  const datos = inicial || {};
  return {
    async get(clave) { return datos[clave] ? JSON.parse(JSON.stringify(datos[clave])) : null; },
    async setJSON(clave, valor) { datos[clave] = JSON.parse(JSON.stringify(valor)); return { modified: true }; },
    async delete(clave) { delete datos[clave]; },
    async list() { return { blobs: Object.keys(datos).map(key => ({ key })) }; },
  };
}

const PEDIDO = {
  referencia: 'ZC-260918-TESTCASE',
  cliente: { nombre: 'Valentina', apellido: 'Ríos', celular: '3018990672' },
};

async function main() {
  const { EVENTOS, TEXTOS } = await import('../netlify/functions/_envios.mjs');
  const CLAVE = 'clave-de-prueba-treinta-y-dos-c';
  process.env.ENVIO_ESTADO_KEY = CLAVE;
  const mod = await import('../netlify/functions/envio-estado.mjs');
  const pedidos = await import('../netlify/functions/_pedidos.mjs');

  const CUERPO_VALIDO = {
    referencia: PEDIDO.referencia, evento: 'creada',
    guia: 'SKX-1', transportadora: 'Interrapidísimo', urlSeguimiento: 'https://x.test/1',
  };

  const pedir = async (cuerpo, { metodo = 'POST', clave = CLAVE } = {}) => {
    const headers = new Headers();
    if (clave !== null) headers.set('x-zephora-automation-key', clave);
    const r = await mod.default({ method: metodo, headers, text: async () => JSON.stringify(cuerpo) });
    const texto = await r.text();
    return { r, d: texto ? JSON.parse(texto) : null };
  };

  console.log('\n1 · Los seis eventos y sus textos');
  {
    comprobar(EVENTOS.length === 6, 'hay exactamente seis eventos canónicos', EVENTOS.join(', '));
    comprobar(EVENTOS.every(e => typeof TEXTOS[e] === 'string' && TEXTOS[e].length > 10),
      'cada evento tiene un texto real para la clienta, no un placeholder');
  }

  console.log('\n2 · Solo POST, y solo con la clave correcta');
  {
    const { r: metodoMalo } = await pedir(CUERPO_VALIDO, { metodo: 'GET' });
    comprobar(metodoMalo.status === 405, 'GET no está permitido', String(metodoMalo.status));

    const { r: sinClave } = await pedir(CUERPO_VALIDO, { clave: null });
    comprobar(sinClave.status === 401, 'sin header de clave, 401', String(sinClave.status));

    const { r: claveMala } = await pedir(CUERPO_VALIDO, { clave: 'otra-clave-cualquiera' });
    comprobar(claveMala.status === 401, 'con la clave equivocada, también 401', String(claveMala.status));
  }

  console.log('\n3 · Validación del cuerpo');
  {
    const { referencia, ...sinReferencia } = CUERPO_VALIDO;
    const { r: faltaCampo, d: dFaltaCampo } = await pedir(sinReferencia);
    comprobar(faltaCampo.status === 400, 'sin referencia, 400', String(faltaCampo.status));
    comprobar(typeof dFaltaCampo.error === 'string', 'con un mensaje de error, no un cuerpo vacío');

    const { r: eventoRaro } = await pedir(Object.assign({}, CUERPO_VALIDO, { evento: 'perdido' }));
    comprobar(eventoRaro.status === 400, 'evento fuera de la lista cerrada, 400', String(eventoRaro.status));

    const headersOk = new Headers();
    headersOk.set('x-zephora-automation-key', CLAVE);
    const rJsonRoto = await mod.default({ method: 'POST', headers: headersOk, text: async () => '{ esto no es json' });
    comprobar(rJsonRoto.status === 400, 'cuerpo que no es JSON válido, 400', String(rJsonRoto.status));
  }

  console.log('\n4 · Referencia inexistente o sin celular registrado');
  {
    pedidos._interno.usarAlmacen(almacenFalso({}));
    const { r: sinPedido } = await pedir(CUERPO_VALIDO);
    comprobar(sinPedido.status === 404, 'referencia que no existe, 404 — nunca se adivina a quién avisar',
      String(sinPedido.status));

    pedidos._interno.usarAlmacen(almacenFalso({ 'ZC-SIN-CLIENTE': { referencia: 'ZC-SIN-CLIENTE' } }));
    const { r: sinCliente } = await pedir(Object.assign({}, CUERPO_VALIDO, { referencia: 'ZC-SIN-CLIENTE' }));
    comprobar(sinCliente.status === 404, 'pedido sin celular registrado todavía, también 404',
      String(sinCliente.status));
  }

  console.log('\n5 · Caso válido por evento, y anti-duplicados');
  {
    /* "excepcion" queda fuera de este bucle a propósito: dispara un correo a
       la tienda (Task 4), y ese camino solo se ejerce en § 6, donde
       RESEND_API_KEY queda forzada a vacía para no arriesgar un envío real. */
    pedidos._interno.usarAlmacen(almacenFalso({ [PEDIDO.referencia]: PEDIDO }));
    const eventosSinExcepcion = EVENTOS.filter(e => e !== 'excepcion');

    for (const evento of eventosSinExcepcion) {
      const cuerpo = { referencia: PEDIDO.referencia, evento,
        guia: 'SKX-' + evento, transportadora: 'Coordinadora', urlSeguimiento: 'https://x.test/' + evento };
      const { r, d } = await pedir(cuerpo);
      comprobar(r.status === 200, `evento "${evento}", 200`, String(r.status));
      comprobar(d.textoEstado === TEXTOS[evento],
        `evento "${evento}" devuelve exactamente el texto de _envios.mjs, no uno inventado aquí`);
      comprobar(d.celular === PEDIDO.cliente.celular && d.nombre === PEDIDO.cliente.nombre,
        `evento "${evento}" trae el celular y el nombre del pedido guardado`);
      comprobar(d.yaEnviado === false, `evento "${evento}", primera vez, yaEnviado es false`);
    }

    const repetido = { referencia: PEDIDO.referencia, evento: 'en_transito',
      guia: 'SKX-en_transito', transportadora: 'Coordinadora', urlSeguimiento: 'https://x.test/en_transito' };
    const { r: segunda, d: d2 } = await pedir(repetido);
    comprobar(segunda.status === 200, 'repetir el mismo evento sigue respondiendo 200', String(segunda.status));
    comprobar(d2.yaEnviado === true, 'pero avisa que ya se había mandado — n8n no debe repetir el WhatsApp');

    const guardado = await pedidos.leer(PEDIDO.referencia);
    comprobar(Array.isArray(guardado.envios) && guardado.envios.length === eventosSinExcepcion.length,
      'cada evento distinto se guarda una sola vez, y repetir uno no agrega una fila más',
      String(guardado.envios.length));
  }

  pedidos._interno.usarAlmacen(null);
  console.log(fallos ? `\nEnvío-estado: ${fallos} en rojo` : '\nEnvío-estado en verde ✓');
}

main().catch(e => { console.log('  ✗ FALLA la batería reventó — ' + e.stack); });
```

- [ ] **Step 2: Correr la prueba para verificar que falla**

Run: `node pruebas/envio-estado.js`
Expected: §4 y §5 en rojo (el endpoint todavía responde `500` para cualquier
cuerpo válido).

- [ ] **Step 3: Completar `netlify/functions/envio-estado.mjs`**

Cambiar el import de arriba:

```js
import crypto from 'node:crypto';
import { leer, marcar } from './_pedidos.mjs';
import { EVENTOS, TEXTOS } from './_envios.mjs';
```

Y reemplazar la línea final (`// Task 3 sigue desde aquí…` y el `return
responder(500, …)`) por:

```js
  const pedido = await leer(referencia);
  if (!pedido || !pedido.cliente || !pedido.cliente.celular) {
    return responder(404, { error: 'No existe un pedido con celular registrado para esa referencia' });
  }

  const envios = pedido.envios || [];
  const yaEnviado = envios.some(e => e.evento === evento);

  if (!yaEnviado) {
    await marcar(referencia, {
      envios: [...envios, {
        evento, guia, transportadora, urlSeguimiento,
        notificadoEn: new Date().toISOString(),
      }],
    });
  }

  return responder(200, {
    celular: pedido.cliente.celular,
    nombre: pedido.cliente.nombre,
    evento,
    textoEstado: TEXTOS[evento],
    guia, transportadora, urlSeguimiento,
    yaEnviado,
  });
};
```

- [ ] **Step 4: Correr la prueba para verificar que pasa**

Run: `node pruebas/envio-estado.js`
Expected: secciones 1 a 5 en verde, termina en `Envío-estado en verde ✓`.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/envio-estado.mjs pruebas/envio-estado.js
git commit -m "feat: correlaciona por referencia y evita avisar dos veces el mismo evento"
```

---

## Task 4: Incidencia → aviso a la tienda

**Files:**
- Modify: `netlify/functions/envio-estado.mjs` (agrega `avisarIncidencia` y su llamada)
- Modify: `pruebas/envio-estado.js` (agrega §6 dentro de `main()`, antes de `usarAlmacen(null)`)

**Interfaces:**
- Consumes: `enviar({ para, asunto, html, txt })` y `correoTienda()` de
  `./_correo.js` — `enviar` es un `import` con nombre desde un módulo
  CommonJS (mismo patrón que ya usan `crear-pago.mjs` y `rescate.mjs`);
  devuelve `{ enviado: boolean, motivo? }` y, sin `RESEND_API_KEY` puesta,
  no manda nada y **no lanza**, solo deja constancia en `console.log`
  con el texto `no se manda correo`. `correoTienda()` devuelve `{ para, defecto }`.

- [ ] **Step 1: Escribir el test que falla — incidencia avisa a la tienda**

En `pruebas/envio-estado.js`, insertar esta sección entre el cierre de la
sección 5 (`}`) y la línea `pedidos._interno.usarAlmacen(null);`:

```js
  console.log('\n6 · Una incidencia avisa también a la tienda');
  {
    pedidos._interno.usarAlmacen(almacenFalso({ [PEDIDO.referencia]: PEDIDO }));

    /* Ver la constante de "Global Constraints": sin esto, quien tenga una
       RESEND_API_KEY real puesta en su entorno mandaría un correo de verdad. */
    const llaveAntes = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = '';
    const original = console.log;
    const capturado = [];
    console.log = (...args) => { capturado.push(args.join(' ')); };

    const { r, d } = await pedir({ referencia: PEDIDO.referencia, evento: 'excepcion',
      guia: 'SKX-9', transportadora: 'Coordinadora', urlSeguimiento: 'https://x.test/9' });

    console.log = original;
    if (llaveAntes === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = llaveAntes;

    comprobar(r.status === 200, 'una incidencia sigue respondiendo 200 a n8n', String(r.status));
    comprobar(d.textoEstado === TEXTOS.excepcion, 'con el texto neutro de excepcion, no uno alarmante inventado aquí');
    comprobar(capturado.some(l => l.includes('no se manda correo')),
      'sin RESEND_API_KEY en la prueba, intenta avisar a la tienda y lo deja escrito en el log');
  }
```

- [ ] **Step 2: Correr la prueba para verificar que falla**

Run: `node pruebas/envio-estado.js`
Expected: §6 en rojo — la comprobación de `capturado.some(...)` falla porque
nada llama a `enviar()` todavía cuando el evento es `excepcion`.

- [ ] **Step 3: Agregar `avisarIncidencia` a `netlify/functions/envio-estado.mjs`**

Agregar el import (junto a los que ya están):

```js
import { enviar, correoTienda } from './_correo.js';
```

Agregar esta función, entre `claveValida` y `export default async (req) => {`:

```js
/* Aviso a la tienda cuando Skydropx reporta una incidencia — una excepción de
   envío necesita que alguien la resuelva, no solo que la clienta se entere. */
async function avisarIncidencia({ referencia, guia, transportadora, urlSeguimiento, cliente }) {
  const { para } = correoTienda();
  const txt = [
    `El pedido ${referencia} tiene una incidencia de envío reportada por Skydropx.`,
    `Guía: ${guia}`,
    `Transportadora: ${transportadora}`,
    `Seguimiento: ${urlSeguimiento}`,
    `Clienta: ${cliente.nombre} ${cliente.apellido || ''} · Cel. ${cliente.celular}`,
  ].join('\n');
  return enviar({ para, asunto: `Incidencia de envío · ${referencia}`, html: `<pre>${txt}</pre>`, txt });
}
```

Y cambiar el bloque `if (!yaEnviado) { … }` dentro de `export default async
(req) => { … }` a:

```js
  if (!yaEnviado) {
    await marcar(referencia, {
      envios: [...envios, {
        evento, guia, transportadora, urlSeguimiento,
        notificadoEn: new Date().toISOString(),
      }],
    });
    if (evento === 'excepcion') {
      await avisarIncidencia({ referencia, guia, transportadora, urlSeguimiento, cliente: pedido.cliente });
    }
  }
```

- [ ] **Step 4: Correr la prueba para verificar que pasa**

Run: `node pruebas/envio-estado.js`
Expected: secciones 1 a 6 en verde.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/envio-estado.mjs pruebas/envio-estado.js
git commit -m "feat: una incidencia de envío también avisa a la tienda por correo"
```

---

## Task 5: Forma del código, ruta amigable y batería completa

**Files:**
- Modify: `pruebas/envio-estado.js` (agrega §7 dentro de `main()`, antes de `usarAlmacen(null)`)
- Modify: `netlify.toml` (agrega la ruta `/envio-estado`, después del bloque de `/armar-carrito`)

**Interfaces:**
- No agrega interfaces nuevas — esta tarea verifica la forma del código ya
  escrito en las tareas 2 a 4 y conecta la ruta pública, sin tocar el
  contrato que ya usan.

- [ ] **Step 1: Escribir la comprobación de forma**

En `pruebas/envio-estado.js`, insertar esta sección entre el cierre de la
sección 6 (`}`) y la línea `pedidos._interno.usarAlmacen(null);`:

```js
  console.log('\n7 · Forma del código');
  {
    const codigo = fs.readFileSync(path.join(RAIZ, 'netlify', 'functions', 'envio-estado.mjs'), 'utf8');
    comprobar(/from '\.\/_pedidos\.mjs'/.test(codigo) && /\bleer\(/.test(codigo) && /\bmarcar\(/.test(codigo),
      'usa leer/marcar de _pedidos.mjs — no un lector ni un escritor propios');
    comprobar(/timingSafeEqual/.test(codigo),
      'compara la clave en tiempo constante, no con === directo');
  }
```

- [ ] **Step 2: Correr la prueba y confirmar que ya pasa**

Run: `node pruebas/envio-estado.js`
Expected: las 7 secciones en verde, termina en `Envío-estado en verde ✓`. No
hace falta tocar `envio-estado.mjs` — el código de las tareas 2 y 4 ya usa
`leer`/`marcar` y `timingSafeEqual`. Si algo sale en rojo aquí, alguna tarea
anterior quedó a medias: revisar antes de seguir.

- [ ] **Step 3: Agregar la ruta amigable en `netlify.toml`**

Después del bloque de `/armar-carrito` (el de "El que arma un carrito para
el bot de WhatsApp…"), agregar:

```toml
# El que recibe el aviso de estado de envío desde n8n, después de que n8n
# reconoce un correo de Skydropx. Va con nombre propio por el mismo motivo
# que /armar-carrito: lo llama n8n desde un workflow y se lee en su
# configuración. Protegido por header —no por la URL—, ver envio-estado.mjs.
[[redirects]]
  from = "/envio-estado"
  to = "/.netlify/functions/envio-estado"
  status = 200
```

- [ ] **Step 4: Correr la batería completa del repo**

Run: `./pruebas/correr.sh`
Expected: `Todo en verde.` — confirma que `envio-estado` corre dentro de la
lista completa (Task 1, Step 4) sin romper ninguna de las otras baterías.

- [ ] **Step 5: Commit**

```bash
git add pruebas/envio-estado.js netlify.toml
git commit -m "test: forma del código de envio-estado y ruta amigable /envio-estado"
```

---

## Qué queda fuera de este plan (a propósito)

- El workflow de n8n (Email Trigger, reconocimiento del correo de Skydropx,
  nodo de WhatsApp): depende de los correos de muestra que el propietario
  todavía está recolectando (spec § 5). No es código de este repo.
- Poner `ENVIO_ESTADO_KEY` en Netlify (Site settings → Environment variables)
  y la misma clave como credencial Header Auth en n8n: es configuración del
  propietario, no un paso de este plan.
- Redactar y mandar a aprobación la plantilla `actualizacion_envio` en Meta
  (spec § 4): administración de cuenta, no código.
