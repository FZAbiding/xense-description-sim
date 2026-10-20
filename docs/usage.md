# Forward-01 使用指南

## 获取与启动

首次获取代码：

```bash
git clone https://github.com/FZAbiding/xense-description-sim.git
cd xense-description-sim/web_mujoco
```

本机已有工作区时，直接进入 `/home/xense/src/xense-description-sim/web_mujoco`。
开发和 Git 操作均在新工程中进行；旧 `reBot_RS_Sim` 目录只作初始版本参考。

使用 Node.js 22.20+（与 CI 的 Node 22 系列一致），在 `web_mujoco/` 安装并启动：

```bash
node --version
npm ci
npm run dev
```

打开终端打印的地址。默认端口为 5173；端口被占用时 Vite 会选择其他可用端口。
可以用 `npm run dev -- --port 5174` 指定首选端口。

如果系统仍使用 Node 18，可通过 npm 临时运行 Node 22，不更改系统默认版本：

```bash
npm exec --yes --package=node@22 -- npm ci
npm exec --yes --package=node@22 -- npm run dev
```

日常运行只使用已提交的模型与网页资源，不需要启动 ROS、安装 Python 包或读取
`xense-description` 源工程。首次打开需要下载模型并初始化浏览器中的 MuJoCo。

## 页面入口

下表路径相对于终端打印的站点根目录；部署在子目录时保留该前缀。

| 路径 | 内容 |
| --- | --- |
| `/` | Forward-01 双 Rizon4S / TacCap，当前默认页面 |
| `/rebot.html` | 原 reBot 单臂演示 |
| `/rebot.html?variant=agv` | 原 reBot AGV 实验室 |
| `/rebot.html?variant=agv-campus` | 原 reBot AGV 园区 |

## 控制双臂与夹爪

三维画布占据主区可用高度，相机和底部面板悬浮在画布内，不再单独占用上下空间。
右侧用于关节、夹爪、TCP 数值目标和关键帧编辑；展开底部“双臂 TCP”时，两臂实际位置并排显示，
不受右侧当前选择影响。青绿色代表模型定义的左臂，琥珀色代表右臂；三维视图也有对应标签。
左右名称按源模型定义，不随观察视角改变。

1. 等待底部状态显示“18 关节 · 双相机已就绪”。
2. 在右侧选择“左臂”或“右臂”，使用 J1–J7 滑块调整该侧关节。
3. 也可直接填写角度输入框，按 Tab 或移开焦点应用。界面单位为度，输入按源关节限位约束。
4. 用“闭合”“张开”或开度滑块控制当前夹爪。从动指保持 −1 联动；百分比表示源关节角度范围，不能直接当作毫米开口宽度。
5. 点击“恢复启动姿态”恢复两臂和两组夹爪的源工位姿态。启动姿态不是全零关节姿态。

鼠标左键拖动旋转，滚轮缩放，右键拖动平移。顶部按钮切换透视、正视、侧视、俯视；
“居中”根据当前模型范围重新调整主视角。改变主视角不会改变机器人或腕部相机位姿。
窄屏下相机仍悬浮在画布左右上角，控制区滚动到画布下方；主视角自动调整取景比例，避免竖屏裁掉模型两侧。

## 折叠面板与专注视图

- **相机单独折叠**：点击“左腕相机”或“右腕相机”标题栏，收起后只保留标题，再点展开。
- **隐藏相机**：顶部“相机”按钮统一隐藏或恢复浮窗，各相机的折叠状态会保留。
- **折叠底部面板**：点击“双臂 TCP”或“关键帧回放”的标题栏。TCP 默认展开，回放默认折叠；
  成功记录或导入关键帧后会自动展开回放操作。
- **隐藏控制区**：顶部“控制区”按钮收起或恢复右侧编辑器，画布宽度随之调整。
- **专注视图**：一键隐藏相机、底部面板和控制区；点击“退出专注”或按 Esc 恢复进入前的布局。
  Esc 也会退出正在启用的 TCP 拖动模式。

折叠和隐藏只调整显示，不改变关节姿态、回放状态或相机更新开关。布局切换保持当前主视角，
需要重新取景时点击“居中”。布局状态只保留在本次页面会话中，刷新后恢复默认布局。

## 末端 TCP 控制

