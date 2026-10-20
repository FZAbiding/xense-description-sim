/** Kinematic control only: preview source joint frames without inventing dynamics. */
export function createFlexivController(mujoco, model, data, description) {
  const type = mujoco.mjtObj.mjOBJ_JOINT.value;
  const joints = description.joints.map((entry) => {
    const id = mujoco.mj_name2id(model, type, entry.name);
    if (id < 0) throw new Error(`模型缺少关节 ${entry.name}`);
    return { ...entry, id, address: model.jnt_qposadr[id] };
  });
  const byName = Object.fromEntries(joints.map((entry) => [entry.name, entry]));
  let revision = 0;

  function forward() {
    for (const joint of joints) {
      if (!joint.mimic) continue;
      const driver = byName[joint.mimic.joint];
      data.qpos[joint.address] = data.qpos[driver.address] * joint.mimic.multiplier + joint.mimic.offset;
    }
    mujoco.mj_forward(model, data);
    revision += 1;
  }

  function setPose(values) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) return false;
    const entries = Object.entries(values);
    if (entries.some(([name, value]) => !Object.hasOwn(byName, name) || !Number.isFinite(value))) return false;
    const next = {};
    for (const [name, value] of entries) {
      const joint = byName[name];
      if (!joint.mimic) next[name] = Math.max(joint.min, Math.min(joint.max, value));
    }
    for (const [name, value] of entries) {
      const joint = byName[name];
      if (!joint.mimic) continue;
      const driver = byName[joint.mimic.joint];
      const expected = (next[driver.name] ?? data.qpos[driver.address]) * joint.mimic.multiplier + joint.mimic.offset;
      if (Math.abs(value - expected) > 1e-8) return false;
    }
    if (Object.entries(next).every(([name, value]) => data.qpos[byName[name].address] === value)) return true;
    for (const [name, value] of Object.entries(next)) data.qpos[byName[name].address] = value;
    forward();
    return true;
  }

  function setJoint(name, value) {
    const joint = Object.hasOwn(byName, name) ? byName[name] : null;
    if (!joint || joint.mimic) return false;
    return setPose({ [name]: value });
  }

  function reset() {
    mujoco.mj_resetData(model, data);
    for (const joint of joints) data.qpos[joint.address] = joint.home;
    forward();
  }

  function setGripper(side, percentage) {
    const joint = byName[`${side}_tool_taccap_right_finger_joint`];
    if (!joint || !Number.isFinite(percentage)) return false;
    return setJoint(joint.name, joint.min + (joint.max - joint.min) * Math.max(0, Math.min(100, percentage)) / 100);
  }

  function pose() {
    return Object.fromEntries(joints.map((entry) => [entry.name, data.qpos[entry.address]]));
  }

  reset();
  return { joints, byName, setJoint, setPose, setGripper, reset, pose, get revision() { return revision; } };
}
