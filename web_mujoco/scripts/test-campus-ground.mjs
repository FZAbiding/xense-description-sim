import assert from 'node:assert/strict';
import { Color, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { createCampusGroundGeometry } from '../src/campus-ground.js';

const geometry = createCampusGroundGeometry();
const mesh = new Mesh(geometry, new MeshBasicMaterial({ vertexColors: true }));
mesh.updateMatrixWorld(true);
const positions = geometry.attributes.position;
let area = 0;
for (let i = 0; i < positions.count; i += 3) {
  const [a, b, c] = [i, i + 1, i + 2].map((index) => new Vector3().fromBufferAttribute(positions, index));
  assert.equal(a.z, 0);
  assert.equal(b.z, 0);
  assert.equal(c.z, 0);
  const signedArea = b.clone().sub(a).cross(c.clone().sub(a)).z / 2;
  assert.ok(signedArea > 0, 'floor faces must point up');
  area += signedArea;
}
assert.ok(Math.abs(area - 30 * 24) < 0.0001, 'the single floor must cover exactly 30 × 24 m');
for (let x = -14.81; x < 15; x += 1.2717) {
  for (let y = -11.731; y < 12; y += 1.20237) {
    const hits = new Raycaster(new Vector3(x, y, 10), new Vector3(0, 0, -1)).intersectObject(mesh);
    assert.equal(hits.length, 1, `floor at (${x}, ${y}) must have one visible surface`);
  }
}
for (const [x, y, hex] of [[6.1, 0.27, 0x485254], [8.1, -4.1, 0x485254], [8.1, 6.1, 0xb4b9ad], [14.7, 11.7, 0xadb5a3]]) {
  const [hit] = new Raycaster(new Vector3(x, y, 10), new Vector3(0, 0, -1)).intersectObject(mesh);
  const actual = new Color().fromBufferAttribute(geometry.attributes.color, hit.face.a);
  const expected = new Color(hex);
  assert.ok(actual.toArray().every((value, index) => Math.abs(value - expected.toArray()[index]) < 1e-6));
}
geometry.dispose();
mesh.material.dispose();
console.log('campus ground ok: complete coverage, one surface per point, road/paving/grass colors');
