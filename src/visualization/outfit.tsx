'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { fabricFor } from '@/modules/catalog/catalog';
import type { Design } from '@/modules/configuration/types';
import { sketchSpec, shoeStyle } from './sketch-spec';
import { outfitParts, type GarmentPart, type Role } from './garments/garments';
import { patternTexture, weaveNormal } from './garments/materials';

// Generated garments for the accepted design. Lining, monogram, threads and
// accessories are shown in the 2D drawing instead.

function lighter(hex: string, amount: number) {
  return new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), amount);
}

function useMaterials(design: Design) {
  const spec = sketchSpec(design);
  const fabric = fabricFor(design.fabricId)!;
  const shirtProduct = design.product === 'shirt';
  const buttonColor = spec.jacket?.buttonColor ?? '#2f2a25';
  const shoe = shoeStyle(spec.shoes);
  const key = [fabric.id, shirtProduct, buttonColor, shoe.color, design.product].join('|');
  const materials = useMemo(() => {
    const pattern = patternTexture(fabric);
    const weave = weaveNormal(fabric.pattern);
    const fine = weaveNormal('plain', true);
    const cloth = new THREE.MeshPhysicalMaterial({
      map: pattern,
      normalMap: weave,
      normalScale: new THREE.Vector2(0.28, 0.28),
      roughness: 0.84,
      sheen: 0.7,
      sheenRoughness: 0.6,
      sheenColor: lighter(fabric.color, 0.45),
    });
    const facing = cloth.clone();
    facing.sheen = 0.95;
    // A pressed facing catches light differently from the body cloth.
    facing.color = new THREE.Color('#ffffff').multiplyScalar(0.9);
    facing.sheenRoughness = 0.4;
    const shirtColor = shirtProduct ? fabric.color : '#f2f0ea';
    const shirt = new THREE.MeshPhysicalMaterial({
      map: shirtProduct ? pattern : null,
      color: shirtProduct ? '#ffffff' : shirtColor,
      normalMap: fine,
      normalScale: new THREE.Vector2(0.12, 0.12),
      roughness: 0.7,
      sheen: 0.3,
      sheenColor: new THREE.Color('#ffffff'),
      side: THREE.DoubleSide,
    });
    const trouser =
      design.product === 'suit'
        ? cloth
        : new THREE.MeshPhysicalMaterial({
            color: '#56524b',
            normalMap: weave,
            normalScale: new THREE.Vector2(0.25, 0.25),
            roughness: 0.9,
            sheen: 0.5,
            sheenColor: new THREE.Color('#8a857c'),
          });
    const byRole: Record<Role, THREE.Material> = {
      cloth,
      facing,
      trouser,
      shirt,
      lining: new THREE.MeshStandardMaterial({
        color: new THREE.Color(fabric.color).multiplyScalar(0.55),
        roughness: 0.45,
        side: THREE.BackSide,
      }),
      seam: new THREE.MeshStandardMaterial({
        color: new THREE.Color(fabric.color).multiplyScalar(0.62),
        roughness: 0.9,
      }),
      button: new THREE.MeshPhysicalMaterial({
        color: buttonColor,
        roughness: 0.32,
        clearcoat: 0.6,
      }),
      shirtButton: new THREE.MeshStandardMaterial({ color: '#f5f3ee', roughness: 0.3 }),
      shoe: new THREE.MeshPhysicalMaterial({
        color: shoe.color,
        roughness: 0.42,
        clearcoat: 0.7,
        clearcoatRoughness: 0.25,
      }),
      sole: new THREE.MeshStandardMaterial({ color: '#1b1816', roughness: 0.8 }),
      metal: new THREE.MeshStandardMaterial({ color: '#c9a55f', metalness: 1, roughness: 0.3 }),
    };
    return { byRole, textures: [pattern, weave, fine] };
    // The key captures every input used above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(
    () => () => {
      new Set(Object.values(materials.byRole)).forEach((m) => m.dispose());
      materials.textures.forEach((t) => t.dispose());
    },
    [materials],
  );
  return materials.byRole;
}

function Part({ part, material }: { part: GarmentPart; material: THREE.Material }) {
  if (part.matrices)
    return (
      <instancedMesh
        args={[part.geometry, material, part.matrices.length]}
        castShadow
        ref={(mesh) => {
          if (!mesh) return;
          part.matrices!.forEach((m, i) => mesh.setMatrixAt(i, m));
          mesh.instanceMatrix.needsUpdate = true;
          mesh.computeBoundingSphere();
        }}
      />
    );
  return <mesh geometry={part.geometry} material={material} castShadow receiveShadow />;
}

export function Outfit({ design }: { design: Design }) {
  const spec = sketchSpec(design);
  const shape = JSON.stringify({ ...spec, fabric: undefined, skinTone: undefined });
  // Rebuilt only when a shape-affecting choice changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const parts = useMemo(() => outfitParts(sketchSpec(design)), [shape]);
  useEffect(() => () => parts.forEach((p) => p.geometry.dispose()), [parts]);
  const materials = useMaterials(design);
  return (
    <group name="generated-outfit">
      {parts.map((part) => (
        <Part key={part.key} part={part} material={materials[part.role]} />
      ))}
    </group>
  );
}
