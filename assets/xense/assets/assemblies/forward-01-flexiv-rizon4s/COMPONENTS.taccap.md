# forward-01-flexiv-rizon4s-taccap：部件与连接件

装配 ID：`assembly.forward_01_flexiv_rizon4s_taccap`，以 [assembly.json](assembly.taccap.json) 为准。

| 配方实例 | 已登记资产及入口 | 状态 |
|---|---|---|
| `left_arm` | `flexiv.rizon4s:default` | 已引用；重现当前 URDF 必需 |
| `right_arm` | `flexiv.rizon4s:default` | 已引用；重现当前 URDF 必需 |
| `stand` | `forward44r.stand:default` | 已引用；重现当前 URDF 必需 |
| `left_adapter` | `xense.flexiv_elite_franka_to_taccap_slave:collision` | 已引用；重现当前 URDF 必需 |
| `left_gripper` | `xense.taccap_slave_v2026_10_15:default` | 已引用；重现当前 URDF 必需 |
| `right_adapter` | `xense.flexiv_elite_franka_to_taccap_slave:collision` | 已引用；重现当前 URDF 必需 |
| `right_gripper` | `xense.taccap_slave_v2026_10_15:default` | 已引用；重现当前 URDF 必需 |

各侧按支架 → 机械臂 → `flexiv-elite-franka-to-taccap-slave` → 裸 TacCap Slave 维护。
安装候选待实物验收；两侧夹爪主动关节独立，从动指维持源 mimic。
