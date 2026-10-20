# ReBot Arm RS 机械描述包

本目录提供 B601-RS 的独立 URDF 与外观、碰撞网格。当前仓库的模型读取和维护规则见 [机械描述说明](../docs/arm_description.md)。

```text
RS/
├── urdf/
│   └── ReBot_Arm_RS.urdf
└── meshes/
    ├── visual/             # 22 个外观分件
    └── shared/             # 10 个外观 / URDF 碰撞共用整件
```

- `urdf/ReBot_Arm_RS.urdf` 包含机械臂和夹爪，也是 Gazebo SDF 再生成的输入。
- URDF 使用 `../meshes/...` 相对路径；独立加载时保留整个 `RS/` 的层级和文件名大小写。
- MuJoCo 的 10 个夹爪精细碰撞网格统一保留在 `rebotarm_mujoco_rs/models/meshes/`，不属于本目录的 URDF 依赖。
- URDF 与 MuJoCo 是独立模型；修改其中一份不会自动更新另一份。

从仓库根目录取得 URDF 路径：

```python
from pathlib import Path

urdf_path = Path("RS/urdf/ReBot_Arm_RS.urdf")
```
