(function(){
const WA='573018990672', LIBRE=0;
/* Envío con tarifa plana nacional. La contraentrega cuesta más porque la
   transportadora cobra el recaudo. Gratis a partir de LIBRE en ambos casos. */
const ENVIO={anticipado:15000, contraentrega:20000};
/* El envío gratis premia el prepago y solo el prepago. La contraentrega le
   cuesta a la tienda la comisión de recaudo de la transportadora y el riesgo
   de que el paquete se devuelva sin cobrar: regalar ese envío es subsidiar la
   opción más cara. Se dice de frente en el carrito, no en letra chica. */
const LIBRE_SOLO_ANTICIPADO=true;
let pago='anticipado';
const DATA={"charms": [{"id": "mickey-mouse", "n": "Mickey Mouse", "p": 95000}, {"id": "minnie-mouse", "n": "Minnie Mouse", "p": 95000}, {"id": "dalmata", "n": "Dálmata", "p": 95000}, {"id": "ariel", "n": "Ariel", "p": 95000}, {"id": "jasmine", "n": "Jasmine", "p": 95000}, {"id": "blancanieves", "n": "Blancanieves", "p": 95000}, {"id": "princesa-bella", "n": "Princesa Bella", "p": 95000}, {"id": "olaf-de-frozen", "n": "Olaf de Frozen", "p": 95000}, {"id": "stitch-azul", "n": "Stitch Plateado", "p": 95000}, {"id": "stitch", "n": "Stitch", "p": 95000}, {"id": "angel", "n": "Angel", "p": 95000}, {"id": "lilo-stitch", "n": "Lilo & Stitch", "p": 95000}, {"id": "gato-cheshire", "n": "Gato Cheshire", "p": 95000}, {"id": "jack-sally", "n": "Jack & Sally", "p": 95000}, {"id": "buzz-lightyear", "n": "Buzz Lightyear", "p": 95000}, {"id": "casa-de-los-globos", "n": "Casa de los Globos", "p": 95000}, {"id": "mike-wazowski", "n": "Mike Wazowski", "p": 95000}, {"id": "sulley", "n": "Sulley", "p": 95000}, {"id": "walle", "n": "WALL·E", "p": 95000}, {"id": "capitan-america", "n": "Capitán América", "p": 95000}, {"id": "escudo-capitan-america", "n": "Escudo Capitán América", "p": 95000}, {"id": "spider-man", "n": "Spider-Man", "p": 95000}, {"id": "wolverine", "n": "Wolverine", "p": 95000}, {"id": "hulk", "n": "Hulk", "p": 95000}, {"id": "guantelete-del-infinito", "n": "Guantelete del Infinito", "p": 95000}, {"id": "iron-man", "n": "Iron Man", "p": 95000}, {"id": "deadpool", "n": "Deadpool", "p": 95000}, {"id": "mjolnir-martillo-de-thor", "n": "Mjolnir – Martillo de Thor", "p": 95000}, {"id": "groot-bebe", "n": "Groot Bebé", "p": 95000}, {"id": "casco-iron-man", "n": "Casco Iron Man", "p": 95000}, {"id": "mascara-un-gran-poder", "n": "Máscara Un Gran Poder", "p": 95000}, {"id": "esfera-telarana-spider-man", "n": "Esfera Telaraña Spider-Man", "p": 95000}, {"id": "spider-man-pave", "n": "Spider-Man Pavé", "p": 95000}, {"id": "mascara-spider-man-roja", "n": "Máscara Spider-Man Roja", "p": 95000}, {"id": "corazon-de-filigrana", "n": "Corazón de Filigrana", "p": 88000}, {"id": "clip-orquideas-moradas", "n": "Clip Orquídeas Moradas", "p": 78000}, {"id": "clip-mariposas-de-colores", "n": "Clip Mariposas de Colores", "p": 78000}, {"id": "clip-forever-multicolor", "n": "Clip Forever Multicolor", "p": 78000}, {"id": "clip-infinito-con-corazon", "n": "Clip Infinito con Corazón", "p": 78000}, {"id": "cadena-seguridad-love-forever", "n": "Cadena Seguridad Love Forever", "p": 75000}, {"id": "cadena-seguridad-hamsa-y-ojo", "n": "Cadena Seguridad Hamsa y Ojo", "p": 75000}, {"id": "cadena-seguridad-luna-y-sol", "n": "Cadena Seguridad Luna y Sol", "p": 75000}, {"id": "bola-rosa-con-flores", "n": "Murano Rosa con Flores", "p": 82000}, {"id": "osito-pave-con-corazon", "n": "Osito Pavé con Corazón", "p": 90000}, {"id": "angel-guardian", "n": "Ángel Guardián", "p": 86000}, {"id": "pulpo-azul-cristal", "n": "Pulpo Azul Cristal", "p": 94000}, {"id": "osito-graduacion", "n": "Osito Graduación", "p": 94000}, {"id": "caballo-herradura", "n": "Caballo Herradura", "p": 82000}, {"id": "manos-orando-con-cruz", "n": "Manos Orando con Cruz", "p": 86000}, {"id": "trebol-verde-giratorio", "n": "Trébol Verde Giratorio", "p": 94000}, {"id": "torre-eiffel-y-camara", "n": "Torre Eiffel y Cámara", "p": 82000}, {"id": "gatito-con-corazon-azul", "n": "Gatito con Corazón Azul", "p": 82000}, {"id": "huella-con-huesito", "n": "Huella con Huesito", "p": 82000}, {"id": "atrapasuenos-azul", "n": "Atrapasueños Azul", "p": 82000}, {"id": "tortuga-marina-cristal", "n": "Tortuga Marina Cristal", "p": 82000}, {"id": "osito-con-rosa-y-corazon", "n": "Osito con Rosa y Corazón", "p": 86000}, {"id": "atrapasuenos-corazon-multicolor", "n": "Atrapasueños Corazón Multicolor", "p": 82000}, {"id": "mariposas-tricolor-colgantes", "n": "Mariposas Tricolor Colgantes", "p": 82000}, {"id": "avion-globo-y-pasaporte", "n": "Avión, Globo y Pasaporte", "p": 82000}, {"id": "sol-y-luna-con-cristales", "n": "Sol y Luna con Cristales", "p": 82000}, {"id": "bola-roja-remolino", "n": "Murano Fucsia Remolino", "p": 82000}, {"id": "libelula-morada", "n": "Libélula Morada", "p": 82000}, {"id": "virgen-maria", "n": "Virgen María", "p": 86000}, {"id": "bola-azul-con-flor-rosa", "n": "Murano Azul con Flor Rosa", "p": 82000}, {"id": "elefantito-rosa", "n": "Elefantito Rosa", "p": 88000}, {"id": "conejita-con-corazon-rosa", "n": "Conejita con Corazón Rosa", "p": 86000}, {"id": "flor-azul-con-cristales", "n": "Flor Azul con Cristales", "p": 82000}, {"id": "camaleon-verde", "n": "Camaleón Verde", "p": 82000}, {"id": "esfera-azul-con-cristales", "n": "Esfera Azul con Cristales", "p": 82000}, {"id": "luciernaga-you-are-my-light", "n": "Luciérnaga Evangeline", "p": 82000}, {"id": "corazon-arbol-de-la-vida", "n": "Corazón Árbol de la Vida", "p": 88000}, {"id": "charm-psicologia", "n": "Charm Psicología", "p": 82000}, {"id": "charm-odontologia", "n": "Charm Odontología", "p": 82000}, {"id": "charm-fisioterapia", "n": "Charm Fisioterapia", "p": 82000}, {"id": "charm-medicina", "n": "Charm Medicina", "p": 82000}, {"id": "carrusel-rosado", "n": "Carrusel Rosado", "p": 92000}, {"id": "aries", "n": "Aries", "p": 86000}, {"id": "tauro", "n": "Tauro", "p": 86000}, {"id": "geminis", "n": "Géminis", "p": 86000}, {"id": "cancer", "n": "Cáncer", "p": 86000}, {"id": "leo", "n": "Leo", "p": 86000}, {"id": "virgo", "n": "Virgo", "p": 86000}, {"id": "libra", "n": "Libra", "p": 86000}, {"id": "escorpio", "n": "Escorpio", "p": 86000}, {"id": "sagitario", "n": "Sagitario", "p": 86000}, {"id": "capricornio", "n": "Capricornio", "p": 86000}, {"id": "acuario", "n": "Acuario", "p": 86000}, {"id": "piscis", "n": "Piscis", "p": 86000}, {"id": "cenicienta", "n": "Cenicienta", "p": 95000}, {"id": "corazon-mama-e-hija", "n": "Corazón Mamá e Hija", "p": 78000}, {"id": "letra-a", "n": "Letra A", "p": 86000}, {"id": "letra-b", "n": "Letra B", "p": 86000}, {"id": "letra-c", "n": "Letra C", "p": 86000}, {"id": "letra-d", "n": "Letra D", "p": 86000}, {"id": "letra-e", "n": "Letra E", "p": 86000}, {"id": "letra-f", "n": "Letra F", "p": 86000}, {"id": "letra-g", "n": "Letra G", "p": 86000}, {"id": "letra-h", "n": "Letra H", "p": 86000}, {"id": "letra-i", "n": "Letra I", "p": 86000}, {"id": "letra-j", "n": "Letra J", "p": 86000}, {"id": "letra-k", "n": "Letra K", "p": 86000}, {"id": "letra-l", "n": "Letra L", "p": 86000}, {"id": "letra-m", "n": "Letra M", "p": 86000}, {"id": "letra-n", "n": "Letra N", "p": 86000}, {"id": "letra-ñ", "n": "Letra Ñ", "p": 86000}, {"id": "letra-o", "n": "Letra O", "p": 86000}, {"id": "letra-p", "n": "Letra P", "p": 86000}, {"id": "letra-q", "n": "Letra Q", "p": 86000}, {"id": "letra-r", "n": "Letra R", "p": 86000}, {"id": "letra-s", "n": "Letra S", "p": 86000}, {"id": "letra-t", "n": "Letra T", "p": 86000}, {"id": "letra-u", "n": "Letra U", "p": 86000}, {"id": "letra-v", "n": "Letra V", "p": 86000}, {"id": "letra-w", "n": "Letra W", "p": 86000}, {"id": "letra-x", "n": "Letra X", "p": 86000}, {"id": "letra-y", "n": "Letra Y", "p": 86000}, {"id": "letra-z", "n": "Letra Z", "p": 86000}], "pulseras": [{"id": "pulsera-corona-con-cristales", "n": "Pulsera Corona con Cristales", "p": 82000}, {"id": "pulsera-avengers", "n": "Pulsera Avengers", "p": 78000}, {"id": "pulsera-corazon-con-diamante", "n": "Pulsera Corazón con Diamante", "p": 78000}, {"id": "pulsera-corazon-liso", "n": "Pulsera Corazón Liso", "p": 78000}, {"id": "pulsera-clasica-cierre-barril", "n": "Pulsera Clásica Cierre Barril", "p": 78000}, {"id": "pulsera-corazon-pave", "n": "Pulsera Corazón Pavé", "p": 82000}, {"id": "pulsera-corazon-pave-pequeno", "n": "Pulsera Corazón Pavé Pequeño", "p": 78000}, {"id": "pulsera-sol-con-cadena-seguridad", "n": "Pulsera Sol con Cadena Seguridad", "p": 88000}, {"id": "pulsera-corona-pave", "n": "Pulsera Corona Pavé", "p": 82000}, {"id": "pulsera-mano-de-hamsa", "n": "Pulsera Mano de Hamsa", "p": 82000}, {"id": "pulsera-corazon-rosado-con-cadena", "n": "Pulsera Corazón Rosado con Cadena", "p": 88000}, {"id": "pulsera-corazon-luminoso", "n": "Pulsera Corazón Luminoso", "p": 82000}, {"id": "pulsera-copo-de-nieve", "n": "Pulsera Copo de Nieve", "p": 78000}, {"id": "pulsera-mickey-mouse-pave", "n": "Pulsera Mickey Mouse Pavé", "p": 82000}, {"id": "pulsera-candado-rosa-con-cadena", "n": "Pulsera Candado Rosa con Cadena", "p": 88000}, {"id": "pulsera-trebol-verde", "n": "Pulsera Trébol Verde", "p": 78000}, {"id": "pulsera-mono-rosa-con-cadena", "n": "Pulsera Moño Rosa con Cadena", "p": 88000}, {"id": "pulsera-rosa-clasica", "n": "Pulsera Rosa Clásica", "p": 78000}]};
const byId=(a)=>a.reduce((o,x)=>(o[x.id]=x,o),{});
const CH=byId(DATA.charms), PU=byId(DATA.pulseras);
const TALLAS=['17','18','19','20','21'];
/* Medidas promedio por familia de pieza. Son dos datos distintos: lo que mide la
   pieza y lo que ocupa de cadena —de ahí sale cuántos charms caben—. */
const FAMILIAS={
  pasador:{n:'Pasador · charm fijo',mide:'0,8 – 1,2 cm',ocupa:'8 – 10 mm',
    d:'Se ensarta en la cadena y queda en su lugar, sin colgar.'},
  colgante:{n:'Dije colgante',mide:'1,5 – 2,5 cm de largo',ocupa:'4 – 6 mm en el aro',
    d:'Cuelga de la cadena y se mueve con la muñeca. Ocupa poco a lo ancho.'},
  murano:{n:'Murano de cristal',mide:'0,9 – 1,1 cm',ocupa:'9 – 11 mm',
    d:'Cristal sobre núcleo de plata. Es la pieza más gruesa: tenlo en cuenta al elegir talla.'},
  clip:{n:'Clip separador',mide:'0,5 – 0,9 cm',ocupa:'4 – 6 mm',
    d:'Se ajusta a la cadena y sujeta los charms para que no se corran.'},
  cadena:{n:'Cadena de seguridad',mide:'',ocupa:'4 – 5 mm por aro · 10 mm en total',
    d:'Va de extremo a extremo para que los charms no se salgan si el broche se abre.'}
};
/* Capacidad según el margen (talla − muñeca). Tramos, no igualdades: una muñeca
   de 16,5 cm da márgenes fraccionarios y tiene que caer en el tramo correcto. */
const CAP=[
  {min:3,  k:'ok',   v:'Holgada',              c:'15 a 20 charms',
   d:'La llenas completa y cae suelta. Es la ideal si vas a usar sobre todo <b>muranos</b>, que son más gruesos.'},
  {min:2,  k:'best', v:'La recomendada',       c:'15 a 20 charms',
   d:'La llenas completa y te queda <b>justa y cómoda</b> en tu medida real.'},
  {min:1,  k:'warn', v:'Capacidad reducida',   c:'5 a 8 charms',
   d:'Te sirve si vas a usar pocos charms. Si la llenas más, <b>te va a apretar</b>.'},
  {min:-99,k:'bad',  v:'No recomendable',      c:'—',
   d:'Te quedará apretada aun sin charms, o no te cerrará.'}
];
const capDe = m => CAP.find(x=>m>=x.min);
const LETRAS=DATA.charms.filter(c=>/^letra-/.test(c.id)).map(c=>c.id.slice(6));

/* Inventario. Vive en assets/stock.json y no dentro de este archivo, para poder
   actualizarlo sin tocar el código. Si no carga, STOCK queda null y la página
   funciona como antes: todo agregable, sin etiquetas ni talla obligatoria. */
let STOCK=null;
const inv = id => STOCK ? STOCK[id] : null;
const unidades = id => { const s=inv(id); return s&&typeof s.stock==='number' ? s.stock : null; };
const tallasDe = id => { const s=inv(id); return s&&s.tallas ? s.tallas : null; };
const tallasLibres = id => { const t=tallasDe(id); return t ? Object.keys(t).filter(k=>t[k]>0) : null; };
/* Sin inventario nada está agotado: ante la duda, no bloqueamos la venta. */
const agotado = id => {
  if(!STOCK) return false;
  const t=tallasLibres(id); if(t) return t.length===0;
  const u=unidades(id); return u!==null && u<=0;
};
/* Tope de unidades por charm, para no vender 5 de algo que tiene 1. */
const tope = id => { const u=unidades(id); return u===null?Infinity:u; };
const cop=n=>'$'+Math.round(n).toLocaleString('es-CO').replace(/,/g,'.');
const ESC=[0,0,.08,.15,.25];
const escala=n=>n<=0?0:ESC[Math.min(n,4)];
const $=s=>document.querySelector(s);
/* El carrusel del hero solo existe en la portada. Las páginas de colección
   traen su propia portada, así que esto se salta si no está: este archivo lo
   comparten varias páginas y no puede dar por hecho el diseño de una sola. Sin
   la guarda, la página entera se queda sin carrito —las tarjetas se ven, se
   tocan, y no pasa nada—, que es la peor forma de fallar. */
const hbTrack=$('.hbanner-track');
const hbPause=$('.hbanner-pause');
if(hbPause && hbTrack){
  hbPause.addEventListener('click',()=>{
    const paused=hbTrack.classList.toggle('paused');
    hbPause.setAttribute('aria-pressed', paused ? 'true' : 'false');
  });
}

/* Videos de clientas: no se descargan hasta que la seccion entra en pantalla.
 *
 * Los tres suman 4,5 MB contra los 300 KB del resto de la pagina, asi que
 * arrancarlos al cargar castigaria a quien entra con datos moviles. Con
 * preload="none" solo viaja la portada; el observer pide el video cuando la
 * pieza se ve, y lo pausa al salir para no gastar bateria ni datos de fondo.
 *
 * A quien pidio "reducir movimiento" no se le reproduce nada: se le dejan los
 * controles para que decida. Es la misma regla que ya respetan el banner y el
 * ticker de avisos. */
const quietoPorPreferencia = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ugcVideos = document.querySelectorAll('.ugc-v');
if (quietoPorPreferencia) {
  ugcVideos.forEach(v => { v.controls = true; v.preload = 'metadata'; });
} else if (ugcVideos.length) {
  const ojo = new IntersectionObserver(entradas => {
    entradas.forEach(e => {
      const v = e.target;
      if (e.isIntersecting) { v.play().catch(()=>{ v.controls = true; }); }
      else { v.pause(); }
    });
  }, { threshold: 0.4 });
  ugcVideos.forEach(v => ojo.observe(v));
}

/* La calculadora de talla esta plegada, pero el menu superior y dos enlaces
   mas apuntan a #talla. Caer ahi y encontrarla cerrada, justo despues de pedir
   "Tallas", seria peor que no tener el enlace: se abre sola al llegar. */
const tallaDes=$('#talla-des');
const abrirTalla=()=>{ if(location.hash==='#talla') tallaDes.open=true; };
abrirTalla();
addEventListener('hashchange',abrirTalla);

/* Vistas adicionales por pieza, en orden: la principal es la de la tarjeta y
 * estas van detrás. Se declara a mano y no por convención de nombres porque el
 * navegador no puede preguntar si un archivo existe sin pedirlo: una convención
 * «prueba -2, -3, -4» dispara 404 en cada ficha que se abre.
 *
 * `pruebas/regresion.js` comprueba que cada archivo listado aquí exista de
 * verdad. Sin eso, un nombre mal escrito da un hueco en la galería y no un
 * error: la ficha abre, la foto no carga, y nadie se entera. */
const FOTOS = {
  'guantelete-del-infinito': ['guantelete-del-infinito-2.webp'],
  'hulk': ['hulk-2.webp'],
  'mjolnir-martillo-de-thor': ['mjolnir-martillo-de-thor-2.webp', 'mjolnir-martillo-de-thor-3.webp'],
  'spider-man': ['spider-man-2.webp'],
  'dalmata': ['dalmata-2.webp'],
};

let base=null, sel=[];
/* Dijes que un kit sugiere (ver `sug=` en delEnlace) — NUNCA se agregan
   solos al carrito, solo resaltan la tarjeta para que la clienta decida. */
let kitSug=[], kitNombre='';
/* Si la clienta cierra el aviso de charms, no vuelve a salir en esa visita.
   En sessionStorage y no en localStorage: cerrarlo hoy no es decir que no
   quiere verlo nunca más. */
let xsFuera=(()=>{ try{ return sessionStorage.getItem('zephora.xs')==='1'; }catch(e){ return false; } })();
const evId=()=>(window.zcEvId?window.zcEvId():'zc-'+Math.random().toString(36).slice(2,10));
const track=(ev,d)=>{ if(typeof fbq==='function')
  fbq('track',ev,Object.assign({currency:'COP'},d||{}),{eventID:evId()}); };
/* ViewContent de UNA pieza. El id es el de catalogo.json —el mismo slug de la
   página de producto y el que usará el catálogo de Meta—, así que el
   retargeting dinámico empata sin mapeos. */
const verPieza=id=>{ const p=PU[id]||CH[id]; if(!p) return;
  track('ViewContent',{content_type:'product',content_ids:[id],content_name:p.n,value:p.p});
  suscVista(); };

/* ——— Suscripción por correo con charm de regalo ———
 * automatizaciones/suscripcion/BRIEF.md. Aparece a los 15 s o tras ver 2
 * productos, lo primero que pase; nunca encima de la ficha o del carrito
 * (espera a que se cierren). Cerrada, no vuelve en 30 días. checkout.html no
 * carga este archivo, así que ahí nunca sale. La casilla de autorización va
 * SIN marcar (Ley 1581) y el servidor solo la acepta como booleano true. */
const lsLeer=k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } };
const lsPoner=(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} };
/* navigator.webdriver: un navegador automatizado (las pruebas con Playwright,
   bots) no recibe la ventana sola —taparía los clics de cualquier batería que
   pase más de 15 s en la página—. pruebas/suscripcion.js lo apaga para probarla. */
