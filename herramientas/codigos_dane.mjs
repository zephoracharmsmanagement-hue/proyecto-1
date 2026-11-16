#!/usr/bin/env node
/* Arma assets/codigos-dane.json: el código DANE (DIVIPOLA, 5 dígitos) de cada
 * ciudad que ofrece el checkout en assets/colombia.json.
 *
 * Por qué existe: Skydropx Colombia cotiza por código, y el checkout no pide
 * ninguno (casi nadie se sabe el suyo). Comprobado con cotizaciones el
 * 2026-11-15: Skydropx acepta el código DANE del municipio (`05001`, y también
 * el de 8 dígitos `11001000`), rechaza los códigos postales de 4-72 con un 422,
 * y la tarifa no cambia dentro de una misma ciudad. Así que basta el municipio.
 *
 * La fuente es el listado DIVIPOLA del DANE en datos.gov.co (conjunto
 * gdxc-w37w). No se guarda en el repo: se descarga y se pasa por argumento.
 *
 *   curl -s 'https://www.datos.gov.co/resource/gdxc-w37w.json?$limit=3000' -o divipola.json
 *   node herramientas/codigos_dane.mjs divipola.json            # muestra el cruce
 *   node herramientas/codigos_dane.mjs divipola.json --escribir # escribe la tabla
 *
 * Si una ciudad de colombia.json no casa con el DANE, el script se detiene:
 * una ciudad sin código no da error en el checkout, solo deja esa guía a mano.
 * Mejor enterarse aquí. `pruebas/pedido-envio.js` exige que estén todas.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const [archivo, bandera] = process.argv.slice(2);
if (!archivo) {
  console.error('Uso: node herramientas/codigos_dane.mjs <divipola.json> [--escribir]');
  process.exit(1);
}

const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  .replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();

/* El checkout usa el nombre con el que la gente conoce el sitio; el DANE, el
   oficial. Estos son los que no casan solos. Cada uno se comprobó contra el
   listado (2026-11-15). */
const DEPTOS = { 'SAN ANDRES Y PROVIDENCIA': 'ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA' };
const CIUDADES = {
  'Antioquia|El Retiro': 'RETIRO',
  'Bolívar|Cartagena': 'CARTAGENA DE INDIAS',
  'Bolívar|Mompós': 'SANTA CRUZ DE MOMPOX',
  'Cauca|Piendamó': 'PIENDAMO - TUNIA',
  'Cesar|Codazzi': 'AGUSTIN CODAZZI',
  'Cundinamarca|Ubaté': 'VILLA DE SAN DIEGO DE UBATE',
  'Nariño|Tumaco': 'SAN ANDRES DE TUMACO',
  'Norte de Santander|Cúcuta': 'SAN JOSE DE CUCUTA',
  'Sucre|Tolú': 'SANTIAGO DE TOLU',
  'Sucre|Since': 'SAN LUIS DE SINCE',
  'Tolima|Mariquita': 'SAN SEBASTIAN DE MARIQUITA',
  'Valle del Cauca|Cali': 'SANTIAGO DE CALI',
  'Valle del Cauca|Buga': 'GUADALAJARA DE BUGA',
};

const geo = JSON.parse(fs.readFileSync(path.join(RAIZ, 'assets', 'colombia.json'), 'utf8')).departamentos;
const dane = JSON.parse(fs.readFileSync(archivo, 'utf8'));
const porDepto = {};
dane.forEach(m => { (porDepto[norm(m.dpto)] = porDepto[norm(m.dpto)] || []).push(m); });

const tabla = {}, sinCasar = [];
for (const [depto, ciudades] of Object.entries(geo)) {
  const lista = porDepto[DEPTOS[norm(depto)] || norm(depto)] || [];
  for (const ciudad of ciudades) {
    const buscado = CIUDADES[depto + '|' + ciudad] || norm(ciudad);
    const hallados = lista.filter(m => norm(m.nom_mpio) === buscado);
    if (hallados.length === 1 && /^\d{5}$/.test(hallados[0].cod_mpio)) {
      (tabla[depto] = tabla[depto] || {})[ciudad] = hallados[0].cod_mpio;
    } else {
      sinCasar.push(`${depto} → ${ciudad} (${hallados.length} coincidencias)`);
    }
  }
}

const total = Object.values(tabla).reduce((n, cs) => n + Object.keys(cs).length, 0);
console.log(`DIVIPOLA: ${dane.length} municipios. Ciudades del checkout con código: ${total}.`);
if (sinCasar.length) {
  console.error('Sin casar:\n  ' + sinCasar.join('\n  '));
  process.exit(1);
}

if (bandera === '--escribir') {
  const salida = {
    _: 'Código DANE (DIVIPOLA) de cada ciudad de assets/colombia.json. Lo genera '
      + 'herramientas/codigos_dane.mjs desde el listado del DANE (datos.gov.co, gdxc-w37w); '
      + 'no se edita a mano. Lo lee netlify/functions/_dane.js para la guía de Skydropx.',
    departamentos: tabla,
  };
  fs.writeFileSync(path.join(RAIZ, 'assets', 'codigos-dane.json'), JSON.stringify(salida, null, 1) + '\n');
  console.log('Escrito assets/codigos-dane.json');
} else {
  console.log('Sin --escribir no se toca nada.');
}
