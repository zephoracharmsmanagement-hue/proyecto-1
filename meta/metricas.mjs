#!/usr/bin/env node
// Rendimiento de campañas: gasto, CPA, ROAS, CTR, CPM.
//
//   node meta/metricas.mjs                      # últimos 30 días
//   node meta/metricas.mjs today
//   node meta/metricas.mjs last_7d adset        # nivel adset o ad
//
// Solo lectura. No cambia presupuestos ni pausa nada.

import { api, todas, titulo, tabla, money, num, correr } from './lib.mjs';

const periodo = process.argv[2] || 'last_30d';
const nivel = process.argv[3] || 'campaign';

// De todas las acciones que devuelve Meta, estas son las del embudo de Zephora.
const CONVERSION = ['lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped'];

const cuentaDe = (a) => a.find((x) => CONVERSION.includes(x.action_type));

await correr(async () => {
  let cuentas = process.env.META_AD_ACCOUNT_ID
    ? [{ id: process.env.META_AD_ACCOUNT_ID, name: '(del .env)', currency: 'COP' }]
    : await todas('/me/adaccounts', { fields: 'id,name,currency' });

  if (!cuentas.length) {
    console.log('\nNo hay cuentas publicitarias visibles para este token.\n');
    return;
  }

  for (const cuenta of cuentas) {
    titulo(`${cuenta.name} · ${cuenta.id} · ${periodo} · nivel ${nivel}`);

    const filas = await todas(`/${cuenta.id}/insights`, {
      level: nivel,
      date_preset: periodo,
      fields: [
        'campaign_name', 'adset_name', 'ad_name',
        'spend', 'impressions', 'clicks', 'ctr', 'cpm', 'cpc',
        'actions', 'purchase_roas',
      ].join(','),
      limit: 100,
    });

    if (!filas.length) {
      console.log('  Sin datos en este periodo. Puede que no haya campañas activas todavía.');
      continue;
    }

    const mon = cuenta.currency || 'COP';
    let gastoTotal = 0;
    let convTotal = 0;

    const salida = filas.map((f) => {
      const gasto = Number(f.spend || 0);
      const conv = Number(cuentaDe(f.actions || [])?.value || 0);
      const roas = f.purchase_roas?.[0]?.value;
      gastoTotal += gasto;
      convTotal += conv;
      return {
        nombre: (f.ad_name || f.adset_name || f.campaign_name || '—').slice(0, 34),
        gasto: money(gasto, mon),
        conv: num(conv),
        CPA: conv ? money(gasto / conv, mon) : '—',
        ROAS: roas ? Number(roas).toFixed(2) : '—',
        CTR: f.ctr ? `${Number(f.ctr).toFixed(2)}%` : '—',
        CPM: money(f.cpm, mon),
      };
    });

    // Lo peor primero: donde se está yendo la plata sin retorno.
    salida.sort((a, b) => (a.CPA === '—' ? -1 : b.CPA === '—' ? 1 : 0));
    tabla(salida);

    console.log(`\n  Total: ${money(gastoTotal, mon)} · ${num(convTotal)} conversiones` +
      (convTotal ? ` · CPA ${money(gastoTotal / convTotal, mon)}` : ''));

    const sinConv = salida.filter((s) => s.conv === '0');
    if (sinConv.length) {
      console.log(`  ⚠ ${sinConv.length} con gasto y cero conversiones — candidatas a pausar o revisar.`);
    }
  }

  console.log('\n  Para cambiar presupuestos o pausar, dímelo y te preparo el payload');
  console.log('  antes de ejecutar nada (los scripts de este repo no escriben).');
});