const suscFuera=()=>navigator.webdriver||lsLeer('zephora.suscrita')
  ||(Date.now()-(+lsLeer('zephora.susc.cerrado')||0)<30*864e5);
let suscAbierta=false;
function suscVista(){
  let n=0; try{ n=+(sessionStorage.getItem('zephora.vistas')||0)+1; sessionStorage.setItem('zephora.vistas',n); }catch(e){}
  /* Un instante después: verPieza corre dentro de abrirFicha ANTES de que la
     ficha se muestre, y sin esperar la ventana creía que no había ficha y se
     le ponía encima. */
  if(n>=2) setTimeout(()=>abrirSusc(),600);
}
function abrirSusc(forzar){
  if(suscAbierta||(!forzar&&suscFuera())) return;
  const ficha=document.getElementById('ficha');
  if((ficha&&!ficha.hidden)||document.body.classList.contains('sheet-open')){
    if(!forzar){ setTimeout(()=>abrirSusc(),4000); return; }
  }
  suscAbierta=true;
  const capa=document.createElement('div');
  capa.className='susc'; capa.setAttribute('role','dialog'); capa.setAttribute('aria-modal','true');
  capa.setAttribute('aria-labelledby','susc-t');
  capa.innerHTML='<div class="susc-box"><button type="button" class="susc-x" aria-label="Cerrar">✕</button>'
    +'<span class="eyebrow">Suscríbete</span>'
    +'<h2 id="susc-t">Un charm de regalo en tu primera compra</h2>'
    +'<p class="susc-sub">Te lo llevas en tu primera compra de 2 charms o más. Y te enteras primero cuando lleguen piezas nuevas.</p>'
    +'<form class="susc-f" novalidate>'
    +'<input type="email" name="correo" required autocomplete="email" placeholder="Tu correo" aria-label="Tu correo">'
    +'<input type="text" name="web" class="susc-trampa" tabindex="-1" autocomplete="off" aria-hidden="true">'
    +'<label class="susc-ok"><input type="checkbox" name="acepta"> <span>Acepto recibir correos de Zephora Charms con novedades y ofertas. Puedo darme de baja cuando quiera. <a href="politica-de-privacidad.html" target="_blank" rel="noopener">Política de datos</a></span></label>'
    +'<button class="btn" type="submit">Quiero mi regalo</button>'
    +'<p class="susc-msg" aria-live="polite"></p></form></div>';
  document.body.appendChild(capa);
  const cerrar=()=>{ capa.remove(); suscAbierta=false; lsPoner('zephora.susc.cerrado',String(Date.now()));
    document.removeEventListener('keydown',esc); };
  const esc=e=>{ if(e.key==='Escape') cerrar(); };
  document.addEventListener('keydown',esc);
  capa.addEventListener('click',e=>{ if(e.target===capa||e.target.closest('.susc-x')) cerrar(); });
  const f=capa.querySelector('form'), msg=capa.querySelector('.susc-msg');
  f.addEventListener('submit',async e=>{
    e.preventDefault();
    const correo=f.correo.value.trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)){ msg.textContent='Revisa tu correo.'; return; }
    if(!f.acepta.checked){ msg.textContent='Marca la casilla para que podamos escribirte.'; return; }
    const b=f.querySelector('button[type=submit]'); b.disabled=true; msg.textContent='Enviando…';
    try{
      const r=await fetch('suscribir',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({correo,acepta:true,web:f.web.value})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok){ msg.textContent=d.error||'No se pudo. Intenta de nuevo.'; b.disabled=false; return; }
      track('Lead',{content_name:'suscripcion'});
      lsPoner('zephora.susc.cerrado',String(Date.now()));
      f.innerHTML='<p class="susc-listo"><b>¡Casi listo!</b> '+'Revisa tu correo y toca «Confirmar». Tu regalo queda guardado para tu primera compra de 2 charms o más.</p>';
    }catch(err){ msg.textContent='Sin conexión. Intenta de nuevo.'; b.disabled=false; }
  });
  f.correo.focus();
}
if(!suscFuera()) setTimeout(()=>abrirSusc(),15000);
/* Cualquier enlace o botón con data-susc abre la suscripción a pedido. */
document.addEventListener('click',e=>{ const a=e.target.closest('[data-susc]'); if(a){ e.preventDefault(); abrirSusc(true); } });

