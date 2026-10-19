# B601-RS 机械描述与运行模型

当前仓库保留 RS 独立 URDF，以及 MuJoCo / Gazebo 运行模型。夹爪精细碰撞网格统一保存在运行模型目录。

## 资源位置

| 位置 | 用途 | 读取者 |
| --- | --- | --- |
| `RS/urdf/ReBot_Arm_RS.urdf` | 机械臂与夹爪的独立 URDF | URDF 加载器、Gazebo SDF 生成脚本 |
| `RS/meshes/visual/` | 22 个仅用于外观的分件 | RS URDF |
| `RS/meshes/shared/` | 10 个外观 / URDF 碰撞共用整件 | RS URDF |
| `rebotarm_mujoco_rs/models/rs_arm.xml` | 机械臂、夹爪、腕部相机与精细碰撞 | MuJoCo 抓取场景、AGV 模型生成脚本 |
| `rebotarm_mujoco_rs/models/rs_grasp_scene.xml` | 标准机械臂抓取场景 | Web、AGV 模型生成脚本 |
| `rebotarm_mujoco_rs/models/rs_agv_scene.xml` | 完整 RS + AGV 实验室场景 | Web、ROS 2 MuJoCo |
| `rebotarm_mujoco_rs/models/meshes/` | 运行用机械臂、夹爪、支架和底盘网格 | MuJoCo、Gazebo 已生成的机器人 SDF |

## 夹爪几何

RS 本身包含夹爪。RS 和 DM 历史上共用的 10 个精细碰撞网格，经逐组 SHA-256 验证一致后，统一保留在运行网格目录：

```text
rebotarm_mujoco_rs/models/meshes/
├── left_finger_front.stl
├── left_finger_mid.stl
├── left_finger_rear.stl
├── right_finger_front.stl
├── right_finger_mid.stl
├── right_finger_rear.stl
├── colored_left_finger_carriage_grey.stl
├── colored_left_finger_travel_stop_yellow.stl
├── colored_right_finger_carriage_grey.stl
└── colored_right_finger_travel_stop_yellow.stl
```

[`rs_arm.xml`](../rebotarm_mujoco_rs/models/rs_arm.xml) 通过 `meshdir="meshes/"` 引用这些文件。RS 的局部左右命名与原始碰撞文件命名相反，因此 MJCF 的 left 资产使用 right 文件，反之亦然。修改时保留对应的坐标与映射。

URDF 使用整件网格进行碰撞描述；MuJoCo 使用上述分段凸网格实现夹爪接触。不要以整件夹指凸包替代分段网格，否则可能影响闭合和抓取。

## 路径和单位

- URDF 网格使用 `../meshes/...`，独立分发时保留整个 `RS/` 目录。
- Linux 区分大小写，保留 `.STL` / `.stl` 文件名。
- 机械臂网格使用米；AGV CAD 和 D405 支架 STL 使用毫米，MJCF 已设置缩放。
- Web 的 Vite 配置从 `rebotarm_mujoco_rs/models/` 复制模型；ROS 安装规则位于对应包的 `setup.py`。
- Gazebo 已生成的 SDF 使用 `model://rebotarm_mujoco_rs/models/meshes/...`；启动文件设置资源搜索路径。

## 修改与再生成

1. 修改 RS URDF 后，检查相对网格引用，并按需运行 `python3 rebotarm_gazebo/scripts/generate_rs_agv_sdf.py` 更新 Gazebo 模型。
2. 修改 `rs_arm.xml`、`rs_grasp_scene.xml` 或底盘 STL 后，运行 `python3 tools/build_rs_agv_model.py` 更新 AGV 场景。
3. 修改外观与共用整件时，同时核对 URDF 和运行网格。RS 目录与运行目录仍有副本，生成脚本不会自动同步所有机械臂 STL。
4. 修改夹爪碰撞时，检查左右映射、闭合全行程、抓取和释放，并验证 Web 标准款与 AGV 款。

模型来源与第三方说明见 [MuJoCo 包文档](../rebotarm_mujoco_rs/README.md) 和 [第三方模型记录](../rebotarm_mujoco_rs/models/THIRD_PARTY_MODELS.md)。
