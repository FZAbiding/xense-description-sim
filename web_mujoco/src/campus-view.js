import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CAMPUS_BUILDINGS, CAMPUS_LAYOUT, CAMPUS_PROPS } from './campus-layout.js';

export async function loadCampusEnvironment(scene) {
  const root = new THREE.Group();
  root.name = 'campus-environment';
  const mat = (color, roughness = 0.9) => new THREE.MeshStandardMaterial({ color, roughness, envMapIntensity: 0.35 });
  const asphalt = mat(0x485254);
  const pavement = mat(0xb4b9ad);
  const white = mat(0xe8e9d9);
  const yellow = mat(0xe4bc5d);
  const grass = mat(0x718568);
  const bark = mat(0x6a5840);
  const leaf = mat(0x63795b);

  function box(name, x, y, z, width, depth, height, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, depth, height), material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  }
  function marking(x, y, width, depth, material = white) {
    return box('road-marking', x, y, 0.027, width, depth, 0.003, material);
  }
  function groundLabel(text, x, y, width, depth, color = '#eaf1e4') {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '600 82px sans-serif';
    context.fillText(text, 512, 128, 980);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshBasicMaterial({
      map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1
    }));
    mesh.name = `campus-label-${text}`;
    mesh.position.set(x, y, 0.035);
    root.add(mesh);
  }

  // All drivable surfaces stay at z=0 in MuJoCo. These thin overlays sit below
  // the floor or up to 3.5 cm above it and never introduce a physical step.
  box('east-west-road', 0, 0, -0.012, 30, 3, 0.025, asphalt);
  box('north-south-road', 0, 0, -0.010, 4.4, 24, 0.025, asphalt);
  box('service-yard', 8.15, -6.55, -0.008, 12.4, 9.8, 0.025, asphalt);
  for (const building of CAMPUS_BUILDINGS) {
    // Keep the paving surface above the z=0 base floor, never coplanar with it.
    box(`paving-${building.id}`, building.x, building.y, -0.023,
      building.halfX * 2, building.halfY * 2, 0.07, pavement);
  }
  for (let x = -13.5; x < 14; x += 1.6) {
    if (Math.abs(x) > 3) marking(x, 0, 0.75, 0.055, yellow);
  }
  for (let y = -10.5; y < 11; y += 1.6) {
    if (Math.abs(y) > 2.8) marking(0, y, 0.055, 0.75, yellow);
  }
  for (const sign of [-1, 1]) {
    for (let index = -3; index <= 3; index += 1) {
      marking(sign * 3.0, index * 0.36, 0.65, 0.18);
      marking(index * 0.46, sign * 2.6, 0.24, 0.6);
    }
  }
  for (const [kind, zone, color] of [
    ['CHARGING', CAMPUS_LAYOUT.charging, 0x317e63],
    ['DELIVERY', CAMPUS_LAYOUT.delivery, 0x3b759a]
  ]) {
    const material = mat(color);
    box(`bay-${kind}`, zone.x, zone.y, 0.018, zone.halfX * 2, zone.halfY * 2, 0.004, material);
    for (const sign of [-1, 1]) {
      marking(zone.x + sign * zone.halfX, zone.y, 0.035, zone.halfY * 2);
      marking(zone.x, zone.y + sign * zone.halfY, zone.halfX * 2, 0.035);
    }
    groundLabel(kind, zone.x, zone.y + 1.05, 2.3, 0.5);
  }
  groundLabel('REBOT  /  CAMPUS', 8.1, -10.4, 7.5, 0.8, '#bdcbbb');
  groundLabel('LOADING', 3.5, -1.0, 1.5, 0.35);

  for (const item of CAMPUS_PROPS) {
    if (item.kind === 'planter') {
      box(`${item.id}-soil`, item.x, item.y, item.height + 0.006, 1.12, 1.12, 0.012, grass);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 1.6, 8), bark);
      trunk.rotation.x = Math.PI / 2;
      trunk.position.set(item.x, item.y, 1.2);
      trunk.castShadow = true;
      root.add(trunk);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 1), leaf);
      crown.position.set(item.x, item.y, 2.35);
      crown.scale.z = 1.2;
      crown.castShadow = true;
      root.add(crown);
    } else if (item.kind === 'charger') {
      box('charger-screen', item.x, item.y + 0.225, 0.83, 0.24, 0.015, 0.22, mat(0x9cd9b9));
    } else if (item.kind === 'locker') {
      for (let col = 0; col < 5; col += 1) {
        for (let row = 0; row < 3; row += 1) {
          box('locker-door', item.x - 0.78 + col * 0.39, item.y + 0.305, 0.28 + row * 0.50,
            0.36, 0.012, 0.46, pavement);
        }
      }
    }
  }

  let added = false;
  const resources = new Set();
  function dispose() {
    scene.remove(root);
    root.traverse((node) => {
      if (!node.isMesh) return;
      resources.add(node.geometry);
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        resources.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
      }
    });
    for (const resource of resources) resource.dispose();
  }
  try {
    // The GLB contains its textures and is cached by content version.
    const assetUrl = `${import.meta.env.BASE_URL}environments/campus/chinese-building.glb?v=${CAMPUS_LAYOUT.assetVersion}`;
    const gltf = await new GLTFLoader().loadAsync(assetUrl);
    root.add(gltf.scene);
    gltf.scene.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = true;
      node.receiveShadow = true;
      node.material.envMapIntensity = 0.35;
    });
    for (const [index, building] of CAMPUS_BUILDINGS.entries()) {
      const instance = index === 0 ? gltf.scene : gltf.scene.clone(true);
      instance.name = building.id;
      instance.position.set(building.x, building.y, 0);
      if (index > 0) root.add(instance);
    }
    scene.add(root);
    added = true;
    return { dispose };
  } finally {
    if (!added) dispose();
  }
}