function imgDe(id){
  /* las 27 iniciales comparten la foto del bloque de letras (tarjetaDe) */
  const t=tarjetaDe(id), el=t&&t.querySelector('img');
  return el?el.src:'';
}

function fila(id,nombre,meta,precio,quitar){
  const r=document.createElement('div'); r.className='srow';
  const src=imgDe(id);
  /* Sin foto va un monograma, no un <img src=""> — eso pedía el HTML otra vez. */
  const mini = src ? '<img src="'+src+'" alt="">'
    : '<span class="srow-nof" aria-hidden="true">'+nombre.trim().charAt(0).toUpperCase()+'</span>';
  r.innerHTML=mini+
    '<div class="srow-n">'+nombre+'<small>'+meta+'</small></div>'+
    '<span class="srow-p">'+cop(precio)+'</span>'+
    '<button class="srow-x" type="button" aria-label="Quitar '+nombre+'">✕</button>';
  r.querySelector('.srow-x').onclick=quitar;
  return r;
}

/* ¿Alguna pulsera tiene unidades en esta talla? Sirve para no recomendar una
   talla que nadie tiene. Sin inventario cargado no opinamos: devuelve true. */
function tallaEnCatalogo(t){
  if(!STOCK) return true;
  return Object.keys(STOCK).some(id=>{
    const l=tallasLibres(id); return l && l.indexOf(t)>=0;
  });
}

function pintarCalculadora(){
  const caja=document.getElementById('calc-out');
  const v=parseFloat(String(document.getElementById('muneca').value).replace(',','.'));
  if(!isFinite(v)||v<=0){
    caja.innerHTML='<p class="calc-vacia">Escribe tu medida y te mostramos las cinco tallas con lo que cabe en cada una.</p>';
    return;
  }
  caja.innerHTML='';
  TALLAS.forEach(t=>{
    const margen=+(Number(t)-v).toFixed(1);
    const c=capDe(margen);
    const hay=tallaEnCatalogo(t);
    const f=document.createElement('div');
    f.className='tfila tfila--'+c.k;
    f.innerHTML='<span class="tfila-t">'+t+'<small style="font-size:12px"> cm</small></span>'+
      '<span class="tfila-v">'+c.v+' · '+c.c+
        (hay?'':' <span class="tfila-ago">· sin unidades hoy</span>')+'</span>'+
      '<p class="tfila-d">'+c.d+' <b>Margen '+
        (margen>0?'+':'')+String(margen).replace('.',',')+' cm</b>.</p>';
    caja.appendChild(f);
  });
}

/* Enlace a WhatsApp para pedir por encargo algo agotado. */
function waEncargo(nombre){
  return 'https://wa.me/'+WA+'?text='+encodeURIComponent(
    'Hola, Zephora Charms. Vi en la página que «'+nombre+'» está agotado. '+
    '¿Me pueden avisar cuándo vuelve o pedirlo por encargo?');
}

/* Etiqueta de disponibilidad. Solo dice "últimas unidades" cuando de verdad
   quedan 1 o 2: no se inventa urgencia donde no la hay. */
function etiquetaStock(p,id){
  let vieja=p.querySelector('.pc-stock'); if(vieja) vieja.remove();
  if(!STOCK) return;
  /* Justo encima del pie: queda pegada al precio y al botón, que es la
     información con la que se decide la compra. */
  const pie=p.querySelector('.pc-foot'); if(!pie) return;
  const libres=tallasLibres(id), u=unidades(id);
  let txt='', cero=false;
  if(libres){
    if(libres.length===0){ txt='Agotado'; cero=true; }
    else if(libres.length===1) txt='Última talla';
  }else if(u!==null){
    if(u<=0){ txt='Agotado'; cero=true; }
    else if(u<=2) txt=u===1?'Última unidad':'Últimas 2';
  }
  if(!txt) return;
  const e=document.createElement('p');
  e.className='pc-stock'+(cero?' pc-stock--0':'');
  e.textContent=txt;
  pie.parentNode.insertBefore(e,pie);
}

/* Kits (kits.html): cada paso de la escalera trae en `data-piezas` los ids
   que necesita (ver gen_colecciones.py). Si alguna se agotó, el paso no puede
   seguir prometiendo un carrito que el checkout va a rechazar: se convierte
   en un enlace a WhatsApp, igual que ya hace `waEncargo` con el resto del
   catálogo. No toca páginas sin `.kit-paso`: el selector devuelve vacío. */
function marcarKits(){
  if(!STOCK) return;
  document.querySelectorAll('.kit-paso[data-piezas]').forEach(a=>{
    if(a.dataset.marcado) return;
    const ids=a.dataset.piezas.split(',');
    if(!ids.some(agotado)) return;
    a.dataset.marcado='1';
    a.classList.add('kit-paso--agotado');
    const nombre=a.closest('.kit')?.querySelector('h3')?.textContent || 'este kit';
    a.href=waEncargo(nombre);
    const p=a.querySelector('.kit-paso-p'); if(p) p.innerHTML='<b>Agotado</b>';
    const d=a.querySelector('.kit-paso-d'); if(d) d.textContent='Escríbenos y te avisamos';
  });
}

/* Aviso de "estos son los dijes de tu kit" al aterrizar desde kits.html con
   `sug=`. Va arriba del catálogo completo, que es donde tienda.js resalta
   las tarjetas (ver `pintarTarjetas`) — sin este aviso, resaltar unas
   tarjetas entre 117 no se entiende solo. No existe en páginas sin
   `#full-cat` (los generadores lo dejan aunque esté vacío, ver
   gen_colecciones.py), así que esto nunca corre ahí. */
function mostrarBannerKit(){
  if(!full||!kitSug.length) return;
  const n=kitSug.length;
  const banner=document.createElement('p');
  banner.className='sug-banner';
  /* Con nodos, no con innerHTML: `kitNombre` viene de la URL (`k=`) y no se
     confía en su contenido. */
  const b=document.createElement('b');
  b.textContent=(kitNombre?'Para tu '+kitNombre+': ':'')
    +'te sugerimos '+n+(n===1?' dije':' dijes');
  banner.appendChild(b);
  banner.appendChild(document.createTextNode(
    ', resaltados abajo. Agrega los que quieras, cámbialos por otros, o ninguno — tú decides.'));
  full.insertBefore(banner, full.firstChild);
}

/* Panel de tallas dentro de la tarjeta del brazalete. */
function pintarTallas(p,id){
  let caja=p.querySelector('.tallas');
  const disp=tallasLibres(id);
  if(!disp){ if(caja) caja.remove(); return; }   // sin inventario, sin panel
  if(!caja){
    caja=document.createElement('div');
    caja.className='tallas'; caja.hidden=true;
    caja.innerHTML='<p class="tallas-t">Elige tu talla</p><div class="tallas-row"></div>'+
      '<p class="tallas-ayuda">Mide tu muñeca y súmale 2 cm. '+
      '<a href="#talla">¿Qué talla es la mía?</a></p>';
    p.querySelector('.pc-body').appendChild(caja);
  }
  const fila=caja.querySelector('.tallas-row');
  fila.innerHTML='';
  TALLAS.forEach(t=>{
    const hay=disp.indexOf(t)>=0;
    const b=document.createElement('button');
    b.type='button'; b.className='tbtn';
    b.textContent=t;
    b.dataset.talla=t; b.dataset.para=id;
    if(!hay){ b.setAttribute('aria-disabled','true'); b.title='Talla '+t+' cm sin unidades'; }
    if(base&&base.id===id&&base.talla===t) b.classList.add('is-on');
    b.setAttribute('aria-label','Talla '+t+' centímetros'+(hay?'':', sin unidades'));
    fila.appendChild(b);
  });
}

function pintarTarjetas(){
  document.querySelectorAll('.pc').forEach(p=>{
    const id=p.dataset.id;
    if(!id||id==='letras') return;
    const esBrazalete=p.classList.contains('pc--b');
    const veces=sel.filter(x=>x===id).length;
    const on=(base&&base.id===id)||veces>0;
    const sinStock=agotado(id);
    p.classList.toggle('is-sel',on);
    p.classList.toggle('is-out',sinStock);
    p.classList.toggle('is-sug',!on&&!sinStock&&kitSug.indexOf(id)>=0);
    etiquetaStock(p,id);
    if(esBrazalete) pintarTallas(p,id);

    const b=p.querySelector('.pc-add'); if(!b) return;
    const pie=b.parentNode;
    let enc=pie.querySelector('.pc-encargo');
    if(sinStock){
      b.setAttribute('aria-disabled','true');
      b.textContent='Agotado';
      if(!enc){
        enc=document.createElement('a');
        enc.className='pc-encargo'; enc.dataset.wa='encargo';
        enc.textContent='Pedir por encargo';
        pie.appendChild(enc);
      }
      enc.href=waEncargo((esBrazalete?PU[id]:CH[id]).n);
    }else{
      b.removeAttribute('aria-disabled');
      if(enc) enc.remove();
      if(esBrazalete){
        b.textContent=on?('Elegido ✓'+(base.talla?' · '+base.talla:'')):'Elegir';
      }else{
        const lleno=veces>=tope(id);
        b.textContent=on?('Agregado'+(veces>1?' ×'+veces:'')):'Agregar';
        if(lleno&&veces>0){ b.setAttribute('aria-disabled','true'); b.title='No hay más unidades'; }
        else b.removeAttribute('title');
      }
    }
  });
}

