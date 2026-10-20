import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import loadMujoco from '@mujoco/mujoco';
import { createFlexivController } from '../src/flexiv-control.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const config = JSON.parse(await readFile(path.join(root, 'web_mujoco/src/flexiv-model.json')));
const startup = JSON.parse(await readFile(path.join(root, 'assets/xense/assets/assemblies/forward-01-flexiv-rizon4s/config/start_pose.taccap.json')));
const modelDirectory = path.join(root, 'rebotarm_mujoco_rs/models');
const mujoco = await loadMujoco();
const vfs = new mujoco.MjVFS();
const scene = await readFile(path.join(modelDirectory, config.sceneXml));
vfs.addBuffer(config.sceneXml, scene);
for (const [, relative] of scene.toString().matchAll(/\bfile="([^"]+)"/g)) {
  vfs.addBuffer(relative, await readFile(path.join(modelDirectory, relative)));
}
const model = mujoco.MjModel.from_xml_path(config.sceneXml, vfs);
const data = new mujoco.MjData(model);
try {
  assert.equal(model.nq, 18);
  assert.equal(model.ncam, 2);
  assert.equal(model.neq, 2);
  assert.equal(model.nu, 0, 'Preview must not introduce arbitrary actuator dynamics');
  const controller = createFlexivController(mujoco, model, data, config);
  const initial = controller.pose();
  for (const side of ['left', 'right']) {
    startup.values[`${side}_arm`].forEach((angle, i) => {
      assert(Math.abs(initial[`${side}_joint${i + 1}`] - angle * Math.PI / 180) < 1e-12);
    });
  }
  const cameraIds = config.cameras.map((entry) => mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_CAMERA.value, entry.name));
  const positions = () => cameraIds.map((id) => Array.from(data.cam_xpos.subarray(id * 3, id * 3 + 3)));
  const before = positions();
  controller.setJoint('left_joint1', initial.left_joint1 - 0.2);
  const after = positions();
  assert(Math.hypot(...after[0].map((v, i) => v - before[0][i])) > 0.01, 'Left camera must follow left arm');
  assert.deepEqual(after[1], before[1], 'Left arm control must not move the right camera');

  for (const side of ['left', 'right']) {
    for (const percentage of [0, 37, 100]) {
      controller.setGripper(side, percentage);
      const pose = controller.pose();
      const driver = `${side}_tool_taccap_right_finger_joint`;
      const follower = `${side}_tool_taccap_left_finger_joint`;
      assert(Math.abs(pose[driver] + pose[follower]) < 1e-12, 'Opposing fingers must keep -1 coupling');
      assert(Math.abs(pose[driver] - controller.byName[driver].max * percentage / 100) < 1e-12);
    }
  }
  const joint = controller.byName.right_joint6;
  controller.setJoint(joint.name, 1000);
  assert.equal(data.qpos[joint.address], model.jnt_range[joint.id * 2 + 1], 'Clamp at the compiled source limit');
  assert.equal(controller.setJoint(joint.name, NaN), false);
  assert.equal(controller.setJoint('left_tool_taccap_left_finger_joint', 0), false);
  controller.reset();
  assert.deepEqual(controller.pose(), initial);

  for (const entry of config.cameras) {
    const cameraId = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_CAMERA.value, entry.name);
    const bodyId = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_BODY.value, entry.opticalLink);
    for (let i = 0; i < 3; i += 1) {
      assert(Math.abs(data.cam_xpos[cameraId * 3 + i] - data.xpos[bodyId * 3 + i]) < 1e-12);
    }
    for (let i = 0; i < 9; i += 1) {
      const sign = i % 3 === 0 ? 1 : -1;
      assert(Math.abs(data.cam_xmat[cameraId * 9 + i] - sign * data.xmat[bodyId * 9 + i]) < 1e-12,
        'Camera conversion must preserve optical +Z forward and image orientation');
    }
  }
  console.log('Forward-01 WASM checks passed: source startup, independent arms, source limits, mimic, reset, optical frame conversion.');
} finally {
  data.delete();
  model.delete();
  vfs.delete();
}
