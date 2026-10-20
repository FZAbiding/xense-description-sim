import { createMotionPlayer, decodeMotionFile, encodeMotionFile, validateWaypoints } from './flexiv-motion.js';

export function createFlexivMotionUi({ controller, description, ik, view, onPoseChange, onSelectSide, saveFile, filename }) {
  const player = createMotionPlayer(controller, description);
  const element = (id) => document.getElementById(id);
  const coordinateInputs = ['x', 'y', 'z'].map((axis) => element(`tcp-${axis}`));
  let side = 'left';
  let dragEnabled = false;
  let dragRotation = null;
  let waypoints = [];
  let recordNumber = 0;
  let lastRevision = -1;
  let notice = '';
  let noticeError = false;
  let lastIk = null;

  function syncTcp(force = false) {
    for (const arm of ['left', 'right']) {
      const current = ik.readPose(arm);
      ['x', 'y', 'z'].forEach((axis, index) => {
        element(`${arm}-tcp-${axis}`).textContent = current.position[index].toFixed(4);
      });
      const active = dragEnabled && side === arm;
      const button = element(`${arm}-tcp-drag`);
      button.setAttribute('aria-pressed', String(active));
      button.textContent = `${active ? '结束' : '拖动'}${arm === 'left' ? '左臂' : '右臂'}${active ? '拖动' : ' TCP'}`;
      document.querySelector(`[data-tcp-side="${arm}"]`).classList.toggle('drag-active', active);
    }
    const pose = ik.readPose(side);
    coordinateInputs.forEach((input, i) => {
      if (force || document.activeElement !== input) input.value = pose.position[i].toFixed(4);
    });
    element('tcp-side-label').textContent = side === 'left' ? '左臂' : '右臂';
    element('tcp-stage-hint').textContent = dragEnabled ? `${side === 'left' ? '左臂' : '右臂'}拖动中 · 拖彩色轴 / 平面 · Esc 退出` : '点击对应按钮，直接进入左臂或右臂拖动';
  }

  function updatePlayback() {
    const state = player.state();
    element('motion-play').disabled = waypoints.length === 0 || state.status === 'playing';
    element('motion-play').textContent = state.status === 'paused' ? '继续' : '播放';
    element('motion-pause').disabled = state.status !== 'playing';
    element('motion-stop').disabled = state.status === 'idle';
    element('record-waypoint').disabled = waypoints.length >= 100;
    element('export-motion').disabled = waypoints.length === 0;
    element('clear-waypoints').disabled = waypoints.length === 0;
    element('motion-progress').disabled = state.segmentCount === 0;
    element('motion-progress').value = Math.round(state.progress * 1000);
    const labels = { playing: '播放中', paused: '已暂停', complete: '已完成' };
    const status = element('motion-status');
    status.textContent = noticeError ? notice : state.status === 'idle' ? notice || '先记录两个姿态，或导入姿态 / 轨迹 JSON'
      : `${labels[state.status]} · ${state.elapsed.toFixed(1)} / ${state.duration.toFixed(1)} 秒 · 片段 ${state.segmentIndex + 1}/${state.segmentCount}`;
    status.classList.toggle('error', noticeError);
    element('waypoint-count').textContent = `${waypoints.length} 帧`;
  }

  function stop(message = '') {
    player.stop();
    notice = message;
    noticeError = false;
    updatePlayback();
  }

  function setDrag(enabled) {
    dragEnabled = enabled;
    view.setTcpDrag(side, enabled);
    if (enabled) {
      stop('末端控制已启用');
    }
    syncTcp(true);
  }

  function applyTarget(position, rotation = ik.readPose(side).rotation) {
    stop('已切换到末端控制');
    lastIk = ik.solve(side, { position, rotation }, { holdOrientation: element('tcp-hold-orientation').checked });
    const status = element('tcp-result');
    status.classList.toggle('error', !lastIk.success);
    if (lastIk.success && controller.setPose(lastIk.angles)) {
      const orientation = element('tcp-hold-orientation').checked ? `朝向误差 ${(lastIk.orientationError * 180 / Math.PI).toFixed(2)}°` : '朝向自由';
      status.textContent = `${side === 'left' ? '左臂' : '右臂'}已到达 · 误差 ${(lastIk.positionError * 1000).toFixed(2)} mm · ${orientation}`;
      onPoseChange();
      syncTcp();
      return true;
    }
    status.textContent = lastIk.reason === 'invalid-target' ? '请输入有效的 X、Y、Z 坐标'
      : `本次求解未收敛，已保留当前姿态 · 误差 ${(lastIk.positionError * 1000).toFixed(1)} mm`;
    return false;
  }

  function renderWaypoints() {
    const list = element('waypoint-list');
    list.replaceChildren();
    waypoints.forEach((point, index) => {
      const item = document.createElement('li');
      const row = document.createElement('div');
      const label = document.createElement('span');
      label.textContent = `${point.name} · ≥ ${point.durationSeconds.toFixed(1)} s`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '删除';
      remove.setAttribute('aria-label', `删除关键帧 ${index + 1}`);
      remove.addEventListener('click', () => {
        stop('已删除关键帧');
        waypoints.splice(index, 1);
        renderWaypoints();
      });
      row.append(label, remove);
      item.append(row);
      list.append(item);
    });
    updatePlayback();
  }

  document.querySelectorAll('[data-tcp-drag]').forEach((button) => button.addEventListener('click', () => {
    const enabled = side !== button.dataset.tcpDrag || !dragEnabled;
    onSelectSide(button.dataset.tcpDrag);
    setDrag(enabled);
  }));
  function keydown(event) {
    if (event.key === 'Escape' && dragEnabled) setDrag(false);
  }
  document.addEventListener('keydown', keydown);
  element('open-waypoints').addEventListener('click', () => {
    element('motion-panel').open = true;
    element('motion-panel').scrollIntoView({ block: 'nearest' });
    element('motion-panel').querySelector('summary').focus({ preventScroll: true });
  });
  coordinateInputs.forEach((input) => input.addEventListener('focus', () => stop('正在编辑末端目标')));
  element('tcp-apply').addEventListener('click', () => applyTarget(coordinateInputs.map((input) => input.valueAsNumber)));
  element('tcp-read').addEventListener('click', () => {
    syncTcp(true);
    element('tcp-result').classList.remove('error');
    element('tcp-result').textContent = '已读取当前末端位置';
  });
  document.querySelectorAll('[data-jog-axis]').forEach((button) => button.addEventListener('click', () => {
    const point = ik.readPose(side).position;
    point[Number(button.dataset.jogAxis)] += Number(button.dataset.jogSign) * Number(element('tcp-step').value);
    applyTarget(point);
  }));
  view.setTcpHandlers({
    start(dragSide) {
      side = dragSide;
      stop('末端拖动中');
      dragRotation = ik.readPose(side).rotation;
    },
    move(dragSide, position) {
      side = dragSide;
      applyTarget(position, dragRotation || ik.readPose(side).rotation);
    },
    end() {
      dragRotation = null;
      // A failed target remains reported, while the gizmo returns to the actual TCP.
      view.setTcpDrag(side, dragEnabled);
      syncTcp(true);
    }
  });

  element('record-waypoint').addEventListener('click', () => {
    try {
      const point = { name: `姿态 ${recordNumber + 1}`, durationSeconds: element('waypoint-duration').valueAsNumber, joints: controller.pose() };
      const next = validateWaypoints([...waypoints, point], description);
      stop('已记录当前双臂与夹爪姿态');
      waypoints = next;
      recordNumber += 1;
      element('playback-overlay').open = true;
      renderWaypoints();
    } catch (error) {
      notice = error.message; noticeError = true; updatePlayback();
    }
  });
  element('motion-play').addEventListener('click', () => {
    try {
      const paused = player.state().status === 'paused';
      setDrag(false);
      notice = ''; noticeError = false;
      if (paused) player.resume(performance.now() / 1000);
      else player.play(waypoints, performance.now() / 1000);
      updatePlayback();
    } catch (error) {
      stop(); notice = error.message; noticeError = true; updatePlayback();
    }
  });
  element('motion-pause').addEventListener('click', () => { player.pause(); updatePlayback(); });
  element('motion-stop').addEventListener('click', () => stop('回放已停止，保留当前姿态'));
  element('motion-progress').addEventListener('input', (event) => {
    if (player.seek(Number(event.target.value) / 1000)) { onPoseChange(); syncTcp(); }
    updatePlayback();
  });
  element('clear-waypoints').addEventListener('click', () => {
    stop(); waypoints = []; renderWaypoints();
  });
  element('export-motion').addEventListener('click', () => {
    try {
      const payload = encodeMotionFile(waypoints, description);
      saveFile(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), filename('trajectory.json'));
    } catch (error) {
      notice = error.message; noticeError = true; updatePlayback();
    }
  });
  element('import-motion').addEventListener('click', () => element('motion-file').click());
  element('motion-file').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error('JSON 文件不能超过 1 MiB');
      const imported = decodeMotionFile(JSON.parse(await file.text()), description, element('waypoint-duration').valueAsNumber);
      const next = validateWaypoints([...waypoints, ...imported], description);
      stop(`已导入 ${imported.length} 个关键帧，播放后应用`);
      waypoints = next;
      element('playback-overlay').open = true;
      renderWaypoints();
    } catch (error) {
      notice = `导入失败：${error.message}`; noticeError = true; updatePlayback();
    } finally {
      event.target.value = '';
    }
  });
  function visibilityChanged() {
    if (document.hidden && player.state().status === 'playing') { player.pause(); updatePlayback(); }
  }
  document.addEventListener('visibilitychange', visibilityChanged);
  syncTcp(true);
  renderWaypoints();

  return {
    refresh() { syncTcp(true); updatePlayback(); },
    interrupt(message = '当前为手动控制') { stop(message); },
    setSide(next) {
      if (side === next) return;
      side = next;
      element('tcp-result').classList.remove('error');
      element('tcp-result').textContent = `当前控制：${side === 'left' ? '左臂' : '右臂'}`;
      view.setTcpDrag(side, dragEnabled);
      syncTcp(true);
    },
    tick(now) {
      if (player.tick(now)) onPoseChange();
      if (lastRevision !== controller.revision) { syncTcp(); lastRevision = controller.revision; }
      updatePlayback();
    },
    state: () => ({ side, dragEnabled, waypointCount: waypoints.length, playback: player.state(),
      lastIk: lastIk ? { success: lastIk.success, reason: lastIk.reason, positionError: lastIk.positionError, orientationError: lastIk.orientationError } : null }),
    dispose() {
      player.stop();
      document.removeEventListener('visibilitychange', visibilityChanged);
      document.removeEventListener('keydown', keydown);
    }
  };
}
