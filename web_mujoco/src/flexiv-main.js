import description from './flexiv-model.json';
import { loadMujocoModule, loadRsScene } from './load-model.js';
import { createFlexivController } from './flexiv-control.js';
import { createFlexivView } from './flexiv-view.js';
import { createFlexivIk } from './flexiv-ik.js';
import { createFlexivMotionUi } from './flexiv-motion-ui.js';

const workspace = document.getElementById('workspace');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');
const downloadStatus = document.getElementById('download-status');
const inputs = new Map();
const radians = (degrees) => degrees * Math.PI / 180;
const degrees = (angle) => angle * 180 / Math.PI;

function saveFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  downloadStatus.textContent = `已导出 ${filename}`;
}

function filename(suffix) {
  return `forward-01-${new Date().toISOString().replaceAll(':', '-')}-${suffix}`;
}

function buildControls(controller, { onManual, onSelectSide }) {
  const host = document.getElementById('joint-controls');
  for (const side of ['left', 'right']) {
    const section = document.createElement('section');
    section.id = `${side}-controls`;
    section.setAttribute('role', 'tabpanel');
    section.setAttribute('aria-labelledby', `${side}-tab`);
    section.hidden = side !== 'left';
    for (let index = 1; index <= 7; index += 1) {
      const name = `${side}_joint${index}`;
      const joint = controller.byName[name];
      const minimum = degrees(joint.min);
      const maximum = degrees(joint.max);
      const row = document.createElement('div');
      row.className = 'joint-row';
      row.innerHTML = `<label for="${name}">J${index}</label><input id="${name}" aria-label="${side === 'left' ? '左' : '右'}臂 J${index}" data-joint="${name}" type="range" min="${minimum}" max="${maximum}" step="0.01"><label class="number-input"><input type="number" data-number="${name}" aria-label="${side === 'left' ? '左' : '右'}臂 J${index} 角度" min="${minimum}" max="${maximum}" step="0.1"><span>°</span></label>`;
      const slider = row.querySelector('input[type="range"]');
      const number = row.querySelector('input[type="number"]');
      const update = (value) => {
        if (!Number.isFinite(value)) return;
        onManual();
        controller.setJoint(name, radians(value));
        syncControls(controller);
      };
      slider.addEventListener('input', () => update(Number(slider.value)));
      number.addEventListener('focus', onManual);
      number.addEventListener('change', () => update(number.valueAsNumber));
      inputs.set(name, { slider, number });
      section.append(row);
    }
    const hint = document.createElement('p');
    hint.className = 'joint-hint';
    hint.textContent = '角度单位 ° · 输入值按源关节限位约束';
    section.append(hint);
    const gripper = document.createElement('div');
    gripper.className = 'gripper-box';
    gripper.innerHTML = `<div class="gripper-label"><label for="${side}-gripper">TacCap 夹爪开度</label><output id="${side}-gripper-value">100%</output></div><input id="${side}-gripper" type="range" min="0" max="100" step="1" value="100" aria-label="${side === 'left' ? '左' : '右'}夹爪开度"><div class="gripper-actions"><button data-gripper="${side}" data-opening="0">闭合</button><button data-gripper="${side}" data-opening="100">张开</button></div><p>主动指驱动 · 从动指 −1 联动</p>`;
    gripper.querySelector('input').addEventListener('input', (event) => {
      onManual();
      controller.setGripper(side, Number(event.target.value));
      syncControls(controller);
    });
    gripper.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
      onManual();
      controller.setGripper(side, Number(button.dataset.opening));
      syncControls(controller);
    }));
    section.append(gripper);
    host.append(section);
  }
  const tabs = [...document.querySelectorAll('[data-side][role="tab"]')];
  function selectTab(selected) {
    for (const tab of tabs) {
      const active = tab === selected;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      document.getElementById(`${tab.dataset.side}-controls`).hidden = !active;
    }
    onSelectSide(selected.dataset.side);
  }
  for (const tab of tabs) {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = tabs[event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - tabs.indexOf(tab)];
      selectTab(next);
      next.focus();
    });
  }
  syncControls(controller);
  return { selectSide: (side) => selectTab(tabs.find((tab) => tab.dataset.side === side)) };
}

function syncControls(controller) {
  const pose = controller.pose();
  for (const [name, { slider, number }] of inputs) {
    const value = degrees(pose[name]);
    slider.value = value;
    number.value = value.toFixed(2);
  }
  for (const side of ['left', 'right']) {
    const joint = controller.byName[`${side}_tool_taccap_right_finger_joint`];
    const opening = Math.round((pose[joint.name] - joint.min) / (joint.max - joint.min) * 100);
    document.getElementById(`${side}-gripper`).value = opening;
    document.getElementById(`${side}-gripper-value`).textContent = `${opening}%`;
  }
}

