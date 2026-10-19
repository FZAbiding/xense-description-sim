import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import loadMujoco from '@mujoco/mujoco';
import { compileRemoteWasm } from '../src/wasm-loader.js';

const originalFetch = globalThis.fetch;
const source = (await readFile(new URL('../src/load-model.js', import.meta.url), 'utf8'))
  .replaceAll('import.meta.env', JSON.stringify({ BASE_URL: '/', DEV: false }))
  .replace("'./wasm-loader.js'", JSON.stringify(new URL('../src/wasm-loader.js', import.meta.url).href));
const { loadRsScene } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

async function checkDownloadQueue(meshSize) {
  let releaseRuntime;
  const runtime = new Promise((resolve) => { releaseRuntime = resolve; });
  const stored = new Set();
  let deleted = false;
  const fakeRuntime = {
    MjVFS: class {
      addBuffer(name) { assert(!deleted); stored.add(name); }
      delete() { deleted = true; }
    },
    MjModel: { from_xml_path() { assert.equal(stored.size, 21); return {}; } },
    MjData: class {},
    mj_forward() {}
  };
  let downloaded = 0;
  globalThis.fetch = async (url) => {
    if (url.includes('.xml')) {
      return new Response(`<mujoco>${Array.from({ length: 20 }, (_, i) => `<mesh file="part${i}.stl"/>`).join('')}</mujoco>`);
    }
    downloaded++;
    return new Response(new Uint8Array(meshSize));
  };
  const loading = loadRsScene(runtime);
  try {
    // Allow downloads to settle while deliberately holding WASM initialization.
    for (let i = 0; i < 20; i++) await new Promise(setImmediate);
    if (meshSize === 1024) assert.equal(downloaded, 20, 'small meshes should all download before WASM');
    else {
      assert(downloaded >= 6 && downloaded <= 9, `buffer must apply backpressure: ${downloaded}`);
      assert.equal(stored.size, 0);
    }
  } finally {
    releaseRuntime(fakeRuntime);
    await loading;
  }
  assert(deleted);
  assert.equal(stored.size, 21);
}

try {
  await checkDownloadQueue(1024);
  await checkDownloadQueue(4 * 1024 * 1024);

  const emptyWasm = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
  for (const type of ['application/wasm', 'application/octet-stream']) {
    globalThis.fetch = async (_url, options) => {
      assert.notEqual(options.method, 'HEAD');
      return new Response(emptyWasm, { headers: { 'content-type': type } });
    };
    assert(await compileRemoteWasm('https://example.test/mujoco.wasm') instanceof WebAssembly.Module);
  }
  globalThis.fetch = async () => new Response('', { status: 503 });
  await assert.rejects(compileRemoteWasm('https://example.test/mujoco.wasm'), /503/);
  globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
  await assert.rejects(compileRemoteWasm('https://example.test/mujoco.wasm', 20), /aborted/);

  // Exercise the production download/VFS pipeline with both real scene trees.
  const mujoco = await loadMujoco();
  globalThis.fetch = async (url) => {
    const relative = new URL(url, 'https://example.test').pathname.slice('/models/'.length);
    if (relative.endsWith('.gzbin')) return new Response('', { status: 404 });
    return new Response(await readFile(new URL(`../../rebotarm_mujoco_rs/models/${relative}`, import.meta.url)));
  };
  const warn = console.warn;
  console.warn = () => {}; // These requests intentionally exercise raw-mesh fallback.
  try {
    for (const [sceneXml, expectedGeoms] of [['rs_grasp_scene.xml', 66], ['rs_agv_scene.xml', 92]]) {
      const { model, data } = await loadRsScene(mujoco, null, { sceneXml });
      try { assert.equal(model.ngeom, expectedGeoms); }
      finally { data.delete(); model.delete(); }
    }
  } finally { console.warn = warn; }
} finally {
  globalThis.fetch = originalFetch;
}

// Execute the actual worker with an in-memory Cache API.
const entries = new Map();
const cache = {
  async keys() { return [...entries.keys()].map((url) => new Request(url)); },
  async match(request) { return entries.get(typeof request === 'string' ? request : request.url)?.clone(); },
  async put(request, response) { entries.set(typeof request === 'string' ? request : request.url, response); },
  async delete(request) { return entries.delete(typeof request === 'string' ? request : request.url); }
};
const base = 'https://example.test/sim/';
const listeners = {};
const context = vm.createContext({
  URL, Request, Promise,
  self: {
    registration: { scope: base }, location: { origin: 'https://example.test' },
    addEventListener(type, handler) { listeners[type] = handler; }
  },
  caches: { async open() { return cache; } },
  fetch: async () => new Response('fresh')
});
vm.runInContext(await readFile(new URL('../public/sw.js', import.meta.url), 'utf8'), context);
const meshA = `${base}models/meshes/a.stl.gzbin?v=hashA`;
const meshB = `${base}models/meshes/b.stl.gzbin?v=hashB`;
entries.set(meshA, new Response('mesh A'));
entries.set(meshB, new Response('mesh B'));
entries.set(`${base}models/scene.xml?v=old`, new Response('old XML'));
const waits = [];
let result;
listeners.fetch({
  request: new Request(`${base}models/scene.xml?v=new`),
  waitUntil(promise) { waits.push(promise); },
  respondWith(promise) { result = promise; }
});
assert.equal(await (await result).text(), 'fresh');
await Promise.all(waits);
assert(entries.has(meshA) && entries.has(meshB), 'XML updates must preserve every unchanged mesh');
assert(!entries.has(`${base}models/scene.xml?v=old`));
assert(entries.has(`${base}models/scene.xml?v=new`));
console.log('Loading regression checks passed: independent downloads, bounded buffer, WASM streaming/MIME fallback/timeout, real arm/AGV scenes, per-file cache pruning.');
