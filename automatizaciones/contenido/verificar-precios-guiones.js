#!/usr/bin/env node
'use strict';
/* Comprueba que los precios escritos en CALENDARIO-EDITORIAL.md y CLAUDE.md
 * se reproducen con calcular() de netlify/functions/_precios.js.
 *
 * Por qué existe: el 2026-09-07 el calendario afirmaba estar «verificado
 * corriendo calcular(), no de memoria» y sus tres números centrales
 * —$205.200 / $237.800 / tercer dije $32.600— no salían de ahí. El guion 5 los
 * repetía en voz alta y estaba programado para grabarse dos días después. Un
 * precio que el checkout desmiente se paga con la clienta.
 *
 * Este archivo SOLO LEE _precios.js. No toca netlify/functions/ (decisión 4 del
 * BRIEF: una sola sesión toca la tienda).
 *
 * Uso:  node automatizaciones/contenido/verificar-precios-guiones.js
 * Sale con código 1 si algún número dejó de cuadrar — por ejemplo porque
 * catalogo.json cambió la escala, el descuento del brazalete o el empaque.
 */
const { calcular, cop } = require('../../netlify/functions/_precios.js');

const total = (base, charms, opts = {}) => calcular({
  base: base ? { id: base, talla: opts.talla || '18' } : null,
  charms,
  pago: opts.pago || 'anticipado',
  empaque: opts.empaque === true,
}).total;

/* Cada fila es una afirmación que está escrita en un documento. Si se añade un
   precio a un guion, se añade aquí — es lo que hace que «verificado» signifique
   algo. */
const AFIRMACIONES = [
  // § 1.1 · la tabla del tercer dije, con dijes de $76.000 sobre Corazón Liso
  ['CALENDARIO § 1.1 · pulsera + 1 dije',
    () => total('pulsera-corazon-liso', ['letra-a']), 149000],
  ['CALENDARIO § 1.1 · pulsera + 2 dijes',
    () => total('pulsera-corazon-liso', ['letra-a', 'letra-b']), 197840],
  ['CALENDARIO § 1.1 · pulsera + 3 dijes',
    () => total('pulsera-corazon-liso', ['letra-a', 'letra-b', 'letra-d']), 234400],
  ['CALENDARIO § 1.1 · pulsera + 4 dijes',
    () => total('pulsera-corazon-liso', ['letra-a', 'letra-b', 'letra-d', 'letra-e']), 268600],
  ['CALENDARIO § 1.1 + CLAUDE.md · el tercer dije de $76.000',
    () => total('pulsera-corazon-liso', ['letra-a', 'letra-b', 'letra-d'])
        - total('pulsera-corazon-liso', ['letra-a', 'letra-b']), 36560],

  // § 1.3 · el combo con empaque, en sus dos bases
  ['CALENDARIO § 1.3 · Corazón Liso + 3 dijes + empaque',
    () => total('pulsera-corazon-liso', ['letra-a', 'letra-b', 'letra-d'], { empaque: true }), 274400],

  // GUION 5 · el orden importa: los dos primeros son de $72.000 y letra-e ($76.000) va de tercera
  ['GUION 5 · 2 dijes',
    () => total('pulsera-corazon-liso', ['esfera-azul-con-cristales', 'atrapasuenos-corazon-multicolor']), 190480],
  ['GUION 5 · 3 dijes',
    () => total('pulsera-corazon-liso', ['esfera-azul-con-cristales', 'atrapasuenos-corazon-multicolor', 'letra-e']), 227600],
  ['GUION 5 · lo que costó la letra-e de tercera',
    () => total('pulsera-corazon-liso', ['esfera-azul-con-cristales', 'atrapasuenos-corazon-multicolor', 'letra-e'])
        - total('pulsera-corazon-liso', ['esfera-azul-con-cristales', 'atrapasuenos-corazon-multicolor']), 37120],

  // GUION 6 · corona-pave + tres dijes de $76.000 + empaque
  ['GUION 6 · corona-pavé + 3 dijes + empaque',
    () => total('pulsera-corona-pave', ['letra-o', 'virgen-maria', 'manos-orando-con-cruz'], { empaque: true }), 281400],

  // GUION 3 · Marvel sobre la Clásica (talla 20-21), este siempre estuvo bien
  ['GUION 3 · Clásica + Iron Man, Hulk y escudo',
    () => total('pulsera-clasica-cierre-barril', ['iron-man', 'hulk', 'escudo-capitan-america'], { talla: '20' }), 257350],
];

/* «Menos de la mitad» es el gancho hablado de los guiones 2 y 5. Es una
   afirmación distinta de un total: hay que comprobar la desigualdad, no la
   igualdad, porque es lo que se dice en cámara. */
const DESIGUALDADES = [
  ['GUION 5 · «menos de la mitad» (letra-e de tercera)',
    () => total('pulsera-corazon-liso', ['esfera-azul-con-cristales', 'atrapasuenos-corazon-multicolor', 'letra-e'])
        - total('pulsera-corazon-liso', ['esfera-azul-con-cristales', 'atrapasuenos-corazon-multicolor']), 76000 / 2],
  ['GUION 2 · «menos de la mitad» (dije genérico de $76.000)',
    () => total('pulsera-corazon-liso', ['letra-a', 'letra-b', 'letra-d'])
        - total('pulsera-corazon-liso', ['letra-a', 'letra-b']), 76000 / 2],
];

let fallos = 0;

for (const [etiqueta, calc, esperado] of AFIRMACIONES) {
  const real = calc();
  if (real === esperado) {
    console.log(`ok    ${etiqueta} — ${cop(real)}`);
  } else {
    fallos++;
    console.error(`FALLA ${etiqueta}\n      documentado ${cop(esperado)} · calcular() da ${cop(real)}`
      + ` · diferencia ${cop(real - esperado)}`);
  }
}

for (const [etiqueta, calc, tope] of DESIGUALDADES) {
  const real = calc();
  if (real < tope) {
    console.log(`ok    ${etiqueta} — ${cop(real)} < ${cop(tope)}`);
  } else {
    fallos++;
    console.error(`FALLA ${etiqueta}\n      ${cop(real)} ya NO es menos de ${cop(tope)}:`
      + ' el gancho hablado dejó de ser cierto');
  }
}

const n = AFIRMACIONES.length + DESIGUALDADES.length;
if (fallos) {
  console.error(`\n${fallos} de ${n} afirmaciones ya no cuadran.`
    + ' Corregir los documentos ANTES de grabar o publicar.');
  process.exit(1);
}
console.log(`\n${n} afirmaciones verificadas contra calcular(). Todo cuadra.`);
