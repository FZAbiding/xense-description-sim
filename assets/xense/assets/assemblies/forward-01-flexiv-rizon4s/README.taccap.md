# forward-01-flexiv-rizon4s-taccap

forward-01-flexiv-rizon4s 的双 TacCap 从夹爪候选变体。01 保留双 Rizon4S 以及已修正的右臂基座安装；起始姿态与 04 类似，开合方向约倾斜 9–11°。

打开 [forward-01-flexiv-rizon4s-taccap.urdf](urdf/forward-01-flexiv-rizon4s-taccap.urdf)，再于 Robot Viewer 的
Animation → Import JSON 手动导入 [start_pose.taccap.robotanim.json](config/start_pose.taccap.robotanim.json)。
URDF 保留单臂零位、关节轴向与限位。工位姿态单独记录在
[start_pose.taccap.json](config/start_pose.taccap.json)，14 个机械臂角度来自本平台，未复制 04 的角度。
两侧夹爪主动指默认 +28.92° 张开，从动指保持源 −1 mimic；只对主动指创建轨道。

维护层次：支架 → 左/右机械臂 → 独立
`xense.flexiv_elite_franka_to_taccap_slave` → `xense.taccap_slave_v2026_10_15:default`。
两侧连接件/夹爪分别使用 `left_adapter_`/`right_adapter_` 与
`left_tool_`/`right_tool_` 前缀，避免使用 `with_mount` 重复叠装。
部件见 [COMPONENTS.taccap.md](COMPONENTS.taccap.md)，唯一装配配置见 [assembly.json](assembly.taccap.json)。

法兰到连接件无平移，绕法兰 +Z 的左右安装角分别为 90°、-90°；
连接件到裸夹爪保留源变换 +Z 12 mm。安装角参考 04 的历史桥接与四孔法兰的
90° 对称档位；02 单独采用 0°/0°，以适配侧向支架和本工位腕部角度。
[历史安装来源](provenance/taccap/forward44r_mount_source.xml)、基础配置和 start 角的快照
及 SHA-256 均记录在配方 source。装配不复制部件质量/惯量或网格。

原基础 URDF 和工位 start 角均保留。工作台位姿仍待测量，本变体未添加桌子。
连接件质量只在部件 JSON 记录；质心/惯量未提供，未补猜。
相机光轴方向按现有未标定的源 frame 检查，不表示真实光学校准。
实物螺孔/定位、安装时钟方向、全行程干涉、承载和动力学/接触仍待验收。

本次只生成 URDF 与 Viewer 姿态，无新增 MJCF/USD 或仿真调用。

生成/检查：`python scripts/assemblies/build_assemblies.py --update-lock` / `--check`，
`python scripts/assemblies/build_viewer_poses.py` / `--check`。
