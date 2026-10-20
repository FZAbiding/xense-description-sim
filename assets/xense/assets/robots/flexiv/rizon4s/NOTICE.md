# flexiv.rizon4s 来源与修改记录

当前本体 Xacro、配置、网格与物理参数来自 Flexiv 官方 flexiv_description，固定提交 `8b8452105c5faf088f456db18b0e2581b16fc630`，采用随源发布的 [Apache-2.0](LICENSES/LICENSE)。上游原件保存在 provenance/upstream；来源路径、SHA-256 与 Git blob 哈希见 asset.json。

2026-10-12 本地衍生修改：标准 inertial 包装、移除非 URDF workspace 扩展、相对资源路径和有记录的兼容名称/恒等辅助框架。质量、质心、惯量、关节、碰撞几何保持官方值。完整参数与源文件入口见 [README.md](README.md)。

provenance/urdf 中的旧平台/旧 RDK 文件只用于历史来源、连接或版本比对，不作为当前本体的权威输入；其原来源登记保存在对应文件元数据和迁移报告中。官方本体许可证不扩展到历史平台来源。用户 STEP 仅作总装安装参考。

Menagerie 交叉来源（如有）单独保留其说明、许可证、提交号，仅解析 XML 作参数比对。来源一致性不代表硬件标定、接触或动力学验收完成。

2026-10-14 补充厂家现成 USD：来自 https://github.com/flexivrobotics/isaac_sim_ws，固定提交 `b28e3bd08af852ed8eef1e1201cf2ff264245f66`，适用随此来源保留的 Apache-2.0 许可证（`LICENSES/official_usd_*.txt`）。USD 层、材质及纹理原字节保留；来源清单为 `usd/source.json`，上游说明为 `provenance/usd/upstream_README.md`。本次不转换、不调整参数，也不将上游验证声明视为本仓库验收。