function pintarLetras(){
  const g=document.getElementById('letras-grid'); if(!g) return;
  if(!g.dataset.listo){
    LETRAS.forEach(L=>{
      const b=document.createElement('button');
      b.type='button'; b.className='lbtn'; b.dataset.letra=L;
      g.appendChild(b);
    });
    g.dataset.listo='1';
  }
  g.querySelectorAll('.lbtn').forEach(b=>{
    const id='letra-'+b.dataset.letra;
    const veces=sel.filter(x=>x===id).length;
    const sinStock=agotado(id);
    b.innerHTML=b.dataset.letra.toUpperCase()+
      (sinStock?'<small>agotada</small>':(veces?'<small>×'+veces+'</small>':''));
    b.classList.toggle('is-on',veces>0);
    if(sinStock||veces>=tope(id)) b.setAttribute('aria-disabled','true');
    else b.removeAttribute('aria-disabled');
    b.setAttribute('aria-label','Inicial '+b.dataset.letra.toUpperCase()+
      (sinStock?', agotada':', '+cop(CH[id].p)));
  });
  /* El precio de la tarjeta sale de DATA, no del HTML: estuvo escrito a mano
     en $76.000 mientras se cobraban $86.000 (alza del 2026-09-13). */
  const meta=document.querySelector('.pc[data-id="letras"] .pc-meta');
  if(meta&&LETRAS.length) meta.textContent=LETRAS.length+' iniciales · '+cop(CH['letra-'+LETRAS[0]].p)+' cada una';
}

/* ——— ficha de producto ——— */
let fichaId=null;
/* La galería de la ficha. Recibe la <img> de la tarjeta —que es la foto
   principal, la misma que ya se está viendo— y le añade las vistas extra. */
