'use client';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Line, Html, useProgress } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState, Suspense, Component, type ReactNode } from 'react';
import * as THREE from 'three';
import Image from 'next/image';
import type { OrbitControls as Controls } from 'three-stdlib';
import { RotateCcw, ZoomIn, ZoomOut, Move, Box } from 'lucide-react';
import { fabricFor, type Fabric } from '@/modules/catalog/catalog';
import type { Design } from '@/modules/configuration/types';
import { TailoredHuman } from './tailored-human';
const SKIN = { porcelain: '#e2cbb6', warm: '#b99779', tan: '#987456', deep: '#604436' };
function fabricTexture(fabric: Fabric) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d')!;
  c.fillStyle = fabric.color;
  c.fillRect(0, 0, 256, 256);
  // Deterministic woven reference. These are not supplier texture assets.
  for (let y = 0; y < 256; y += 2) {
    c.strokeStyle = y % 4 ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.05)';
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(256, y);
    c.stroke();
  }
  for (let x = 0; x < 256; x += 3) {
    c.strokeStyle = 'rgba(255,255,255,.05)';
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, 256);
    c.stroke();
  }
  if (fabric.pattern === 'twill')
    for (let x = -256; x < 256; x += 6) {
      c.strokeStyle = 'rgba(255,255,255,.045)';
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x + 256, 256);
      c.stroke();
    }
  if (fabric.pattern === 'check') {
    c.strokeStyle = 'rgba(208,210,193,.38)';
    c.lineWidth = 1;
    for (let n = 0; n < 256; n += 64) {
      c.beginPath();
      c.moveTo(n, 0);
      c.lineTo(n, 256);
      c.moveTo(0, n);
      c.lineTo(256, n);
      c.stroke();
    }
  }
  if (fabric.pattern === 'stripe') {
    c.fillStyle = 'rgba(34,63,93,.5)';
    for (let n = 0; n < 256; n += 18) c.fillRect(n, 0, 2, 256);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
function Mannequin({
  design,
  measure,
  highlight,
  measurementValue,
}: {
  design: Design;
  measure: boolean;
  highlight?: string;
  measurementValue?: string;
}) {
  const fabric = fabricFor(design.fabricId)!;
  const texture = useMemo(() => fabricTexture(fabric), [fabric]);
  const cloth = useMemo(
    () => new THREE.MeshStandardMaterial({ map: texture, roughness: 0.86, side: THREE.DoubleSide }),
    [texture],
  );
  const lapel = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(fabric.color).multiplyScalar(1.08),
        roughness: 0.86,
        side: THREE.DoubleSide,
      }),
    [fabric.color],
  );
  const skin = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: SKIN[design.skinTone],
        roughness: 0.64,
      }),
    [design.skinTone],
  );
  const ivory = useMemo(
    () =>
      new THREE.MeshStandardMaterial({ color: '#e8e5db', roughness: 0.93, side: THREE.DoubleSide }),
    [],
  );
  const trouser = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#56524b', roughness: 1 }),
    [],
  );
  const dark = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#302922', roughness: 0.32 }),
    [],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => () => cloth.dispose(), [cloth]);
  useEffect(() => () => lapel.dispose(), [lapel]);
  useEffect(() => () => skin.dispose(), [skin]);
  useEffect(() => () => ivory.dispose(), [ivory]);
  useEffect(() => () => trouser.dispose(), [trouser]);
  useEffect(() => () => dark.dispose(), [dark]);
  const y =
    highlight === 'neck'
      ? 2.99
      : highlight === 'chest'
        ? 2.5
        : highlight === 'waist'
          ? 2.1
          : highlight === 'hips'
            ? 1.8
            : 1.9;
  const ellipse = Array.from({ length: 65 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2;
    return [
      Math.cos(a) * (highlight === 'neck' ? 0.14 : highlight === 'waist' ? 0.32 : 0.4),
      y,
      0.065 + Math.sin(a) * (highlight === 'neck' ? 0.145 : 0.255),
    ] as [number, number, number];
  });
  const path: Record<string, [number, number, number][]> = {
    height: [
      [-0.85, 0, 0],
      [-0.85, 3.435, 0],
    ],
    shoulder: [
      [-0.39, 2.75, 0.22],
      [0.39, 2.75, 0.22],
    ],
    sleeve: [
      [0.39, 2.75, 0.18],
      [0.49, 2.27, 0.17],
      [0.55, 1.75, 0.15],
    ],
    inseam: [
      [0.035, 1.65, 0.2],
      [0.145, 0.18, 0.15],
    ],
  };
  return (
    <group>
      <Suspense fallback={null}>
        <TailoredHuman
          design={design}
          measure={measure}
          cloth={cloth}
          lapel={lapel}
          skin={skin}
          ivory={ivory}
          trouser={trouser}
          dark={dark}
        />
      </Suspense>
      {measure && highlight && (
        <>
          <Line points={path[highlight] || ellipse} color="#937340" lineWidth={2.5} />
          <Html
            position={
              highlight === 'height'
                ? [-0.85, 3.38, 0]
                : highlight === 'inseam'
                  ? [0.2, 0.5, 0.3]
                  : [0.51, y, 0.12]
            }
            center
          >
            <span className="model-label">
              {highlight === 'hips'
                ? 'Seat'
                : highlight === 'inseam'
                  ? 'Inside leg'
                  : highlight.charAt(0).toUpperCase() + highlight.slice(1)}
              {measurementValue ? ` · ${measurementValue}` : ''}
            </span>
          </Html>
        </>
      )}
    </group>
  );
}
function Scene({
  design,
  measure,
  highlight,
  measurementValue,
  view,
  zoom,
  reset,
}: {
  design: Design;
  measure: boolean;
  highlight?: string;
  measurementValue?: string;
  view: string;
  zoom: number;
  reset: number;
}) {
  const controls = useRef<Controls>(null);
  const { camera, invalidate } = useThree();
  useEffect(() => {
    const angle = view === 'back' ? Math.PI : view === 'side' ? Math.PI / 2 : 0;
    camera.position.set(Math.sin(angle) * 5.65, 1.82, Math.cos(angle) * 5.65);
    (camera as THREE.PerspectiveCamera).zoom = zoom;
    camera.updateProjectionMatrix();
    controls.current?.target.set(0, 1.7, 0);
    controls.current?.update();
    invalidate();
  }, [view, zoom, reset, camera, invalidate]);
  return (
    <>
      <ambientLight intensity={0.45} />
      <hemisphereLight args={['#fff7ef', '#7a8392', 1.15]} />
      <directionalLight
        position={[3, 6, 4]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-normalBias={0.025}
      />
      <directionalLight position={[-3, 3, -2]} intensity={1.8} />
      <Mannequin
        design={design}
        measure={measure}
        highlight={highlight}
        measurementValue={measurementValue}
      />
      <ContactShadows
        position={[0, 0.02, 0]}
        opacity={0.28}
        scale={8}
        blur={2.7}
        far={4}
        resolution={256}
        frames={1}
      />
      <OrbitControls
        ref={controls}
        target={[0, 1.7, 0]}
        enablePan={false}
        minDistance={3.5}
        maxDistance={7.5}
        minPolarAngle={0.8}
        maxPolarAngle={2}
        enableDamping
      />
    </>
  );
}
function ModelLoading() {
  const { active } = useProgress();
  return active ? (
    <div className="viewer-fallback" role="status">
      Loading human model…
    </div>
  ) : null;
}
class ViewError extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="viewer-fallback">
        <Box size={40} />
        <h3>3D preview unavailable</h3>
        <p>
          You can still select every detail. Try another browser with WebGL enabled to view the
          mannequin.
        </p>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function GarmentView({
  design,
  measure = false,
  highlight,
  measurementValue,
  photo,
}: {
  design: Design;
  measure?: boolean;
  highlight?: string;
  measurementValue?: string;
  photo?: string;
}) {
  const [view, setView] = useState('front');
  const [zoom, setZoom] = useState(1);
  const [reset, setReset] = useState(0);
  return (
    <div
      className="model-stage"
      aria-label={
        measure ? 'Interactive reference measurement mannequin' : 'Interactive 3D garment reference'
      }
    >
      <ViewError>
        <Canvas
          style={{ height: 'var(--model-canvas-height, 100%)' }}
          shadows={{ type: THREE.PCFShadowMap }}
          frameloop="demand"
          dpr={[1, 1.5]}
          camera={{ position: [0, 1.82, 5.65], fov: 38 }}
          gl={{ antialias: true, alpha: true }}
          fallback={
            <div className="viewer-fallback">
              Your browser does not support the 3D preview. All design controls are still available.
            </div>
          }
        >
          <Scene
            design={design}
            measure={measure}
            highlight={highlight}
            measurementValue={measurementValue}
            view={view}
            zoom={zoom}
            reset={reset}
          />
        </Canvas>
        <ModelLoading />
      </ViewError>
      {photo && (
        <div className="photo-reference">
          <Image
            src={photo}
            alt="Your local appearance reference"
            width={67}
            height={85}
            unoptimized
          />
          <span>Your reference</span>
        </div>
      )}
      <div className="view-toolbar">
        <div className="view-angle" role="group" aria-label="Viewing angle">
          {['front', 'side', 'back'].map((v) => (
            <button
              key={v}
              aria-pressed={view === v}
              onClick={() => {
                setView(v);
                setReset((n) => n + 1);
              }}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="view-zoom">
          <button
            className="icon-button"
            aria-label="Zoom in"
            disabled={zoom >= 1.5}
            onClick={() => setZoom((v) => Math.min(1.5, v + 0.15))}
          >
            <ZoomIn size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Zoom out"
            disabled={zoom <= 0.75}
            onClick={() => setZoom((v) => Math.max(0.75, v - 0.15))}
          >
            <ZoomOut size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Reset view"
            onClick={() => {
              setView('front');
              setZoom(1);
              setReset((n) => n + 1);
            }}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
      <span className="drag-hint">
        <Move size={12} /> Drag to rotate · scroll to zoom
      </span>
    </div>
  );
}
