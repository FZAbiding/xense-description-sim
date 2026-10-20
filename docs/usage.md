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

1. 等待底部状态显示“18 关节 · 双相机已就绪”。
2. 在右侧选择“左臂”或“右臂”，使用 J1–J7 滑块调整该侧关节。
3. 也可直接填写角度输入框，按 Tab 或移开焦点应用。界面单位为度，输入按源关节限位约束。
4. 用“闭合”“张开”或开度滑块控制当前夹爪。从动指保持 −1 联动；百分比表示源关节角度范围，不能直接当作毫米开口宽度。
5. 点击“恢复启动姿态”恢复两臂和两组夹爪的源工位姿态。启动姿态不是全零关节姿态。

鼠标左键拖动旋转，滚轮缩放，右键拖动平移。顶部按钮切换透视、正视、侧视、俯视；
“居中”根据当前模型范围重新调整主视角。改变主视角不会改变机器人或腕部相机位姿。
窄屏下控制区位于模型下方，可滚动访问相机和导出按钮。

## 查看与保存腕部图像

- 左右腕部画面各为 **640×480**，采用 **60° 垂直视场角**预览设置。
- 相机随各自机械臂运动；两路启用时从同一份 MuJoCo 状态渲染。
- 勾选框控制相机更新。暂停后保留最后画面；静止时也会复用已有图像。
- “视锥”用于在主视角观察两路相机方向，不会叠加到腕部图像中。
- “显示参考标靶”控制辅助棋盘的显示。标靶没有接触物理，也不代表实测工作台。
- 各相机标题栏的“PNG ↓”保存对应画面；“保存主视角 PNG ↓”保存主视角。

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
| `unit` / `mode` | 关节角为 `rad`，运行模式为 `kinematic` |
| `timestamp` | 导出时的 UTC 时间，不是相机逐帧采集时间 |
| `sourceUrdfSha256` | 本次模型使用的源 URDF 内容哈希 |
| `joints` | 18 个关节的当前角度，包含两个 mimic 从动指 |
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
| PNG 含参考棋盘 | 取消“显示参考标靶”后重新截图 |
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