function pintarGaleria(id, img, nombre){
  const ph=$('#fx-ph'), mini=$('#fx-mini');
  const alt=nombre.replace(/"/g,'&quot;');
  if(!img){
    ph.innerHTML='<span class="nofoto-m" aria-hidden="true">'+nombre.trim().charAt(0).toUpperCase()+'</span>';
    mini.innerHTML=''; mini.hidden=true;
    return;
  }
  const extra=FOTOS[id]||[];
  if(!extra.length){
    ph.innerHTML='<img src="'+img.src+'" alt="'+alt+'">';
    mini.innerHTML=''; mini.hidden=true;
    return;
  }
  /* La version va en la URL a proposito: las fotos se sirven con max-age
     de una semana y conservan el nombre al cambiar, asi que sin esto una
     clienta que ya visito la tienda seguiria viendo la foto vieja hasta
     siete dias. Al cambiar una foto hay que subir V. */
  const fuentes=[img.getAttribute('src')].concat(extra.map(f=>'assets/'+f+'?v=20260822'));
  ph.innerHTML='<div class="fx-gal" id="fx-gal">'
    + fuentes.map((src,i)=>'<figure><img src="'+src+'" alt="'+alt
        +(i?' — vista '+(i+1):'')+'" loading="'+(i?'lazy':'eager')+'" decoding="async"></figure>').join('')
    + '</div><div class="fx-pts" id="fx-pts" aria-hidden="true">'
    + fuentes.map((_,i)=>'<i'+(i?'':' class="is-on"')+'></i>').join('')+'</div>';
  mini.innerHTML=fuentes.map((src,i)=>
    '<button type="button" data-i="'+i+'"'+(i?'':' class="is-on"')
    +' aria-label="Ver foto '+(i+1)+' de '+fuentes.length+'">'
    +'<img src="'+src+'" alt="" loading="lazy"></button>').join('');
  mini.hidden=false;

  const gal=$('#fx-gal'), pts=[...$('#fx-pts').children], btns=[...mini.children];
  const marcar=i=>{
    pts.forEach((x,j)=>x.classList.toggle('is-on',j===i));
    btns.forEach((x,j)=>x.classList.toggle('is-on',j===i));
  };
  /* La posición se lee del scroll y no de un contador propio: el dedo puede
     dejar la tira a medio camino, y un contador se desincroniza en cuanto eso
     pasa. El ancho de la caja es el paso. */
  gal.addEventListener('scroll',()=>marcar(Math.round(gal.scrollLeft/gal.clientWidth)),{passive:true});
  mini.onclick=e=>{
    const b=e.target.closest('[data-i]'); if(!b) return;
    gal.scrollTo({left:gal.clientWidth*(+b.dataset.i), behavior:'smooth'});
  };
}

/* La tarjeta de una pieza. Las iniciales comparten la tarjeta «letras» en la
   portada, pero en su propia página de producto tienen una tarjeta suya. */
function tarjetaDe(id){
  return document.querySelector('.pc[data-id="'+CSS.escape(id)+'"]')
    || (/^letra-/.test(id)?document.querySelector('.pc[data-id="letras"]'):null);
}
function familiaDe(id){ const s=STOCK?STOCK[id]:null; return s&&s.familia?FAMILIAS[s.familia]:null; }

/* Disponibilidad y ficha técnica de una pieza. Las usan la ficha emergente y
   la página de producto: el material se escribe en UN solo sitio, porque dos
   copias ya dejaron una vez afirmaciones de 925 en brazaletes. */
function estadoDe(id){
  if(!STOCK) return {t:'',k:''};
  if(agotado(id)) return {t:'Agotado — puedes pedirlo por encargo',k:'out'};
  if(PU[id]) return {t:'Disponible en talla '+(tallasLibres(id)||[]).join(', ')+' cm',k:'ok'};
  const u=unidades(id);
  return u!==null&&u<=2 ? {t:u===1?'Queda 1 unidad':'Quedan '+u+' unidades',k:'few'} : {t:'Disponible',k:'ok'};
}
function specsDe(id){
  const filas=[], fam=familiaDe(id);
  const fila=(k,v)=>filas.push('<div><dt>'+k+'</dt><dd>'+v+'</dd></div>');
  if(PU[id]){
    fila('Material','Base de latón de calidad joyería con baño de plata certificado y capa protectora e-coating');
    fila('Tallas','17 a 21 cm. <a href="#talla" class="talla-link" style="margin:0">¿Cuál es la mía?</a>');
  }else{
    fila('Material','Plata Esterlina 925 verificada, con sello grabado');
    if(fam){
      fila('Tipo de pieza',fam.n+' — '+fam.d);
      if(fam.mide) fila('Mide la pieza',fam.mide);
      fila('Ocupa en la pulsera',fam.ocupa);
    }
  }
  fila('Compatible','Con brazaletes Zephora y con pulseras de sistema modular, incluidas las de Pandora');
  fila('Sin níquel','Libre de níquel y plomo — apta para pieles sensibles');
  return filas.join('');
}
/* En una página de producto, su bloque de disponibilidad y ficha técnica.
   Se repinta al llegar el inventario (la familia de la pieza sale de ahí). */
function pintarPagina(){
  const id=document.body.dataset.producto, specs=$('#pp-specs'), est=$('#pp-est');
  if(!id||!specs||!est) return;
  specs.innerHTML=specsDe(id);
  /* En la página de un brazalete, la talla es lo primero que hay que elegir:
     el panel sale abierto en vez de esconderse tras «Elegir». */
  const t=tarjetaDe(id), tallas=t&&t.querySelector('.tallas');
  if(tallas&&!t.dataset.abierta){ tallas.hidden=false; t.dataset.abierta='1'; }
  const e=estadoDe(id);
  est.textContent=e.t; est.className='fx-est'+(e.k?' fx-est--'+e.k:'');
}

function abrirFicha(id){
  const esB=!!PU[id], p=esB?PU[id]:CH[id];
  if(!p) return;
  /* Se repinta abierta tras agregar y al llegar el inventario: eso no es
     otra vista. Y en su propia página de producto ya se contó al cargar. */
  if(($('#ficha').hidden||fichaId!==id) && id!==document.body.dataset.producto) verPieza(id);
  fichaId=id;
  const tarjeta=tarjetaDe(id);
  const img=tarjeta&&tarjeta.querySelector('.pc-img img');
  const fam=familiaDe(id);

  pintarGaleria(id, img, p.n);
  $('#fx-tipo').textContent = esB ? 'Brazalete' : (fam?fam.n:'Charm');
  $('#fx-n').textContent = p.n.replace(/^Pulsera /,'');
  $('#fx-p').textContent = cop(p.p);

  const e=estadoDe(id), est=$('#fx-est');
  est.textContent=e.t; est.className='fx-est'+(e.k?' fx-est--'+e.k:'');

  $('#fx-specs').innerHTML=specsDe(id);
  $('#fx-nota').textContent = esB ? '' : 'Medidas aproximadas por tipo de pieza, no medición individual.';

  const add=$('#fx-add'), sinStock=agotado(id);
  add.hidden=esB;
  if(!esB){
    const lleno=sel.filter(x=>x===id).length>=tope(id);
    add.textContent = sinStock ? 'Agotado' : (lleno?'Sin más unidades':'Agregar a mi pulsera');
    if(sinStock||lleno) add.setAttribute('aria-disabled','true'); else add.removeAttribute('aria-disabled');
  }
  const pag=$('#fx-pag');
  pag.href='producto-'+encodeURIComponent(id)+'.html';
  pag.hidden = id===document.body.dataset.producto;
  const fw=$('#fx-wa');
  fw.hidden=!sinStock;
  if(sinStock) fw.href=waEncargo(p.n);

  $('#ficha').hidden=false;
  bloquearFondo(true);
  $('#fx-x').focus();
}
/* Bloqueo del fondo mientras hay una capa abierta (ficha o carrito).
 *
 * `body{overflow:hidden}` NO bloquea en Safari de iOS: el fondo sigue
 * arrastrándose por debajo, y como la capa es `position:fixed`, lo que el
 * cliente percibe es que la ficha "se traba" —el dedo mueve algo, pero no lo
 * que está mirando—. Reportado sobre iOS el 2026-09-22 con la ficha abierta.
 *
 * Lo único que lo bloquea de verdad en iOS es fijar el propio body. Al fijarlo
 * pierde su posición de scroll, así que hay que guardarla y devolverla al
 * cerrar; si no, cada vez que se cierra una ficha la página salta arriba y se
 * pierde el sitio de la rejilla donde estaba mirando.
 *
 * El contador existe porque las dos capas comparten el bloqueo y pueden
 * solaparse: abrir la ficha desde el carrito y cerrarla no debe soltar el
 * fondo mientras el carrito siga abierto. */
let fondoY = 0, fondoN = 0;
function bloquearFondo(v){
  if(v){
    if(fondoN++ === 0){
      fondoY = window.scrollY || document.documentElement.scrollTop || 0;
      document.body.style.top = '-' + fondoY + 'px';
      document.body.classList.add('sheet-open');
    }
    return;
  }
  if(fondoN === 0) return;
  if(--fondoN === 0){
    document.body.classList.remove('sheet-open');
    document.body.style.top = '';
    /* La lectura fuerza el recálculo de la maquetación ANTES de devolver el
       scroll. Sin ella, el body todavía no ha vuelto al flujo, la página mide
       una pantalla, y el navegador recorta la posición pedida a ese alto: se
       guardaban 3.339 px y se volvía a 1.942. Comprobado el 2026-09-22. */
    void document.body.offsetHeight;
    /* `behavior:'instant'` es obligatorio: `html{scroll-behavior:smooth}` hace
       que devolver la posición se convierta en un barrido de más de un
       segundo desde arriba. Es exactamente lo que el cliente ve como que la
       página "se queda corrida" al cerrar la ficha: no está trabada, está
       animándose. Se mide: al cerrar iba por 94 px y solo llegaba a los 3.339
       guardados pasado 1,2 s. */
    window.scrollTo({ top: fondoY, left: 0, behavior: 'instant' });
  }
}

function cerrarFicha(){
  $('#ficha').hidden=true; fichaId=null;
  /* El bloqueo lo comparten la hoja del carrito y la ficha; lo lleva un
     contador, así que cerrar la ficha no suelta el fondo si la hoja sigue
     abierta detrás. */
  bloquearFondo(false);
}
$('#fx-x').onclick=cerrarFicha;
$('#ficha').addEventListener('click',e=>{ if(e.target.id==='ficha') cerrarFicha(); });
$('#fx-add').addEventListener('click',()=>{
  if(fichaId&&!bloqueado($('#fx-add'))) { sumarCharm(fichaId); abrirFicha(fichaId); }
});

function render(){
  const body=$('#sheet-body');
  body.innerHTML='';
  if(!base&&!sel.length){
    body.innerHTML='<p class="s-empty">Aún no has elegido nada.<br>Toca "Elegir" en un brazalete o "Agregar" en un charm.</p>';
  }else{
    if(base) body.appendChild(fila(base.id,PU[base.id].n.replace(/^Pulsera /,''),
      'Brazalete · Baño de plata'+(base.talla?' · Talla '+base.talla+' cm':''),
      PU[base.id].p,()=>{base=null;render()}));
    const cont={};
    sel.forEach(id=>cont[id]=(cont[id]||0)+1);
    Object.entries(cont).forEach(([id,n])=>{
      body.appendChild(fila(id,CH[id].n+(n>1?' ×'+n:''),'Charm · Plata 925',CH[id].p*n,
        ()=>{sel.splice(sel.indexOf(id),1);render()}));
    });
  }

  const nC=sel.length;
  const brutoC=sel.reduce((s,id)=>s+CH[id].p,0);
  const descC=brutoC*escala(nC);
  const brutoB=base?PU[base.id].p:0;
  const descB=(base&&nC>=3)?brutoB*.30:0;
  /* El umbral de envío gratis se mide sobre la mercancía, no sobre el total:
     de lo contrario el propio envío ayudaría a alcanzarlo. */
  const subtotal=brutoC-descC+brutoB-descB;
  const ahorro=descC+descB;
  /* alcanza: llegó al umbral. libre: además le corresponde el beneficio.
     Se separan para poder decirle a quien eligió contraentrega que ya alcanzó
     el monto pero el envío gratis es del pago anticipado — callarlo sería
     prometer algo en la barra de progreso y quitarlo al final. */
  const alcanza=subtotal>=LIBRE;
  const libre=alcanza&&(!LIBRE_SOLO_ANTICIPADO||pago==='anticipado');
  const envio=(subtotal<=0||libre)?0:ENVIO[pago];
  const total=subtotal+envio;

  $('#l-b').textContent=base
    ? PU[base.id].n.replace(/^Pulsera /,'Brazalete ')+(base.talla?' · '+base.talla+' cm':'')
    : 'Brazalete';
  $('#v-b').textContent=base?cop(brutoB):'—';
  $('#l-c').textContent=nC?(nC+(nC===1?' charm':' charms')):'Charms';
  $('#v-c').textContent=nC?cop(brutoC):'—';
  $('#row-save').hidden=ahorro<=0;
  $('#v-save').textContent='− '+cop(ahorro);
  $('#v-tot').textContent=cop(total);

  const ship=$('#v-ship'), nota=$('#ship-note'), barra=$('#ship-bar');
  /* La barra de progreso solo tiene sentido mientras haya un umbral que
     alcanzar. Con LIBRE=0 no falta nada: medir el avance hacia cero es
     dividir por cero —NaN en el ancho— y, peor, insinuar una condición que
     ya no existe. Se esconde y en su lugar se dice el beneficio de frente. */
  const conUmbral=LIBRE>0;
  barra.hidden=!conUmbral;
  const relleno=barra.firstElementChild;
  if(subtotal<=0){
    ship.textContent='—'; ship.className='';
    nota.textContent=''; nota.className='ship-note'; relleno.style.width='0';
  }else if(libre){
    ship.textContent='Gratis'; ship.className='ship-ok';
    nota.textContent='✓ Tu pedido tiene envío gratis a toda Colombia';
    nota.className='ship-note ship-ok'; relleno.style.width='100%';
  }else if(alcanza){
    /* Le corresponde envío gratis por monto pero eligió contraentrega. Se le
       dice aquí, con el ahorro en pesos y un botón que lo aplica, en vez de
       dejar que lo descubra en el último paso. */
    ship.textContent=cop(envio); ship.className='';
    nota.innerHTML=(conUmbral?'Tu pedido ya pasa de '+cop(LIBRE)+'. ':'')
      +'El envío gratis aplica al '
      +'pagar por adelantado: <button type="button" class="ship-cta" id="ship-cta">'
      +'cámbiate y ahórrate '+cop(envio)+'</button>';
    nota.className='ship-note ship-casi'; relleno.style.width='100%';
  }else{
    ship.textContent=cop(envio); ship.className='';
    nota.textContent='Agrega '+cop(LIBRE-subtotal)+' más y el envío es gratis'
      +(LIBRE_SOLO_ANTICIPADO?' con pago anticipado':'');
    nota.className='ship-note'; relleno.style.width=Math.min(100,subtotal/LIBRE*100)+'%';
  }

  /* El siguiente tramo de descuento.
   *
   * La escala por cantidad ya existía pero no se anunciaba en ninguna parte: la
   * clienta solo veía el descuento que ya tenía, nunca el que estaba a un charm
   * de distancia. Pasó en la primera venta real —dos charms, 8%— sin que nada
   * le dijera que el tercero la subía al 15%.
   *
   * La cifra que se muestra es lo que baja el descuento sobre lo que YA lleva,
   * que es comprobable en el propio resumen. No se dice que el total baje,
   * porque no baja: el charm que añada lo paga. Prometer un ahorro que no
   * existe es la clase de cosa que se descubre en la pantalla de pago. */
  const dn=$('#desc-nota');
  const sigue=escala(nC+1)>escala(nC) || (base && nC+1>=3 && nC<3);
  if(nC>=1 && sigue){
    const ahoraD=brutoC*escala(nC)+descB;
    const luegoD=brutoC*escala(nC+1)+((base&&nC+1>=3)?brutoB*.30:0);
    const extra=Math.round(luegoD-ahoraD);
    const pct=Math.round(escala(nC+1)*100);
    dn.hidden=extra<=0;
    dn.innerHTML='Con un charm más el descuento sube al <b>'+pct+'%</b>'
      +(base&&nC+1>=3&&nC<3?' y se activa el 30% del brazalete':'')
      +': <b>'+cop(extra)+' menos</b> en lo que ya llevas.';
  }else{
    dn.hidden=true;
  }

  /* Cada opción muestra lo que le costaría el envío a ESTE carrito, para que
     la diferencia se vea antes de elegir y no después. */
  const ant=$('#pb-ant'), con=$('#pb-con');
  if(subtotal<=0){
    ant.textContent='Envío '+cop(ENVIO.anticipado);
    con.textContent='Envío '+cop(ENVIO.contraentrega);
    ant.className=''; con.className='';
  }else{
    ant.textContent=alcanza?'Envío GRATIS':'Envío '+cop(ENVIO.anticipado);
    ant.className=alcanza?'pb-gratis':'';
    con.textContent='Envío '+cop(ENVIO.contraentrega);
    con.className='';
  }

  pintarTarjetas();
  pintarLetras();

  const piezas=nC+(base?1:0);
  /* Lo que falta para el envío gratis, en la barra fija. Dentro de la hoja ya
     estaba, pero solo lo veía quien abría el detalle: el resto armaba sin
     saber que le faltaban $20.000 para no pagar envío. */
  const falta=Math.max(0,LIBRE-subtotal);
  $('#dock-n').textContent = piezas
    ? piezas+(piezas===1?' pieza':' piezas')
      +(libre?' · envío gratis'
        :(subtotal>0&&falta>0?' · '+cop(falta)+' para envío gratis':''))
    : 'Tu selección está vacía';
  $('#dock-p').textContent=cop(total);

  const dbar=$('#dock-bar');
  dbar.classList.toggle('is-ok',libre);
  dbar.firstElementChild.style.width=subtotal>0?Math.min(100,subtotal/LIBRE*100)+'%':'0';

  pintarEscalera(nC);
  pintarSug();
  pintarCross(nC,brutoC,brutoB,descB);
  guardar();
}

/* «Te puede interesar», dentro de la hoja.
 *
 * Hasta ahora, sumar una pieza desde la hoja obligaba a cerrarla, buscar en el
 * catálogo y volver. El catálogo está en la misma página, pero la hoja lo tapa
 * entero: en la práctica, quien abría el resumen ya no añadía nada más.
 *
 * Tres reglas la hacen útil en vez de molesta, las mismas que gobiernan la
 * tira del checkout: nunca ofrece lo agotado, nunca repite lo que ya lleva y
 * se calla por debajo de tres piezas, porque una tira a medias ocupa sitio y
 * no vende. Las iniciales quedan fuera: se eligen, no se sugieren.
 *
 * Y no repite el aviso del descuento. Eso ya lo dice #desc-nota unas líneas
 * más abajo, en el desglose, con la cifra calculada; decirlo dos veces en la
 * misma hoja es ruido. */
const SUG_MAX=6;
/* Categoría y destacados viven en los atributos de las tarjetas del catálogo,
   que es de donde los saca también extraer_catalogo.py para el checkout. Se
   leen una vez: el catálogo no cambia mientras la página está abierta. */
const GRUPO=(()=>{const m={};
  document.querySelectorAll('.pc[data-g]').forEach(a=>{ m[a.dataset.id]=a.dataset.g; });
  return m;})();
const DEST=[...document.querySelectorAll('.pc--top[data-id]')].map(a=>a.dataset.id);

function sugeridos(){
  const puestos=new Set(sel);
  const mios=new Set(sel.map(id=>GRUPO[id]).filter(Boolean));
  const vale=id=>CH[id] && !puestos.has(id) && !/^letra-/.test(id) && !agotado(id);
  const orden=Object.keys(GRUPO);
  const out=[];
  const meter=id=>{ if(out.length<SUG_MAX && !out.includes(id) && vale(id)) out.push(id); };
  /* Primero lo de las mismas categorías que ya lleva —quien puso uno de Marvel
     probablemente quiera otro—, luego los destacados y, de último recurso,
     cualquiera con categoría, para que no salga a medias en una hoja que solo
     tiene brazalete. */
  orden.filter(id=>mios.has(GRUPO[id])).forEach(meter);
  DEST.forEach(meter);
  orden.forEach(meter);
  return { ids: out, categorias: [...mios] };
}

/* Mientras una tarjeta está confirmando «Añadido ✓» no se repinta: añadir la
   saca de la lista, y repintar de golpe la haría desaparecer sin dejar señal
   de que entró al pedido. */
let sugPausa=false;

function pintarSug(){
  if(sugPausa) return;
  const caja=$('#sug'), tira=$('#sug-tira');
  const { ids, categorias } = sugeridos();
  if(ids.length<3){ caja.hidden=true; return; }
  caja.hidden=false;
  /* render() corre en cada cambio —también al elegir forma de pago—. Si la
     lista no cambió, no se toca: repintar reiniciaría el
     desplazamiento de la tira justo mientras la clienta la recorre. */
  if(tira.dataset.ids===ids.join(',')) return;

  $('#sug-por').textContent = categorias.length
    ? '· parecidos a '+categorias.slice(0,2).join(' y ')
    : '· los favoritos de las clientas';

  /* Se arma con nodos y no con innerHTML: hay nombres con comillas dentro
     —«Luciérnaga "You Are My Light"»— y concatenarlos rompería el atributo. */
  tira.textContent='';
  ids.forEach(id=>{
    const b=document.createElement('button');
    b.type='button'; b.className='sug-c'; b.dataset.sug=id;
    b.setAttribute('aria-label','Agregar '+CH[id].n);
    const ph=document.createElement('span'); ph.className='sug-ph';
    const im=document.createElement('img');
    im.src=imgDe(id); im.alt=''; im.loading='lazy'; im.decoding='async';
    const mas=document.createElement('span'); mas.className='sug-mas';
    mas.setAttribute('aria-hidden','true'); mas.textContent='+';
    ph.append(im,mas);
    const n=document.createElement('span'); n.className='sug-n'; n.textContent=CH[id].n;
    const pr=document.createElement('span'); pr.className='sug-p'; pr.textContent=cop(CH[id].p);
    b.append(ph,n,pr);
    tira.appendChild(b);
  });
  tira.dataset.ids=ids.join(',');
  tira.scrollLeft=0;
}

$('#sug-tira').addEventListener('click',e=>{
  const b=e.target.closest('.sug-c');
  if(!b || b.classList.contains('is-puesto')) return;
  const id=b.dataset.sug;
  /* El tope por unidades es el mismo que bloquea el botón del catálogo: la
     tira no puede ser la puerta de atrás para pedir tres de algo que tiene uno. */
  if(agotado(id) || sel.filter(x=>x===id).length>=tope(id)) return;
  b.classList.add('is-puesto');
  b.querySelector('.sug-mas').textContent='✓';
  b.querySelector('.sug-p').textContent='Añadido';
  sugPausa=true;
  sumarCharm(id);
  setTimeout(()=>{ sugPausa=false; pintarSug(); },900);
});

/* El tramo de la escalera en el que va la clienta ahora mismo.
 *
 * La escalera de la portada es informativa mientras el carrito está vacío,
 * pero en cuanto hay charms deja de ser un cartel y pasa a decir dónde está
 * parada: la selección se guarda entre visitas, así que quien vuelve con dos
 * charms ve marcado el 8% y, justo al lado, lo que le falta para el siguiente.
 * El tope se marca en 4 porque de ahí en adelante el descuento ya no sube. */
function pintarEscalera(nC){
  document.querySelectorAll('#esc .esc-t').forEach(t=>{
    t.classList.toggle('is-now', nC>0 && +t.dataset.n===Math.min(nC,4));
  });
}

/* Venta cruzada, al fijar el brazalete.
 *
 * La promo «brazalete + 3 charms = 30% menos» estaba anunciada arriba, en una
 * tarjeta, y no en el momento en que se decide: al elegir el brazalete la
 * página no volvía a mencionarla y la clienta seguía sola. Este aviso la trae
 * al momento exacto.
 *
 * La cifra es el descuento que gana sobre lo que YA lleva —la misma disciplina
 * de #desc-nota—, nunca una rebaja del total: el charm que añada lo paga. Y se
 * apaga solo al llegar a 3, que es donde el 30% ya está activo; seguir
 * empujando después sería pedir por pedir. */
function pintarCross(nC,brutoC,brutoB,descB){
  const xs=$('#xs');
  if(xsFuera||!base||nC>=3||brutoB<=0){ xs.hidden=true; return; }
  if(nC===0){
    $('#xs-tx').innerHTML='Tu brazalete ya está. Con <b>3 charms</b> baja un 30%: '
      +'<b>'+cop(Math.round(brutoB*.30))+' menos</b>, sin códigos ni letra pequeña.';
  }else{
    const extra=Math.round(brutoC*(escala(3)-escala(nC))+(brutoB*.30-descB));
    const faltan=3-nC;
    $('#xs-tx').innerHTML='Llevas '+nC+(nC===1?' charm':' charms')+'. Con '
      +(faltan===1?'uno más':faltan+' más')+' se activa el 30% del brazalete y el 15% '
      +'en charms: <b>'+cop(extra)+' menos</b> en lo que ya llevas.';
  }
  xs.hidden=false;
}

/* Abrir el detalle ya no dispara InitiateCheckout: ese evento ahora marca
   el salto a WhatsApp, que es donde de verdad empieza la compra. */
let hojaAbierta = false;
const abrir=v=>{
  v = !!v;
  if(v !== hojaAbierta){ hojaAbierta = v; bloquearFondo(v); }
  $('#sheet').setAttribute('aria-hidden',v?'false':'true');
  $('#dock-open').setAttribute('aria-expanded',v?'true':'false');
  $('#dock-open svg').style.transform=v?'rotate(180deg)':'';
};
$('#dock').addEventListener('click',e=>{
  if(e.target.closest('#dock-send')) return;
  abrir(!hojaAbierta);
});
$('#dock').addEventListener('keydown',e=>{
  if(e.key==='Enter'||e.key===' '){e.preventDefault();abrir(true)}
});
$('#sheet-x').onclick=()=>abrir(false);
$('#veil').onclick=()=>abrir(false);
$('#xs-x').onclick=()=>{
  xsFuera=true;
  try{ sessionStorage.setItem('zephora.xs','1'); }catch(e){}
  $('#xs').hidden=true;
};
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape') return;
  if(!$('#ficha').hidden){ cerrarFicha(); return; }   /* la ficha va encima */
  abrir(false);
});