async function main() {
  const runtime = loadMujocoModule();
  const loaded = await loadRsScene(runtime, ({ key, vars }) => {
    loadingText.textContent = key === 'status.compiling' ? '构建双臂模型…'
      : key === 'status.loadingAssets' ? `加载网格 ${vars?.loaded || ''} / ${vars?.total || ''}`
        : key === 'status.download' ? `读取 ${vars?.file || '场景'}` : '加载 MuJoCo 与机器人资产…';
  }, { sceneXml: description.sceneXml });
  const { mujoco, model, data, materialProps } = loaded;
  const controller = createFlexivController(mujoco, model, data, description);
  const ik = createFlexivIk(mujoco, model, data, controller, description);
  const view = createFlexivView({ host: document.getElementById('viewport'), mujoco, model, data, materialProps, description });
  let motionUi;
  const jointUi = buildControls(controller, { onManual: () => motionUi?.interrupt(), onSelectSide: (side) => motionUi?.setSide(side) });
  motionUi = createFlexivMotionUi({ controller, description, ik, view, onPoseChange: () => syncControls(controller),
    onSelectSide: (side) => jointUi.selectSide(side), saveFile, filename });
  document.getElementById('reset-pose').addEventListener('click', () => {
    motionUi.interrupt('已恢复启动姿态');
    controller.reset();
    syncControls(controller);
    motionUi.refresh();
  });
  document.getElementById('export-pose').addEventListener('click', () => {
    const payload = { schemaVersion: 1, kind: 'xense-pose', model: description.id, unit: 'rad', mode: 'kinematic',
      timestamp: new Date().toISOString(), sourceUrdfSha256: description.sourceUrdfSha256,
      display: { referenceTarget: document.getElementById('show-reference').checked, hideOwnCameraHousing: true },
      endEffectors: Object.fromEntries(['left', 'right'].map((side) => [side, ik.readPose(side)])),
      joints: controller.pose(), cameras: view.cameraState().map((camera) => ({ ...camera, calibrated: false, fovyDegrees: 60, resolution: [640, 480], coordinateConvention: 'render camera: -Z forward, +Y up' })) };
    saveFile(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), filename('pose.json'));
  });
  for (const button of document.querySelectorAll('[data-view]')) {
    button.addEventListener('click', () => {
      view.setView(button.dataset.view);
      for (const option of document.querySelectorAll('[data-view]')) option.setAttribute('aria-pressed', String(option === button));
    });
  }
  document.getElementById('frame-model').addEventListener('click', () => {
    view.frameModel();
    for (const option of document.querySelectorAll('[data-view]')) option.setAttribute('aria-pressed', String(option.dataset.view === 'perspective'));
  });
  document.getElementById('show-frusta').addEventListener('change', (event) => view.setFrustaVisible(event.target.checked));
  document.getElementById('show-reference').addEventListener('change', (event) => view.setReferenceVisible(event.target.checked));
  for (const side of ['left', 'right']) {
    document.getElementById(`${side}-camera-enabled`).addEventListener('change', (event) => {
      view.setCameraEnabled(side, event.target.checked);
      document.querySelector(`.camera-feed[data-side="${side}"]`).classList.toggle('paused', !event.target.checked);
      document.getElementById(`${side}-camera-state`).textContent = event.target.checked ? '已同步' : '已暂停';
    });
    document.querySelector(`[data-capture="${side}"]`).addEventListener('click', () => capture(side));
  }
  async function capture(id) {
    try {
      view.render(performance.now(), controller.revision, true);
      saveFile(await view.snapshot(id), filename(`${id}.png`));
    } catch (error) {
      downloadStatus.textContent = `截图失败：${error.message}`;
    }
  }
  document.getElementById('capture-main').addEventListener('click', () => capture('main'));
  workspace.querySelectorAll('button:disabled, input:disabled').forEach((input) => { input.disabled = false; });
  motionUi.refresh();
  view.render(performance.now(), controller.revision, true);
  for (const side of ['left', 'right']) document.getElementById(`${side}-camera-state`).textContent = '已同步';
  loading.hidden = true;
  workspace.setAttribute('aria-busy', 'false');
  document.getElementById('status').textContent = '18 关节 · 双相机已就绪';
  let frame;
  function animate(now) {
    motionUi.tick(now / 1000);
    view.render(now, controller.revision);
    frame = requestAnimationFrame(animate);
  }
  frame = requestAnimationFrame(animate);

  // Read-only diagnostics support integration tests and external screenshot tools.
  window.xensePreview = {
    state: () => ({ model: description.id, joints: controller.pose(), cameras: view.cameraState(), revision: controller.revision,
      tcps: Object.fromEntries(['left', 'right'].map((side) => [side, ik.readPose(side)])), motion: motionUi.state(), tcpDrag: view.tcpDragState() }),
    ready: true
  };
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) return;
    cancelAnimationFrame(frame);
    motionUi.dispose();
    ik.dispose();
    view.dispose();
    data.delete();
    model.delete();
    delete window.xensePreview;
  });
}

document.getElementById('reload').addEventListener('click', () => window.location.reload());
main().catch((error) => {
  console.error(error);
  loading.classList.add('error');
  loading.querySelector('strong').textContent = '模型加载失败';
  loadingText.textContent = error.message || String(error);
  document.getElementById('reload').hidden = false;
  document.getElementById('status').textContent = '加载失败';
  workspace.setAttribute('aria-busy', 'false');
});
