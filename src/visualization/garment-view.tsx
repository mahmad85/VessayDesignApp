'use client';
import { Canvas, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  ContactShadows,
  Environment,
  Lightformer,
  Line,
  Html,
  useProgress,
} from '@react-three/drei';
import { useEffect, useMemo, useRef, useState, Suspense, Component, type ReactNode } from 'react';
import * as THREE from 'three';
import Image from 'next/image';
import type { OrbitControls as Controls } from 'three-stdlib';
import { RotateCcw, ZoomIn, ZoomOut, Move, Box } from 'lucide-react';
import type { Design } from '@/modules/configuration/types';
import { TailoredHuman } from './tailored-human';
const SKIN = { porcelain: '#e2cbb6', warm: '#b99779', tan: '#987456', deep: '#604436' };
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
  const skin = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: SKIN[design.skinTone],
        roughness: 0.64,
      }),
    [design.skinTone],
  );
  useEffect(() => () => skin.dispose(), [skin]);
  // Circumference fields: rendered as a ring at [y, centerX, centerZ] with
  // radii [rx, rz]. Torso rings are centered on the body; limb rings follow
  // the same illustrative arm/leg centerlines the `path` fields below use.
  const CIRCUMFERENCE: Record<string, [number, number, number, number, number]> = {
    neck: [2.99, 0, 0.065, 0.14, 0.145],
    chest: [2.5, 0, 0.065, 0.4, 0.255],
    waist: [2.1, 0, 0.065, 0.32, 0.255],
    hips: [1.8, 0, 0.065, 0.4, 0.255],
    bicep: [2.55, 0.43, 0.176, 0.095, 0.1],
    forearm: [2.0, 0.52, 0.16, 0.075, 0.08],
    wrist: [1.75, 0.55, 0.15, 0.05, 0.055],
    thigh: [1.35, 0.057, 0.19, 0.16, 0.17],
    knee: [0.85, 0.095, 0.173, 0.11, 0.115],
    calf: [0.5, 0.121, 0.161, 0.115, 0.12],
    ankle: [0.15, 0.145, 0.15, 0.07, 0.075],
  };
  const circle = CIRCUMFERENCE[highlight ?? ''] ?? CIRCUMFERENCE.chest;
  const [y, cx, cz, rx, rz] = circle;
  const ellipse = Array.from({ length: 65 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2;
    return [cx + Math.cos(a) * rx, y, cz + Math.sin(a) * rz] as [number, number, number];
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
    jacketLength: [
      [0.41, 2.85, 0.2],
      [0.41, 1.55, 0.2],
    ],
    frontRise: [
      [0, 2.1, 0.32],
      [0.035, 1.65, 0.2],
    ],
    backRise: [
      [0, 2.1, -0.19],
      [0.035, 1.65, 0.2],
    ],
  };
  const LABELS: Record<string, string> = {
    hips: 'Seat',
    inseam: 'Inside leg',
    jacketLength: 'Jacket length',
    frontRise: 'Front rise',
    backRise: 'Back rise',
  };
  const LABEL_POSITION: Record<string, [number, number, number]> = {
    height: [-0.85, 3.38, 0],
    inseam: [0.2, 0.5, 0.3],
    jacketLength: [0.55, 2.2, 0.2],
    frontRise: [0.15, 1.9, 0.35],
    backRise: [0.15, 1.9, -0.05],
  };
  return (
    <group>
      <Suspense fallback={null}>
        <TailoredHuman design={design} measure={measure} skin={skin} />
      </Suspense>
      {measure && highlight && (
        <>
          <Line points={path[highlight] || ellipse} color="#937340" lineWidth={2.5} />
          <Html position={LABEL_POSITION[highlight] ?? [cx + rx + 0.1, y, cz]} center>
            <span className="model-label">
              {LABELS[highlight] ?? highlight.charAt(0).toUpperCase() + highlight.slice(1)}
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
      {/* Local studio lighting: soft boxes rendered once, no downloaded HDRI. */}
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 4, 5]} scale={[6, 3, 1]} />
        <Lightformer
          form="rect"
          intensity={1.1}
          position={[-5, 2, 1]}
          scale={[3, 5, 1]}
          rotation-y={Math.PI / 2}
        />
        <Lightformer
          form="rect"
          intensity={1.4}
          position={[5, 3, -3]}
          scale={[3, 5, 1]}
          rotation-y={-Math.PI / 2}
        />
        <Lightformer
          form="rect"
          intensity={0.6}
          position={[0, -2, 0]}
          scale={[8, 8, 1]}
          rotation-x={-Math.PI / 2}
          color="#d8d2c4"
        />
      </Environment>
      <ambientLight intensity={0.15} />
      <hemisphereLight args={['#fff7ef', '#7a8392', 0.5]} />
      <directionalLight
        position={[3, 6, 4]}
        intensity={1.9}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-normalBias={0.025}
      />
      <directionalLight position={[-3, 3, -2]} intensity={0.9} />
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
