'use client';

import { useEffect, useMemo } from 'react';
import { useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { Design } from '@/modules/configuration/types';
import { Outfit } from './outfit';

export function TailoredHuman({
  design,
  measure,
  skin,
  trouser,
}: {
  design: Design;
  measure: boolean;
  skin: THREE.Material;
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
  // Bermuda trousers leave the legs visible, so the full body is drawn.
  const bermuda =
    design.product === 'suit' &&
    design.customizations?.['style.pants.pants_length.pants-length'] === 'bermuda';
  return (
    <group name="human-reference">
      <mesh
        name={measure ? 'anatomical-body' : 'face-and-hands'}
        geometry={mesh(measure || bermuda ? 'Body' : 'ExposedSkin')}
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
        <Outfit design={design} />
      )}
    </group>
  );
}
