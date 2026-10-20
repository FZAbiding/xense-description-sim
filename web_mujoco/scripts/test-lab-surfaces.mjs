import assert from 'node:assert/strict';
import { Box3, Raycaster, Vector3 } from 'three';
import { createLabProp, disposeLabProp } from '../src/lab-props-view.js';

// A top-down ray through a lid must not hit two front-facing surfaces at the
// same depth. The original full-height crate body fails this check.
for (const [name, halfSize, samples] of [
  ['dynamic_pallet_geom', [0.35, 0.225, 0.20], [[0.10, 0.05], [0.07, -0.09], [-0.07, 0.13]]],
  ['storage_rack', [0.60, 0.55, 0.55], [[-0.20, -0.20], [0.30, -0.15]]]
]) {
  const prop = createLabProp(name, halfSize);
  prop.updateMatrixWorld(true);
  for (const [x, y] of samples) {
    const ray = new Raycaster(new Vector3(x, y, 2), new Vector3(0, 0, -1));
    const hits = ray.intersectObject(prop, true);
    assert.ok(hits.length > 1, `${name}: expected lid and shelf/pallet below`);
    for (let i = 1; i < hits.length; i += 1) {
      assert.ok(hits[i].distance - hits[i - 1].distance > 0.00001,
        `${name}: competing coplanar faces at (${x}, ${y})`);
    }
  }
  const bounds = new Box3().setFromObject(prop);
  for (const [axis, half] of ['x', 'y', 'z'].map((axis, i) => [axis, halfSize[i]])) {
    assert.ok(bounds.min[axis] >= -half - 1e-6 && bounds.max[axis] <= half + 1e-6,
      `${name}: visual exceeds ${axis} collision envelope`);
  }
  disposeLabProp(prop);
}
console.log('lab surfaces ok: separate lid depths, collision envelopes preserved');
