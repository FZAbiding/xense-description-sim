const MAX_WAYPOINTS = 100;
const MAX_DURATION_SECONDS = 120;
const MAX_TOTAL_SECONDS = 3600;
const PEAK_QUINTIC_SPEED = 1.875;
const quintic = (u) => u * u * u * (10 + u * (-15 + 6 * u));

export function validatePose(pose, description) {
  if (!pose || typeof pose !== 'object' || Array.isArray(pose)) throw new Error('姿态必须包含关节对象');
  const names = new Set(description.joints.map((joint) => joint.name));
  if (Object.keys(pose).length !== names.size || Object.keys(pose).some((name) => !names.has(name))) throw new Error('关节集合与当前模型不一致');
  const result = {};
  for (const joint of description.joints) {
    const value = pose[joint.name];
    if (!Number.isFinite(value) || value < joint.min - 1e-9 || value > joint.max + 1e-9) throw new Error(`关节超出限位或数值无效：${joint.name}`);
    result[joint.name] = Math.max(joint.min, Math.min(joint.max, value));
  }
  for (const joint of description.joints) {
    if (joint.mimic && Math.abs(result[joint.name] - (result[joint.mimic.joint] * joint.mimic.multiplier + joint.mimic.offset)) > 1e-8) {
      throw new Error(`夹爪联动不一致：${joint.name}`);
    }
  }
  return result;
}

export function validateWaypoints(waypoints, description) {
  if (!Array.isArray(waypoints) || waypoints.length === 0 || waypoints.length > MAX_WAYPOINTS) throw new Error('轨迹需包含 1–100 个关键帧');
  return waypoints.map((point, i) => {
    if (!point || typeof point !== 'object' || !Number.isFinite(point.durationSeconds)
      || point.durationSeconds < 0.1 || point.durationSeconds > MAX_DURATION_SECONDS) throw new Error(`第 ${i + 1} 帧时长需为 0.1–120 秒`);
    if (point.name !== undefined && (typeof point.name !== 'string' || point.name.length > 80)) throw new Error('关键帧名称最多 80 个字符');
    return { name: point.name || `姿态 ${i + 1}`, durationSeconds: point.durationSeconds, joints: validatePose(point.joints, description) };
  });
}

export function decodeMotionFile(value, description, defaultDuration = 2) {
  if (!value || value.schemaVersion !== 1 || value.model !== description.id || value.sourceUrdfSha256 !== description.sourceUrdfSha256
    || value.unit !== 'rad' || value.mode !== 'kinematic') throw new Error('文件的模型、版本、源 URDF 或角度单位不匹配');
  if (value.kind === 'xense-waypoints') {
    if (value.interpolation !== 'quintic-joint') throw new Error('不支持的轨迹插值类型');
    return validateWaypoints(value.waypoints, description);
  }
  if (value.kind !== undefined && value.kind !== 'xense-pose') throw new Error('不支持的文件类型');
  return validateWaypoints([{ name: '导入姿态', durationSeconds: defaultDuration, joints: value.joints }], description);
}

export function encodeMotionFile(waypoints, description) {
  return { schemaVersion: 1, kind: 'xense-waypoints', model: description.id, sourceUrdfSha256: description.sourceUrdfSha256,
    mode: 'kinematic', unit: 'rad', interpolation: 'quintic-joint', waypoints: validateWaypoints(waypoints, description) };
}

export function createMotionPlayer(controller, description) {
  const drivers = description.joints.filter((joint) => !joint.mimic);
  if (description.joints.some((joint) => !Number.isFinite(joint.maxVelocity) || joint.maxVelocity <= 0)) throw new Error('模型缺少源关节速度限值');
  let segments = [];
  let status = 'idle';
  let elapsed = 0;
  let duration = 0;
  let segmentIndex = 0;
  let previousTime = null;

  function sample() {
    if (!segments.length) return;
    segmentIndex = segments.findIndex((segment) => elapsed < segment.end);
    if (segmentIndex < 0) segmentIndex = segments.length - 1;
    const segment = segments[segmentIndex];
    const amount = quintic(Math.max(0, Math.min(1, (elapsed - segment.start) / segment.duration)));
    const pose = Object.fromEntries(drivers.map((joint) => [joint.name,
      segment.from[joint.name] + (segment.to[joint.name] - segment.from[joint.name]) * amount]));
    if (!controller.setPose(pose)) throw new Error('无法应用回放姿态');
  }

  function play(waypoints, now) {
    if (!Number.isFinite(now)) throw new Error('回放时钟无效');
    const validated = validateWaypoints(waypoints, description);
    let from = controller.pose();
    let total = 0;
    const plan = validated.map((point) => {
      const minimum = Math.max(...description.joints.map((joint) => PEAK_QUINTIC_SPEED * Math.abs(point.joints[joint.name] - from[joint.name]) / joint.maxVelocity));
      const seconds = Math.max(point.durationSeconds, minimum);
      const segment = { from, to: point.joints, start: total, end: total + seconds, duration: seconds };
      total += seconds;
      from = point.joints;
      return segment;
    });
    if (!Number.isFinite(total) || total > MAX_TOTAL_SECONDS) throw new Error('轨迹总时长不能超过一小时');
    segments = plan; duration = total; elapsed = 0; segmentIndex = 0; status = 'playing'; previousTime = now;
    sample();
  }

  function tick(now) {
    if (status !== 'playing') return false;
    if (!Number.isFinite(now)) return false;
    if (previousTime !== null && now < previousTime) return false;
    const delta = previousTime === null ? 0 : Math.max(0, Math.min(0.25, now - previousTime));
    previousTime = now;
    if (delta === 0) return false;
    elapsed = Math.min(duration, elapsed + delta);
    sample();
    if (elapsed >= duration) status = 'complete';
    return true;
  }

  return {
    play, tick,
    pause() { if (status === 'playing') status = 'paused'; previousTime = null; },
    resume(now) { if (status === 'paused' && Number.isFinite(now)) { status = 'playing'; previousTime = now; } },
    stop() { status = 'idle'; previousTime = null; segments = []; elapsed = 0; duration = 0; segmentIndex = 0; },
    seek(amount) {
      if (!segments.length || !Number.isFinite(amount)) return false;
      elapsed = Math.max(0, Math.min(1, amount)) * duration;
      status = elapsed === duration ? 'complete' : 'paused';
      previousTime = null;
      sample();
      return true;
    },
    state: () => ({ status, elapsed, duration, segmentIndex, segmentCount: segments.length, progress: duration ? elapsed / duration : 0 })
  };
}
