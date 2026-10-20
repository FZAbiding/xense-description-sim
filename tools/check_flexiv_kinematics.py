#!/usr/bin/env python3
"""Compare compiled MJCF frames against independent URDF forward kinematics."""

import json
from pathlib import Path
import xml.etree.ElementTree as ET

import mujoco
import numpy as np


ROOT = Path(__file__).resolve().parents[1]


def rotation_rpy(angles):
    roll, pitch, yaw = angles
    cr, cp, cy = np.cos(angles)
    sr, sp, sy = np.sin(angles)
    rx = np.array([[1, 0, 0], [0, cr, -sr], [0, sr, cr]])
    ry = np.array([[cp, 0, sp], [0, 1, 0], [-sp, 0, cp]])
    rz = np.array([[cy, -sy, 0], [sy, cy, 0], [0, 0, 1]])
    return rz @ ry @ rx


def urdf_frames(urdf, pose):
    transforms = {}
    children = {}
    child_links = set()
    for joint in urdf.findall("joint"):
        children.setdefault(joint.find("parent").get("link"), []).append(joint)
        child_links.add(joint.find("child").get("link"))

    def visit(name, parent):
        transforms[name] = parent
        for joint in children.get(name, []):
            origin = joint.find("origin")
            local = np.eye(4)
            if origin is not None:
                local[:3, 3] = np.fromstring(origin.get("xyz", "0 0 0"), sep=" ")
                local[:3, :3] = rotation_rpy(np.fromstring(origin.get("rpy", "0 0 0"), sep=" "))
            motion = np.eye(4)
            if joint.get("type") == "revolute":
                axis = np.fromstring(joint.find("axis").get("xyz"), sep=" ")
                axis /= np.linalg.norm(axis)
                angle = pose[joint.get("name")]
                cross = np.array([[0, -axis[2], axis[1]], [axis[2], 0, -axis[0]], [-axis[1], axis[0], 0]])
                motion[:3, :3] = np.eye(3) + np.sin(angle) * cross + (1 - np.cos(angle)) * cross @ cross
            visit(joint.find("child").get("link"), parent @ local @ motion)

    for link in urdf.findall("link"):
        if link.get("name") not in child_links:
            visit(link.get("name"), np.eye(4))
    return transforms


def main():
    urdf = ET.parse(ROOT / "assets/xense/assets/assemblies/forward-01-flexiv-rizon4s/urdf/forward-01-flexiv-rizon4s-taccap.urdf").getroot()
    config = json.loads((ROOT / "web_mujoco/src/flexiv-model.json").read_text())
    source_joints = {joint.get("name"): joint for joint in urdf.findall("joint")}
    for joint in config["joints"]:
        assert joint["maxVelocity"] == float(source_joints[joint["name"]].find("limit").get("velocity"))
    model = mujoco.MjModel.from_xml_path(str(ROOT / "rebotarm_mujoco_rs/models" / config["sceneXml"]))
    data = mujoco.MjData(model)
    rng = np.random.default_rng(42)
    for case in range(6):
        pose = {}
        for joint in config["joints"]:
            pose[joint["name"]] = joint["home"] if case == 0 else rng.uniform(joint["min"], joint["max"])
        for joint in config["joints"]:
            if "mimic" in joint:
                mimic = joint["mimic"]
                pose[joint["name"]] = pose[mimic["joint"]] * mimic["multiplier"] + mimic["offset"]
        for name, value in pose.items():
            data.qpos[model.joint(name).qposadr] = value
        mujoco.mj_forward(model, data)
        for name, expected in urdf_frames(urdf, pose).items():
            actual = data.body(name)
            np.testing.assert_allclose(actual.xpos, expected[:3, 3], atol=1e-10, err_msg=name)
            np.testing.assert_allclose(actual.xmat.reshape(3, 3), expected[:3, :3], atol=1e-10, err_msg=name)
    print("URDF/MJCF forward kinematics match for all 42 links at startup and five seeded poses (1e-10 tolerance).")


if __name__ == "__main__":
    main()
