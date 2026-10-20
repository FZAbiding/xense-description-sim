const POSITION_TOLERANCE = 0.0005;
const ANGLE_TOLERANCE = 0.01;
const ORIENTATION_WEIGHT = 0.25;

function solveLinear(matrix, rhs) {
  const rows = matrix.map((row, i) => [...row, rhs[i]]);
  const size = rows.length;
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    if (Math.abs(rows[pivot][column]) < 1e-14) return null;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    for (let i = column; i <= size; i += 1) rows[column][i] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let i = column; i <= size; i += 1) rows[row][i] -= factor * rows[column][i];
    }
  }
  return rows.map((row) => row[size]);
}

// World-space SO(3) logarithm, including rotations near pi.
export function orientationError(target, current) {
  const r = Array.from({ length: 9 }, (_, i) => {
    const row = Math.floor(i / 3);
    const column = i % 3;
    return target[row * 3] * current[column * 3]
      + target[row * 3 + 1] * current[column * 3 + 1]
      + target[row * 3 + 2] * current[column * 3 + 2];
  });
  let w; let x; let y; let z;
  const trace = r[0] + r[4] + r[8];
  if (trace > 0) {
    const s = 2 * Math.sqrt(1 + trace);
    w = s / 4; x = (r[7] - r[5]) / s; y = (r[2] - r[6]) / s; z = (r[3] - r[1]) / s;
  } else if (r[0] > r[4] && r[0] > r[8]) {
    const s = 2 * Math.sqrt(Math.max(0, 1 + r[0] - r[4] - r[8]));
    w = (r[7] - r[5]) / s; x = s / 4; y = (r[1] + r[3]) / s; z = (r[2] + r[6]) / s;
  } else if (r[4] > r[8]) {
    const s = 2 * Math.sqrt(Math.max(0, 1 + r[4] - r[0] - r[8]));
    w = (r[2] - r[6]) / s; x = (r[1] + r[3]) / s; y = s / 4; z = (r[5] + r[7]) / s;
  } else {
    const s = 2 * Math.sqrt(Math.max(0, 1 + r[8] - r[0] - r[4]));
    w = (r[3] - r[1]) / s; x = (r[2] + r[6]) / s; y = (r[5] + r[7]) / s; z = s / 4;
  }
  if (w < 0) { w = -w; x = -x; y = -y; z = -z; }
  const norm = Math.hypot(x, y, z);
  const factor = norm < 1e-12 ? 2 : 2 * Math.atan2(norm, w) / norm;
  return [x * factor, y * factor, z * factor];
}

export function createFlexivIk(mujoco, model, data, controller, description) {
  const scratch = new mujoco.MjData(model);
  const arms = Object.fromEntries(Object.entries(description.arms).map(([side, entry]) => {
    const body = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_BODY.value, entry.tcpBody);
    if (body < 0) throw new Error(`模型缺少末端坐标 ${entry.tcpBody}`);
    return [side, { body, frame: entry.tcpBody, joints: entry.joints.map((name) => controller.byName[name]) }];
  }));

  function readPose(side, state = data) {
    const arm = arms[side];
    return {
      frame: arm.frame,
      position: Array.from(state.xpos.subarray(arm.body * 3, arm.body * 3 + 3)),
      rotation: Array.from(state.xmat.subarray(arm.body * 9, arm.body * 9 + 9))
    };
  }

  function solve(side, target, { holdOrientation = true, maxIterations = 100 } = {}) {
    if (!Object.hasOwn(arms, side) || !Array.isArray(target?.position)
      || target.position.length !== 3 || !target.position.every(Number.isFinite)
      || (target.rotation && (target.rotation.length !== 9 || !Array.from(target.rotation).every(Number.isFinite)))) {
      return { success: false, reason: 'invalid-target' };
    }
    const arm = arms[side];
    const reference = target.rotation || readPose(side).rotation;
    scratch.qpos.set(data.qpos);
    mujoco.mj_forward(model, scratch);
    let damping = 0.012;
    let residual;
    function evaluate() {
      const pose = readPose(side, scratch);
      const position = target.position.map((value, i) => value - pose.position[i]);
      const orientation = holdOrientation ? orientationError(reference, pose.rotation) : [0, 0, 0];
      const error = holdOrientation ? [...position, ...orientation.map((value) => value * ORIENTATION_WEIGHT)] : position;
      return { error, positionError: Math.hypot(...position), orientationError: Math.hypot(...orientation), cost: Math.hypot(...error), pose };
    }
    for (let iteration = 0; iteration <= maxIterations; iteration += 1) {
      residual = evaluate();
      if (residual.positionError <= POSITION_TOLERANCE && (!holdOrientation || residual.orientationError <= ANGLE_TOLERANCE)) {
        return { success: true, iterations: iteration, positionError: residual.positionError, orientationError: residual.orientationError,
          pose: residual.pose, angles: Object.fromEntries(arm.joints.map((joint) => [joint.name, scratch.qpos[joint.address]])) };
      }
      if (iteration === maxIterations) break;
      const rows = Array.from({ length: holdOrientation ? 6 : 3 }, () => []);
      for (const joint of arm.joints) {
        const axis = scratch.xaxis.subarray(joint.id * 3, joint.id * 3 + 3);
        const anchor = scratch.xanchor.subarray(joint.id * 3, joint.id * 3 + 3);
        const offset = residual.pose.position.map((v, i) => v - anchor[i]);
        rows[0].push(axis[1] * offset[2] - axis[2] * offset[1]);
        rows[1].push(axis[2] * offset[0] - axis[0] * offset[2]);
        rows[2].push(axis[0] * offset[1] - axis[1] * offset[0]);
        if (holdOrientation) for (let i = 0; i < 3; i += 1) rows[i + 3].push(axis[i] * ORIENTATION_WEIGHT);
      }
      const gram = arm.joints.map((_, i) => arm.joints.map((__, j) =>
        rows.reduce((sum, row) => sum + row[i] * row[j], 0) + (i === j ? damping * damping : 0)));
      const rhs = arm.joints.map((_, i) => rows.reduce((sum, row, j) => sum + row[i] * residual.error[j], 0));
      const delta = solveLinear(gram, rhs);
      if (!delta || !delta.every(Number.isFinite)) break;
      const scale = Math.min(1, 0.15 / Math.max(...delta.map(Math.abs), 1e-12));
      const previous = arm.joints.map((joint) => scratch.qpos[joint.address]);
      let improved = false;
      for (let fraction = 1; fraction >= 1 / 64; fraction /= 2) {
        arm.joints.forEach((joint, i) => {
          scratch.qpos[joint.address] = Math.max(joint.min, Math.min(joint.max, previous[i] + delta[i] * scale * fraction));
        });
        mujoco.mj_forward(model, scratch);
        if (evaluate().cost < residual.cost - 1e-10) { improved = true; break; }
      }
      if (improved) damping = Math.max(0.004, damping * 0.8);
      else {
        arm.joints.forEach((joint, i) => { scratch.qpos[joint.address] = previous[i]; });
        mujoco.mj_forward(model, scratch);
        damping *= 3;
        if (damping > 0.5) break;
      }
    }
    residual = evaluate();
    return { success: false, reason: 'unreachable', positionError: residual.positionError, orientationError: residual.orientationError };
  }

  return { readPose, solve, dispose: () => scratch.delete() };
}
