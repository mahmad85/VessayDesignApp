'use client';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Minus, Plus, RotateCcw, Move } from 'lucide-react';
import type { Design } from '@/modules/configuration/types';
import { REGIONS, type RegionId, type SketchView, type Reveal } from './focus-regions';
import { sketchSpec, shoeStyle, type SketchSpec } from './sketch-spec';

// Interactive 2D technical drawing. It is an illustration of the accepted
// configuration, not a pattern or a fit simulation.

const SKIN = { porcelain: '#e2cbb6', warm: '#b99779', tan: '#987456', deep: '#604436' };
const SHIRT = '#f6f4ee';
const FULL: Box = [0, 0, 400, 800];
type Box = [number, number, number, number];
type P = [number, number];

export type SketchFocus = {
  region: RegionId;
  label?: string;
  value?: string;
  nonce: number;
};

export type SketchHotspot = { region: RegionId; leafId: string; label: string };

function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) =>
    Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)
      .toString(16)
      .padStart(2, '0');
  return `#${mix(n >> 16)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
}
/** Leaves breathing room around a focused region. */
function padded([x, y, w, h]: Box): Box {
  if (w >= 400) return [x, y, w, h];
  const px = w * 0.14;
  const py = h * 0.14;
  return [x - px, y - py, w + 2 * px, h + 2 * py];
}
function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150;
}
const pts = (list: P[]) => list.map((p) => p.join(',')).join(' ');
const mirror = (list: P[]): P[] => list.map(([x, y]) => [400 - x, y]);

function fitWidths(fit: SketchSpec['fit']) {
  return fit === 'slim'
    ? { chest: 82, waist: 74, hem: 77 }
    : fit === 'regular'
      ? { chest: 86, waist: 80, hem: 82 }
      : { chest: 90, waist: 86, hem: 88 };
}

function jacketLayout(style: string) {
  const db = style.startsWith('crossed');
  const mao = style === 'mao';
  const rows: Record<string, number[]> = {
    simple_1: [338],
    simple_2: [322, 372],
    simple_3: [292, 336, 380],
    crossed_2: [350],
    crossed_4: [330, 380],
    crossed_6: [280, 330, 380],
    mao: [178, 226, 274, 322, 370],
  };
  const buttons = rows[style] ?? rows.simple_2;
  const vBottom = mao ? 146 : style === 'crossed_6' ? 322 : buttons[0] - 6;
  return { db, mao, buttons, vBottom, edge: db ? 184 : 200 };
}

/** Jacket silhouette from shoulders to hem, excluding the neckline opening. */
function jacketBody(spec: SketchSpec, back = false) {
  const w = fitWidths(spec.fit);
  const layout = jacketLayout(spec.jacket?.style ?? 'simple_2');
  const lowest = layout.buttons[layout.buttons.length - 1];
  const left = `M180,146 L110,160 C101,188 110,230 ${200 - w.chest},252 L${200 - w.waist},336 Q${200 - w.hem + 1},410 ${200 - w.hem},480`;
  const right = `L${200 + w.hem},480 Q${200 + w.hem - 1},410 ${200 + w.waist},336 L${200 + w.chest},252 C290,230 299,188 290,160 L220,146`;
  if (back)
    return `${left} L${200 + w.hem},480 ${right.slice(right.indexOf('Q'))} Q200,136 180,146 Z`;
  if (layout.db)
    return `${left} Q${200 - w.hem + 20},484 184,484 L${200 + w.hem},480 ${right.slice(right.indexOf('Q'))} L220,146 L${layout.edge},${layout.vBottom} Z`;
  const cut = `Q${200 - w.hem + 30},488 186,486 Q196,${lowest + 40} 200,${lowest + 16} Q204,${lowest + 40} 214,486 Q${200 + w.hem - 30},488 ${200 + w.hem},480`;
  const rest = right.slice(right.indexOf('Q'));
  return `${left} ${cut} ${rest} L220,146 L200,${layout.vBottom} Z`;
}

function lapelShapes(spec: SketchSpec): { lapels: P[][]; collars: P[][]; shawl: string[] } {
  const jacket = spec.jacket!;
  const layout = jacketLayout(jacket.style);
  if (layout.mao) return { lapels: [], collars: [], shawl: [] };
  const L = jacket.lapelWidth === 'narrow' ? 28 : jacket.lapelWidth === 'width' ? 48 : 38;
  const vb = layout.vBottom;
  const vx = layout.edge;
  const g = 198;
  const edge = (y: number): number => 180 + ((vx - 180) * (y - 146)) / (vb - 146);
  const rightEdge = (y: number): number => 220 + ((vx - 220) * (y - 146)) / (vb - 146);
  if (jacket.lapelType === 'round') {
    const make = (side: 1 | -1) => {
      const e = side < 0 ? edge : rightEdge;
      const out = side < 0 ? -1 : 1;
      return `M${vx},${vb} Q${e(g + 40) + out * (L + 6)},${g + 30} ${200 + out * 36},150 L${200 + out * 20},146 L${vx},${vb} Z`;
    };
    return { lapels: [], collars: [], shawl: [make(-1), make(1)] };
  }
  const peak = jacket.lapelType === 'peak';
  const left: P[] = [
    [vx, vb],
    [edge(g + 46) - L, g + 42],
    peak ? [edge(g) - L - 8, g - 14] : [edge(g) - L - 1, g + 4],
    peak ? [edge(g) - L + 16, g + 3] : [edge(g) - L + 12, g - 3],
    [edge(g) - 2, g + 1],
  ];
  const leftCollar: P[] = [
    [edge(g) - 2, g - 1],
    peak ? [edge(g) - L + 18, g - 1] : [edge(g) - L + 20, g - 8],
    [162, 151],
    [180, 146],
  ];
  const mirrorAround = (list: P[]): P[] =>
    list.map(([x, y]) => {
      // Mirror across the centre, then shift the lapel onto a double-breasted front edge.
      const t = (y - 146) / (vb - 146);
      const shift = layout.db ? (vx - 200) * 2 * t : 0;
      return [400 - x + shift, y];
    });
  return {
    lapels: [left, mirrorAround(left)],
    collars: [leftCollar, mirrorAround(leftCollar)],
    shawl: [],
  };
}

function Pocket({
  x,
  y,
  width,
  type,
  fill,
  slant = 0,
}: {
  x: number;
  y: number;
  width: number;
  type: string;
  fill: string;
  slant?: number;
}) {
  const h = 14;
  const kind = type.replace(/^\d/, '');
  return (
    <g transform={`rotate(${slant} ${x} ${y})`} className="sk-detail">
      {type.endsWith('b') ? (
        <path
          d={`M${x - width / 2},${y - 6} h${width} v34 q0,12 -12,12 h${-width + 24} q-12,0 -12,-12 z`}
          className="sk-panel"
          fill={fill}
        />
      ) : kind === 'a' || kind === 'd' ? (
        <>
          <rect x={x - width / 2} y={y - 2} width={width} height={3} className="sk-welt" />
          <rect x={x - width / 2} y={y + 2} width={width} height={3} className="sk-welt" />
        </>
      ) : (
        <path
          d={`M${x - width / 2},${y} h${width} v${h - 3} q0,3 -3,3 h${-width + 6} q-3,0 -3,-3 z`}
          className="sk-panel"
          fill={fill}
        />
      )}
    </g>
  );
}

function Button({
  x,
  y,
  r = 4.2,
  fill,
  holes,
}: {
  x: number;
  y: number;
  r?: number;
  fill: string;
  holes?: string;
}) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={fill} className="sk-button" />
      <circle cx={x - 1.2} cy={y - 1} r={0.7} fill={holes ?? '#ffffff55'} />
      <circle cx={x + 1.2} cy={y + 1} r={0.7} fill={holes ?? '#ffffff55'} />
    </g>
  );
}

function Trousers({
  spec,
  color,
  id,
  back,
}: {
  spec: SketchSpec;
  color: string;
  id: string;
  back?: boolean;
}) {
  const t = spec.trousers;
  const bermuda = t.length === 'bermuda';
  const hemY = bermuda ? 596 : t.break === 'no' ? 750 : t.break === 'full' ? 768 : 760;
  const legW = t.fit === 'slim' ? 20 : 24;
  const leg = (side: -1 | 1): P[] => {
    const c = 200 + side * 41;
    return [
      [200 + side * 62, 398],
      [200 + side * 66, 452],
      [c + side * legW, hemY + (t.break === 'full' ? -side * 2 : 0)],
      [c - side * legW, hemY + (t.break === 'full' ? side * 2 : 0)],
      [200 + side * 2, 506],
      [200, 404],
    ];
  };
  const stroke = shade(color, -0.4);
  return (
    <g>
      {[-1, 1].map((side) => (
        <g key={side}>
          <polygon
            points={pts(leg(side as -1 | 1))}
            fill={`url(#${id}-trouser)`}
            stroke={stroke}
            strokeWidth={1.2}
          />
          <line
            x1={200 + side * 44}
            y1={bermuda ? 470 : 420}
            x2={200 + side * 41}
            y2={hemY - 4}
            className="sk-crease"
          />
          {t.break !== 'no' && !bermuda && (
            <path
              d={`M${200 + side * 41 - legW + 3},${hemY - 18} q${legW - 3},${t.break === 'full' ? 9 : 5} ${2 * legW - 6},0`}
              className="sk-fold"
            />
          )}
          {t.cuffs && (
            <rect
              x={200 + side * 41 - legW}
              y={hemY - 11}
              width={legW * 2}
              height={11}
              className="sk-cuff"
              fill={`url(#${id}-trouser)`}
            />
          )}
        </g>
      ))}
      <rect
        x={138}
        y={392}
        width={124}
        height={12}
        fill={`url(#${id}-trouser)`}
        stroke={stroke}
        strokeWidth={1.1}
      />
      {!back && (
        <>
          <path d="M200,404 L200,462 Q200,470 208,466" className="sk-line" />
          {t.frontPocket === 'diagonal'
            ? [-1, 1].map((side) => (
                <line
                  key={side}
                  x1={200 + side * 48}
                  y1={404}
                  x2={200 + side * 62}
                  y2={446}
                  className="sk-line"
                />
              ))
            : [-1, 1].map((side) => (
                <path
                  key={side}
                  d={`M${200 + side * 44},404 Q${200 + side * 48},436 ${200 + side * 66},440`}
                  className="sk-line"
                />
              ))}
          {Array.from({ length: t.pleats }).flatMap((_, i) =>
            [-1, 1].map((side) => (
              <line
                key={`${side}-${i}`}
                x1={200 + side * (22 + i * 8)}
                y1={404}
                x2={200 + side * (23 + i * 8)}
                y2={438 - i * 8}
                className="sk-line"
              />
            )),
          )}
          {t.fastening.startsWith('1') ? (
            <>
              <path d="M200,392 h18 v12 h-18" className="sk-line" />
              {!t.fastening.endsWith('hidden') && <Button x={212} y={398} r={3} fill="#2f2a25" />}
            </>
          ) : (
            !t.fastening.endsWith('hidden') && <Button x={200} y={398} r={3} fill="#2f2a25" />
          )}
          {t.suspenderButtons &&
            [-34, -22, 22, 34].map((dx) => (
              <circle key={dx} cx={200 + dx} cy={396} r={2} className="sk-button" fill="#2f2a25" />
            ))}
        </>
      )}
      {back &&
        t.backPocket !== '0' &&
        [-1, 1]
          .filter((side) => t.backPocket.endsWith('2') || side === -1)
          .map((side) => (
            <g key={side}>
              {t.backPocket.startsWith('B') ? (
                <path
                  d={`M${200 + side * 32 - 17},424 h34 v28 q0,6 -6,6 h-22 q-6,0 -6,-6 z`}
                  className="sk-panel"
                  fill={`url(#${id}-trouser)`}
                />
              ) : t.backPocket.startsWith('C') ? (
                <path
                  d={`M${200 + side * 32 - 17},426 h34 v10 q0,3 -3,3 h-28 q-3,0 -3,-3 z`}
                  className="sk-panel"
                  fill={`url(#${id}-trouser)`}
                />
              ) : (
                <>
                  <rect
                    x={200 + side * 32 - 16}
                    y={428}
                    width={32}
                    height={2.5}
                    className="sk-welt"
                  />
                  <rect
                    x={200 + side * 32 - 16}
                    y={431.5}
                    width={32}
                    height={2.5}
                    className="sk-welt"
                  />
                  <Button x={200 + side * 32} y={440} r={2.6} fill="#2f2a25" />
                </>
              )}
            </g>
          ))}
      {t.waist === '2' &&
        [-1, 1].map((side) => (
          <g key={side}>
            <rect
              x={200 + side * 58 - 6}
              y={394}
              width={12}
              height={7}
              rx={1}
              className="sk-panel"
              fill={`url(#${id}-trouser)`}
            />
            <rect
              x={200 + side * 58 - 3}
              y={395.5}
              width={6}
              height={4}
              fill="none"
              stroke="#bfa46a"
              strokeWidth={1}
            />
          </g>
        ))}
      {t.waist === '1' &&
        [-1, 1].map((side) => (
          <path
            key={side}
            d={`M${200 + side * 52},394 v8 M${200 + side * 55},394 v8 M${200 + side * 58},394 v8`}
            className="sk-line"
          />
        ))}
      {t.belt && (
        <g>
          <rect x={138} y={394} width={124} height={8} fill="#4a3322" />
          {[-44, -18, 18, 44].map((dx) => (
            <rect
              key={dx}
              x={200 + dx - 2}
              y={391}
              width={4}
              height={14}
              fill={`url(#${id}-trouser)`}
              stroke={stroke}
              strokeWidth={0.6}
            />
          ))}
          {!back && (
            <rect
              x={193}
              y={393}
              width={14}
              height={10}
              rx={1.5}
              fill="none"
              stroke="#c9ad6c"
              strokeWidth={2}
            />
          )}
        </g>
      )}
    </g>
  );
}