主视图底部悬浮的“双臂 TCP”面板中，两张卡片同时显示左右源 EEF 节点的实际 X、Y、Z，单位为米。
需要数值控制时，展开右侧“末端 TCP 控制”，用左臂或右臂标签选择编辑对象。
输入框代表该侧目标，与下方两臂的只读实际坐标分开显示。

- **坐标输入**：填写 X/Y/Z 后点击“应用目标”。“读取当前位置”恢复输入框为当前实际位置。
- **末端点动**：选择 5、10 或 20 mm 步长，点击 X±、Y±、Z±。
- **三维拖动**：直接点击对应卡片的“拖动左臂 TCP”或“拖动右臂 TCP”，无需先切右侧标签。
  按钮高亮后拖动该 TCP 的彩色轴或平面；点击另一臂按钮立即切换对象，并同步右侧编辑对象。
  点击“结束左臂拖动”/“结束右臂拖动”或按 Esc 退出。一次启用一个拖动器，展开面板时两臂位置同时可见。
- **保持当前朝向**：默认勾选。数值操作保持操作开始时的朝向；一次拖动保持拖动开始时的朝向。
  取消勾选后只约束位置，末端允许旋转。

求解只调整所选机械臂的七个关节，另一臂和夹爪保持原值。七轴数值逆运动学在独立状态中计算，
成功后应用结果；未收敛或输入无效时保留当前姿态，并显示误差。完成拖动后，拖动器回到实际 TCP。
当前收敛阈值为位置 0.5 mm、朝向 0.01 rad，显示的数值精度不代表实机标定精度。

IK 是本仓库 `flexiv-ik.js` 自行实现的阻尼最小二乘数值求解器，使用 MuJoCo 正运动学、
关节轴和锚点构造雅可比，没有调用 Flexiv 官方 IK 库或实机 SDK。
它是从当前姿态开始的局部求解，失败不证明目标在全局不可达。

TCP 来自模型 EEF 定义，仍用于运动学检查。该操作不计算碰撞避让、力矩或接触抓取。

## 双臂关键帧与回放

展开右侧“双臂关键帧编辑”，或先展开主视图底部“关键帧回放”再点击“编辑关键帧”：

1. 设置“新片段时长”，点击“记录当前姿态”。关键帧同时保存两臂及两组夹爪。
2. 用关节或 TCP 控制调整姿态，再记录下一帧。可继续添加，最多 100 帧。
3. 点击底部回放面板的“播放”：先从当前位置平滑移动到第一帧，再依次到达后续帧。
4. 展开的回放面板提供“暂停”“继续”“停止”和进度条；停止保留当前姿态。拖动进度条会定位并暂停。
5. “导出轨迹”保存关键帧 JSON；“导入 JSON”将姿态或轨迹追加到现有列表，导入后播放才应用。

可先导入仓库内的[双关键帧示例](examples/forward-01-waypoints.json)：工位初始姿态 →
左 TCP 上移 10 mm 并闭合左夹爪。示例锁定当前 URDF 哈希，用于控制演示；
源资产更新后应重新验证或生成示例。

新片段时长允许 0.1–120 秒。连续播放采用五次关节插值，按 URDF 中的关节速度限值自动延长
必要片段，总计划时长上限为一小时。进度定位可以直接跳转姿态，速度约束仅作用于连续播放。
所有路径仍是运动学预览，不包含避碰规划或实机加速度/力矩控制。

手动操作关节、夹爪或 TCP，以及复位、删除关键帧和清空列表，都会停止当前回放。
切到后台会自动暂停，回到页面后点击“继续”。列表保存在当前页面内存，刷新前可导出备份。

轨迹文件的关键结构如下，其中 `joints` 与姿态文件使用相同的完整 18 关节集合：

```text
schemaVersion: 1
kind: "xense-waypoints"
model: 当前装配标识
sourceUrdfSha256: 当前源 URDF 哈希
mode: "kinematic"
unit: "rad"
interpolation: "quintic-joint"
waypoints: [{name, durationSeconds, joints}, ...]
```

导入兼容第一版导出的姿态 JSON，以及新版 `kind: "xense-pose"` 文件。
会校验版本、装配标识、URDF 哈希、弧度单位、插值类型、关节集合、限位、mimic 和时长；
错误文件不修改场景或已有列表。文件最大为 1 MiB，关键帧名称最多 80 个字符。

## 查看与保存腕部图像

