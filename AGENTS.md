# Repository Guidelines

## Project Structure & Module Organization

- `web_mujoco/src/`: browser UI, Three.js rendering, MuJoCo WASM integration, and navigation; `scripts/` contains generators and checks, and `public/` holds web assets.
- `rebotarm_mujoco_rs/`: ROS 2 Python nodes, launch files, shared runtime models in `models/`, and pytest checks in `test/`.
- `rebotarm_gazebo/`: Gazebo scenes, maps, and SLAM/Nav2 configuration for both simulation backends.
- `rebotarm_msgs/`: ROS messages, services, and actions.
- `RS/`, `mobile_base/cad/agv_v1/`, `tools/`, and `docs/`: robot descriptions, chassis CAD, model generators, and documentation.

## Build, Test, and Development Commands

Use Node.js 22 to match CI. In `web_mujoco/`:

- `npm ci`: install locked dependencies.
- `npm run dev`: generate the campus scene and start Vite at `127.0.0.1:5173`.
- `npm run build` / `npm run preview`: build production assets / preview the build.
- `npm run smoke`: check model loading and physics without a browser.

For ROS 2 Jazzy, source `/opt/ros/jazzy/setup.bash`, then run from the repository root:

```bash
colcon build --symlink-install --packages-select rebotarm_msgs rebotarm_mujoco_rs rebotarm_gazebo
source install/setup.bash
ros2 launch rebotarm_gazebo mujoco_slam_nav.launch.py
```

Install ROS dependencies with `rosdep`; install Python `mujoco` separately.

## Coding Style & Naming Conventions

Follow surrounding code: Python uses four-space indentation, snake_case functions/modules, and PascalCase classes. JavaScript uses ES modules, two-space indentation, single quotes, semicolons, camelCase functions, and kebab-case filenames. Keep ROS launch filenames as `*.launch.py`. No dedicated formatter or linter is configured.

## Testing Guidelines

Web checks are Node scripts named `scripts/test-*.mjs`. Run relevant npm scripts: `test:loading`, `test:reset`, `test:variants`, `test:campus`, `test:timing`, `test:surfaces`, and `test:explode`.

ROS tests use pytest with `test_*.py` files and `test_*` functions. After sourcing the workspace, run `colcon test --packages-select rebotarm_mujoco_rs`, then `colcon test-result --verbose`. No coverage threshold is configured. Include behavioral regression checks for changed simulation or navigation logic.

## Commit & Pull Request Guidelines

Use the history's prefixes: `feat:`, `fix:`, and `docs:`, followed by a concise imperative summary. PRs should explain behavior changes, link relevant issues, list validation commands/results, and include screenshots for UI changes.

## Model Maintenance

Regenerate AGV scenes with `python3 tools/build_rs_agv_model.py`; edit generator inputs for persistent changes. Preserve mesh filename case and paths. Arm assets use meters; chassis CAD uses millimeters with MJCF scaling. Retain third-party attribution.