/** Men's shoes seen from the front or back, with welt and sole. */
function Feet({ spec, id, back }: { spec: SketchSpec; id: string; back?: boolean }) {
  const shoe = shoeStyle(spec.shoes);
  const bermuda = spec.trousers.length === 'bermuda';
  const skin = SKIN[spec.skinTone];
  const edge = shade(shoe.color, shoe.color === '#ece9e1' ? -0.25 : 0.3);
  return (
    <g>
      {bermuda &&
        [-1, 1].map((side) => {
          const c = 200 + side * 41;
          // Calf and ankle below knee-length trousers.
          return (
            <path
              key={side}
              d={`M${c - 18},596 C${c - 21},640 ${c - 19},690 ${c - 11},748 L${c + 11},748 C${c + 19},690 ${c + 21},640 ${c + 18},596 Z`}
              fill={skin}
            />
          );
        })}
      {[-1, 1].map((side) => {
        const c = 200 + side * 41;
        const top = shoe.boot ? 738 : 752;
        return (
          <g key={side}>
            <rect
              x={c - 13}
              y={bermuda ? 728 : 738}
              width={26}
              height={bermuda ? 30 : 22}
              fill={spec.socks.on && spec.socks.asset ? `url(#${id}-socks)` : '#26282b'}
            />
            {back ? (
              <>
                <path
                  d={`M${c - 16},${top} C${c - 18},770 ${c - 17},782 ${c - 13},786 L${c + 13},786 C${c + 17},782 ${c + 18},770 ${c + 16},${top} Z`}
                  fill={shoe.color}
                  stroke={edge}
                  strokeWidth={1}
                />
                <rect x={c - 13} y={784} width={26} height={7} rx={1.5} fill="#1b1816" />
              </>
            ) : (
              <>
                {/* Instep behind a rounded toe cap, turned slightly outwards. */}
                <rect
                  x={c - 14}
                  y={top}
                  width={28}
                  height={786 - top}
                  rx={4}
                  fill={shade(shoe.color, shoe.color === '#ece9e1' ? -0.12 : -0.15)}
                />
                <path
                  d={`M${c - 20 + side * 2},787 L${c - 20 + side * 2},777 C${c - 20 + side * 2},768 ${c - 10 + side * 2},764 ${c + side * 2},764 C${c + 10 + side * 2},764 ${c + 20 + side * 2},768 ${c + 20 + side * 2},777 L${c + 20 + side * 2},787 Z`}
                  fill={shoe.color}
                  stroke={edge}
                  strokeWidth={1}
                />
                <ellipse
                  cx={c + side * 2}
                  cy={769}
                  rx={8}
                  ry={2.6}
                  fill="#ffffff"
                  opacity={shoe.color === '#ece9e1' ? 0.3 : 0.14}
                />
                {!shoe.sneaker && !shoe.boot && (
                  <path
                    d={`M${c - 7 + side * 2},776 Q${c + side * 2},772 ${c + 7 + side * 2},776`}
                    fill="none"
                    stroke={edge}
                    strokeWidth={0.8}
                  />
                )}
                <rect
                  x={c - 22 + side * 2}
                  y={786}
                  width={44}
                  height={shoe.sneaker ? 6 : 4}
                  rx={2}
                  fill={shoe.sneaker ? '#e7e3da' : '#1b1816'}
                />
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** A relaxed hanging hand seen from the front: edge of the palm, thumb in front. */
function handPaths(side: -1 | 1) {
  const k = -side; // The thumb faces the body.
  const X = (u: number) => 200 + side * 83 + k * (u - 8);
  return {
    hand: `M${X(0)},456 C${X(-2)},468 ${X(-3)},480 ${X(-2)},488 C${X(-1)},497 ${X(2)},505 ${X(6)},509 C${X(9)},511 ${X(13)},509 ${X(14)},503 C${X(15)},495 ${X(16)},486 ${X(16)},477 L${X(16)},456 Z`,
    thumb: `M${X(13)},461 C${X(18)},466 ${X(21)},474 ${X(21)},483 C${X(21)},489 ${X(17)},491 ${X(14)},487 Z`,
    fingers: `M${X(2)},492 C${X(4)},497 ${X(6)},501 ${X(9)},504 M${X(7)},488 C${X(9)},494 ${X(11)},498 ${X(13)},500`,
  };
}

function Figure({ spec, back }: { spec: SketchSpec; back?: boolean }) {
  const skin = SKIN[spec.skinTone];
  const shadow = shade(skin, -0.22);
  const hair = '#2a221d';
  return (
    <g>
      {/* Neck with trapezius, wider and shorter than a female croquis. */}
      <path d="M182,96 C183,118 182,134 178,148 L222,148 C218,134 217,118 218,96 Z" fill={skin} />
      {/* Head sits low on a short, strong neck. */}
      <g transform="translate(0 6)">
        {/* Ears */}
        {[-1, 1].map((side) => (
          <ellipse
            key={side}
            cx={200 + side * 27}
            cy={78}
            rx={4.5}
            ry={9}
            fill={skin}
            stroke={shadow}
            strokeOpacity={0.4}
            strokeWidth={0.8}
          />
        ))}
        {/* Squarer skull, angular jaw and a broad chin. */}
        <path
          d="M200,34 C225,34 229,54 228,72 C227,86 225,94 221,99 C216,105 210,110 206,112 L194,112 C190,110 184,105 179,99 C175,94 173,86 172,72 C171,54 175,34 200,34 Z"
          fill={skin}
        />
        {!back && (
          <path
            d="M183,103 C188,108 191,110 194,112 L206,112 C209,110 212,108 217,103 C213,114 206,118 200,118 C194,118 187,114 183,103 Z"
            fill={shadow}
            opacity={0.35}
          />
        )}
        {/* Short tapered cut with a side part. */}
        {back ? (
          <path
            d="M172,72 C169,44 183,30 200,30 C217,30 231,44 228,72 C228,82 225,88 219,92 C212,95 206,96 200,96 C194,96 188,95 181,92 C175,88 172,82 172,72 Z"
            fill={hair}
          />
        ) : (
          <>
            <path
              d="M172,72 C168,44 182,29 202,29 C221,29 232,42 228,72 C226,62 223,55 216,51 C205,46 190,48 180,55 C176,58 174,64 172,72 Z"
              fill={hair}
            />
            <path
              d="M172,66 L175,64 L175.5,80 L172.5,84 Z M228,66 L225,64 L224.5,80 L227.5,84 Z"
              fill={hair}
            />
            <path
              d="M190,46 C196,40 206,38 214,40"
              fill="none"
              stroke="#ffffff"
              strokeOpacity={0.12}
              strokeWidth={1.2}
            />
          </>
        )}
      </g>
      {[-1, 1].map((side) => {
        const paths = handPaths(side as -1 | 1);
        return (
          <g key={side}>
            <path d={paths.hand} fill={skin} />
            <path
              d={paths.thumb}
              fill={skin}
              stroke={shadow}
              strokeOpacity={0.45}
              strokeWidth={0.8}
            />
            <path
              d={paths.fingers}
              fill="none"
              stroke={shadow}
              strokeOpacity={0.5}
              strokeWidth={0.8}
            />
          </g>
        );
      })}
    </g>
  );
}

function Shirt({ spec, id, full }: { spec: SketchSpec; id: string; full: boolean }) {
  const w = fitWidths(spec.fit);
  const collarPoint = spec.shirt.collar === 'Point';
  return (
    <g>
      {full ? (
        <>
          <path
            d={`M184,146 L112,160 C102,200 110,232 ${200 - w.chest + 2},254 L${200 - w.waist + 4},340 L${200 - 60},398 L${200 + 60},398 L${200 + w.waist - 4},340 L${200 + w.chest - 2},254 C290,232 298,200 288,160 L216,146 Z`}
            fill={`url(#${id}-shirt)`}
            stroke="#b7b6ad"
            strokeWidth={1.2}
          />
          {[-1, 1].map((side) => {
            const cuffY = 440;
            return (
              <g key={side}>
                <path
                  d={`M${200 + side * 86},160 C${200 + side * 104},250 ${200 + side * 103},380 ${200 + side * 101},${cuffY} L${200 + side * 65},${cuffY + 2} L${200 + side * (w.chest - 2)},262 Z`}
                  fill={`url(#${id}-shirt)`}
                  stroke="#b7b6ad"
                  strokeWidth={1.2}
                />
                <rect
                  x={200 + side * 83 - 18}
                  y={cuffY}
                  width={36}
                  height={spec.shirt.cuffs === 'French' ? 22 : 16}
                  rx={2}
                  fill={`url(#${id}-shirt)`}
                  stroke="#b7b6ad"
                  strokeWidth={1.2}
                />
                {spec.shirt.cuffs === 'French' ? (
                  <rect
                    x={200 + side * 83 + side * 9 - 3}
                    y={cuffY + 8}
                    width={6}
                    height={6}
                    rx={1}
                    fill="#c3a15f"
                  />
                ) : (
                  <Button
                    x={200 + side * 83 + side * 9}
                    y={cuffY + 8}
                    r={2.4}
                    fill="#e9e6de"
                    holes="#9a988f"
                  />
                )}
              </g>
            );
          })}
          <line x1={200} y1={160} x2={200} y2={400} stroke="#c7c6bd" strokeWidth={1} />
          {[186, 226, 266, 306, 346, 386].map((y) => (
            <Button key={y} x={200} y={y} r={2.4} fill="#eeebe3" holes="#a09e96" />
          ))}
        </>
      ) : (
        <polygon
          points={pts([
            [180, 146],
            [220, 146],
            [226, 420],
            [174, 420],
          ])}
          fill={SHIRT}
        />
      )}
      <path
        d="M182,150 L184,134 Q200,140 216,134 L218,150 Q200,158 182,150 Z"
        fill={full ? `url(#${id}-shirt)` : SHIRT}
        stroke="#b9b7ae"
        strokeWidth={1}
      />
      {[-1, 1].map((side) => (
        <polygon
          key={side}
          points={pts(
            collarPoint
              ? [
                  [200, 164],
                  [200 + side * 16, 140],
                  [200 + side * 20, 148],
                  [200 + side * 10, 186],
                ]
              : [
                  [200, 164],
                  [200 + side * 16, 140],
                  [200 + side * 24, 150],
                  [200 + side * 24, 176],
                ],
          )}
          fill={full ? `url(#${id}-shirt)` : SHIRT}
          stroke="#b9b7ae"
          strokeWidth={1}
        />
      ))}
    </g>
  );
}

function Tie({ spec, id }: { spec: SketchSpec; id: string }) {
  if (spec.bowtie.on)
    return (
      <g>
        <path
          d="M200,160 L182,151 L182,171 Z M200,160 L218,151 L218,171 Z"
          fill={`url(#${id}-bowtie)`}
          stroke="#00000044"
        />
        <rect
          x={195}
          y={155}
          width={10}
          height={10}
          rx={2}
          fill={`url(#${id}-bowtie)`}
          stroke="#00000044"
        />
      </g>
    );
  if (!spec.tie.on) return null;
  return (
    <g>
      <path
        d="M194,156 L206,156 L204,170 L196,170 Z M196,170 L204,170 L212,380 L200,394 L188,380 Z"
        fill={`url(#${id}-tie)`}
        stroke="#00000033"
      />
    </g>
  );
}

function Vest({ spec, id }: { spec: SketchSpec; id: string }) {
  const vest = spec.vest!;
  const db = vest.style.startsWith('crossed');
  const count = vest.style === 'simple_4' ? 4 : vest.style === 'simple_5' ? 5 : 3;
  const top = db ? 250 : 236;
  const buttons = Array.from(
    { length: count },
    (_, i) => top + 14 + i * ((402 - top - 14) / count),
  );
  const bottom = vest.bottom === 'cut' ? 'L200,432 L166,420' : 'L200,422 L166,422';
  const stroke = shade(spec.fabric.color, -0.4);
  return (
    <g>
      <path
        d={`M186,150 L160,168 Q150,210 146,262 L148,418 L166,420 ${bottom.replace('L166,420', '')} ${vest.bottom === 'cut' ? 'L234,420' : 'L234,422'} L252,418 L254,262 Q250,210 240,168 L214,150 L${db ? 190 : 200},${top} Z`}
        fill={`url(#${id}-fabric)`}
        stroke={stroke}
        strokeWidth={1.2}
      />
      {vest.lapel !== 'no' &&
        [-1, 1].map((side) => (
          <path
            key={side}
            d={`M${200 + side * 14},152 L${200 + side * (vest.lapel === 'peak' ? 30 : 24)},${vest.lapel === 'peak' ? 176 : 184} L${db ? 190 : 200},${top} Z`}
            fill={`url(#${id}-fabric)`}
            stroke={stroke}
            strokeWidth={1}
          />
        ))}
      <line
        x1={db ? 190 : 200}
        y1={top}
        x2={db ? 190 : 200}
        y2={420}
        stroke={stroke}
        strokeWidth={1}
      />
      {buttons.map((y) =>
        db ? (
          [-1, 1].map((side) => (
            <Button key={`${y}-${side}`} x={200 + side * 14} y={y} r={3.2} fill="#2f2a25" />
          ))
        ) : (
          <Button key={y} x={200} y={y} r={3.2} fill="#2f2a25" />
        ),
      )}
      {vest.pockets !== '0' &&
        [-1, 1].map((side) =>
          vest.pockets === '2b' ? (
            <path
              key={side}
              d={`M${200 + side * 30 - 13},370 h26 v8 q0,3 -3,3 h-20 q-3,0 -3,-3 z`}
              className="sk-panel"
              fill={`url(#${id}-fabric)`}
            />
          ) : (
            <g key={side}>
              <rect x={200 + side * 30 - 13} y={372} width={26} height={2.5} className="sk-welt" />
              {vest.pockets === '2a' && (
                <rect
                  x={200 + side * 30 - 13}
                  y={375.5}
                  width={26}
                  height={2.5}
                  className="sk-welt"
                />
              )}
            </g>
          ),
        )}
      {vest.chestPocket && <rect x={218} y={236} width={20} height={2.5} className="sk-welt" />}
    </g>
  );
}

function JacketFront({ spec, id, stroke }: { spec: SketchSpec; id: string; stroke: string }) {
  const jacket = spec.jacket!;
  const w = fitWidths(spec.fit);
  const layout = jacketLayout(jacket.style);
  const shapes = lapelShapes(spec);
  const threadCuff =
    jacket.threads && (jacket.threads.scope === 'all' || jacket.threads.scope === 'cuff');
  const threadLapel =
    jacket.threads && (jacket.threads.scope === 'all' || jacket.threads.scope === 'lapel');
  const threadFront = jacket.threads?.scope === 'all';
  const buttonFill = jacket.buttonAsset ? `url(#${id}-button)` : jacket.buttonColor;
  const sleeve = (side: -1 | 1): P[] => {
    const m = (list: P[]) => (side < 0 ? list : mirror(list));
    return m([
      [110, 160],
      [97, 300],
      [97, 452],
      [137, 456],
      [200 - w.chest + 2, 262],
    ]);
  };
  const pocketSlant = jacket.pockets.endsWith('c') ? 8 : 0;
  const ticket = jacket.pockets.startsWith('3');
  return (
    <g>
      <path
        d={jacketBody(spec)}
        fill={`url(#${id}-fabric)`}
        stroke={stroke}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <path
        d={`M${200 - w.chest + 14},258 Q${200 - w.waist + 16},340 ${200 - w.hem + 24},476`}
        className="sk-seam"
      />
      <path
        d={`M${200 + w.chest - 14},258 Q${200 + w.waist - 16},340 ${200 + w.hem - 24},476`}
        className="sk-seam"
      />
      {[-1, 1].map((side) => (
        <g key={side}>
          <path
            d={`M${pts(sleeve(side as -1 | 1)).replaceAll(' ', ' L')} Z`}
            fill={`url(#${id}-fabric)`}
            stroke={stroke}
            strokeWidth={1.3}
          />
          <rect
            x={200 + side * 83 - 18}
            y={452}
            width={36}
            height={6}
            fill={SHIRT}
            stroke="#b9b7ae"
            strokeWidth={0.8}
          />
        </g>
      ))}
      {Array.from({ length: jacket.sleeveButtons }).map((_, i) => (
        <g key={i}>
          {jacket.sleeveHoles && (
            <line
              x1={106 - 6}
              y1={440 - i * 8}
              x2={106 - 1}
              y2={440 - i * 8}
              stroke={threadCuff ? `url(#${id}-hole)` : shade(spec.fabric.color, -0.5)}
              strokeWidth={1.6}
            />
          )}
          <Button x={106} y={440 - i * 8} r={3} fill={buttonFill} />
        </g>
      ))}
      {layout.mao ? (
        <>
          <path
            d="M178,146 Q200,154 222,146 L222,136 Q200,144 178,136 Z"
            fill={`url(#${id}-fabric)`}
            stroke={stroke}
            strokeWidth={1.2}
          />
          <line
            x1={200}
            y1={146}
            x2={200}
            y2={layout.buttons.at(-1)! + 16}
            stroke={stroke}
            strokeWidth={1.2}
          />
        </>
      ) : (
        <>
          {shapes.collars.map((c, i) => (
            <polygon
              key={`c${i}`}
              points={pts(c)}
              fill={`url(#${id}-lapel)`}
              stroke={stroke}
              strokeWidth={1.2}
              strokeLinejoin="round"
            />
          ))}
          {shapes.lapels.map((l, i) => (
            <polygon
              key={`l${i}`}
              points={pts(l)}
              fill={`url(#${id}-lapel)`}
              stroke={stroke}
              strokeWidth={1.2}
              strokeLinejoin="round"
            />
          ))}
          {shapes.shawl.map((d, i) => (
            <path
              key={`s${i}`}
              d={d}
              fill={`url(#${id}-lapel)`}
              stroke={stroke}
              strokeWidth={1.2}
            />
          ))}
          <line
            x1={layout.edge}
            y1={layout.vBottom}
            x2={layout.db ? 184 : 200}
            y2={layout.db ? 484 : layout.buttons.at(-1)! + 16}
            stroke={stroke}
            strokeWidth={1.2}
          />
          {!layout.db && (
            <line
              x1={241}
              y1={218}
              x2={247}
              y2={214}
              stroke={threadLapel ? `url(#${id}-hole)` : shade(spec.fabric.color, -0.45)}
              strokeWidth={2}
              strokeLinecap="round"
            />
          )}
        </>
      )}
      {layout.buttons.flatMap((y, row) =>
        layout.db
          ? [-1, 1].map((side) => (
              <Button
                key={`${y}${side}`}
                x={200 + side * (jacket.style === 'crossed_6' && row === 0 ? 30 : 20)}
                y={y}
                fill={buttonFill}
                holes={threadFront ? `url(#${id}-thread)` : undefined}
              />
            ))
          : [
              <Button
                key={y}
                x={200}
                y={y}
                fill={buttonFill}
                holes={threadFront ? `url(#${id}-thread)` : undefined}
              />,
            ],
      )}
      {jacket.pockets !== '0' &&
        [-1, 1].map((side) => (
          <Pocket
            key={side}
            x={200 + side * 52}
            y={402}
            width={jacket.pockets.endsWith('b') ? 50 : 46}
            type={jacket.pockets}
            fill={`url(#${id}-fabric)`}
            slant={side * pocketSlant}
          />
        ))}
      {ticket && (
        <Pocket
          x={150}
          y={378}
          width={36}
          type={jacket.pockets}
          fill={`url(#${id}-fabric)`}
          slant={-pocketSlant}
        />
      )}
      {jacket.chestPocket !== '0' &&
        (jacket.chestPocket === '1' ? [1] : jacket.chestPocket === 'patched_2' ? [-1, 1] : [1]).map(
          (side) => (
            <g key={side}>
              {jacket.pocketSquare.on && side === 1 && (
                <path
                  d="M236,236 l6,-14 l6,8 l6,-10 l6,14 z"
                  fill={`url(#${id}-square)`}
                  stroke="#00000033"
                  strokeWidth={0.8}
                />
              )}
              {jacket.chestPocket.startsWith('patched') ? (
                <path
                  d={`M${200 + side * 48 - 16},236 h32 v26 q0,8 -8,8 h-16 q-8,0 -8,-8 z`}
                  className="sk-panel"
                  fill={`url(#${id}-fabric)`}
                />
              ) : (
                <rect
                  x={232}
                  y={234}
                  width={34}
                  height={7}
                  transform="rotate(-6 249 237)"
                  className="sk-panel"
                  fill={`url(#${id}-fabric)`}
                />
              )}
            </g>
          ),
        )}
    </g>
  );
}

function JacketBack({ spec, id, stroke }: { spec: SketchSpec; id: string; stroke: string }) {
  const jacket = spec.jacket!;
  const w = fitWidths(spec.fit);
  const sleeve = (side: -1 | 1): P[] => {
    const list: P[] = [
      [110, 160],
      [97, 300],
      [97, 452],
      [137, 456],
      [200 - w.chest + 2, 262],
    ];
    return side < 0 ? list : mirror(list);
  };
  return (
    <g>
      {[-1, 1].map((side) => (
        <g key={side}>
          <polygon
            points={pts(sleeve(side as -1 | 1))}
            fill={`url(#${id}-fabric)`}
            stroke={stroke}
            strokeWidth={1.3}
          />
          {Array.from({ length: jacket.sleeveButtons }).map((_, i) => (
            <Button
              key={i}
              x={200 + side * 92}
              y={440 - i * 8}
              r={3}
              fill={jacket.buttonAsset ? `url(#${id}-button)` : jacket.buttonColor}
            />
          ))}
          {jacket.elbowPatches && (
            <ellipse
              cx={200 + side * 96}
              cy={322}
              rx={11}
              ry={24}
              fill={`url(#${id}-patch)`}
              stroke="#00000044"
              strokeDasharray="2 2"
            />
          )}
        </g>
      ))}
      <path
        d={jacketBody(spec, true)}
        fill={`url(#${id}-fabric)`}
        stroke={stroke}
        strokeWidth={1.4}
      />
      <path
        d="M176,146 Q200,160 224,146 L222,132 Q200,142 178,132 Z"
        fill={jacket.neckLining ? `url(#${id}-neck)` : `url(#${id}-lapel)`}
        stroke={stroke}
        strokeWidth={1.2}
      />
      <line x1={200} y1={152} x2={200} y2={jacket.vent === '1' ? 404 : 480} className="sk-seam" />
      {jacket.vent === '1' && (
        <path
          d="M200,404 L200,480 M200,404 l4,4 L204,480"
          stroke={stroke}
          strokeWidth={1.2}
          fill="none"
        />
      )}
      {jacket.vent === '2' &&
        [-1, 1].map((side) => (
          <path
            key={side}
            d={`M${200 + side * (w.hem - 14)},400 L${200 + side * (w.hem - 12)},480`}
            stroke={stroke}
            strokeWidth={1.2}
            fill="none"
          />
        ))}
    </g>
  );
}

function Inside({ spec, id, stroke }: { spec: SketchSpec; id: string; stroke: string }) {
  const jacket = spec.jacket!;
  const w = fitWidths(spec.fit);
  const lining =
    jacket.lining === 'unlined'
      ? `url(#${id}-fabric)`
      : jacket.lining === 'personalizado' && jacket.liningAsset
        ? `url(#${id}-lining)`
        : jacket.lining === 'padded'
          ? `url(#${id}-quilt)`
          : shade(spec.fabric.color, -0.18);
  const font = jacket.monogram?.font ?? 'bold_script';
  const fontFamily = font === 'block' ? 'var(--font-sans)' : 'var(--font-serif)';
  // Opened fronts shown flat, as a tailor would present the inside of a jacket.
  const panel = (side: -1 | 1): P[] => {
    const list: P[] = [
      [196, 146],
      [124, 162],
      [200 - w.chest - 34, 300],
      [200 - w.hem - 30, 482],
      [194, 488],
    ];
    return side < 0 ? list : mirror(list);
  };
  const liningShape = (side: -1 | 1): P[] => {
    const list: P[] = [
      [170, 176],
      [128, 176],
      [200 - w.chest - 24, 300],
      [200 - w.hem - 20, 470],
      [170, 474],
    ];
    return side < 0 ? list : mirror(list);
  };
  return (
    <g>
      <polygon
        points={pts([
          [180, 146],
          [220, 146],
          [226, 484],
          [174, 484],
        ])}
        fill={SHIRT}
        stroke="#c8c6bd"
      />
      <path
        d="M176,146 Q200,160 224,146 L222,132 Q200,142 178,132 Z"
        fill={jacket.neckLining ? `url(#${id}-neck)` : `url(#${id}-lapel)`}
        stroke={stroke}
        strokeWidth={1.2}
      />
      {[-1, 1].map((side) => (
        <g key={side}>
          <polygon
            points={pts(panel(side as -1 | 1))}
            fill={`url(#${id}-fabric)`}
            stroke={stroke}
            strokeWidth={1.3}
            strokeLinejoin="round"
          />
          <polygon
            points={pts(liningShape(side as -1 | 1))}
            fill={lining}
            stroke="#00000030"
            strokeLinejoin="round"
          />
          <rect x={200 + side * 52 - 16} y={262} width={32} height={4} rx={1} fill="#00000040" />
          <rect x={200 + side * 52 - 12} y={400} width={24} height={3} rx={1} fill="#00000030" />
        </g>
      ))}
      {jacket.halfCanvas && (
        <g>
          <path
            d="M132,188 L170,184 L170,300 L126,316 Z"
            fill="none"
            stroke="#b28a43"
            strokeDasharray="5 4"
            strokeWidth={1.6}
          />
          <text x={153} y={250} textAnchor="middle" className="sk-note">
            half canvas
          </text>
        </g>
      )}
      {jacket.monogram && (
        <g>
          <text
            x={255}
            y={350}
            textAnchor="middle"
            fontFamily={fontFamily}
            fontStyle={font.includes('script') || font === 'calligraphy' ? 'italic' : 'normal'}
            fontWeight={font === 'bold_script' || font === 'block' ? 700 : 500}
            fontSize={font === 'block' ? 15 : 19}
            fill={jacket.monogram.threadAsset ? `url(#${id}-mono)` : '#c3a15f'}
          >
            {font === 'block' ? 'A B' : 'A.B.'}
          </text>
          <text x={255} y={366} textAnchor="middle" className="sk-note">
            sample initials
          </text>
        </g>
      )}
    </g>
  );
}

function ImagePattern({ id, href, zoom = 1 }: { id: string; href?: string; zoom?: number }) {
  if (!href) return null;
  return (
    <pattern id={id} width={1} height={1} patternContentUnits="objectBoundingBox">
      <image
        href={href}
        x={(1 - zoom) / 2}
        y={(1 - zoom) / 2}
        width={zoom}
        height={zoom}
        preserveAspectRatio="xMidYMid slice"
      />
    </pattern>
  );
}

function FabricPattern({
  id,
  color,
  pattern,
  scale = 1,
}: {
  id: string;
  color: string;
  pattern: string;
  scale?: number;
}) {
  const s = 12 * scale;
  return (
    <pattern id={id} width={s} height={s} patternUnits="userSpaceOnUse">
      <rect width={s} height={s} fill={color} />
      {pattern === 'twill' && (
        <path d={`M0,${s} L${s},0`} stroke="#ffffff" strokeOpacity={0.07} strokeWidth={2} />
      )}
      {pattern === 'check' && (
        <path
          d={`M0,0.5 H${s * 4} M0.5,0 V${s * 4}`}
          stroke="#d0d2c1"
          strokeOpacity={0.4}
          strokeWidth={0.8}
        />
      )}
      {pattern === 'stripe' && (
        <rect x={0} width={1.2} height={s} fill="#223f5d" fillOpacity={0.45} />
      )}
      {pattern === 'plain' && (
        <rect x={s / 2} y={s / 2} width={1} height={1} fill="#ffffff" fillOpacity={0.05} />
      )}
    </pattern>
  );
}

export default function GarmentSketch({
  design,
  focus,
  hotspots = [],
  onHotspot,
}: {
  design: Design;
  focus: SketchFocus;
  hotspots?: SketchHotspot[];
  onHotspot?: (spot: SketchHotspot) => void;
}) {
  const id = useId().replace(/:/g, '');
  const spec = sketchSpec(design);
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<SketchView>('front');
  const [reveal, setReveal] = useState<Reveal>('none');
  const [box, setBox] = useState<Box>(FULL);
  const boxRef = useRef<Box>(FULL);
  const frame = useRef(0);
  const drag = useRef<{ x: number; y: number; box: Box } | null>(null);

  const apply = useCallback((next: Box) => {
    boxRef.current = next;
    setBox(next);
  }, []);
  const animate = useCallback(
    (target: Box) => {
      cancelAnimationFrame(frame.current);
      const start = boxRef.current;
      const reduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        frame.current = requestAnimationFrame(() => apply(target));
        return;
      }
      const began = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - began) / 520);
        const e = 1 - Math.pow(1 - t, 3);
        apply(start.map((v, i) => v + (target[i] - v) * e) as Box);
        if (t < 1) frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
    },
    [apply],
  );
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const available = (region: RegionId) =>
    !(
      (spec.product === 'shirt' && REGIONS[region].view !== 'front') ||
      (region === 'vest' && !spec.vest)
    );
  // Follow the latest choice: switch face, reveal hidden layers and zoom in.
  const target = available(focus.region) ? focus.region : 'full';
  const focusKey = `${focus.nonce}:${target}`;
  const [followed, setFollowed] = useState(focusKey);
  if (followed !== focusKey) {
    setFollowed(focusKey);
    setView(REGIONS[target].view);
    setReveal(REGIONS[target].reveal);
  }
  useEffect(() => {
    animate(padded(REGIONS[target].box));
  }, [focusKey, target, animate]);

  const zoomBy = useCallback(
    (factor: number, cx?: number, cy?: number) => {
      const [x, y, w, h] = boxRef.current;
      const nw = Math.min(460, Math.max(70, w / factor));
      const nh = (nw / w) * h;
      const px = cx ?? x + w / 2;
      const py = cy ?? y + h / 2;
      apply([px - ((px - x) * nw) / w, py - ((py - y) * nh) / h, nw, nh]);
    },
    [apply],
  );
  const pan = useCallback(
    (dx: number, dy: number) => {
      const [x, y, w, h] = boxRef.current;
      apply([
        Math.min(400 - w * 0.3, Math.max(-w * 0.7, x + dx)),
        Math.min(800 - h * 0.3, Math.max(-h * 0.7, y + dy)),
        w,
        h,
      ]);
    },
    [apply],
  );
  const toSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return undefined;
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return point;
  };
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      cancelAnimationFrame(frame.current);
      const point = toSvg(event.clientX, event.clientY);
      zoomBy(event.deltaY < 0 ? 1.15 : 1 / 1.15, point?.x, point?.y);
    };
    svg.addEventListener('wheel', wheel, { passive: false });
    return () => svg.removeEventListener('wheel', wheel);
  }, [zoomBy]);
  const unitsPerPixel = () => {
    const rect = svgRef.current?.getBoundingClientRect();
    const [, , w, h] = boxRef.current;
    return rect ? Math.max(w / rect.width, h / rect.height) : 1;
  };
  function reset() {
    setReveal('none');
    animate(
      view === 'front' ? FULL : padded(view === 'back' ? REGIONS.back.box : REGIONS.inside.box),
    );
  }
  function chooseView(next: SketchView) {
    setView(next);
    setReveal('none');
    animate(next === 'front' ? FULL : padded(REGIONS[next === 'back' ? 'back' : 'inside'].box));
  }

  const trouserColor = spec.trousers.color ?? spec.fabric.color;
  const stroke = shade(spec.fabric.color, spec.product === 'shirt' ? -0.3 : -0.45);
  const jacketOpacity = reveal === 'none' ? 1 : 0.14;
  const visibleSpots = hotspots.filter(
    (spot) => REGIONS[spot.region].view === view && available(spot.region),
  );
  const views: SketchView[] = spec.product === 'shirt' ? ['front'] : ['front', 'back', 'inside'];
  const layer = (children: ReactNode, opacity = 1) => (
    <g style={{ opacity, transition: 'opacity .35s ease' }}>{children}</g>
  );

  return (
    <div className="sketch-stage" role="group" aria-label="Interactive 2D garment drawing">
      <svg
        ref={svgRef}
        className="sketch-svg"
        style={
          {
            '--sk-detail': isLight(spec.fabric.color) ? '#00000059' : '#ffffff66',
            '--sk-welt': isLight(spec.fabric.color) ? '#00000050' : '#00000080',
          } as CSSProperties
        }
        viewBox={box.join(' ')}
        preserveAspectRatio="xMidYMid meet"
        tabIndex={0}
        aria-label={`2D ${view} view${focus.label ? `, focused on ${focus.label}` : ''}. Use arrow keys to pan and plus or minus to zoom.`}
        onKeyDown={(event) => {
          const step = boxRef.current[2] * 0.08;
          const keys: Record<string, () => void> = {
            ArrowLeft: () => pan(-step, 0),
            ArrowRight: () => pan(step, 0),
            ArrowUp: () => pan(0, -step),
            ArrowDown: () => pan(0, step),
            '+': () => zoomBy(1.2),
            '=': () => zoomBy(1.2),
            '-': () => zoomBy(1 / 1.2),
            '0': reset,
          };
          if (keys[event.key]) {
            event.preventDefault();
            cancelAnimationFrame(frame.current);
            keys[event.key]();
          }
        }}
        onPointerDown={(event) => {
          if ((event.target as Element).closest('.sketch-hotspot')) return;
          cancelAnimationFrame(frame.current);
          drag.current = { x: event.clientX, y: event.clientY, box: boxRef.current };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          const k = unitsPerPixel();
          const start = drag.current;
          const [x, y, w, h] = start.box;
          apply([x - (event.clientX - start.x) * k, y - (event.clientY - start.y) * k, w, h]);
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onDoubleClick={(event) => {
          const point = toSvg(event.clientX, event.clientY);
          zoomBy(1.6, point?.x, point?.y);
        }}
      >
        <defs>
          <FabricPattern
            id={`${id}-fabric`}
            color={spec.fabric.color}
            pattern={spec.fabric.pattern}
          />
          <FabricPattern
            id={`${id}-shirt`}
            color={spec.fabric.color}
            pattern={spec.fabric.pattern}
            scale={0.8}
          />
          <FabricPattern
            id={`${id}-lapel`}
            color={shade(spec.fabric.color, 0.06)}
            pattern={spec.fabric.pattern}
          />
          <FabricPattern
            id={`${id}-trouser`}
            color={trouserColor}
            pattern={spec.trousers.color ? 'plain' : spec.fabric.pattern}
          />
          <pattern
            id={`${id}-quilt`}
            width={10}
            height={10}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width={10} height={10} fill={shade(spec.fabric.color, -0.25)} />
            <path d="M0,0 H10 M0,0 V10" stroke="#ffffff" strokeOpacity={0.18} />
          </pattern>
          <ImagePattern id={`${id}-tie`} href={spec.tie.asset} zoom={2.2} />
          <ImagePattern id={`${id}-bowtie`} href={spec.bowtie.asset} zoom={1.6} />
          <ImagePattern id={`${id}-square`} href={spec.jacket?.pocketSquare.asset} zoom={1.4} />
          <ImagePattern id={`${id}-button`} href={spec.jacket?.buttonAsset} zoom={1.2} />
          <ImagePattern id={`${id}-hole`} href={spec.jacket?.threads?.holeAsset} />
          <ImagePattern id={`${id}-thread`} href={spec.jacket?.threads?.threadAsset} />
          {spec.jacket?.liningAsset && (
            <pattern id={`${id}-lining`} width={56} height={56} patternUnits="userSpaceOnUse">
              <image
                href={spec.jacket.liningAsset}
                width={56}
                height={56}
                preserveAspectRatio="xMidYMid slice"
              />
            </pattern>
          )}
          <ImagePattern id={`${id}-patch`} href={spec.jacket?.elbowPatches?.asset} />
          <ImagePattern id={`${id}-neck`} href={spec.jacket?.neckLining?.asset} />
          <ImagePattern id={`${id}-mono`} href={spec.jacket?.monogram?.threadAsset} />
          <ImagePattern id={`${id}-socks`} href={spec.socks.asset} zoom={1.5} />
        </defs>
        <rect x={-400} y={-400} width={1200} height={1600} fill="transparent" />
        <ellipse cx={200} cy={790} rx={120} ry={8} fill="#2a332c" opacity={0.08} />
        {view === 'inside' && spec.jacket ? (
          <Inside spec={spec} id={id} stroke={stroke} />
        ) : (
          <>
            <Figure spec={spec} back={view === 'back'} />
            <Feet spec={spec} id={id} back={view === 'back'} />
            {view === 'front' && <Shirt spec={spec} id={id} full={!spec.jacket} />}
            <Trousers spec={spec} color={trouserColor} id={id} back={view === 'back'} />
            {view === 'front' && spec.trousers.braces && (
              <g>
                {[-1, 1].map((side) => (
                  <path
                    key={side}
                    d={`M${200 + side * 30},160 L${200 + side * 28},398`}
                    stroke="#6d2f2a"
                    strokeWidth={5}
                  />
                ))}
              </g>
            )}
            {view === 'front' && <Tie spec={spec} id={id} />}
            {view === 'front' &&
              spec.vest &&
              layer(<Vest spec={spec} id={id} />, reveal === 'trousers' ? 0.14 : 1)}
            {spec.jacket &&
              layer(
                view === 'front' ? (
                  <JacketFront spec={spec} id={id} stroke={stroke} />
                ) : (
                  <JacketBack spec={spec} id={id} stroke={stroke} />
                ),
                jacketOpacity,
              )}
          </>
        )}
        {visibleSpots.map((spot) => {
          const [cx, cy] = REGIONS[spot.region].anchor;
          const active = focus.region === spot.region;
          const r = box[2] / 48;
          return (
            <g
              key={spot.leafId}
              className={`sketch-hotspot ${active ? 'active' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={`Edit ${spot.label}`}
              onClick={() => onHotspot?.(spot)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onHotspot?.(spot);
                }
              }}
            >
              <circle cx={cx} cy={cy} r={r} />
              <path d={`M${cx - r * 0.45},${cy} h${r * 0.9} M${cx},${cy - r * 0.45} v${r * 0.9}`} />
              <title>{spot.label}</title>
            </g>
          );
        })}
      </svg>
      {focus.label && (
        <div className="sketch-callout" aria-live="polite">
          <span>{focus.label}</span>
          {focus.value && <strong>{focus.value}</strong>}
        </div>
      )}
      <div className="view-toolbar">
        <div className="view-angle" role="group" aria-label="Drawing side">
          {views.map((v) => (
            <button key={v} aria-pressed={view === v} onClick={() => chooseView(v)}>
              {v}
            </button>
          ))}
        </div>
        <div className="view-zoom">
          <button className="icon-button" aria-label="Zoom in" onClick={() => zoomBy(1.25)}>
            <Plus size={17} />
          </button>
          <button className="icon-button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.25)}>
            <Minus size={17} />
          </button>
          <button className="icon-button" aria-label="Reset view" onClick={reset}>
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
      <span className="drag-hint">
        <Move size={12} /> Drag to move · scroll to zoom · tap a dot to edit
      </span>
    </div>
  );
}
