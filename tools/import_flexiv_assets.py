#!/usr/bin/env python3
"""Snapshot the Forward-01 URDF dependency closure without modifying its source."""

import argparse
import hashlib
import json
from pathlib import Path
import shlex
import shutil
import subprocess
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "assets" / "xense"
ENTRYPOINT = Path("assets/assemblies/forward-01-flexiv-rizon4s/urdf/forward-01-flexiv-rizon4s-taccap.urdf")


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def dependencies(path):
    if path.suffix.lower() == ".urdf":
        tree = ET.parse(path)
        for element in tree.findall(".//mesh") + tree.findall(".//texture"):
            yield path.parent / element.attrib["filename"]
    elif path.suffix.lower() in (".obj", ".mtl"):
        for line in path.read_text().splitlines():
            words = shlex.split(line, comments=True)
            if not words:
                continue
            if words[0] == "mtllib":
                for filename in words[1:]:
                    yield path.parent / filename
            elif words[0].lower().startswith("map_") or words[0].lower() in ("bump", "disp", "decal"):
                yield path.parent / words[-1]


def import_assets(source):
    source = source.resolve()
    pending = [source / ENTRYPOINT]
    assembly = (source / ENTRYPOINT).parents[1]
    pending += [assembly / name for name in (
        "config/start_pose.taccap.json", "assembly.taccap.json",
        "README.taccap.md", "COMPONENTS.taccap.md",
    )]
    selected = set()
    asset_roots = set()
    while pending:
        path = pending.pop().resolve()
        path.relative_to(source)
        if path in selected:
            continue
        if not path.is_file():
            raise FileNotFoundError(path)
        selected.add(path)
        pending.extend(dependencies(path))
        for parent in path.parents:
            if parent == source:
                break
            if (parent / "asset.json").is_file() and parent not in asset_roots:
                asset_roots.add(parent)
                # Registry snapshots document provenance; this is a selected-file
                # bundle, not a complete installation of the source registry.
                pending += [p for p in (parent / "asset.json", parent / "NOTICE.md") if p.is_file()]
                for license_dir in (parent / "LICENSES",):
                    if license_dir.is_dir():
                        pending.extend(p for p in license_dir.rglob("*") if p.is_file())

    camera_config = source / "assets/grippers/xense/taccap/slave-v2026.10.15/config/model.json"
    selected.update((source / "LICENSE", source / "NOTICE.md", camera_config))
    records = []
    for path in sorted(selected):
        relative = path.relative_to(source)
        target = DESTINATION / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)
        digest = sha256(path)
        if digest != sha256(target):
            raise RuntimeError(f"Source changed during import: {relative}")
        records.append({"path": relative.as_posix(), "sha256": digest, "bytes": target.stat().st_size})

    revision = subprocess.check_output(["git", "-C", str(source), "rev-parse", "HEAD"], text=True).strip()
    manifest = {
        "schema_version": 1,
        "source_repository": "xense-description",
        "source_revision": revision,
        "snapshot": "working_tree; per-file SHA-256 identifies actual inputs, including uncommitted files",
        "entrypoint": ENTRYPOINT.as_posix(),
        "scope": "Selected URDF dependencies, material dependencies, startup pose, camera review, and attribution. Registry JSON files are provenance snapshots, not complete asset installations.",
        "files": records,
    }
    (DESTINATION / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(f"Imported {len(records)} files ({sum(r['bytes'] for r in records) / 1048576:.2f} MiB) into {DESTINATION}")


def verify_assets():
    manifest = json.loads((DESTINATION / "manifest.json").read_text())
    for record in manifest["files"]:
        path = DESTINATION / record["path"]
        if not path.is_file() or sha256(path) != record["sha256"]:
            raise RuntimeError(f"Snapshot differs: {record['path']}")
        for dependency in dependencies(path):
            dependency = dependency.resolve()
            dependency.relative_to(DESTINATION.resolve())
            if not dependency.is_file():
                raise FileNotFoundError(dependency)
    print(f"Verified {len(manifest['files'])} snapshot hashes and recursive resource paths")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", nargs="?", type=Path, help="Local xense-description repository")
    parser.add_argument("--check", action="store_true", help="Verify the committed snapshot without the source repository")
    args = parser.parse_args()
    if args.check:
        verify_assets()
    elif args.source:
        import_assets(args.source)
        verify_assets()
    else:
        parser.error("provide the source repository or --check")
