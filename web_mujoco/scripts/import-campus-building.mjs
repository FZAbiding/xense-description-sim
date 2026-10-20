// Usage: node scripts/import-campus-building.mjs /path/to/ProceduralBuildingsThreeJS
// Bake the upstream Blender graph once. No geometry-node evaluator is shipped
// to the browser. Materials are deliberately simplified to standard glTF PBR.
import { readFile, writeFile, mkdir, copyFile, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const upstream = path.resolve(process.argv[2] || '/tmp/rebot-procedural-buildings');
const source = path.join(upstream, 'public/assets/cn');
const output = path.join(root, 'public/environments/campus');
const readJson = async (name) => JSON.parse(await readFile(path.join(source, name), 'utf8'));
const [graph, kitJson, bin] = await Promise.all([
  readJson('graph.json'), readJson('kit.json'), readFile(path.join(source, 'kit.bin'))
]);
const temp = await mkdtemp(path.join(root, 'node_modules/.campus-import-'));
try {
  const evaluatorPath = path.join(temp, 'evaluator.mjs');
  await build({
    stdin: {
      contents: 'export { Evaluator, realize } from "./src/nyc/gn"; export { NycKit } from "./src/nyc/kit";',
      resolveDir: upstream
    },
    bundle: true, platform: 'node', format: 'esm', outfile: evaluatorPath,
    alias: { three: path.join(root, 'node_modules/three/build/three.module.js') }
  });
  const { Evaluator, realize, NycKit } = await import(pathToFileURL(evaluatorPath));
  const kit = new NycKit(kitJson, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
  const params = {
    ...graph.modifier, Width: 8, Depth: 6, Floors: 3,
    'Ground Floor Height': 3, 'Floor Height': 2.8, 'Bay Width': 2.6,
    'Detail Level': 'LOD1', Sidewalk: false, 'Street Trees': false,
    'Street Lamps': false, 'Street Props': false, 'Rooftop Sign': false,
    'Shop Props': false, 'Stair Bulkhead': false, 'Solar Heaters': 0,
    'Roof Props': 0, 'Roof Vents': 0, Antennas: 0
  };
  const ev = new Evaluator(graph, kit);
  const evaluated = ev.run(graph.root, params);
  const m = (evaluated.instances ? realize(evaluated) : evaluated).mesh;
  if (!m?.faces) throw new Error('The upstream graph produced no building');
  const normals = m.vertexNormals(true);
  const uv = m.corner.get('UVMap');
  const col = m.point.get('Col');
  const slots = new Map();
  for (let face = 0; face < m.faces; face += 1) {
    const name = m.materials[m.matIndex[face]] || 'M_CN_Concrete';
    if (!slots.has(name)) slots.set(name, { pos: [], normal: [], uv: [], color: [] });
    const data = slots.get(name);
    const start = m.faceStart[face];
    const count = m.faceStart[face + 1] - start;
    const faceNormal = m.faceNormal(face);
    for (let k = 1; k < count - 1; k += 1) {
      for (const local of [0, k, k + 1]) {
        const corner = start + local;
        const vertex = m.corners[corner];
        data.pos.push(m.pos[vertex * 3] - 4, m.pos[vertex * 3 + 1] - 3, m.pos[vertex * 3 + 2]);
        data.normal.push(...(m.smooth[face] ? Array.from(normals.subarray(vertex * 3, vertex * 3 + 3)) : faceNormal));
        data.uv.push(uv?.data[corner * uv.size] || 0, uv?.data[corner * uv.size + 1] || 0);
        // Col is Blender shader data: alpha is a mixing mask, not opacity.
        const rgb = col ? Array.from(col.data.subarray(vertex * col.size, vertex * col.size + 3)) : [1, 1, 1];
        data.color.push(...(Math.max(...rgb) > 0.02 ? rgb : [1, 1, 1]));
      }
    }
  }
  const palette = {
    WallStucco: [0xd4d0bc, 'PaintedPlaster017_2K-JPG_Color.jpg'],
    WallTile: [0xd0ddd7, 'Tiles138_2K-JPG_Color.jpg'],
    Stone: [0xaaaaa4, 'Concrete034_2K-JPG_Color.jpg'],
    Concrete: [0xa9aaa2, 'Concrete036_2K-JPG_Color.jpg'],
    Band: [0xb8b7ae], SteelBlack: [0x303b3e], Aluminum: [0x9da9ac],
    Stainless: [0xa4adb0], Glass: [0x527c87], GlassFrosted: [0xadc5c5],
    Plastic: [0xe2dfce], PlasticDirty: [0xbebca9], PaintWhite: [0xdfdfd3],
    Shutter: [0x778d8b, 'CorrugatedSteel005_1K-JPG_Color.jpg'],
    RoofTile: [0x7b7d72, 'RoofingTiles012A_2K-JPG_Color.jpg'],
    RedPaper: [0xa5322d], Gold: [0xd5ac53], SignText: [0xf0e0b2],
    IntWall: [0xb7ad91], IntFloor: [0x77695b], IntLit: [0xcab77b],
    IntShop: [0x98876a], Emissive: [0xd1bf7d], PVC: [0x819c94],
    Fabric: [0x637c89], Wood: [0x8e6a4c], Rubber: [0x303435], Lantern: [0xbc4734]
  };
  const group = new THREE.Group();
  group.name = 'ChineseCampusBuilding';
  const textures = new Map();
  for (const [name, data] of slots) {
    const kind = name.replace('M_CN_', '');
    const [color, texture] = palette[kind] || [0xb2b2a8];
    const geometry = new THREE.BufferGeometry();
    for (const [attribute, values, size] of [
      ['position', data.pos, 3], ['normal', data.normal, 3], ['uv', data.uv, 2], ['color', data.color, 3]
    ]) geometry.setAttribute(attribute, new THREE.Float32BufferAttribute(values, size));
    const metal = /Aluminum|Stainless|SteelBlack|Gold/.test(kind);
    const material = new THREE.MeshStandardMaterial({
      name, color, vertexColors: true, roughness: kind.includes('Glass') ? 0.25 : 0.85,
      metalness: metal ? 0.55 : 0, side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(mergeVertices(geometry), material);
    mesh.name = name;
    group.add(mesh);
    if (texture) textures.set(name, texture);
  }
  // GLTFExporter uses FileReader for its binary buffer even without image data.
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) { blob.arrayBuffer().then((result) => { this.result = result; this.onloadend?.(); }); }
  };
  const glb = Buffer.from(await new GLTFExporter().parseAsync(group, { binary: true }));
  const jsonLength = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
  let binary = glb.subarray(28 + jsonLength);
  json.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
  json.images = [];
  json.textures = [];
  await mkdir(output, { recursive: true });
  const imageIndices = new Map();
  for (const material of json.materials) {
    const texture = textures.get(material.name);
    if (!texture) continue;
    let index = imageIndices.get(texture);
    if (index == null) {
      const image = await readFile(path.join(source, 'tex', texture));
      const view = json.bufferViews.length;
      json.bufferViews.push({ buffer: 0, byteOffset: binary.length, byteLength: image.length });
      const paddedImage = Buffer.alloc(Math.ceil(image.length / 4) * 4);
      image.copy(paddedImage);
      binary = Buffer.concat([binary, paddedImage]);
      index = json.images.length;
      json.images.push({ bufferView: view, mimeType: 'image/jpeg' });
      json.textures.push({ sampler: 0, source: index });
      imageIndices.set(texture, index);
    }
    material.pbrMetallicRoughness.baseColorTexture = { index };
  }
  json.buffers[0].byteLength = binary.length;
  const jsonBytes = Buffer.from(JSON.stringify(json));
  const padded = Buffer.alloc(Math.ceil(jsonBytes.length / 4) * 4, 0x20);
  jsonBytes.copy(padded);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + padded.length + binary.length, 8);
  header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binary.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
  const result = Buffer.concat([header, padded, binHeader, binary]);
  await writeFile(path.join(output, 'chinese-building.glb'), result);
  const box = new THREE.Box3().setFromObject(group);
  const head = (await readFile(path.join(upstream, '.git/HEAD'), 'utf8')).trim();
  const commit = head.startsWith('ref: ')
    ? (await readFile(path.join(upstream, '.git', head.slice(5)), 'utf8')).trim()
    : head;
  const metadata = {
    source: 'https://github.com/achrefelouafi/ProceduralBuildingsThreeJS',
    commit,
    version: createHash('sha256').update(result).digest('hex').slice(0, 12),
    params, min: box.min.toArray(), max: box.max.toArray(),
    triangles: [...slots.values()].reduce((sum, slot) => sum + slot.pos.length / 9, 0),
    bytes: result.length, materialConversion: 'Simplified standard glTF PBR; not the upstream shader graph'
  };
  await writeFile(path.join(output, 'building.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  await copyFile(path.join(upstream, 'LICENSE'), path.join(output, 'LICENSE.txt'));
  console.log(JSON.stringify(metadata, null, 2));
} finally {
  await rm(temp, { recursive: true, force: true });
}
