# Forward-01 asset snapshot

This directory contains the selected dependencies of
`assets/assemblies/forward-01-flexiv-rizon4s/urdf/forward-01-flexiv-rizon4s-taccap.urdf`.
The original relative paths and bytes are preserved, including OBJ material files.
It is a dependency bundle, not a complete installation of the xense-description asset registry.
Copied `asset.json` files and assembly recipes are source metadata snapshots; they may describe
additional variants and authoring files outside this selected bundle.

- `manifest.json` records the source repository revision and each copied file's actual SHA-256 and byte count.
- The input came from a working tree with uncommitted asset updates. Per-file hashes identify the snapshot;
  the recorded Git revision alone does not describe its complete contents.
- `derived-manifest.json` records the generated runtime meshes and their input/output hashes.
- Original robot, stand, adapter and gripper notices and supplied license files are retained.
  Flexiv robot geometry retains its Apache-2.0 attribution. TacCap 10.15 inputs and other assets
  retain the specific permission status in their copied notices; the source tooling license
  does not grant additional rights to these files.

From the repository root, verify the snapshot without access to its source:

```bash
python3 tools/import_flexiv_assets.py --check
```

Update explicitly with `python3 tools/import_flexiv_assets.py /path/to/xense-description`,
then regenerate and validate the runtime model as described in the root README.
No runtime code reads files from the original source repository.
