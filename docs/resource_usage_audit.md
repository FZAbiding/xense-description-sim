# 资源清理记录

日期：2026-10-19。依据当前代码、模型引用、ROS 安装规则、Web 构建配置及文件哈希核查，删除了用户确认的 8 处资源，共 68 个 Git 跟踪文件、46,393,306 字节（约 44.24 MiB）。这是工作树内容大小，Git 历史中仍保留原文件。

## 已删除

| 路径 | 删除原因 |
| --- | --- |
| `DM/` | 当前项目仅运行 RS，没有程序加载此独立 DM 描述包 |
| `RS/meshes/mujoco_collision/` | 10 个夹爪精细碰撞 STL 与运行目录副本一致，RS URDF 没有引用此目录 |
| `rebotarm_mujoco_rs/models/meshes/pla3_black.STL` | 旧视觉件；当前模型实际使用 `pla3_black_without_seeed_badge.STL` 和独立字标 |
| `RS/urdf/ReBot_Arm_RS.csv` | 未参与程序加载的历史 CAD / URDF 导出表 |
| `mobile_base/cad/agv_v1/rebotarm_agv_v1_cad.zip` | 内部 21 个文件均与相邻散文件逐字节一致 |
| `rebotarm_gazebo/config/semantic_zones.yaml` | 未接入程序的任务区域设计记录；Web 导航使用 JS 内的常量 |
| `rebotarm_msgs/msg/JointMitCmd.msg` | 当前仓库没有发布或消费代码，同时移除 CMake 接口生成声明 |
| `rebotarm_msgs/srv/SetZero.srv` | 当前仓库没有服务实现或调用，同时移除 CMake 接口生成声明 |

此次移除 `JointMitCmd` 和 `SetZero` 会取消这两个接口的生成。仓库外若有依赖这两个类型的节点，需要相应调整；当前仓库节点没有引用它们。

## 保留的运行资源

- `rebotarm_mujoco_rs/models/meshes/` 中的 10 个夹爪精细碰撞网格完整保留。清理前，RS、DM 和运行目录对应文件的 SHA-256 逐组一致；清理后运行目录是这些文件的保留位置。
- `RS/` 的 URDF、22 个视觉网格和 10 个共用整件保留，用于独立 URDF 加载及 Gazebo SDF 再生成。
- AGV CAD 的散文件、参数化脚本、STEP / STL、校验图及 manifest 保留，六种底盘网格仍可复制到运行目录。
- 备用 SLAM 地图、相机 / 检测 / 任务 / 仿真驱动节点、Gazebo 工作台与物体模型、第三方模型来源说明保留。
- 本地 `build/`、`install/`、`log/`、TF 输出和手动保存地图未纳入此次清理。

根 README、RS README、机械描述说明和 Gazebo README 已同步更新。关于删除路径的上表是历史记录，不是当前可用资源列表。

## 验证

清理前已通过夹爪哈希比对、压缩包内容比对，以及 Web 标准款 / AGV 款导航、抓取与堆叠检查。

清理后已完成：

- 保留的 47 个运行 STL 的 SHA-256 与清理前一致。
- 172 处 URDF / MJCF / SDF 模型及网格引用完整，三个原生 MuJoCo 模型加载成功。
- 更新文档的本地链接有效，没有残留指向删除资源的使用说明。
- 在 `/tmp` 的独立构建 / 安装目录中，从干净状态构建 `rebotarm_msgs` 成功。
- 使用新生成的接口导入仿真驱动、任务服务和关节 GUI 模块成功；保留类型存在，移除的两个类型不再生成。
- `npm run test:variants` 通过，覆盖路径规划、两种配置加载和 AGV 导航 / 抓取 / 堆叠。
- `npm run build` 通过，生产包不再包含旧 `pla3_black.STL` 及其压缩副本。

未执行完整 ROS / Gazebo 导航实测。

## 仍需关注

- `mobile_base/cad/agv_v1/generate_agv_v1.py` 的默认底座路径仍指向旧工程。根 README 已给出通过 `--repository-base rebotarm_mujoco_rs/models/meshes/base_link.STL` 显式传入文件的命令。
- RS 独立 URDF 与运行模型中仍有用于不同加载流程的网格副本；修改机械臂几何时需同步核对。
