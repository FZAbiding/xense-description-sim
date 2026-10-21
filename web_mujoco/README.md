# Web MuJoCo 开发说明

默认页面为 Forward-01 双 Flexiv Rizon4S / TacCap 运动学预览。

- [项目总览](../README.md)
- [使用指南](../docs/usage.md)：控制、相机、导出、部署与排障
- [实现与验证](../docs/flexiv-visualization.md)：资产来源、模型生成与坐标约定
- [原 reBot 网页参考](README_REBOT.md)：AGV、抓取和原界面说明

## 启动和入口

使用 Node.js 22.20+ 和 Chrome / Edge，在本目录执行：

```bash
npm ci
CHOKIDAR_USEPOLLING=1 npm run dev -- --port 5174 --strictPort
```

打开 `http://127.0.0.1:5174/`；端口被占用时使用已有服务、停止原服务后重启，或修改 `--port`。
`CHOKIDAR_USEPOLLING=1` 规避本机已遇到的 `EMFILE` 文件监听额度错误。
根目录启动及 Node 18 临时使用 Node 22 的命令见[项目总览](../README.md#本地运行)。
原始 `npm run dev` 脚本仍默认尝试 5173，示例使用参数覆盖端口。路径映射：

| 路径 | 页面 |
| --- | --- |
| `/` | Forward-01 双臂、双夹爪、双腕部相机 |
| `/rebot.html` | reBot 单臂 |
| `/rebot.html?variant=agv` | reBot AGV 实验室 |
| `/rebot.html?variant=agv-campus` | reBot AGV 园区 |

所有模型均从本仓库的 `../rebotarm_mujoco_rs/models/` 读取。
`predev` / `prebuild` 自动生成原 AGV 园区场景；Forward-01 使用已提交的生成结果，
日常启动无需 Python 或原资产仓库。新开发入口为 `/home/xense/src/xense-description-sim`。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm ci` | 按锁文件安装依赖 |
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | 将 Forward-01 和 reBot 两个入口构建到 `dist/` |
| `npm run preview -- --port 4173` | 预览已有生产构建 |
| `npm run test:flexiv` | 用真实 WASM 验证双臂独立性、源姿态、限位、夹爪 mimic 和光学坐标 |
| `npm run test:flexiv:motion` | 验证 TCP 求解、失败回退、JSON 校验、回放速度与时间控制 |
| `npm run test:flexiv:browser` | Chromium 验证控制、图像、下载、移动端和原 reBot 入口 |
| `npm run test:loading` | 原模型加载、WASM 与缓存回归 |
| `npm run test:reset` | 原 reBot 复位按钮回归 |
| `npm run smoke` | 原 reBot 物理、抓取与堆叠检查 |

浏览器测试首次使用前执行 `npx playwright install chromium`。
默认测试服务器为 `127.0.0.1:4175`；已有服务器和浏览器的指定方法见下表。
原 AGV / 园区还有 `test:variants`、`test:campus`、`test:timing`、`test:surfaces` 和 `test:explode`。

## 配置与生产构建

| 环境变量 | 用途 |
| --- | --- |
| `GITHUB_PAGES_BASE` | 构建和预览使用的站点子目录，例如 `/xense-description-sim/` |
| `VITE_MUJOCO_WASM_CDN=local` | 构建时强制使用站内 WASM；默认生产版本尝试 CDN 后回退站内 |
| `CLOUDFLARE_WEB_ANALYTICS_TOKEN` | 可选公开站点标识；未配置时不插入统计脚本，见 `.env.example` |
| `CHROMIUM_PATH` | 浏览器测试使用的可执行文件绝对路径 |
| `FLEXIV_BASE_URL` | 浏览器测试访问的已有站点地址，须包含实际子目录前缀；设置后不自动启动服务器 |
| `CHOKIDAR_USEPOLLING=1` | 开发服务器改用轮询监听，规避本机文件监听额度错误；也适用于自动启动开发服务器的浏览器测试 |

子目录构建和预览：

```bash
GITHUB_PAGES_BASE=/xense-description-sim/ VITE_MUJOCO_WASM_CDN=local npm run build
GITHUB_PAGES_BASE=/xense-description-sim/ npm run preview -- --port 4173
```

访问 `http://127.0.0.1:4173/xense-description-sim/`。
GitHub Pages 的启用和发布确认见[使用指南](../docs/usage.md#构建与部署预览)。

## Forward-01 维护入口

| 路径 | 责任 |
| --- | --- |
| `index.html` / `src/flexiv.css` | 页面结构与布局 |
| `src/flexiv-main.js` | 启动、界面事件和导出 |
| `src/flexiv-layout.js` | 相机浮窗、控制区显示、专注视图与原布局恢复 |
| `src/flexiv-control.js` | `qpos`、源限位、mimic 和复位 |
| `src/flexiv-ik.js` | 独立状态中的七轴位置 / 朝向逆运动学 |
| `src/flexiv-motion.js` / `src/flexiv-motion-ui.js` | 关键帧文件校验、五次插值和控制界面 |
| `src/flexiv-view.js` | 主视角、两路 RenderTarget、图像读回和显示过滤 |
| `src/flexiv-model.json` | 生成的关节、启动角与相机配置 |
| `src/load-model.js` / `src/scene-view.js` | 与原 reBot 共用的加载和几何工具 |
| `../tools/build_flexiv_model.py` | 从源快照生成 MJCF、网格与网页配置 |

生成文件通过仓库根目录的工具更新，不在网页目录手工维护第二套关节参数。
当前 Forward-01 只调用 `mj_forward`，相机为未标定预览；动力学、接触抓取和真实设备采集
属于后续工作，其边界见[实现说明](../docs/flexiv-visualization.md)。