/* Indicio de que la tarjeta se abre. Se pone una vez, no en cada render. */
function marcarVerDetalle(){
  document.querySelectorAll('.pc[data-id]').forEach(p=>{
    if(p.dataset.id==='letras'||p.querySelector('.pc-ver')) return;
    const cont=p.querySelector('.pc-img'); if(!cont) return;
    const e=document.createElement('span');
    e.className='pc-ver';
    e.innerHTML='<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M12 11v6M12 7.4v.2"/></svg>Ver detalle';
    cont.appendChild(e);
  });
}

/* El carrito se arma aquí y se paga en checkout.html, que es otra página. Se
   guarda en localStorage para que sobreviva al salto —y para que quien se vaya
   a mirar otra cosa vuelva y encuentre su pulsera como la dejó—.
   Si el navegador no deja escribir (modo privado en algunos iOS, cuota llena),
   no pasa nada: el checkout recibe el mismo pedido por la URL. */
const LLAVE='zephora.carrito.v1';
/* El mismo tope que _precios.js: un enlace no puede meter más de lo que el
   servidor va a aceptar. */
const MAX_CHARMS=60;
/* Se pone en true en cuanto la clienta toca algo. Hasta entonces, un render()
   con el carrito vacío no puede pisar lo que hubiera guardado: si recuperar()
   falla por lo que sea —JSON corrupto, localStorage que no deja leer— el
   primer render borraría la selección de forma definitiva, y el síntoma sería
   justo «se me borraron las joyas». */
let tocado=false;
function guardar(){
  if(base||sel.length) tocado=true;   /* desde que hay algo, se persiste todo */
  if(!tocado) return;                 /* incluido el vaciado deliberado */
  try{
    localStorage.setItem(LLAVE,JSON.stringify({
      v:1, base:base, charms:sel,
      /* Siempre false. El Empaque Premium se retiró el 2026-09-13 y este
         campo se mantiene para pisar lo que quedó guardado de antes: un
         carrito de ayer trae empaque:true y, sin interfaz que lo muestre,
         cobraría $40.000 que nadie puede ver ni quitar. */
      empaque:false,
      pago:pago, cuando:Date.now()
    }));
  }catch(_){}
}
/* ——— el carrito puede llegar en el enlace ———
 *
 * Un enlace que ya trae la selección puesta. Lo usa el correo de recuperación
 * de un checkout abandonado, y más adelante el asesor de WhatsApp: en vez de
 * describir por chat lo que la clienta eligió, se le manda armado.
 *
 * La forma es  ?p=letra-e*2,virgen-maria,pulsera-corazon-liso@19&e=1&pago=…
 * donde `*N` son unidades de un charm y `@T` la talla de un brazalete.
 *
 * Manda sobre lo guardado a propósito: quien llega por un enlace quiere ver
 * eso, no lo que dejó en este navegador hace tres días.
 *
 * Un id que no existe se ignora en vez de romper la página — un enlace viejo
 * puede nombrar una pieza que ya se retiró del catálogo. Y esto no decide
 * ningún precio: como todo lo del navegador, lo que se cobra lo vuelve a
 * calcular el servidor.
 */
function delEnlace(){
  var q;
  try{ q=new URLSearchParams(location.search); }catch(_){ return false; }
  var p=q.get('p');
  if(!p) return false;
  var b=null, s=[];
  p.split(',').forEach(function(trozo){
    var t=trozo.trim(); if(!t) return;
    var m=t.match(/^([a-z0-9-]+)(?:([*@])([0-9]{1,2}))?$/);
    if(!m) return;
    var id=m[1], op=m[2], valor=m[3];
    if(PU[id]){
      /* Un solo brazalete por pedido, igual que armando a mano. Gana el primero. */
      if(b) return;
      b={id:id,talla:(op==='@'&&/^(17|18|19|20|21)$/.test(valor))?valor:null};
      return;
    }
    /* Una talla en un charm es un enlace mal armado: no se adivina. */
    if(!CH[id]||op==='@') return;
    var n=op==='*'?(parseInt(valor,10)||1):1;
    for(var i=0;i<n&&s.length<MAX_CHARMS;i++) s.push(id);
  });
  if(!b&&!s.length) return false;
  base=b; sel=s; tocado=true;
  /* El parámetro «e» (empaque) se ignora desde que se retiró el Premium.
     Los correos de recuperación enviados antes siguen trayéndolo. */
  if(q.get('pago')==='contraentrega'){
    var btn=document.querySelector('.pbtn[data-pago="contraentrega"]');
    if(btn) btn.click();
  }
  guardar();
  /* Se quitan de la URL los parámetros ya aplicados: si no, recargar la página
     vuelve a imponer el enlace encima de lo que la clienta acabe de cambiar
     aquí, y parecería que la tienda le deshace los cambios. Se dejan intactos
     los demás parámetros —una utm, por ejemplo— porque no son nuestros. */
  try{
    var u=new URL(location.href);
    ['p','e','pago'].forEach(function(k){ u.searchParams.delete(k); });
    history.replaceState(null,'',u.pathname+(u.search||'')+u.hash);
  }catch(_){}
  return true;
}

/* ── Dijes sugeridos de un kit ───────────────────────────────────────────
 *
 * `sug=id1,id2,…` viene de kits.html (ver gen_colecciones.py). A propósito
 * NO entra al carrito como `p=` sí hace con el brazalete: antes un kit ponía
 * el brazalete Y los dijes de una vez, y la clienta se encontraba el carrito
 * armado con piezas que nunca tocó. Aquí solo se guardan para resaltar esas
 * tarjetas en el catálogo — agregarlas, cambiarlas o no sigue siendo
 * decisión suya, y el descuento que se gana se ve solo, en el resumen del
 * carrito de siempre (`#row-save`, `#desc-nota`).
 *
 * `k=` es el nombre del kit, solo para el aviso; no afecta nada del cobro.
 */
function delSugerido(){
  var q;
  try{ q=new URLSearchParams(location.search); }catch(_){ return; }
  var s=q.get('sug'), k=q.get('k');
  if(!s && !k) return;
  if(s) kitSug=s.split(',').map(function(x){ return x.trim(); }).filter(function(id){ return CH[id]; });
  kitNombre=k||'';
  try{
    var u=new URL(location.href);
    ['sug','k'].forEach(function(x){ u.searchParams.delete(x); });
    history.replaceState(null,'',u.pathname+(u.search||'')+u.hash);
  }catch(_){}
}

function recuperar(){
  delSugerido();
  /* El enlace primero: si trae selección, no se mira lo guardado. */
  if(delEnlace()) return;
  let d=null;
  try{ d=JSON.parse(localStorage.getItem(LLAVE)||'null'); }catch(_){ return; }
  if(!d||d.v!==1) return;
  if(d.base||(Array.isArray(d.charms)&&d.charms.length)) tocado=true;
  /* Una semana. Más allá, los precios y el inventario ya no son los mismos y
     devolver un carrito viejo promete algo que puede no existir. */
  if(!d.cuando||Date.now()-d.cuando>7*24*3600*1000) return;
  if(d.base&&d.base.id&&PU[d.base.id]) base={id:d.base.id,talla:d.base.talla||null};
  if(Array.isArray(d.charms)) sel=d.charms.filter(id=>CH[id]);
  if(d.pago==='contraentrega'){
    const b=document.querySelector('.pbtn[data-pago="contraentrega"]');
    if(b) b.click();          // click para que el grupo de radio quede coherente
  }
}

/* Al checkout con lo que haya en el carrito. */
function comprar(){
  if(!base&&!sel.length){
    document.getElementById('brazaletes').scrollIntoView({behavior:'smooth'});
    return;
  }
  tocado=true;
  guardar();
  /* Sin InitiateCheckout aquí: lo manda checkout.html al cargar, con los ids
     del carrito. Con los dos, cada checkout contaba doble —cada uno con su
     eventID, así que Meta no los deduplicaba—. Decisión del propietario,
     2026-09-24. */
  location.href='checkout.html';
}

