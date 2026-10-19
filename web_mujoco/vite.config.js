import { cpSync, createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));
const modelsSrc = path.resolve(root, '../rebotarm_mujoco_rs/models');
const modelsSrcAbs = path.resolve(modelsSrc);
const mujocoPkgPath = path.resolve(root, 'node_modules/@mujoco/mujoco/package.json');
const mujocoVersion = existsSync(mujocoPkgPath)
  ? JSON.parse(readFileSync(mujocoPkgPath, 'utf8')).version
  : '3.12.0';


function collectFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? collectFiles(fullPath) : [fullPath];
  });
}

function hashModelFiles() {
  if (!existsSync(modelsSrcAbs)) return {};
  return Object.fromEntries(collectFiles(modelsSrcAbs).sort().map((filePath) => [
    path.relative(modelsSrcAbs, filePath).replaceAll(path.sep, '/'),
    createHash('sha256').update(readFileSync(filePath)).digest('hex').slice(0, 12)
  ]));
}

const modelVersions = hashModelFiles();
const devGzipCache = new Map();

function isMeshFile(filePath) {
  return ['.stl', '.obj', '.msh'].includes(path.extname(filePath).toLowerCase());
}

function writeCompressedMeshes(sourceRoot, destinationRoot) {
  collectFiles(sourceRoot)
    .filter(isMeshFile)
    .forEach((sourcePath) => {
      const relative = path.relative(sourceRoot, sourcePath);
      const destination = path.join(destinationRoot, `${relative}.gzbin`);
      mkdirSync(path.dirname(destination), { recursive: true });
      writeFileSync(destination, gzipSync(readFileSync(sourcePath), { level: 9 }));
    });
}

function pagesBase() {
  const value = process.env.GITHUB_PAGES_BASE;
  if (!value) return '/';
  return value.endsWith('/') ? value : `${value}/`;
}

export default defineConfig(({ command, mode }) => ({
  base: pagesBase(),
  define: {
    __MODEL_VERSIONS__: JSON.stringify(modelVersions),
    __MUJOCO_VERSION__: JSON.stringify(mujocoVersion)
  },
  optimizeDeps: {
    exclude: ['@mujoco/mujoco']
  },
  assetsInclude: ['**/*.wasm'],
  build: {
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 4000
  },
  plugins: [
    {
      name: 'copy-rs-models',
      transformIndexHtml() {
        const env = loadEnv(mode, root, 'VITE_');
        if (command !== 'build' || env.VITE_MUJOCO_WASM_CDN === 'local') return [];
        return [
          { tag: 'link', attrs: { rel: 'preconnect', href: 'https://cdn.jsdelivr.net', crossorigin: 'anonymous' }, injectTo: 'head' },
          { tag: 'link', attrs: {
            rel: 'preload', as: 'fetch', type: 'application/wasm', crossorigin: 'anonymous',
            href: `https://cdn.jsdelivr.net/npm/@mujoco/mujoco@${mujocoVersion}/mujoco.wasm`
          }, injectTo: 'head' }
        ];
      },
      closeBundle() {
       if (!existsSync(modelsSrc)) {
          throw new Error(`RS models not found: ${modelsSrc}`);
       }
        const dest = path.resolve(root, 'dist/models');
        mkdirSync(path.resolve(root, 'dist'), { recursive: true });
        cpSync(modelsSrc, dest, { recursive: true, dereference: true });
        writeCompressedMeshes(modelsSrcAbs, dest);
      },
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const base = pagesBase();
          const prefix = `${base}models/`;
          const url = decodeURIComponent(req.url || '');
          if (!url.startsWith(prefix)) return next();
          const rel = url.slice(prefix.length).split('?')[0];
          const wantsGzip = rel.toLowerCase().endsWith('.gzbin');
          const sourceRel = wantsGzip ? rel.slice(0, -6) : rel;
          const filePath = path.resolve(modelsSrcAbs, sourceRel);
          if (!filePath.startsWith(`${modelsSrcAbs}${path.sep}`)) return next();
          try {
            const stat = statSync(filePath);
            if (!stat.isFile()) return next();
            const etag = `W/"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}${wantsGzip ? '-gz' : ''}"`;
            const ext = path.extname(filePath).toLowerCase();
            const types = {
              '.xml': 'text/xml',
              '.stl': 'application/octet-stream',
              '.obj': 'text/plain',
              '.msh': 'application/octet-stream'
            };
            res.setHeader('Content-Type', wantsGzip ? 'application/gzip' : (types[ext] || 'application/octet-stream'));
            // XML changes frequently while tuning the scene, so ordinary page
            // reloads must revalidate it. Keep the one-hour cache only for the
            // large mesh assets that rarely change.
            res.setHeader(
              'Cache-Control',
              ext === '.xml'
                ? 'no-cache, must-revalidate'
                : 'public, max-age=3600, must-revalidate'
            );
            res.setHeader('ETag', etag);
            res.setHeader('Last-Modified', stat.mtime.toUTCString());
            if (req.headers['if-none-match'] === etag) {
              res.statusCode = 304;
              res.end();
              return;
            }
            if (wantsGzip && isMeshFile(filePath)) {
              const cacheKey = `${filePath}:${stat.size}:${stat.mtimeMs}`;
              let compressed = devGzipCache.get(cacheKey);
              if (!compressed) {
                compressed = gzipSync(readFileSync(filePath), { level: 9 });
                devGzipCache.set(cacheKey, compressed);
              }
              res.setHeader('Content-Length', compressed.byteLength);
              res.end(compressed);
              return;
            }
            res.setHeader('Content-Length', stat.size);
            createReadStream(filePath).pipe(res);
          } catch {
            next();
          }
        });
      }
    }
  ],
  server: {
    port: 5173,
    strictPort: false,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  }
}));
