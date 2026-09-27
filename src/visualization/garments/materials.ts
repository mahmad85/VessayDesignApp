import * as THREE from 'three';
import type { Fabric } from '@/modules/catalog/catalog';

// Browser-only fabric materials. Textures are generated references, not
// supplier swatch scans. UVs are in scene units, so one texture repeat is a
// fixed physical size on every garment.

const TILE = 0.4;

function canvas(size: number) {
  const element = document.createElement('canvas');
  element.width = element.height = size;
  return [element, element.getContext('2d')!] as const;
}

function repeatTexture(element: HTMLCanvasElement, repeat: number, color: boolean) {
  const texture = new THREE.CanvasTexture(element);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 8;
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Colour and pattern; one tile covers 0.4 scene units (about 21 cm). */
export function patternTexture(fabric: Pick<Fabric, 'color' | 'pattern'>) {
  const [element, c] = canvas(512);
  c.fillStyle = fabric.color;
  c.fillRect(0, 0, 512, 512);
  // Gentle mottling so large areas do not look flat.
  for (let i = 0; i < 2400; i++) {
    const x = (i * 97.13) % 512,
      y = (i * 57.71) % 512;
    c.fillStyle = i % 2 ? 'rgba(255,255,255,.018)' : 'rgba(0,0,0,.022)';
    c.fillRect(x, y, 3, 1);
  }
  if (fabric.pattern === 'check') {
    c.strokeStyle = 'rgba(214,216,198,.42)';
    c.lineWidth = 1.5;
    for (let n = 0; n < 512; n += 128) {
      c.beginPath();
      c.moveTo(n + 0.5, 0);
      c.lineTo(n + 0.5, 512);
      c.moveTo(0, n + 0.5);
      c.lineTo(512, n + 0.5);
      c.stroke();
    }
  }
  if (fabric.pattern === 'stripe') {
    c.fillStyle = 'rgba(34,63,93,.5)';
    for (let n = 0; n < 512; n += 20) c.fillRect(n, 0, 2, 512);
  }
  return repeatTexture(element, 1 / TILE, true);
}

/** Tangent-space weave normals: twill diagonals or a plain basket weave. */
export function weaveNormal(pattern: Fabric['pattern'], fine = false) {
  const size = 128;
  const [element, c] = canvas(size);
  const data = c.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const twill = pattern === 'twill' || pattern === 'check';
      const phase = twill ? ((x + y) / 4) * Math.PI : (x / 4) * Math.PI;
      const cross = twill
        ? 0
        : Math.sin((y / 4) * Math.PI) * Math.sign(Math.sin((x / 8) * Math.PI));
      const nx = Math.cos(phase) * 0.5;
      const ny = (twill ? Math.cos(phase) : cross) * 0.5;
      const i = (y * size + x) * 4;
      data.data[i] = 128 + nx * 90;
      data.data[i + 1] = 128 + ny * 90;
      data.data[i + 2] = 255;
      data.data[i + 3] = 255;
    }
  c.putImageData(data, 0, 0);
  // 128 px covers about 1.5 cm of cloth.
  return repeatTexture(element, fine ? 90 : 36, false);
}