/* Los dos botones llevan al checkout. El pedido por WhatsApp desde el carrito
   se retiró: los enlaces de asesoría del resto de la página siguen ahí. */
$('#send').onclick=comprar;
$('#dock-send').onclick=comprar;
/* El atajo del aviso de envío: aplica el pago anticipado sin que la clienta
   tenga que buscar el botón. Delegado porque el aviso se repinta en cada render. */
document.getElementById('ship-note').addEventListener('click',e=>{
  if(!e.target.closest('#ship-cta')) return;
  const b=document.querySelector('.pbtn[data-pago="anticipado"]');
  if(b) b.click();
});
document.getElementById('pago').addEventListener('click',e=>{
  const b=e.target.closest('.pbtn'); if(!b) return;
  pago=b.dataset.pago;
  document.querySelectorAll('#pago .pbtn').forEach(x=>{
    const on=x===b;
    x.classList.toggle('is-on',on);
    x.setAttribute('aria-checked',on?'true':'false');
  });
  render();
});

const bloqueado = el => el.getAttribute('aria-disabled')==='true';
function sumarCharm(id){
  if(agotado(id)||sel.filter(x=>x===id).length>=tope(id)) return;
  sel.push(id); render();
  track('AddToCart',{content_type:'product',content_ids:[id],
    content_name:CH[id].n,value:CH[id].p});
}

document.addEventListener('click',e=>{
  /* La foto y el nombre abren la ficha. El bloque de letras no: cada inicial se
     agrega desde su propia casilla y no tiene ficha propia. */
  const ver=e.target.closest('.pc-img, .pc-name');
  if(ver && !e.target.closest('.pc-add, .tbtn, .lbtn, .pc-encargo')){
    const t=ver.closest('.pc');
    /* El nombre es un enlace a la página de la pieza. El clic normal sigue
       abriendo la ficha —decisión del propietario: el flujo que hoy lleva a
       agregar no se toca—; con Ctrl/Cmd/Mayús o rueda, el navegador abre la
       página como cualquier enlace. */
    const conTecla=e.metaKey||e.ctrlKey||e.shiftKey||e.button!==0;
    if(t && t.dataset.id && t.dataset.id!=='letras' && !(conTecla&&e.target.closest('a'))){
      e.preventDefault(); abrirFicha(t.dataset.id); return;
    }
  }

  const add=e.target.closest('[data-add]');
  if(add){ if(!bloqueado(add)) sumarCharm(add.dataset.add); return; }

  const L=e.target.closest('[data-letra]');
  if(L){ if(!bloqueado(L)) sumarCharm('letra-'+L.dataset.letra); return; }

  /* Elegir talla fija el brazalete; volver a tocarla lo quita. */
  const t=e.target.closest('[data-talla]');
  if(t){
    if(bloqueado(t)) return;
    const id=t.dataset.para, talla=t.dataset.talla;
    const igual=base&&base.id===id&&base.talla===talla;
    base = igual ? null : {id:id,talla:talla};
    render();
    if(base) track('AddToCart',{content_type:'product',content_ids:[id],
      content_name:PU[id].n+' · talla '+talla,value:PU[id].p});
    return;
  }

  const b=e.target.closest('[data-base]');
  if(b){
    if(bloqueado(b)) return;
    const id=b.dataset.base;
    const panel=b.closest('.pc').querySelector('.tallas');
    if(panel){
      /* Con inventario cargado, el brazalete no entra al carrito sin talla:
         "Elegir" abre el selector y la talla es la que confirma. */
      if(base&&base.id===id){ base=null; render(); return; }
      document.querySelectorAll('.tallas').forEach(x=>{ if(x!==panel) x.hidden=true; });
      panel.hidden=!panel.hidden;
      return;
    }
    /* Sin inventario: comportamiento de siempre, un toque y listo. */
    const antes=base&&base.id;
    base = antes===id ? null : {id:id,talla:null};
    render();
    if(base&&base.id!==antes) track('AddToCart',{content_type:'product',content_ids:[id],
      content_name:PU[id].n,value:PU[id].p});
  }
});

/* subfiltro de brazaletes */
document.getElementById('b-filters').addEventListener('click',e=>{
  const b=e.target.closest('.fbtn'); if(!b) return;
  document.querySelectorAll('#b-filters .fbtn').forEach(x=>x.classList.remove('is-on'));
  b.classList.add('is-on');
  const f=b.dataset.cf;
  document.querySelectorAll('#brazaletes .tier').forEach(t=>{
    let v=0;
    t.querySelectorAll('.pc').forEach(p=>{
      const ok=f==='todos'||p.dataset.cg===f;
      p.hidden=!ok; if(ok) v++;
    });
    t.hidden=v===0;
  });
});

/* catalogo completo */
/* El catálogo completo nace abierto.
 *
 * Estaba detrás de un botón, y eso deja 86 charms —el grueso de lo que se
 * vende— a un clic que mucha gente no da: quien llega de un anuncio no sabe que
 * hay más que el carrusel de destacados. Abrirlo no cuesta carga porque cada
 * tarjeta lleva loading="lazy" y el navegador solo pide las que se acercan a la
 * pantalla.
 *
 * El botón se queda, ahora para cerrarlo: quien ya sabe lo que quiere agradece
 * poder plegar 86 tarjetas y volver a la parte de arriba. */
const full=$('#full-cat'), moreBtn=$('#more-btn');
const CERRADO='Ver el catálogo completo · 86 charms';
function abrirCat(v){
  full.hidden=!v;
  moreBtn.textContent=v?'Ocultar catálogo completo':CERRADO;
  moreBtn.setAttribute('aria-expanded',v?'true':'false');
}
moreBtn.addEventListener('click',()=>abrirCat(full.hidden));
$('#ver-todos').addEventListener('click',()=>{
  abrirCat(true);
  full.scrollIntoView({behavior:'smooth',block:'start'});
});

/* filtros del catálogo
   El conteo suma los destacados del carrusel, que viven fuera de #resto-grid:
   si no, "Disney" decía 13 cuando en pantalla hay 15. */
const grid=document.getElementById('resto-grid');
const destacados=document.getElementById('rail-top');
const cuenta=document.getElementById('count');
let filtroActual='todos', soloDisp=false, busqueda='';
/* Sin tildes y en minúscula: quien busca "angel" debe encontrar "Ángel Guardián". */
const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
/* El bloque de letras cuenta por las iniciales que ofrece, no como una tarjeta. */
const cuentaLetras = () => LETRAS.filter(L=>!soloDisp||!agotado('letra-'+L)).length;

function aplicarFiltro(f){
  filtroActual=f;
  /* acotado a #filters: sin esto también apagaba el botón activo de #b-filters */
  document.querySelectorAll('#filters .fbtn:not(.fbtn--disp)').forEach(x=>{
    x.classList.toggle('is-on',x.dataset.f===f);
  });
  const q=norm(busqueda.trim());
  let v=0;
  grid.querySelectorAll('.pc').forEach(p=>{
    const id=p.dataset.id;
    const esLetras=id==='letras';
    const nombre=norm(p.querySelector('.pc-name').textContent);
    const casa = !q || nombre.indexOf(q)>=0 ||
      (esLetras && LETRAS.some(L=>norm('letra '+L).indexOf(q)>=0));
    const ok = casa && (f==='todos'||p.dataset.g===f) &&
               (esLetras ? (!soloDisp||cuentaLetras()>0) : (!soloDisp||!agotado(id)));
    p.hidden=!ok;
    if(ok) v+= esLetras ? cuentaLetras() : 1;
  });
  if(f!=='todos'||q){
    destacados.querySelectorAll('.pc').forEach(p=>{
      const id=p.dataset.id;
      if((f==='todos'||p.dataset.g===f) &&
         (!q||norm(p.querySelector('.pc-name').textContent).indexOf(q)>=0) &&
         (!soloDisp||!agotado(id))) v++;
    });
  }

  /* Un catálogo en blanco sin explicación parece roto. */
  let vacio=document.getElementById('sin-res');
  if(v===0){
    if(!vacio){
      vacio=document.createElement('p');
      vacio.className='sin-res'; vacio.id='sin-res';
      grid.parentNode.insertBefore(vacio,grid);
    }
    /* Sin salida a WhatsApp: quien no encuentra algo casi siempre buscó con
       otra palabra —«corazon» por «corazón», «mickey» por «Disney»— y eso lo
       arregla el propio buscador, no una conversación. */
    vacio.innerHTML='<b>Sin resultados</b>No encontramos charms con esos criterios. '+
      'Prueba con otra palabra o quita algún filtro.';
  }else if(vacio) vacio.remove();

  cuenta.textContent = f==='todos' && !soloDisp && !q ? ''
    : v+(v===1?' charm':' charms')+(q?' encontrados':(soloDisp?' disponibles':' en esta colección'));
}
document.getElementById('filters').addEventListener('click',e=>{
  const d=e.target.closest('.fbtn--disp');
  if(d){
    soloDisp=!soloDisp;
    d.setAttribute('aria-pressed',soloDisp?'true':'false');
    aplicarFiltro(filtroActual);
    return;
  }
  const b=e.target.closest('.fbtn'); if(!b) return;
  aplicarFiltro(b.dataset.f);
});

/* buscador */
(function(){
  const q=document.getElementById('q'), x=document.getElementById('q-x');
  let t=null;
  q.addEventListener('input',()=>{
    x.hidden=!q.value;
    clearTimeout(t);
    t=setTimeout(()=>{ busqueda=q.value; aplicarFiltro(filtroActual); },140);
  });
  x.addEventListener('click',()=>{
    q.value=''; x.hidden=true; busqueda=''; aplicarFiltro(filtroActual); q.focus();
  });
  q.addEventListener('keydown',e=>{ if(e.key==='Escape'&&q.value) x.click(); });
})();

/* calculadora de talla */
(function(){
  const i=document.getElementById('muneca');
  let t=null;
  i.addEventListener('input',()=>{ clearTimeout(t); t=setTimeout(pintarCalculadora,180); });
  i.addEventListener('change',pintarCalculadora);
})();

/* tarjetas de categoría → abren el catálogo ya filtrado */
document.querySelectorAll('.cat[data-cat]').forEach(a=>{
  a.addEventListener('click',e=>{
    e.preventDefault();
    abrirCat(true);
    aplicarFiltro(a.dataset.cat);
    full.scrollIntoView({behavior:'smooth',block:'start'});
    track('ViewContent',{content_type:'product_group',content_name:'Categoría '+a.dataset.cat});
  });
});

/* Flechas de los carruseles.
 *
 * Antes esto estaba atado por id a un solo carrusel, el de charms destacados.
 * Ahora recorre cada .rail-wrap y engancha los botones que viven dentro de ese
 * mismo bloque: los tres niveles de brazaletes y el carrusel de charms con
 * segunda foto son carruseles también, y con la versión por id se habrían
 * quedado con flechas muertas en escritorio. */
document.querySelectorAll('.rail-wrap').forEach(caja=>{
  const rail=caja.querySelector('.rail');
  const prev=caja.querySelector('.rail-btn--prev'), next=caja.querySelector('.rail-btn--next');
  if(!rail||!prev||!next) return;
  const paso=()=>Math.max(200,rail.clientWidth*.8);
  const estado=()=>{
    prev.disabled = rail.scrollLeft<8;
    next.disabled = rail.scrollLeft >= rail.scrollWidth-rail.clientWidth-8;
  };
  prev.addEventListener('click',()=>rail.scrollBy({left:-paso(),behavior:'smooth'}));
  next.addEventListener('click',()=>rail.scrollBy({left:paso(),behavior:'smooth'}));
  rail.addEventListener('scroll',estado,{passive:true});
  addEventListener('resize',estado);
  estado();
});

