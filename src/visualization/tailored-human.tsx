'use client';

import { useEffect, useMemo } from 'react';
import { useGLTF, useTexture, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { Design } from '@/modules/configuration/types';

type Point = [number, number, number];
// Cross sections of a sewn surface: height, centre X, centre Z, width, depth.
type Section = [number, number, number, number, number];
function tailoredSurface(sections: Section[], open = false, width = 1) {
  const curves = [0, 1, 2, 3, 4].map((d) => sections.map((s) => s[d]));
  const sample = (d: number, t: number) => {
    const f = t * (sections.length - 1),
      i = Math.min(Math.floor(f), sections.length - 2),
      u = f - i;
    const values = curves[d];
    const a = values[Math.max(0, i - 1)],
      b = values[i],
      c = values[i + 1],
      next = values[Math.min(values.length - 1, i + 2)];
    return (
      0.5 *
      (2 * b +
        (-a + c) * u +
        (2 * a - 5 * b + 4 * c - next) * u * u +
        (-a + 3 * b - 3 * c + next) * u * u * u)
    );
  };
  const p: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  const rows = 80,
    columns = 64;
  for (let row = 0; row <= rows; row++) {
    const t = row / rows,
      y = sample(0, t),
      x = sample(1, t),
      z = sample(2, t);
    const rx = sample(3, t) * width,
      rz = sample(4, t);
    const gap = open ? Math.max(0.008, (y - 2.18) * 0.23, (1.94 - y) * 0.22) : 0;
    const cut = Math.asin(Math.min(0.92, gap / rx));
    for (let c = 0; c <= columns; c++) {
      const a = cut + (c / columns) * (Math.PI * 2 - 2 * cut);
      // Restrained folds at elbows and hems; no fabricated cloth simulation.
      const fold = Math.sin(t * 44 + a * 2) * 0.0025 * Math.sin(Math.PI * t);
      p.push(x + Math.sin(a) * (rx + fold), y, z + Math.cos(a) * (rz + fold));
      uv.push(c / columns, y / 1.25);
      if (row < rows && c < columns) {
        const i = row * (columns + 1) + c;
        indices.push(i, i + 1, i + columns + 1, i + 1, i + columns + 2, i + columns + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
function Surface({
  sections,
  material,
  open = false,
  width = 1,
}: {
  sections: Section[];
  material: THREE.Material;
  open?: boolean;
  width?: number;
}) {
  const key = JSON.stringify(sections);
  const geometry = useMemo(() => tailoredSurface(JSON.parse(key), open, width), [key, open, width]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={material} castShadow receiveShadow />;
}
function Piece({ points, material }: { points: Point[]; material: THREE.Material }) {
  const key = JSON.stringify(points);
  const geometry = useMemo(() => {
    const points: Point[] = JSON.parse(key);
    const shape = points.map(([x, y]) => new THREE.Vector2(x, y));
    const triangles = THREE.ShapeUtils.triangulateShape(shape, []);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
    g.setAttribute(
      'uv',
      new THREE.Float32BufferAttribute(
        points.flatMap(([x, y]) => [x, y]),
        2,
      ),
    );
    g.setIndex(triangles.flat());
    g.computeVertexNormals();
    return g;
  }, [key]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={material} castShadow />;
}
function Button({
  position,
  material,
  small = false,
}: {
  position: Point;
  material: THREE.Material;
  small?: boolean;
}) {
  return (
    <mesh position={position} rotation={[Math.PI / 2, 0, 0]} material={material} castShadow>
      <cylinderGeometry args={[small ? 0.009 : 0.016, small ? 0.009 : 0.016, 0.007, 20]} />
    </mesh>
  );
}

export function TailoredHuman({
  design,
  measure,
  cloth,
  skin,
  lapel,
  ivory,
  dark,
  trouser,
}: {
  design: Design;
  measure: boolean;
  cloth: THREE.Material;
  skin: THREE.Material;
  lapel: THREE.Material;
  ivory: THREE.Material;
  dark: THREE.Material;
  trouser: THREE.Material;
}) {
  const { nodes } = useGLTF('/models/human-reference-v1.glb');
  const eyeSource = useTexture('/models/brown-eye.png');
  const geometries = useMemo(
    () =>
      Object.fromEntries(
        ['Body', 'ExposedSkin', 'Hair', 'Eyes', 'Trousers', 'Shorts'].map((name) => [
          name,
          (nodes[name] as THREE.Mesh).geometry.clone(),
        ]),
      ),
    [nodes],
  );
  const eyes = useMemo(() => {
    const texture = eyeSource.clone();
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = true;
    return texture;
  }, [eyeSource]);
  const mesh = (name: string) => geometries[name];
  useEffect(() => () => Object.values(geometries).forEach((g) => g.dispose()), [geometries]);
  useEffect(() => () => eyes.dispose(), [eyes]);
  const skinMaterial = useMemo(() => {
    const material = skin.clone() as THREE.MeshStandardMaterial;
    material.vertexColors = true;
    return material;
  }, [skin]);
  useEffect(() => () => skinMaterial.dispose(), [skinMaterial]);
  const width = design.fit === 'Relaxed' ? 1.1 : design.fit === 'Classic' ? 1.045 : 1;
  const shirt = design.product === 'shirt';
  const legs = design.product === 'suit' ? cloth : trouser;
  return (
    <group name="human-reference">
      <mesh
        name={measure ? 'anatomical-body' : 'face-and-hands'}
        geometry={mesh(measure ? 'Body' : 'ExposedSkin')}
        material={skinMaterial}
        castShadow
        receiveShadow
      />
      <mesh geometry={mesh('Eyes')}>
        <meshStandardMaterial map={eyes} roughness={0.35} />
      </mesh>
      <mesh geometry={mesh('Hair')} castShadow>
        <meshStandardMaterial color="#30251f" roughness={0.94} side={THREE.DoubleSide} />
      </mesh>
      {measure ? (
        <mesh geometry={mesh('Shorts')} material={trouser} castShadow receiveShadow />
      ) : (
        <>
          {/* Shirt front sits inside the actual jacket opening. */}
          <Surface
            material={shirt ? cloth : ivory}
            width={shirt ? width : 1}
            sections={[
              [1.77, 0, 0.015, 0.3, 0.17],
              [2.04, 0, 0.005, 0.285, 0.175],
              [2.37, 0, 0.005, 0.33, 0.208],
              [2.67, 0, 0.015, 0.36, 0.19],
              [2.77, 0, 0.018, 0.29, 0.15],
              [2.92, 0, 0.03, 0.11, 0.107],
            ]}
          />
          {!shirt && (
            <Surface
              material={cloth}
              open
              width={width}
              sections={[
                [1.65, 0, 0.048, 0.37, 0.265],
                [1.85, 0, 0.042, 0.355, 0.272],
                [2.11, 0, 0, 0.305, 0.211],
                [2.42, 0, 0.006, 0.354, 0.232],
                [2.66, 0, 0.012, 0.397, 0.211],
                [2.75, 0, 0.018, 0.377, 0.177],
                [2.86, 0, 0.025, 0.25, 0.134],
                [2.925, 0, 0.03, 0.12, 0.113],
              ]}
            />
          )}
          <mesh
            geometry={mesh('Trousers')}
            material={legs}
            scale={[width, 1, 1]}
            castShadow
            receiveShadow
          />
          {[-1, 1].map((s) => (
            <group key={s}>
              <Surface
                material={cloth}
                sections={[
                  [1.79, s * 0.537, 0.057, 0.073, 0.077],
                  [1.99, s * 0.514, 0.045, 0.089, 0.091],
                  [2.25, s * 0.486, 0.029, 0.105, 0.106],
                  [2.49, s * 0.433, 0.022, 0.122, 0.133],
                  [2.65, s * 0.398, 0.013, 0.133, 0.152],
                  [2.75, s * 0.368, 0.014, 0.099, 0.123],
                  [2.795, s * 0.355, 0.015, 0.038, 0.068],
                ]}
              />
              <Surface
                material={shirt ? cloth : ivory}
                sections={[
                  [
                    design.cuffs === 'French' && shirt ? 1.695 : 1.735,
                    s * 0.543,
                    0.058,
                    0.074,
                    0.076,
                  ],
                  [1.8, s * 0.535, 0.055, 0.076, 0.078],
                ]}
              />
              <Button position={[s * 0.545, 1.762, 0.137]} material={shirt ? ivory : dark} small />
              <Line
                points={[
                  [s * 0.24, 0.28, 0.131],
                  [s * 0.227, 0.92, 0.164],
                  [s * 0.2, 1.5, 0.213],
                ]}
                color="#ffffff"
                transparent
                opacity={0.08}
                lineWidth={0.7}
              />
              <group position={[s * 0.24, 0, 0.03]}>
                <mesh
                  position={[0, 0.074, 0.06]}
                  scale={[0.113, 0.062, 0.245]}
                  material={dark}
                  castShadow
                >
                  <sphereGeometry args={[1, 32, 20]} />
                </mesh>
                <mesh
                  position={[0, 0.115, -0.015]}
                  scale={[0.093, 0.105, 0.14]}
                  material={dark}
                  castShadow
                >
                  <sphereGeometry args={[1, 32, 20]} />
                </mesh>
                <mesh position={[0, 0.031, 0.062]} scale={[0.116, 0.024, 0.248]} castShadow>
                  <sphereGeometry args={[1, 32, 16]} />
                  <meshStandardMaterial color="#211e1b" roughness={0.85} />
                </mesh>
                {[0, 1, 2, 3].map((i) => (
                  <Line
                    key={i}
                    points={[
                      [-0.041, 0.174 - i * 0.009, 0.035 + i * 0.02],
                      [0.041, 0.174 - i * 0.009, 0.04 + i * 0.02],
                    ]}
                    color="#59483b"
                    lineWidth={1}
                  />
                ))}
              </group>
              {!shirt && (
                <>
                  <Piece
                    material={lapel}
                    points={[
                      [s * 0.116, 2.914, 0.149],
                      [
                        s * (design.lapel === 'Peak' ? 0.312 : 0.254),
                        design.lapel === 'Peak' ? 2.68 : 2.64,
                        0.182,
                      ],
                      [s * 0.207, 2.596, 0.218],
                      [s * 0.258, 2.56, 0.203],
                      [s * 0.021, 2.159, 0.227],
                      [s * 0.083, 2.55, 0.239],
                    ]}
                  />
                  <Piece
                    material={cloth}
                    points={[
                      [s * 0.139, 1.999, 0.255],
                      [s * 0.29, 2.018, 0.17],
                      [
                        s * 0.29,
                        design.pockets === 'Patch' ? 1.814 : 1.967,
                        design.pockets === 'Patch' ? 0.217 : 0.195,
                      ],
                      [
                        s * 0.14,
                        design.pockets === 'Patch' ? 1.8 : 1.948,
                        design.pockets === 'Patch' ? 0.305 : 0.285,
                      ],
                    ]}
                  />
                  <Line
                    points={[
                      [s * 0.139, 1.999, 0.26],
                      [s * 0.29, 2.018, 0.177],
                    ]}
                    color="#151918"
                    transparent
                    opacity={0.42}
                    lineWidth={1}
                  />
                  {[0, 1, 2].map((i) => (
                    <Button
                      key={i}
                      position={[s * (0.555 - i * 0.004), 1.831 + i * 0.035, 0.124]}
                      material={dark}
                      small
                    />
                  ))}
                </>
              )}
              <Piece
                material={shirt ? cloth : ivory}
                points={[
                  [s * 0.012, 2.932, 0.147],
                  [s * 0.106, 2.935, 0.109],
                  [s * (design.collar === 'Point' ? 0.083 : 0.147), 2.683, 0.211],
                  [s * 0.036, 2.755, 0.223],
                ]}
              />
            </group>
          ))}
          {(shirt
            ? [2.72, 2.54, 2.36, 2.18, 2, 1.83]
            : design.closure === 'One button'
              ? [2.145]
              : [2.145, 1.97]
          ).map((y) => (
            <Button
              key={y}
              position={[
                shirt ? 0 : -0.019,
                y,
                shirt ? (y > 2.25 ? 0.224 : 0.187) : y < 2 ? 0.293 : 0.223,
              ]}
              material={shirt ? ivory : dark}
              small={shirt}
            />
          ))}
          {!shirt && (
            <Line
              points={[
                [0.176, 2.508, 0.218],
                [0.291, 2.524, 0.174],
              ]}
              color="#acb0a7"
              transparent
              opacity={0.45}
              lineWidth={1.4}
            />
          )}
          <Line
            points={[
              [0, 2.8, -0.109],
              [0, 2.56, -0.208],
              [0, 2.1, -0.213],
              [0, 1.68, -0.21],
            ]}
            color="#151918"
            transparent
            opacity={0.22}
            lineWidth={0.7}
          />
        </>
      )}
    </group>
  );
}
