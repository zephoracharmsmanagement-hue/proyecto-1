#!/usr/bin/env node
// Primera prueba: ¿el token sirve, y a qué da acceso?
//
//   node meta/verificar.mjs
//
// Solo lectura. No modifica nada.

import { api, todas, titulo, tabla, fecha, money, correr } from './lib.mjs';

const ESTADOS = {
  1: 'activa', 2: 'deshabilitada', 3: 'sin método de pago',
  7: 'en revisión', 9: 'periodo de gracia', 100: 'cerrada',
};

await correr(async () => {
  // 1. ¿Es válido el token, y qué permisos trae?
  titulo('Token');
  const { data: info } = await api('/debug_token', {
    input_token: process.env.META_ACCESS_TOKEN,
  });

  if (!info?.is_valid) {
    console.log('  ✗ El token NO es válido. Genera uno nuevo antes de seguir.');
    process.exit(1);
  }

  console.log(`  válido      sí`);
  console.log(`  tipo        ${info.type || '—'}`);
  console.log(`  app         ${info.application || '—'} (${info.app_id || '—'})`);
  console.log(`  expira      ${info.expires_at ? fecha(info.expires_at) : 'no expira'}`);
  if (info.data_access_expires_at) {
    console.log(`  datos hasta ${fecha(info.data_access_expires_at)}`);
  }

  const permisos = info.scopes || [];
  console.log(`  permisos    ${permisos.length ? permisos.join(', ') : '(ninguno)'}`);

  // Avisa de lo que falta para las tareas que nos importan.
  const necesarios = {
    ads_read: 'leer métricas de campañas',
    ads_management: 'crear/pausar campañas',
    business_management: 'ver activos del negocio',
    catalog_management: 'sincronizar catálogo',
    leads_retrieval: 'extraer leads de formularios',
    whatsapp_business_management: 'operar WhatsApp Business',
  };
  const faltan = Object.entries(necesarios).filter(([p]) => !permisos.includes(p));
  if (faltan.length) {
    console.log('\n  Permisos ausentes (cada uno limita una función):');
    faltan.forEach(([p, para]) => console.log(`    · ${p} — ${para}`));
  }

  // 2. ¿Quién es el dueño del token?
  titulo('Usuario');
  const yo = await api('/me', { fields: 'id,name' });
  console.log(`  ${yo.name || '(sin nombre)'} · id ${yo.id}`);

  // 3. Portafolios comerciales
  titulo('Portafolios comerciales');
  const negocios = await todas('/me/businesses', { fields: 'id,name,verification_status' });
  tabla(negocios.map((b) => ({
    nombre: b.name, id: b.id, verificación: b.verification_status || '—',
  })));

  // 4. Cuentas publicitarias — aquí es donde se gasta el dinero
  titulo('Cuentas publicitarias');
  const cuentas = await todas('/me/adaccounts', {
    fields: 'id,name,account_status,currency,amount_spent,balance',
  });
  tabla(cuentas.map((c) => ({
    nombre: c.name,
    id: c.id,
    estado: ESTADOS[c.account_status] || `código ${c.account_status}`,
    moneda: c.currency,
    gastado: money(c.amount_spent, c.currency),
  })));

  if (!cuentas.length) {
    console.log('\n  Sin cuentas publicitarias visibles. Si esperabas alguna, al token');
    console.log('  le falta ads_read, o el usuario no está asignado a la cuenta.');
  }

  // 5. Pixeles, con lo único que de verdad importa hoy: ¿han recibido algo?
  titulo('Pixeles / conjuntos de datos');
  const vistos = new Set();
  const pixeles = [];
  for (const b of negocios) {
    let lista = [];
    try {
      lista = await todas(`/${b.id}/adspixels`, { fields: 'id,name,last_fired_time' });
    } catch {
      continue; // sin permiso sobre este negocio: seguimos con el resto
    }
    for (const p of lista) {
      if (vistos.has(p.id)) continue;
      vistos.add(p.id);
      pixeles.push({ nombre: p.name, id: p.id, 'último evento': fecha(p.last_fired_time) });
    }
  }
  tabla(pixeles);

  const mudos = pixeles.filter((p) => p['último evento'] === 'nunca');
  if (mudos.length) {
    console.log(`\n  ${mudos.length} pixel(es) sin recibir un solo evento.`);
    console.log('  Normal si el sitio aún no está publicado con el pixel correcto.');
  }

  console.log('\n✓ Token operativo.');
});
