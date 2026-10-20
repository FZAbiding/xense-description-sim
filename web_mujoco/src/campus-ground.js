import * as THREE from 'three';
import { CAMPUS_BUILDINGS, CAMPUS_LAYOUT } from './campus-layout.js';

// Partition a single floor into disjoint rectangles. Layering large road boxes
// over a base plane leaves sub-millimetre gaps that collapse in the depth buffer.
export function createCampusGroundGeometry() {
  const [halfX, halfY] = CAMPUS_LAYOUT.floorHalfSize;
  const areas = [
    { minX: -halfX, maxX: halfX, minY: -1.5, maxY: 1.5, color: 0x485254 },
    { minX: -2.2, maxX: 2.2, minY: -halfY, maxY: halfY, color: 0x485254 },
    { minX: 1.95, maxX: 14.35, minY: -11.45, maxY: -1.65, color: 0x485254 },
    ...CAMPUS_BUILDINGS.map((building) => ({
      minX: building.x - building.halfX, maxX: building.x + building.halfX,
      minY: building.y - building.halfY, maxY: building.y + building.halfY,
      color: 0xb4b9ad
    }))
  ];
  const breaks = (min, max, low, high) => [...new Set([
    min, max, ...areas.flatMap((area) => [area[low], area[high]])
  ])].filter((n) => n >= min && n <= max).sort((a, b) => a - b);
  const xs = breaks(-halfX, halfX, 'minX', 'maxX');
  const ys = breaks(-halfY, halfY, 'minY', 'maxY');
  const positions = [];
  const colors = [];
  const color = new THREE.Color();
  for (let x = 0; x < xs.length - 1; x += 1) {
    for (let y = 0; y < ys.length - 1; y += 1) {
      const x0 = xs[x], x1 = xs[x + 1], y0 = ys[y], y1 = ys[y + 1];
      const centerX = (x0 + x1) / 2, centerY = (y0 + y1) / 2;
      let surfaceColor = 0xadb5a3;
      for (const area of areas) {
        if (centerX > area.minX && centerX < area.maxX && centerY > area.minY && centerY < area.maxY) {
          surfaceColor = area.color;
        }
      }
      color.setHex(surfaceColor);
      positions.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y0, 0, x1, y1, 0, x0, y1, 0);
      for (let vertex = 0; vertex < 6; vertex += 1) colors.push(color.r, color.g, color.b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