- 两路预览悬浮在三维视图左上角、右上角；宽屏顶部中间保留折叠的头部相机“待接入”入口，窄屏隐藏该占位。
- 后续头部相机需提供安装节点/外参、光学方向与成像参数，再接入渲染与导出链路；当前导出仍只含两路腕部相机。
- 左右腕部画面各为 **640×480**，采用 **60° 垂直视场角**预览设置。
- 相机随各自机械臂运动；两路启用时从同一份 MuJoCo 状态渲染。
- 浮窗内“更新”勾选框控制相机更新。暂停后保留最后画面；静止时也会复用已有图像。
  折叠或隐藏浮窗不会暂停相机；需要停止更新时取消勾选。
- “视锥”用于在主视角观察两路相机方向，不会叠加到腕部图像中。
- “参考标靶”控制辅助棋盘的显示。标靶没有接触物理，也不代表实测工作台。
- 各相机画面下方的“PNG ↓”保存对应画面；三维视图右下角“主视角 PNG ↓”保存主视角。

下载文件名采用 `forward-01-<UTC 时间>-left.png`、`-right.png`、`-main.png`；
主视角尺寸由窗口大小和设备像素比决定。暂停相机时，PNG 保存其冻结画面。

源光学安装坐标尚未标定；网页只在各自相机画面中隐藏自身外壳，以避免源光心位于
外壳内产生的遮挡。相机光心和安装方向保持源值。图像用于视角检查，不能据此认定真实
内参、畸变或手眼标定已完成。坐标与显示过滤细节见[实现说明](flexiv-visualization.md#两路相机)。

## 导出姿态与坐标解释

“导出姿态”下载 `forward-01-<UTC 时间>-pose.json`，其主要字段为：

| 字段 | 含义 |
| --- | --- |
| `schemaVersion` / `model` | 当前格式版本 1 和装配标识 |
| `kind` | 新版姿态为 `xense-pose`；导入继续兼容旧版没有该字段的姿态文件 |
| `unit` / `mode` | 关节角为 `rad`，运行模式为 `kinematic` |
| `timestamp` | 导出时的 UTC 时间，不是相机逐帧采集时间 |
| `sourceUrdfSha256` | 本次模型使用的源 URDF 内容哈希 |
| `joints` | 18 个关节的当前角度，包含两个 mimic 从动指 |
| `endEffectors.left` / `.right` | 源 EEF 的节点名、世界位置（米）和按行排列的局部到世界旋转矩阵 |
| `cameras[].name` | `left_wrist_rgb` 或 `right_wrist_rgb` |
| `cameras[].position` | 渲染相机原点在世界坐标中的位置，单位为米 |
| `cameras[].rotation` | 九个数，按行排列的 3×3 旋转矩阵，将渲染相机坐标转换到世界坐标 |
| `cameras[].fovyDegrees` / `resolution` | 60° 与 `[640, 480]` |
| `cameras[].enabled` / `frames` | 更新开关与累计渲染次数；`frames` 不是时间戳 |
| `cameras[].calibrated` | 当前为 `false` |
| `display` | 参考标靶开关及自身外壳隐藏设置 |

渲染相机采用 −Z 向前、+Y 向上；源光学节点采用 +Z 向前、+Y 向下。
两者通过局部 X 轴旋转 π 转换，位置不变。使用导出矩阵时，应按其渲染坐标约定处理。
若记矩阵为 `R_wc`、位置为 `p_wc`，则世界点到渲染相机坐标为
`p_c = R_wc.T @ (p_w - p_wc)`。

需要图像与姿态对应时，先启用两路相机，保持关节和参考标靶设置不变，再保存两张 PNG
并导出 JSON。相机暂停时导出的关节和相机位姿仍是当前模型状态，可能与冻结画面不同。
当前导出用于单次检查；后续连续数据采集需要增加统一帧编号和采样时间。

## 构建与部署预览

在 `web_mujoco/` 中构建站点根路径版本：

```bash
npm run build
npm run preview -- --port 4173
```

检查与 GitHub 仓库同名的子目录版本时，构建和预览使用相同的 base：

```bash
GITHUB_PAGES_BASE=/xense-description-sim/ VITE_MUJOCO_WASM_CDN=local npm run build
GITHUB_PAGES_BASE=/xense-description-sim/ npm run preview -- --port 4173
```

打开 `http://127.0.0.1:4173/xense-description-sim/`。原 reBot 入口为
`http://127.0.0.1:4173/xense-description-sim/rebot.html`。以预览命令实际输出的端口为准。

`VITE_MUJOCO_WASM_CDN=local` 强制使用构建包中的 WASM；默认生产配置会尝试 CDN，
失败或超时后回退站内文件。`GITHUB_PAGES_BASE` 同时影响脚本、模型和两个 HTML 入口的路径。

仓库保留 `.github/workflows/pages.yml`：推送 `main` 或手动运行后，先检查 Forward-01
模型与控制，再构建并发布 Pages。首次发布须在该仓库中启用 Actions，并在
Settings → Pages 中选择 GitHub Actions。应以 Actions 的实际结果与部署地址确认发布，
Git 推送成功只说明代码已同步。

## 更新资产与检查

从仓库根目录执行。只有更新源资产时才运行导入命令：

```bash
python3 tools/import_flexiv_assets.py /path/to/xense-description
python3 tools/import_flexiv_assets.py --check
```

原始源文件保存在 `assets/xense/`，运行模型和网页关节配置由生成器派生。
需要生成器时，先安装根 README 中的 Python 依赖，再运行：

```bash
.venv/bin/python tools/build_flexiv_model.py
.venv/bin/python tools/build_flexiv_model.py --check
.venv/bin/python tools/check_flexiv_kinematics.py
```

不要手工修改生成的 `flexiv_forward_01_scene.xml` 或 `src/flexiv-model.json`。
更新来源后，应检查哈希变化、再生成结果、关节范围和启动姿态，再运行 Web 检查：

```bash
cd web_mujoco
npm run test:flexiv
npm run test:flexiv:motion
npx playwright install chromium
npm run test:flexiv:browser
npm run build
```

浏览器测试默认启动 `127.0.0.1:4175`。可用 `CHROMIUM_PATH=/path/to/chrome` 指定已有浏览器；
用 `FLEXIV_BASE_URL=http://127.0.0.1:4173/xense-description-sim/ npm run test:flexiv:browser`
检查已运行的生产预览。该地址模式不会自动启动服务器。

## 常见问题

| 现象 | 处理 |
| --- | --- |
| Node 版本或 WASM 命令报错 | 检查 `node --version`，使用 Node 22.20+；可使用上面的临时 Node 22 命令 |
| 打开了旧页面或连接到其他工程 | 检查终端所在目录和实际端口，从新目录重新启动；Forward-01 使用根入口，reBot 使用 `rebot.html` |
| 子目录预览出现模型或脚本 404 | 确认构建与 preview 设置了相同的 `GITHUB_PAGES_BASE`，并从带前缀的地址访问 |
| 画面不随关节更新 | 检查相机更新勾选框；只旋转主视角不会改变腕部视角 |
| TCP 求解未收敛 | 点击“读取当前位置”，先尝试 5 或 10 mm 点动；检查是否需要保持朝向。失败不会应用部分关节结果 |
| 不确定正在拖动哪一臂 | 展开底部“双臂 TCP”，查看高亮按钮和三维 TCP 标签；直接点“拖动右臂 TCP”或“拖动左臂 TCP”切换，Esc 退出 |
| 回放比填写的片段时长更长 | 片段为满足源关节速度限值自动延长，以界面显示的总时长为准 |
| 轨迹导入失败 | 确认文件为本装配的弧度制 JSON，URDF 哈希、18 个关节、mimic 与时长均匹配 |
| PNG 含参考棋盘 | 取消“参考标靶”后重新截图 |
| 相机边缘仍可见机器人部件 | 自身外壳过滤只隐藏该相机实体；其他夹爪和机器人几何仍按源模型正常显示 |
| 浏览器测试提示没有 Chromium | 执行 `npx playwright install chromium`，或设置 `CHROMIUM_PATH` |
| 新克隆无法通过资产检查 | 先确认 `origin/main` 已同步，再运行 `import_flexiv_assets.py --check`，根据报出的相对路径检查缺失或修改 |

## Git 同步

本机开发入口为 `/home/xense/src/xense-description-sim`，`origin` 指向
`FZAbiding/xense-description-sim`；`upstream` 仅保留初始 reBot 工程来源。

```bash
git status --short --branch
git fetch origin
git pull --ff-only origin main
# 审阅并提交本次修改后：
git push origin main
```

拉取前先处理本地未提交修改；远端与本地分叉时，审阅差异后合并，不用强制推送覆盖远端。
`AGENTS.md`、使用说明、资产来源和实现记录均随新仓库同步。
