import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {C, SANS, SERIF, SEGURO, cop} from './estilo';

/* ── Tipos: lo que render.mjs le pasa a cada historia ── */

export type Pieza = {id: string; nombre: string; precio: number; img: string; gratis?: boolean};

export type HistoriaProps = {
  id: string;
  plantilla: 'producto' | 'pregunta' | 'anuncio' | 'resena' | 'info' | 'set';
  fondo?: 'bone' | 'rose' | 'plum' | 'ink';
  kicker?: string;
  titulo: string;
  titulo2?: string; // segunda línea en cursiva
  subtitulo?: string;
  cuerpo?: string;
  cta?: string; // texto sobre la zona del sticker de enlace
  foto?: string;
  fotoPos?: string;
  fotoAlto?: number;
  piezas?: Pieza[];
  etiquetas?: string[]; // «A», «B»… sobre cada pieza en una encuesta
  filas?: [string, string][];
  pasos?: string[];
  numero?: string; // cifra grande de los anuncios («3», «7 p. m.»)
  resena?: {texto: string; nombre: string; ciudad: string};
  totales?: {lista: number; pagas: number; contraentrega: number};
  sticker?: boolean; // deja libre la zona de encuesta/quiz/cajita
};

const FONDOS = {
  bone: {bg: C.bone, tx: C.ink, sub: C.gris, acento: C.rose},
  rose: {bg: C.roseSoft, tx: C.ink, sub: C.gris, acento: C.rose},
  plum: {bg: C.plum, tx: C.bone, sub: '#E6D9E9', acento: '#F3C9D6'},
  ink: {bg: C.ink, tx: C.bone, sub: C.silver, acento: '#F3C9D6'},
};

const img = (f: string) => staticFile(`img/${f}`);

/* ── Piezas comunes ── */

const Marca: React.FC<{color: string}> = ({color}) => (
  <div style={{position: 'absolute', top: SEGURO.arriba + 10, left: 0, right: 0, textAlign: 'center'}}>
    <div style={{fontFamily: SANS, fontWeight: 500, fontSize: 26, letterSpacing: '0.55em', color, paddingLeft: '0.55em'}}>
      ZEPHORA
    </div>
    <div style={{width: 64, height: 1.5, background: color, opacity: 0.45, margin: '14px auto 0'}} />
  </div>
);

const Kicker: React.FC<{t?: string; color: string}> = ({t, color}) =>
  t ? (
    <div style={{fontFamily: SANS, fontWeight: 500, fontSize: 28, letterSpacing: '0.28em', textTransform: 'uppercase', color, marginBottom: 22}}>
      {t}
    </div>
  ) : null;

const Titulo: React.FC<{t: string; t2?: string; color: string; acento: string; size?: number}> = ({t, t2, color, acento, size = 104}) => (
  <div style={{fontFamily: SERIF, fontWeight: 500, fontSize: size, lineHeight: 1.02, color, letterSpacing: '-0.01em'}}>
    {t}
    {t2 ? (
      <div style={{fontStyle: 'italic', color: acento}}>{t2}</div>
    ) : null}
  </div>
);

/* Texto sobre la zona donde va el sticker de enlace (se pone en Instagram). */
const Cta: React.FC<{t?: string; color: string}> = ({t, color}) =>
  t ? (
    <div style={{position: 'absolute', top: 1400, left: 0, right: 0, textAlign: 'center', fontFamily: SANS, fontWeight: 500, fontSize: 34, letterSpacing: '0.04em', color}}>
      {t}
      <div style={{fontSize: 40, marginTop: 6, opacity: 0.8}}>↓</div>
    </div>
  ) : null;

