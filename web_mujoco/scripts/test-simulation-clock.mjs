import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import loadMujoco from '@mujoco/mujoco';
import { createSimulationClock, advanceSimulation } from '../src/simulation-clock.js';
import { createAgvController } from '../src/agv-control.js';
import { createPhysicsController } from '../src/pd-control.js';
import { bindJoints } from '../src/kinematics.js';
import { CAMPUS_LAYOUT } from '../src/campus-layout.js';

for (const fps of [5, 15, 30, 60, 120, 144]) {
  const clock = createSimulationClock(0.001);
  clock.reset(0);
  let steps = 0;
  for (let frame = 1; frame <= fps * 3; frame += 1) steps += clock.steps(frame * 1000 / fps);
  assert.equal(steps, 3000, `${fps} FPS must advance three seconds, not ${steps / 1000}`);
}
const clock = createSimulationClock(0.001);
clock.reset(0);
assert.equal(clock.steps(1), 1);
assert.equal(clock.steps(10001), 250, 'Long stalls must have a bounded catch-up');
assert.equal(clock.steps(10002), 1, 'Dropped time must not leave growing simulation debt');
clock.reset();
assert.equal(clock.steps(999999), 0, 'Resuming a hidden tab must not advance suspended time');
assert.equal(clock.steps(1000019), 20);

const mujoco = await loadMujoco();
const modelDir = new URL('../../rebotarm_mujoco_rs/models/', import.meta.url);
const xmlName = 'rs_agv_campus_scene.xml';
const xml = await readFile(new URL(xmlName, modelDir), 'utf8');
const vfs = new mujoco.MjVFS();
vfs.addBuffer(xmlName, new TextEncoder().encode(xml));
const files = [...new Set([...xml.matchAll(/\sfile="([^"]+\.(?:stl|obj|msh))"/gi)].map((match) => `meshes/${match[1]}`))];
for (const name of files) vfs.addBuffer(name, await readFile(new URL(name, modelDir)));
const model = mujoco.MjModel.from_xml_path(xmlName, vfs);
const data = new mujoco.MjData(model);
try {
  mujoco.mj_forward(model, data);
  const drive = createAgvController(mujoco, model, data, CAMPUS_LAYOUT);
  const physics = createPhysicsController(mujoco, model, data, bindJoints(mujoco, model), {
    beforeStep: () => drive.apply(), afterStep: () => drive.enforceHeldPose()
  });
  for (const fps of [5, 15, 30, 60, 120]) {
    physics.reset();
    drive.releasePlanarPose();
    drive.setPlanarPose(-2, 0.6, 0);
    drive.setCommand(0.65, 0);
    const timer = createSimulationClock(model.opt.timestep);
    timer.reset(0);
    let previousControlTime = data.time;
    for (let frame = 1; frame <= fps * 3; frame += 1) {
      advanceSimulation(physics, timer.steps(frame * 1000 / fps), () => {
        assert(data.time - previousControlTime <= 0.012001, 'Task-control cadence depends on the render frame rate');
        previousControlTime = data.time;
      });
    }
    const distance = drive.pose().x + 2;
    assert(Math.abs(data.time - 3) < 1e-6, `${fps} FPS: incorrect physics time`);
    assert(Math.abs(distance - 1.95) < 0.04, `${fps} FPS: 0.65 m/s travelled only ${distance} m in 3 wall seconds`);
    console.log(`${fps} FPS: 3 wall seconds -> ${data.time.toFixed(3)} simulation seconds, ${distance.toFixed(3)} m at 0.65 m/s`);
  }
  drive.stop();
  const stoppedAt = drive.pose();
  advanceSimulation(physics, 250, () => {});
  assert(Math.hypot(drive.pose().x - stoppedAt.x, drive.pose().y - stoppedAt.y) < 0.01, 'Stop must remain effective with multi-step catch-up');
  console.log('Timing ok: real AGV displacement, 5–144 FPS, task cadence, pause/resume, bounded stalls and stop');
} finally {
  data.delete(); model.delete(); vfs.delete();
}
