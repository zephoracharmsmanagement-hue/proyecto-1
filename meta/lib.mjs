// Utilidades compartidas para hablar con la Graph API de Meta.
// Sin dependencias: Node 22 ya trae fetch y parser de .env.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

// Carga .env sin librerías. Ignora comentarios y líneas vacías, y no
// pisa variables que ya vengan del entorno.
export function cargarEnv() {
  let texto;
  try {
    texto = readFileSync(join(raiz, '.env'), 'utf8');
  } catch {
    return; // sin .env: quizá el token viene exportado en la shell
  }
  for (const linea of texto.split('\n')) {
    const m = linea.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
    if (!m) continue;
    const valor = m[2].trim().replace(/^["']|["']$/g, '');
    if (valor && process.env[m[1]] === undefined) process.env[m[1]] = valor;
  }
}
cargarEnv();

const VERSION = process.env.META_API_VERSION || 'v19.0';
const BASE = `https://graph.facebook.com/${VERSION}`;

function token() {
  const t = process.env.META_ACCESS_TOKEN;
  if (!t) {
    console.error(
      '\nFalta META_ACCESS_TOKEN.\n\n' +
      '  cp .env.example .env    y pega tu token dentro\n\n' +
      'O expórtalo solo para esta terminal:\n\n' +
      '  export META_ACCESS_TOKEN="EAA..."\n'
    );
    process.exit(1);
  }
  return t;
}

export class ErrorMeta extends Error {
  constructor(err, ruta, http) {
    super(err?.message || `La Graph API respondió HTTP ${http} sin detalle de error`);
    this.http = http;
    this.codigo = err?.code;
    this.subcodigo = err?.error_subcode;
    this.tipo = err?.type;
    this.traza = err?.fbtrace_id;
    this.ruta = ruta;
  }

  // Traduce los códigos que más salen a algo accionable.
  get consejo() {
    switch (this.codigo) {
      case 190:
        return this.subcodigo === 463
          ? 'El token expiró. Genera uno nuevo en Configuración del negocio → Usuarios del sistema.'
          : 'Token inválido o revocado. Verifícalo en developers.facebook.com/tools/debug/accesstoken';
      case 200:
      case 10:
        return 'Al token le falta un permiso. Revisa que tenga ads_read / ads_management y que el usuario tenga acceso a ese activo.';
      case 100:
        return 'Parámetro o campo inválido. Puede ser un ID mal escrito, o un campo que no existe en esta versión de la API.';
      case 4:
      case 17:
      case 613:
        return 'Límite de peticiones alcanzado. Espera unos minutos y reintenta.';
      case 803:
        return 'El objeto no existe o tu token no lo puede ver.';
      default:
        return 'Si el mensaje no es claro, busca el código en developers.facebook.com/docs/graph-api/guides/error-handling';
    }
  }
}

// GET contra la Graph API. El token va en el header Authorization y no
// en la URL, para que no quede escrito en logs ni en el historial.
export async function api(ruta, params = {}) {
  const url = new URL(BASE + ruta);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }

  let res;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
  } catch (e) {
    throw new Error(
      `No se pudo alcanzar ${url.host}: ${e.message}\n` +
      'Revisa tu conexión, o si hay un proxy/firewall bloqueando graph.facebook.com'
    );
  }

  const crudo = await res.text();
  let cuerpo = null;
  try { cuerpo = JSON.parse(crudo); } catch { /* no era JSON */ }

  // Si no llegó JSON, la respuesta no viene de la Graph API: casi siempre
  // es un proxy, un firewall corporativo o un portal de red en medio.
  // Distinguirlo importa: si no, te manda a depurar permisos de Meta
  // cuando el problema es la conexión.
  if (cuerpo === null) {
    throw new Error(
      `Respuesta no-JSON de ${url.host} (HTTP ${res.status}).\n` +
      `  Esto no lo mandó Meta — hay algo interceptando la conexión.\n` +
      `  Sospecha de un proxy, VPN o firewall que bloquee graph.facebook.com\n` +
      (crudo ? `\n  Primeros bytes: ${crudo.slice(0, 160).replace(/\s+/g, ' ')}` : '')
    );
  }

  if (!res.ok || cuerpo.error) throw new ErrorMeta(cuerpo.error, ruta, res.status);
  return cuerpo;
}

// Recorre resultados paginados hasta un tope, para no colgarse en cuentas grandes.
export async function todas(ruta, params = {}, tope = 200) {
  const acumulado = [];
  let pagina = await api(ruta, { limit: 50, ...params });
  while (true) {
    acumulado.push(...(pagina.data || []));
    const siguiente = pagina.paging?.next;
    if (!siguiente || acumulado.length >= tope) break;
    // La URL de 'next' ya trae host, versión y cursor: la reusamos tal cual,
    // pero pasando por api() para heredar el mismo manejo de errores.
    const u = new URL(siguiente);
    u.searchParams.delete('access_token'); // va por header, no por URL
    pagina = await api(u.pathname.replace(/^\/v\d+\.\d+/, ''), Object.fromEntries(u.searchParams));
  }
  return acumulado.slice(0, tope);
}

// ---- presentación ----

export const money = (n, mon = 'COP') =>
  n == null || n === '' ? '—'
    : new Intl.NumberFormat('es-CO', { style: 'currency', currency: mon, maximumFractionDigits: 0 })
        .format(Number(n));

export const num = (n) =>
  n == null || n === '' ? '—' : new Intl.NumberFormat('es-CO').format(Number(n));

export const fecha = (v) => {
  if (!v) return 'nunca';
  const d = new Date(typeof v === 'number' ? v * 1000 : v);
  if (Number.isNaN(d.getTime())) return String(v);
  const horas = (Date.now() - d.getTime()) / 36e5;
  const rel = horas < 1 ? 'hace menos de 1 h'
    : horas < 48 ? `hace ${Math.round(horas)} h`
    : `hace ${Math.round(horas / 24)} días`;
  return `${d.toLocaleString('es-CO')} (${rel})`;
};

export const titulo = (t) => console.log(`\n${t}\n${'─'.repeat(t.length)}`);

export function tabla(filas) {
  if (!filas.length) return console.log('  (sin resultados)');
  const cols = Object.keys(filas[0]);
  const ancho = Object.fromEntries(
    cols.map((c) => [c, Math.max(c.length, ...filas.map((f) => String(f[c] ?? '').length))])
  );
  const linea = (vals) => '  ' + cols.map((c) => String(vals[c] ?? '').padEnd(ancho[c])).join('  ');
  console.log(linea(Object.fromEntries(cols.map((c) => [c, c]))));
  console.log('  ' + cols.map((c) => '─'.repeat(ancho[c])).join('  '));
  filas.forEach((f) => console.log(linea(f)));
}

// Envoltorio para que cualquier fallo salga legible en vez de un stacktrace.
export async function correr(fn) {
  try {
    await fn();
    console.log('');
  } catch (e) {
    if (e instanceof ErrorMeta) {
      console.error(`\n✗ Meta rechazó la petición a ${e.ruta}`);
      console.error(`  ${e.message}`);
      if (e.codigo) console.error(`  código ${e.codigo}${e.subcodigo ? `/${e.subcodigo}` : ''}`);
      console.error(`\n  → ${e.consejo}`);
      if (e.traza) console.error(`\n  (fbtrace_id ${e.traza} — útil si escribes a soporte de Meta)`);
    } else {
      console.error(`\n✗ ${e.message}`);
    }
    console.error('');
    process.exit(1);
  }
}