const Tarjeta: React.FC<{p: Pieza; w: number; etiqueta?: string; precio?: boolean}> = ({p, w, etiqueta, precio = true}) => (
  <div style={{width: w, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
    <div
      style={{
        width: w,
        height: w,
        background: C.white,
        borderRadius: 36,
        boxShadow: '0 28px 60px rgba(42,31,46,0.13)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Img src={img(p.img)} style={{width: '100%', height: '100%', objectFit: 'contain', padding: w * 0.07, boxSizing: 'border-box'}} />
      {etiqueta ? (
        <div style={{position: 'absolute', top: 22, left: 22, minWidth: 64, height: 64, padding: '0 20px', boxSizing: 'border-box', borderRadius: 32, background: C.plum, color: C.bone, fontFamily: SANS, fontWeight: 600, fontSize: 32, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          {etiqueta}
        </div>
      ) : null}
      {p.gratis ? (
        <div style={{position: 'absolute', top: 20, right: 20, background: C.rose, color: C.white, fontFamily: SANS, fontWeight: 600, fontSize: w > 380 ? 28 : 22, letterSpacing: '0.12em', padding: '8px 18px', borderRadius: 40}}>
          GRATIS
        </div>
      ) : null}
    </div>
    <div style={{fontFamily: SERIF, fontWeight: 600, fontSize: w > 380 ? 40 : 30, color: C.ink, marginTop: 16, textAlign: 'center', lineHeight: 1.05}}>{p.nombre}</div>
    {precio ? (
      <div style={{fontFamily: SANS, fontSize: w > 380 ? 30 : 24, color: C.gris, marginTop: 4, textDecoration: p.gratis ? 'line-through' : 'none'}}>{cop(p.precio)}</div>
    ) : null}
  </div>
);

/* Foto de ambiente: nítida y enmarcada a su tamaño real, sobre la misma foto
   desenfocada. Las fotos de ambiente miden 720 px: a pantalla completa se
   verían blandas. */
const FondoFoto: React.FC<{foto: string; pos?: string; oscuro?: number}> = ({foto, pos, oscuro = 0.45}) => (
  <>
    <Img src={img(foto)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos || 'center', filter: 'blur(38px) saturate(1.1)', transform: 'scale(1.25)'}} />
    <AbsoluteFill style={{background: `rgba(42,31,46,${oscuro})`}} />
  </>
);

const Marco: React.FC<{foto: string; pos?: string; w: number; h: number}> = ({foto, pos, w, h}) => (
  <div style={{width: w, height: h, minHeight: 340, flexShrink: 1, borderRadius: 40, overflow: 'hidden', boxShadow: '0 30px 70px rgba(0,0,0,0.28)'}}>
    <Img src={img(foto)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos || 'center'}} />
  </div>
);

/* ── Plantillas ── */

const Producto: React.FC<HistoriaProps> = (p) => {
  const f = FONDOS[p.fondo || 'rose'];
  const piezas = p.piezas || [];
  const dos = piezas.length > 1;
  return (
    <AbsoluteFill style={{background: f.bg}}>
      <Marca color={f.tx} />
      <div style={{position: 'absolute', top: 400, left: 90, right: 90, textAlign: 'center'}}>
        <Kicker t={p.kicker} color={f.acento} />
        <Titulo t={p.titulo} t2={p.titulo2} color={f.tx} acento={f.acento} size={dos ? 92 : 104} />
      </div>
      <div style={{position: 'absolute', top: dos ? 700 : 680, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 48}}>
        {piezas.map((x) => (
          <Tarjeta key={x.id} p={x} w={dos ? 430 : 600} />
        ))}
      </div>
      {p.cuerpo ? (
        <div style={{position: 'absolute', top: dos ? 1300 : 1460, left: 120, right: 120, textAlign: 'center', fontFamily: SANS, fontSize: 30, lineHeight: 1.4, color: f.sub}}>{p.cuerpo}</div>
      ) : null}
      {dos ? <Cta t={p.cta} color={f.tx} /> : null}
      {!dos && p.cta ? (
        <div style={{position: 'absolute', top: 1560, left: 0, right: 0, textAlign: 'center', fontFamily: SANS, fontWeight: 500, fontSize: 30, color: f.tx}}>{p.cta} ↓</div>
      ) : null}
    </AbsoluteFill>
  );
};

const Pregunta: React.FC<HistoriaProps> = (p) => {
  const f = FONDOS[p.fondo || 'bone'];
  const piezas = p.piezas || [];
  const n = piezas.length;
  const w = n >= 3 ? 290 : 420;
  return (
    <AbsoluteFill style={{background: f.bg}}>
      <Marca color={f.tx} />
      {/* Debajo de 1330 queda libre para el sticker de encuesta, quiz o cajita. */}
      <div style={{position: 'absolute', top: 390, bottom: 1920 - 1320, left: 90, right: 90, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <div style={{textAlign: 'center'}}>
          <Kicker t={p.kicker} color={f.acento} />
          <Titulo t={p.titulo} t2={p.titulo2} color={f.tx} acento={f.acento} size={p.titulo.length > 22 ? 84 : 96} />
          {p.subtitulo ? <div style={{fontFamily: SANS, fontSize: 32, color: f.sub, marginTop: 20}}>{p.subtitulo}</div> : null}
        </div>
        {n ? (
          <div style={{display: 'flex', justifyContent: 'center', gap: n >= 3 ? 30 : 44, marginTop: 'auto'}}>
            {piezas.map((x, i) => (
              <Tarjeta key={x.id} p={x} w={w} etiqueta={p.etiquetas?.[i]} precio={false} />
            ))}
          </div>
        ) : p.foto ? (
          <div style={{marginTop: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0}}>
            <Marco foto={p.foto} pos={p.fotoPos} w={760} h={p.fotoAlto || 560} />
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const Anuncio: React.FC<HistoriaProps> = (p) => {
  const f = FONDOS[p.fondo || 'plum'];
  return (
    <AbsoluteFill style={{background: f.bg}}>
      {p.foto ? <FondoFoto foto={p.foto} pos={p.fotoPos} oscuro={0.5} /> : null}
      <Marca color={p.foto ? C.bone : f.tx} />

      {!p.foto ? (
        <div style={{position: 'absolute', top: 210, bottom: 210, left: 56, right: 56, border: `1.5px solid ${f.tx}`, opacity: 0.22, borderRadius: 28}} />
      ) : null}
      <div
        style={
          p.foto
            ? {position: 'absolute', top: 380, bottom: p.cta ? 540 : 330, left: 90, right: 90, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}
            : {position: 'absolute', top: 380, bottom: p.cta ? 560 : 380, left: 110, right: 110, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center'}
        }
      >
        {p.foto ? (
          <div style={{display: 'flex', flexDirection: 'column', minHeight: 0, flexShrink: 1, marginBottom: 56}}>
            <Marco foto={p.foto} pos={p.fotoPos} w={640} h={p.fotoAlto || 640} />
          </div>
        ) : null}
        <Kicker t={p.kicker} color={p.foto ? '#F3C9D6' : f.acento} />
        {p.numero ? (
          <div style={{fontFamily: SERIF, fontWeight: 500, fontSize: p.numero.length > 3 ? 190 : 300, lineHeight: 0.9, color: p.foto ? C.bone : f.tx, marginBottom: 20}}>{p.numero}</div>
        ) : null}
        <Titulo t={p.titulo} t2={p.titulo2} color={p.foto ? C.bone : f.tx} acento={p.foto ? '#F3C9D6' : f.acento} size={p.foto ? 84 : 128} />
        {p.subtitulo ? <div style={{fontFamily: SANS, fontSize: p.foto ? 34 : 38, lineHeight: 1.4, color: p.foto ? '#EDE3EE' : f.sub, marginTop: 34}}>{p.subtitulo}</div> : null}
      </div>
      <Cta t={p.cta} color={p.foto ? C.bone : f.tx} />
    </AbsoluteFill>
  );
};

const Resena: React.FC<HistoriaProps> = (p) => {
  const f = FONDOS[p.fondo || 'bone'];
  const r = p.resena!;
  return (
    <AbsoluteFill style={{background: f.bg}}>
      <Marca color={f.tx} />
      <div style={{position: 'absolute', top: 380, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
        <Marco foto={p.foto!} pos={p.fotoPos} w={720} h={p.fotoAlto || 600} />
      </div>
      <div style={{position: 'absolute', top: 380 + (p.fotoAlto || 600) + 56, left: 110, right: 110, textAlign: 'center'}}>
        <div style={{color: C.estrella, fontSize: 44, letterSpacing: '0.18em'}}>★★★★★</div>
        <div style={{fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: r.texto.length > 120 ? 50 : 58, lineHeight: 1.18, color: f.tx, marginTop: 24}}>«{r.texto}»</div>
        <div style={{fontFamily: SANS, fontWeight: 600, fontSize: 30, color: f.tx, marginTop: 30}}>{r.nombre}</div>
        <div style={{fontFamily: SANS, fontSize: 26, color: f.sub, marginTop: 4}}>{r.ciudad} · Compra verificada</div>
      </div>
    </AbsoluteFill>
  );
};

const Info: React.FC<HistoriaProps> = (p) => {
  const f = FONDOS[p.fondo || 'bone'];
  return (
    <AbsoluteFill style={{background: f.bg}}>
      <Marca color={f.tx} />
      <div style={{position: 'absolute', top: 380, bottom: p.cta ? 560 : 330, left: 100, right: 100, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <div style={{textAlign: 'center'}}>
          <Kicker t={p.kicker} color={f.acento} />
          <Titulo t={p.titulo} t2={p.titulo2} color={f.tx} acento={f.acento} size={104} />
        </div>
        {p.foto ? (
          <div style={{display: 'flex', justifyContent: 'center', marginTop: 44}}>
            <Marco foto={p.foto} pos={p.fotoPos} w={520} h={p.fotoAlto || 300} />
          </div>
        ) : null}
        {p.pasos ? (
          <div style={{marginTop: 56}}>
            {p.pasos.map((t, i) => (
              <div key={i} style={{display: 'flex', alignItems: 'flex-start', gap: 30, padding: '26px 0', borderTop: i ? `1.5px solid ${f.tx === C.ink ? C.line : 'rgba(255,255,255,0.18)'}` : 'none'}}>
                <div style={{fontFamily: SERIF, fontWeight: 600, fontSize: 72, lineHeight: 0.9, color: f.acento, width: 60}}>{i + 1}</div>
                <div style={{fontFamily: SANS, fontSize: 40, lineHeight: 1.35, color: f.tx}}>{t}</div>
              </div>
            ))}
          </div>
        ) : null}
        {p.filas ? (
          <div style={{marginTop: 56}}>
            {p.filas.map(([a, b], i) => (
              <div key={i} style={{display: 'flex', justifyContent: 'space-between', gap: 30, padding: '24px 0', borderTop: `1.5px solid ${f.tx === C.ink ? C.line : 'rgba(255,255,255,0.18)'}`}}>
                <div style={{fontFamily: SANS, fontSize: 37, color: f.tx}}>{a}</div>
                <div style={{fontFamily: SANS, fontWeight: 600, fontSize: 37, color: f.tx, textAlign: 'right'}}>{b}</div>
              </div>
            ))}
          </div>
        ) : null}
        {p.cuerpo ? <div style={{fontFamily: SANS, fontSize: 31, lineHeight: 1.45, color: f.sub, marginTop: 40, textAlign: 'center'}}>{p.cuerpo}</div> : null}
      </div>
      <Cta t={p.cta} color={f.tx} />
    </AbsoluteFill>
  );
};

/* El set: las piezas reales con su precio y las que salen gratis según
   calcular(). Los números los pone render.mjs, nunca esta plantilla. */
const SetPromo: React.FC<HistoriaProps> = (p) => {
  const f = FONDOS[p.fondo || 'rose'];
  const piezas = p.piezas || [];
  const seis = piezas.length > 4;
  const w = seis ? 262 : 300;
  const t = p.totales!;
  return (
    <AbsoluteFill style={{background: f.bg}}>
      <Marca color={f.tx} />
      <div style={{position: 'absolute', top: 360, bottom: 1920 - SEGURO.abajo, left: 70, right: 70, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <div style={{textAlign: 'center'}}>
          <Kicker t={p.kicker} color={f.acento} />
          <Titulo t={p.titulo} t2={p.titulo2} color={f.tx} acento={f.acento} size={84} />
        </div>
        <div style={{display: 'grid', gridTemplateColumns: `repeat(${seis ? 3 : 2}, ${w}px)`, columnGap: 34, rowGap: 22, marginTop: 44, alignItems: 'start'}}>
          {piezas.map((x) => (
            <Tarjeta key={x.id + x.nombre} p={x} w={w} />
          ))}
        </div>
        <div style={{marginTop: 'auto', textAlign: 'center'}}>
          <div style={{fontFamily: SANS, fontSize: 30, color: f.sub, textDecoration: 'line-through'}}>{cop(t.lista)}</div>
          <div style={{fontFamily: SERIF, fontWeight: 600, fontSize: 96, color: f.tx, lineHeight: 1}}>{cop(t.pagas)}</div>
          <div style={{fontFamily: SANS, fontSize: 26, color: f.sub, marginTop: 10}}>
            pagando en línea, con envío gratis · contraentrega {cop(t.contraentrega)}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Historia: React.FC<HistoriaProps> = (p) => {
  switch (p.plantilla) {
    case 'producto':
      return <Producto {...p} />;
    case 'pregunta':
      return <Pregunta {...p} />;
    case 'anuncio':
      return <Anuncio {...p} />;
    case 'resena':
      return <Resena {...p} />;
    case 'info':
      return <Info {...p} />;
    case 'set':
      return <SetPromo {...p} />;
  }
};
