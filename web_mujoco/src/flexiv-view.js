import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createMeshGeometry, primitiveGeometry, geomTypes, geomMaterial, setPose } from './scene-view.js';

const HELPER_LAYER = 1;
const CAMERA_INTERVAL_MS = 100;

export function createFlexivView({ host, mujoco, model, data, materialProps, description }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#101b2b');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label', 'Forward-01 双臂三维视图');
  host.appendChild(renderer.domElement);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = new RoomEnvironment();
  const environmentTarget = pmrem.fromScene(environment, 0.04);
  scene.environment = environmentTarget.texture;
  scene.environmentIntensity = 0.5;
  environment.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xe2f2ff, 0x3b4250, 0.8));
  const key = new THREE.DirectionalLight(0xfff4e8, 1.4);
  key.position.set(2, -3, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.1, far: 12 });
  key.shadow.normalBias = 0.002;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x86bfff, 0.6);
  fill.position.set(-2, 1, 3);
  scene.add(fill);

  const mainCamera = new THREE.PerspectiveCamera(42, 1, 0.02, 40);
  mainCamera.up.set(0, 0, 1);
  mainCamera.layers.enable(HELPER_LAYER);
  mainCamera.layers.enable(2);
  mainCamera.layers.enable(3);
  const controls = new OrbitControls(mainCamera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 0.25;
  controls.maxDistance = 9;
  controls.maxPolarAngle = Math.PI * 0.49;
  const types = geomTypes(mujoco);
  const geometries = new Map();
  const meshes = [];
  for (let i = 0; i < model.ngeom; i += 1) {
    if (model.geom_group[i] >= 3 || model.geom_rgba[i * 4 + 3] < 0.01) continue;
    const type = model.geom_type[i];
    let geometry;
    if (type === types.mesh) {
      const id = model.geom_dataid[i];
      if (!geometries.has(id)) geometries.set(id, createMeshGeometry(model, id));
      geometry = geometries.get(id);
    } else {
      geometry = primitiveGeometry(type, model.geom_size.subarray(i * 3, i * 3 + 3), types);
    }
    if (!geometry) continue;
    const material = geomMaterial(model, i, materialProps);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = type !== types.plane;
    mesh.receiveShadow = true;
    mesh.userData.geomIndex = i;
    const name = mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_GEOM.value, i);
    // The inherited optical frame is inside the uncalibrated housing geometry.
    // Keep its original pose and hide only that sensor's housing in its own feed.
    if (name.startsWith('left_tool_taccap_camera_body_link')) mesh.layers.set(2);
    if (name.startsWith('right_tool_taccap_camera_body_link')) mesh.layers.set(3);
    scene.add(mesh);
    meshes.push(mesh);
  }

  const grid = new THREE.GridHelper(8, 80, 0x4c647f, 0x26384d);
  grid.rotation.x = Math.PI / 2;
  grid.position.z = -0.003;
  grid.layers.set(HELPER_LAYER);
  scene.add(grid);
  const axes = new THREE.AxesHelper(0.18);
  axes.position.set(0, 0, 0.002);
  axes.layers.set(HELPER_LAYER);
  scene.add(axes);

  // A visual reference target gives the two converging views a common subject.
  // Its placement is a preview aid, not a measured worktable or collision object.
  const targetCanvas = document.createElement('canvas');
  targetCanvas.width = 640;
  targetCanvas.height = 480;
  const targetContext = targetCanvas.getContext('2d');
  targetContext.fillStyle = '#e5e9e5';
  targetContext.fillRect(0, 0, 640, 480);
  for (let row = 0; row < 6; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      targetContext.fillStyle = (row + column) % 2 ? '#dce4de' : '#304d5b';
      targetContext.fillRect(40 + column * 70, 30 + row * 70, 70, 70);
    }
  }
  for (const [x, color] of [[40, '#db6b56'], [250, '#4c9fc7'], [460, '#d7ae51']]) {
    targetContext.fillStyle = color;
    targetContext.fillRect(x, 200, 140, 80);
  }
  const targetTexture = new THREE.CanvasTexture(targetCanvas);
  targetTexture.colorSpace = THREE.SRGBColorSpace;
  const referenceTarget = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.24), new THREE.MeshBasicMaterial({ map: targetTexture, side: THREE.DoubleSide }));
  referenceTarget.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0)
  ));
  referenceTarget.position.set(1.6, 0, 0.8);
  scene.add(referenceTarget);

  const cameras = description.cameras.map((entry) => {
    const id = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_CAMERA.value, entry.name);
    if (id < 0) throw new Error(`模型缺少相机 ${entry.name}`);
    const camera = new THREE.PerspectiveCamera(model.cam_fovy[id], entry.width / entry.height, 0.005, 15);
    camera.layers.enable(entry.id === 'left' ? 3 : 2);
    const target = new THREE.WebGLRenderTarget(entry.width, entry.height, { depthBuffer: true });
    target.texture.colorSpace = THREE.SRGBColorSpace;
    const canvas = document.getElementById(`${entry.id}-camera-canvas`);
    canvas.width = entry.width;
    canvas.height = entry.height;
    const context = canvas.getContext('2d');
    const helper = new THREE.CameraHelper(camera);
    helper.layers.set(HELPER_LAYER);
    helper.visible = false;
    scene.add(helper);
    return { ...entry, modelId: id, camera, target, canvas, context, helper, enabled: true,
      pixels: new Uint8Array(entry.width * entry.height * 4), image: context.createImageData(entry.width, entry.height), frames: 0 };
  });

  function sync() {
    for (const mesh of meshes) setPose(mesh, data.geom_xpos, data.geom_xmat, mesh.userData.geomIndex);
    for (const entry of cameras) {
      setPose(entry.camera, data.cam_xpos, data.cam_xmat, entry.modelId);
      entry.camera.updateMatrixWorld(true);
      entry.helper.update();
    }
    scene.updateMatrixWorld(true);
  }

  const center = new THREE.Vector3(0, 0, 0.8);
  let distance = 3;
  function frameModel() {
    sync();
    const bounds = new THREE.Box3();
    for (const mesh of meshes) {
      if (model.geom_type[mesh.userData.geomIndex] !== types.plane) bounds.expandByObject(mesh);
    }
    if (referenceTarget.visible) bounds.expandByObject(referenceTarget);
    bounds.getCenter(center);
    distance = Math.max(1.7, bounds.getSize(new THREE.Vector3()).length() * 1.35);
    setView('perspective');
  }

  function setView(name) {
    const offset = name === 'front' ? [0, -1, 0.18]
      : name === 'top' ? [0, -0.01, 1]
        : name === 'side' ? [1, 0, 0.18] : [0.95, -1.35, 0.65];
    mainCamera.position.copy(center).add(new THREE.Vector3(...offset).normalize().multiplyScalar(distance));
    controls.target.copy(center);
    controls.update();
  }

  let dirty = true;
  function resize() {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    mainCamera.aspect = width / height;
    mainCamera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    dirty = true;
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  frameModel();

  function renderCamera(entry) {
    renderer.setRenderTarget(entry.target);
    renderer.render(scene, entry.camera);
    renderer.readRenderTargetPixels(entry.target, 0, 0, entry.width, entry.height, entry.pixels);
    const stride = entry.width * 4;
    for (let y = 0; y < entry.height; y += 1) {
      entry.image.data.set(entry.pixels.subarray(y * stride, (y + 1) * stride), (entry.height - y - 1) * stride);
    }
    entry.context.putImageData(entry.image, 0, 0);
    entry.frames += 1;
  }

  let previousCameraTime = -Infinity;
  let feedRevision = -1;
  let drawRevision = -1;
  let disposed = false;
  controls.addEventListener('change', () => { dirty = true; });
  function render(now, revision, force = false) {
    if (disposed) return;
    if (revision !== drawRevision) {
      sync();
      drawRevision = revision;
      dirty = true;
    }
    controls.update();
    if (force || (now - previousCameraTime >= CAMERA_INTERVAL_MS && feedRevision !== revision)) {
      for (const entry of cameras) if (entry.enabled) renderCamera(entry);
      previousCameraTime = now;
      feedRevision = revision;
    }
    renderer.setRenderTarget(null);
    if (dirty || force) renderer.render(scene, mainCamera);
    dirty = false;
  }

  async function snapshot(id) {
    render(performance.now(), drawRevision, true);
    const canvas = id === 'main' ? renderer.domElement : cameras.find((entry) => entry.id === id)?.canvas;
    if (!canvas) throw new Error(`Unknown camera ${id}`);
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('截图失败')), 'image/png'));
  }

  return {
    render, snapshot, setView, frameModel,
    setCameraEnabled(side, enabled) {
      const entry = cameras.find((item) => item.id === side);
      entry.enabled = enabled;
      feedRevision = -1;
    },
    setFrustaVisible(visible) {
      for (const entry of cameras) entry.helper.visible = visible;
      dirty = true;
    },
    setReferenceVisible(visible) {
      referenceTarget.visible = visible;
      feedRevision = -1;
      dirty = true;
    },
    cameraState() {
      return cameras.map((entry) => ({ name: entry.name, enabled: entry.enabled, frames: entry.frames,
        position: Array.from(data.cam_xpos.subarray(entry.modelId * 3, entry.modelId * 3 + 3)),
        rotation: Array.from(data.cam_xmat.subarray(entry.modelId * 9, entry.modelId * 9 + 9)) }));
    },
    dispose() {
      disposed = true;
      observer.disconnect();
      controls.dispose();
      for (const entry of cameras) { entry.helper.dispose(); entry.target.dispose(); }
      for (const mesh of meshes) mesh.material.dispose();
      for (const geometry of new Set(meshes.map((mesh) => mesh.geometry))) geometry.dispose();
      grid.geometry.dispose(); grid.material.dispose();
      axes.geometry.dispose(); axes.material.dispose();
      environmentTarget.dispose();
      referenceTarget.geometry.dispose(); referenceTarget.material.dispose(); targetTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
