import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import loadMujoco from '@mujoco/mujoco';
import { CAMPUS_LAYOUT } from '../src/campus-layout.js';
import { MODEL_VARIANTS, selectedModelVariant } from '../src/model-variants.js';
import { planAgvPath, AGV_FOOTPRINT_CLEARANCE } from '../src/agv-path-planner.js';
import { createAgvController } from '../src/agv-control.js';
import { createAgvNavigation, GRASP_DOCK } from '../src/agv-navigation.js';
import { createPhysicsController } from '../src/pd-control.js';
import { bindJoints } from '../src/kinematics.js';

assert.equal(selectedModelVariant('?variant=agv-campus'), MODEL_VARIANTS['agv-campus']);
assert.equal(selectedModelVariant('?variant=missing'), MODEL_VARIANTS.arm);
const modelDir = new URL('../../rebotarm_mujoco_rs/models/', import.meta.url);
const xmlName = MODEL_VARIANTS['agv-campus'].sceneXml;
const xml = await readFile(new URL(xmlName, modelDir), 'utf8');
const mujoco = await loadMujoco();
const vfs = new mujoco.MjVFS();
vfs.addBuffer(xmlName, new TextEncoder().encode(xml));
const files = [...new Set([...xml.matchAll(/\sfile="([^"]+\.(?:stl|obj|msh))"/gi)].map((match) => `meshes/${match[1]}`))];
for (const name of files) vfs.addBuffer(name, await readFile(new URL(name, modelDir)));
const model = mujoco.MjModel.from_xml_path(xmlName, vfs);
const data = new mujoco.MjData(model);
try {
  mujoco.mj_forward(model, data);
  const geomType = mujoco.mjtObj.mjOBJ_GEOM.value;
  for (const obstacle of CAMPUS_LAYOUT.obstacles) {
    const id = mujoco.mj_name2id(model, geomType, obstacle.id);
    assert(id >= 0, `Missing physics obstacle ${obstacle.id}`);
    for (const [value, expected] of [
      [data.geom_xpos[id * 3], obstacle.x], [data.geom_xpos[id * 3 + 1], obstacle.y],
      [model.geom_size[id * 3], obstacle.halfX], [model.geom_size[id * 3 + 1], obstacle.halfY]
    ]) assert(Math.abs(value - expected) < 1e-5, `Physics/navigation mismatch: ${obstacle.id}`);
    assert.equal(model.geom_group[id], 0, 'Laser rays must see the scene');
    assert(model.geom_rgba[id * 4 + 3] > 0, 'Invisible geoms do not participate in mj_ray');
  }
  assert.equal(mujoco.mj_name2id(model, geomType, 'north_partition'), -1, 'Lab walls leaked into campus');
  const plan = (start, goal) => planAgvPath(start, goal, CAMPUS_LAYOUT);
  const drive = createAgvController(mujoco, model, data, CAMPUS_LAYOUT);
  const navigation = createAgvNavigation({
    drive, maxLinear: () => 0.8, maxAngular: () => 1.8, planPath: plan
  });
  const physics = createPhysicsController(mujoco, model, data, bindJoints(mujoco, model), {
    beforeStep: () => { navigation.update(); drive.apply(); },
    afterStep: () => drive.enforceHeldPose()
  });
  // Traverse a former lab boundary, turn into the service yard, dock at both
  // bays, return to the workcell and visit the north branch of the junction.
  for (const [label, target] of [
    ['charging', CAMPUS_LAYOUT.charging], ['delivery', CAMPUS_LAYOUT.delivery],
    ['grasp', GRASP_DOCK], ['north-road', { x: 0, y: 9, yaw: Math.PI / 2 }]
  ]) {
    const route = plan(drive.pose(), target);
    assert(route.ok, `${label}: ${route.reason}`);
    // Check every smoothed segment, not just A* cell centres.
    for (let i = 1; i < route.path.length; i += 1) {
      const a = route.path[i - 1], b = route.path[i];
      const samples = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.025);
      for (let k = 0; k <= samples; k += 1) {
        const t = samples ? k / samples : 0;
        const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
        for (const obstacle of CAMPUS_LAYOUT.obstacles) {
          const distance = Math.hypot(Math.max(Math.abs(x - obstacle.x) - obstacle.halfX, 0), Math.max(Math.abs(y - obstacle.y) - obstacle.halfY, 0));
          assert(distance >= AGV_FOOTPRINT_CLEARANCE - 1e-5, `${label}: unsafe smoothed segment`);
        }
      }
    }
    assert(navigation.start(target, label === 'grasp' ? 'grasp' : 'point'));
    let steps = 0;
    while (navigation.state().active && steps < 150000) {
      physics.step(100);
      steps += 100;
      assert(Number.isFinite(drive.pose().x) && Number.isFinite(drive.pose().y), 'Physics diverged');
    }
    assert.equal(navigation.state().result, 'reached', `${label}: failed after ${steps} steps, ${JSON.stringify(drive.pose())}`);
    const pose = drive.pose();
    assert(Math.hypot(pose.x - target.x, pose.y - target.y) < 0.04, `${label}: arrival drift`);
    console.log(`${label}: reached (${pose.x.toFixed(2)}, ${pose.y.toFixed(2)}), ${steps} physics steps`);
  }
  const blocked = plan(drive.pose(), { x: -8, y: 6 });
  assert.equal(blocked.reason, 'goal-blocked');
  drive.releasePlanarPose();
  drive.setPlanarPose(14.5, 0, 0);
  drive.setCommand(0.65, 0);
  physics.step(1000);
  assert(drive.pose().x <= 14.501, 'Campus boundary failed');
  drive.setCommand(-0.3, 0);
  physics.step(500);
  assert(drive.pose().x < 14.4, 'Cannot reverse away from campus boundary');
  physics.reset();
  assert(Math.hypot(drive.pose().x - CAMPUS_LAYOUT.spawn.x, drive.pose().y - CAMPUS_LAYOUT.spawn.y) < 1e-5, 'Campus reset failed');
  console.log(`campus ok: ${CAMPUS_LAYOUT.obstacles.length} synchronized obstacles; bays, workcell, junction, blocked goal, boundary and reset verified`);
} finally {
  data.delete(); model.delete(); vfs.delete();
}
