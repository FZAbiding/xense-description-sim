import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import loadMujoco from '@mujoco/mujoco';
import { createFlexivController } from '../src/flexiv-control.js';
import { createFlexivIk, orientationError } from '../src/flexiv-ik.js';
import { createMotionPlayer, encodeMotionFile, decodeMotionFile } from '../src/flexiv-motion.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const config = JSON.parse(await readFile(path.join(root, 'web_mujoco/src/flexiv-model.json')));
const models = path.join(root, 'rebotarm_mujoco_rs/models');
const mujoco = await loadMujoco();
const vfs = new mujoco.MjVFS();
const xml = await readFile(path.join(models, config.sceneXml));
vfs.addBuffer(config.sceneXml, xml);
for (const [, file] of xml.toString().matchAll(/\bfile="([^"]+)"/g)) vfs.addBuffer(file, await readFile(path.join(models, file)));
const model = mujoco.MjModel.from_xml_path(config.sceneXml, vfs);
const data = new mujoco.MjData(model);
const controller = createFlexivController(mujoco, model, data, config);
const ik = createFlexivIk(mujoco, model, data, controller, config);
try {
  const start = controller.pose();
  const revision = controller.revision;
  assert(controller.setPose(start));
  assert.equal(controller.revision, revision, 'Stationary waypoints should reuse the current render state');
  assert.equal(controller.setPose({ left_joint1: 0, bad_joint: 1 }), false);
  assert.deepEqual(controller.pose(), start, 'A failed batch update must be atomic');
  assert.equal(controller.setPose({ left_joint1: 0, right_joint1: NaN }), false);
  assert.deepEqual(controller.pose(), start);
  for (const side of ['left', 'right']) {
    controller.reset();
    const original = controller.pose();
    const tcp = ik.readPose(side);
    const otherSide = side === 'left' ? 'right' : 'left';
    const other = ik.readPose(otherSide);
    const target = { position: tcp.position.map((v, i) => v + [0.015, -0.01, 0.01][i]), rotation: tcp.rotation };
    const result = ik.solve(side, target);
    assert.deepEqual(controller.pose(), original, 'IK solving must not mutate the live scene');
    assert(result.success, `${side} IK failed: ${JSON.stringify(result)}`);
    assert(controller.setPose(result.angles));
    const reached = ik.readPose(side);
    assert(Math.hypot(...reached.position.map((v, i) => v - target.position[i])) < 0.0005);
    assert(Math.hypot(...orientationError(tcp.rotation, reached.rotation)) < 0.01);
    assert.deepEqual(ik.readPose(otherSide), other, 'IK must isolate the selected arm');
    const beforeFailure = controller.pose();
    assert.equal(ik.solve(side, { position: [10, 10, 10] }).success, false);
    assert.deepEqual(controller.pose(), beforeFailure, 'Unreachable targets must leave live state unchanged');
    assert.equal(ik.solve(side, { position: [NaN, 0, 0] }).reason, 'invalid-target');
  }
  const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  assert(Math.abs(Math.hypot(...orientationError([-1, 0, 0, 0, -1, 0, 0, 0, 1], identity)) - Math.PI) < 1e-12);

  controller.reset();
  const targetPose = { ...start, left_joint1: start.left_joint1 + 1,
    left_tool_taccap_right_finger_joint: 0, left_tool_taccap_left_finger_joint: 0 };
  const points = [{ name: '目标', joints: targetPose, durationSeconds: 0.1 }];
  const encoded = encodeMotionFile(points, config);
  const example = JSON.parse(await readFile(path.join(root, 'docs/examples/forward-01-waypoints.json')));
  assert.equal(decodeMotionFile(example, config).length, 2, 'The documented example must remain compatible with the current source model');
  assert.deepEqual(decodeMotionFile(JSON.parse(JSON.stringify(encoded)), config), points);
  const legacyPose = { schemaVersion: 1, model: config.id, unit: 'rad', mode: 'kinematic', sourceUrdfSha256: config.sourceUrdfSha256, joints: start };
  assert.deepEqual(decodeMotionFile(legacyPose, config)[0].joints, start);
  assert.throws(() => decodeMotionFile({ ...encoded, unit: 'degree' }, config));
  assert.throws(() => decodeMotionFile({ ...encoded, interpolation: 'unknown' }, config));
  assert.throws(() => decodeMotionFile({ ...encoded, sourceUrdfSha256: 'other-model' }, config));
  assert.throws(() => decodeMotionFile({ ...legacyPose, joints: { ...start, right_joint1: 100 } }, config));
  assert.throws(() => decodeMotionFile({ ...legacyPose, joints: { ...start, left_tool_taccap_left_finger_joint: 0 } }, config));
  assert.throws(() => decodeMotionFile({ ...encoded, waypoints: Array(101).fill(points[0]) }, config));

  const player = createMotionPlayer(controller, config);
  player.play(points, 0);
  assert(player.state().duration >= 1.875 / controller.byName.left_joint1.maxVelocity, 'Playback must extend segments to respect source velocity');
  let previous = controller.pose();
  const dt = 0.005;
  for (let time = dt; player.state().status === 'playing'; time += dt) {
    player.tick(time);
    const pose = controller.pose();
    for (const joint of config.joints) {
      assert(Math.abs(pose[joint.name] - previous[joint.name]) / dt <= joint.maxVelocity + 1e-7, `Velocity exceeded on ${joint.name}`);
      assert(pose[joint.name] >= joint.min - 1e-12 && pose[joint.name] <= joint.max + 1e-12);
    }
    previous = pose;
  }
  for (const [name, value] of Object.entries(targetPose)) assert(Math.abs(controller.pose()[name] - value) < 1e-12);
  assert.equal(player.state().progress, 1);
  controller.reset();
  player.play(points, 0);
  player.tick(0.1);
  player.pause();
  const frozen = controller.pose();
  player.tick(10);
  assert.deepEqual(controller.pose(), frozen);
  player.resume(10);
  player.tick(10.1);
  assert.equal(player.state().status, 'playing');
  assert(player.seek(0.5));
  assert.equal(player.state().status, 'paused');
  assert(Math.abs(controller.pose().left_joint1 - (start.left_joint1 + targetPose.left_joint1) / 2) < 1e-12);
  const stopped = controller.pose();
  player.stop(); player.tick(100);
  assert.deepEqual(controller.pose(), stopped);
  console.log('Motion WASM checks passed: independent position/orientation IK, unreachable rollback, atomic updates, validated imports, quintic limits, pause/resume/seek/stop.');
} finally {
  ik.dispose(); data.delete(); model.delete(); vfs.delete();
}
