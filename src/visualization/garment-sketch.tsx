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
    ? { chest: 76, waist: 64, hem: 78 }
    : fit === 'regular'
      ? { chest: 80, waist: 70, hem: 82 }
      : { chest: 84, waist: 77, hem: 88 };
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
  const left = `M180,146 L118,166 C110,190 118,230 ${200 - w.chest},252 L${200 - w.waist},336 Q${200 - w.hem + 1},410 ${200 - w.hem},480`;
  const right = `L${200 + w.hem},480 Q${200 + w.hem - 1},410 ${200 + w.waist},336 L${200 + w.chest},252 C282,230 290,190 282,166 L220,146`;
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
    [166, 152],
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
  const legW = t.fit === 'slim' ? 17 : 21;
  const leg = (side: -1 | 1): P[] => {
    const c = 200 + side * 42;
    return [
      [200 + side * 60, 398],
      [200 + side * 69, 452],
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
            x2={200 + side * 42}
            y2={hemY - 4}
            className="sk-crease"
          />
          {t.break !== 'no' && !bermuda && (
            <path
              d={`M${200 + side * 42 - legW + 3},${hemY - 18} q${legW - 3},${t.break === 'full' ? 9 : 5} ${2 * legW - 6},0`}
              className="sk-fold"
            />
          )}
          {t.cuffs && (
            <rect
              x={200 + side * 42 - legW}
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

function Feet({ spec, id, back }: { spec: SketchSpec; id: string; back?: boolean }) {
  const shoe = shoeStyle(spec.shoes);
  const bermuda = spec.trousers.length === 'bermuda';
  return (
    <g>
      {bermuda &&
        [-1, 1].map((side) => (
          <path
            key={side}
            d={`M${200 + side * 42 - 14},596 L${200 + side * 42 - 11},770 L${200 + side * 42 + 11},770 L${200 + side * 42 + 14},596 Z`}
            fill={SKIN[spec.skinTone]}
          />
        ))}
      {[-1, 1].map((side) => (
        <g key={side}>
          <rect
            x={200 + side * 42 - 12}
            y={bermuda ? 728 : 740}
            width={24}
            height={bermuda ? 44 : 34}
            fill={spec.socks.on && spec.socks.asset ? `url(#${id}-socks)` : '#26282b'}
          />
          <path
            d={
              back
                ? `M${200 + side * 42 - 15},766 q15,-6 30,0 l2,16 q-17,6 -34,0 z`
                : `M${200 + side * 42 - 15},${shoe.boot ? 748 : 764} q15,-4 30,0 l${side * 9},${shoe.boot ? 30 : 14} q${-side * 1},8 ${-side * 12},8 h${-side * 18} q${-side * 12},0 ${-side * 10},-10 z`
            }
            fill={shoe.color}
            stroke={shade(shoe.color, shoe.color === '#ece9e1' ? -0.25 : 0.25)}
            strokeWidth={1}
          />
          {shoe.sneaker && !back && (
            <path
              d={`M${200 + side * 42 - 14},782 h${side * 38}`}
              stroke="#c9c5bb"
              strokeWidth={3}
            />
          )}
        </g>
      ))}
    </g>
  );
}

function Figure({ spec, back }: { spec: SketchSpec; back?: boolean }) {
  const skin = SKIN[spec.skinTone];
  return (
    <g>
      <ellipse cx={200} cy={80} rx={29} ry={37} fill={skin} />
      {back ? (
        <path
          d="M171,74 Q172,40 200,40 Q228,40 229,74 Q231,100 222,108 L178,108 Q169,100 171,74 Z"
          fill="#2c2520"
        />
      ) : (
        <path
          d="M171,74 Q170,40 200,39 Q230,40 229,72 Q226,56 200,55 Q175,56 171,74 Z"
          fill="#2c2520"
        />
      )}
      <path d="M186,106 Q188,128 184,150 L216,150 Q212,128 214,106 Z" fill={skin} />
      <path d="M188,112 Q200,122 212,112" fill="none" stroke="#00000018" strokeWidth={2} />
      {[-1, 1].map((side) => (
        <path
          key={side}
          d={`M${200 + side * 80},456 q${side * 6},10 ${side * 4},26 q${-side * 4},10 ${-side * 12},6 q${-side * 6},-8 ${-side * 6},-30 z`}
          fill={skin}
        />
      ))}
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
            d={`M184,146 L120,166 C110,200 118,232 ${200 - w.chest + 2},254 L${200 - w.waist + 4},340 L${200 - w.waist + 6},400 L${200 + w.waist - 6},400 L${200 + w.waist - 4},340 L${200 + w.chest - 2},254 C282,232 290,200 280,166 L216,146 Z`}
            fill={`url(#${id}-shirt)`}
            stroke="#b7b6ad"
            strokeWidth={1.2}
          />
          {[-1, 1].map((side) => {
            const cuffY = 440;
            return (
              <g key={side}>
                <path
                  d={`M${200 + side * 82},166 C${200 + side * 100},250 ${200 + side * 98},380 ${200 + side * 96},${cuffY} L${200 + side * 64},${cuffY + 2} L${200 + side * (w.chest - 2)},262 Z`}
                  fill={`url(#${id}-shirt)`}
                  stroke="#b7b6ad"
                  strokeWidth={1.2}
                />
                <rect
                  x={200 + side * 80 - 17}
                  y={cuffY}
                  width={34}
                  height={spec.shirt.cuffs === 'French' ? 22 : 16}
                  rx={2}
                  fill={`url(#${id}-shirt)`}
                  stroke="#b7b6ad"
                  strokeWidth={1.2}
                />
                {spec.shirt.cuffs === 'French' ? (
                  <rect
                    x={200 + side * 80 + side * 9 - 3}
                    y={cuffY + 8}
                    width={6}
                    height={6}
                    rx={1}
                    fill="#c3a15f"
                  />
                ) : (
                  <Button
                    x={200 + side * 80 + side * 9}
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
      [118, 166],
      [104, 300],
      [102, 452],
      [138, 456],
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
            x={200 + side * 80 - 16}
            y={452}
            width={32}
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
              x1={113 - 6}
              y1={440 - i * 8}
              x2={113 - 1}
              y2={440 - i * 8}
              stroke={threadCuff ? `url(#${id}-hole)` : shade(spec.fabric.color, -0.5)}
              strokeWidth={1.6}
            />
          )}
          <Button x={113} y={440 - i * 8} r={3} fill={buttonFill} />
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
      [118, 166],
      [104, 300],
      [102, 452],
      [138, 456],
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
              x={200 + side * 94}
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