/* Búsqueda de la cabecera.
 *
 * El buscador del catálogo solo recorre charms, y vive dentro de su sección:
 * quien buscaba un brazalete por nombre no encontraba nada, y quien llegaba de
 * un anuncio a media página tenía que volver arriba para buscar. Este recorre
 * los dos catálogos y está siempre a un toque.
 *
 * No filtra la página: lleva a la pieza. Filtrar dos parrillas que viven en
 * secciones distintas dejaría media búsqueda fuera de pantalla, y el resultado
 * de buscar algo concreto no es una parrilla, es esa pieza.
 *
 * Las 27 iniciales entran como una sola fila. Como piezas sueltas inundaban
 * cualquier búsqueda con una letra dentro —«leo» traía Letra L, Letra E, Letra
 * O— y ninguna tiene ficha propia: se eligen en su bloque. */
const BUSQ_MAX = 8;
const IDX = (() => {
  const e = [];
  DATA.pulseras.forEach(x => e.push({ id: x.id, n: x.n.replace(/^Pulsera /, ''), p: x.p, t: 'Brazalete' }));
  DATA.charms.filter(x => !/^letra-/.test(x.id))
    .forEach(x => e.push({ id: x.id, n: x.n, p: x.p, t: 'Charm · Plata 925' }));
  e.push({ id: 'letras', n: 'Iniciales A – Z', p: CH['letra-a'].p, t: 'Charm · Plata 925', letras: true });
  return e.map(x => Object.assign(x, { k: norm(x.n) }));
})();

function buscarPiezas(q) {
  const t = norm(q.trim());
  if (t.length < 2) return [];
  /* Las que empiezan por lo escrito van primero: quien teclea «cor» busca
     «Corazón…», no «Escudo Capitán…» aunque las dos contengan las tres letras. */
  const empieza = [], dentro = [];
  IDX.forEach(x => {
    const i = x.k.indexOf(t);
    if (i === 0) empieza.push(x);
    else if (i > 0) dentro.push(x);
    else if (x.letras && ('inicial letra abecedario').indexOf(t) >= 0) dentro.push(x);
  });
  return empieza.concat(dentro).slice(0, BUSQ_MAX);
}

/* Menú de secciones (☰): antes era una franja fija en la portada (Kits ·
   Marvel · Brazaletes · Charms), ahora vive en la cabecera compartida y
   alcanza también a kits.html y las colecciones. Mismo patrón abrir/cerrar
   que la lupa, sin buscador porque son 5 enlaces fijos. */
const menuBtn = $('#menu-btn'), menuPanel = $('#menu-panel');
function abrirMenu(v) {
  menuPanel.hidden = !v;
  menuBtn.setAttribute('aria-expanded', v ? 'true' : 'false');
  if (v && busq && !busq.hidden) abrirBusqueda(false);
}
if (menuBtn && menuPanel) {
  menuBtn.addEventListener('click', () => abrirMenu(menuPanel.hidden));
  menuPanel.addEventListener('click', e => { if (e.target.closest('a')) abrirMenu(false); });
  document.addEventListener('click', e => {
    if (!menuPanel.hidden && !e.target.closest('#menu-panel') && !e.target.closest('#menu-btn')) abrirMenu(false);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menuPanel.hidden) abrirMenu(false); });
}

const busq = $('#busq'), busqQ = $('#busq-q'), busqRes = $('#busq-res'),
      busqNota = $('#busq-nota'), lupa = $('#lupa');
let busqMarca = -1;

function pintarBusqueda() {
  const q = busqQ.value;
  $('#busq-x').hidden = !q;
  busqMarca = -1;
  const r = buscarPiezas(q);
  busqRes.textContent = '';

  if (norm(q.trim()).length < 2) {
    busqNota.textContent = 'Escribe un nombre: «Stitch», «corazón», «Leo», «cadena de seguridad».';
    return;
  }
  if (!r.length) {
    /* Sin salida al chat: quien no encuentra algo casi siempre escribió otra
       palabra, y eso lo arregla escribir de nuevo. */
    busqNota.textContent = 'No encontramos ninguna pieza con ese nombre. Prueba con otra palabra.';
    return;
  }
  busqNota.textContent = r.length + (r.length === 1 ? ' pieza' : ' piezas') + ' · toca para ver el detalle';

  r.forEach(x => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'busq-r'; b.dataset.ir = x.id; b.setAttribute('role', 'option');
    const im = document.createElement('img');
    im.src = imgDe(x.letras ? 'letras' : x.id); im.alt = ''; im.loading = 'lazy'; im.decoding = 'async';
    const n = document.createElement('span'); n.className = 'busq-n';
    n.textContent = x.n;
    const meta = document.createElement('small');
    meta.textContent = x.t;
    /* El estado se dice aquí y no al abrir la ficha: enterarse de que está
       agotado después de haber tocado es un clic perdido. */
    if (!x.letras && agotado(x.id)) {
      const o = document.createElement('span'); o.className = 'out'; o.textContent = ' · Agotado';
      meta.appendChild(o);
    }
    n.appendChild(meta);
    const pr = document.createElement('span'); pr.className = 'busq-p';
    pr.textContent = (x.letras ? 'desde ' : '') + cop(x.p);
    b.append(im, n, pr);
    li.appendChild(b); busqRes.appendChild(li);
  });
}

function abrirBusqueda(v) {
  busq.hidden = !v;
  lupa.setAttribute('aria-expanded', v ? 'true' : 'false');
  if (v) { pintarBusqueda(); busqQ.focus(); busqQ.select(); if (menuPanel && !menuPanel.hidden) abrirMenu(false); }
}

function irAPieza(id) {
  abrirBusqueda(false);
  if (id === 'letras') {
    /* Las iniciales no tienen ficha: se eligen en su propio bloque, así que
       ahí es donde hay que dejar a la clienta. */
    const c = document.querySelector('.pc[data-id="letras"]');
    if (c) { c.hidden = false; c.scrollIntoView({ block: 'center' }); }
    return;
  }
  abrirFicha(id);
}

lupa.addEventListener('click', () => abrirBusqueda(busq.hidden));
$('#busq-x').addEventListener('click', () => { busqQ.value = ''; pintarBusqueda(); busqQ.focus(); });
busqQ.addEventListener('input', pintarBusqueda);
busqRes.addEventListener('click', e => {
  const b = e.target.closest('.busq-r'); if (b) irAPieza(b.dataset.ir);
});

/* Teclado: se puede recorrer y abrir sin soltar el teclado, que es como se
   usa un buscador en escritorio. */
busqQ.addEventListener('keydown', e => {
  const filas = [...busqRes.querySelectorAll('.busq-r')];
  if (e.key === 'Escape') { if (busqQ.value) { busqQ.value = ''; pintarBusqueda(); } else abrirBusqueda(false); return; }
  if (e.key === 'Enter') { e.preventDefault(); if (filas[busqMarca < 0 ? 0 : busqMarca]) irAPieza(filas[busqMarca < 0 ? 0 : busqMarca].dataset.ir); return; }
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  e.preventDefault();
  if (!filas.length) return;
  busqMarca = (busqMarca + (e.key === 'ArrowDown' ? 1 : filas.length - 1) + (busqMarca < 0 && e.key === 'ArrowUp' ? 1 : 0)) % filas.length;
  filas.forEach((f, i) => f.classList.toggle('is-marcado', i === busqMarca));
  filas[busqMarca].scrollIntoView({ block: 'nearest' });
});

/* Tocar fuera cierra. El propio panel y la lupa quedan excluidos: si no, el
   clic que lo abre lo cerraría en el mismo gesto. */
document.addEventListener('click', e => {
  if (!busq.hidden && !e.target.closest('#busq') && !e.target.closest('#lupa')) abrirBusqueda(false);
});

/* Los clics a WhatsApp no valen todos lo mismo, y mezclarlos sale caro.
 *
 * Quien escribe desde el carrito o desde un encargo va a comprar, y ahi el
 * checkout ocurre en el chat: eso es InitiateCheckout, que es el evento con el
 * que optimiza la pauta. Pero el boton flotante y el banner del agente son
 * consultas —tallas, materiales, envios—, y se tocan de forma casual. Contarlos
 * como inicio de compra le ensena a Meta a buscar gente que pregunta en vez de
 * gente que compra.
 *
 * Por eso el evento se declara en el enlace con data-wa-evento. Sin ese
 * atributo se mantiene el comportamiento de siempre, que es el correcto para
 * los enlaces de compra. */
document.querySelectorAll('a[href*="wa.me"]').forEach(a=>{
  const evento=a.dataset.waEvento||'InitiateCheckout';
  a.addEventListener('click',()=>track(evento,{
    content_name:'WhatsApp · '+(a.dataset.wa||a.closest('section')?.id||'general')
  }));
});

document.getElementById('year').textContent=new Date().getFullYear();

/* Antes del primer render: si quedó una pulsera a medio armar de una visita
   anterior, se pinta ya armada en vez de aparecer y cambiar un instante después.
   El fetch de inventario que viene abajo la depura contra lo que hay hoy. */
recuperar();
render();
marcarVerDetalle();

/* Llegó con dijes sugeridos por un kit: se abre el catálogo completo —donde
   viven, no en los destacados—. Si todos comparten categoría (el caso normal:
   un kit de Marvel sugiere charms de Marvel), se filtra a esa categoría con
   el mismo `aplicarFiltro` que ya usan las tarjetas de categoría de la
   portada — si no, el aviso queda lejos de lo que señala, en medio de un
   catálogo de 117 piezas sin filtrar. `pintarTarjetas()` (dentro de
   `render()`) ya puso `.is-sug` en las que tocan. */
if(kitSug.length && full){
  abrirCat(true);
  const catsSug=[...new Set(kitSug.map(id=>GRUPO[id]).filter(Boolean))];
  if(catsSug.length===1) aplicarFiltro(catsSug[0]);
  mostrarBannerKit();
  requestAnimationFrame(()=>full.scrollIntoView({behavior:'smooth',block:'start'}));
}

/* El inventario llega después de pintar: la página ya es usable sin él, y si
   falla el fetch se queda como está, sin errores visibles ni venta bloqueada. */
fetch('assets/stock.json',{cache:'no-cache'})
  .then(r=>r.ok?r.json():null)
  .then(d=>{
    if(!d||!d.items) return;
    STOCK=d.items;
    document.body.classList.add('con-stock');
    /* Lo que ya estuviera elegido se depura contra el inventario real: se cae
       lo agotado y se recorta lo que pida más unidades de las que hay.
       El recorte importa desde que el carrito puede llegar en un enlace —nadie
       teclea 5 unidades a mano, pero un enlace sí las puede traer—, y también
       arregla el caso de siempre: un carrito guardado hace días contra un
       inventario que bajó. Sin esto la página promete unidades que el servidor
       va a rechazar después con un 409, ya con la clienta decidida. */
    const puestos={};
    sel=sel.filter(id=>{
      if(agotado(id)) return false;
      puestos[id]=(puestos[id]||0)+1;
      return puestos[id]<=tope(id);
    });
    if(base&&agotado(base.id)) base=null;
    render();
    aplicarFiltro(filtroActual);
    pintarCalculadora();   /* ahora sí puede marcar las tallas sin unidades */
    marcarKits();
    pintarPagina();
    if(fichaId) abrirFicha(fichaId);
    const n=document.getElementById('stock-fecha');
    if(n&&d.conteo_inventario) n.textContent='Último conteo: '+d.conteo_inventario;
  })
  .catch(()=>{});

/* En una página de producto (`<body data-producto="id">`, la escribe
   gen_productos.py) la vista es de esa pieza. En el resto, ViewContent de
   grupo con los ids de los charms destacados. */
pintarPagina();
if(document.body.dataset.producto) verPieza(document.body.dataset.producto);
else track('ViewContent',{content_type:'product_group',content_name:'Catalogo Zephora',
  content_ids:[...document.querySelectorAll('.pc--top')].map(p=>p.dataset.id)});
})();
