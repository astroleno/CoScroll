# 曲目专属序言与 Inko 制作流程

日期：2026-10-25。用户已要求补齐制作流程，让今后每首新曲目自动配专属序言，并补齐《心经》与赞诗录音版《妙法莲华经》。本次实现、验证和制作资源；提交、推送与公网替换另按用户授权执行。

状态：已实现并完成本地验收。两首真实 Inko 资源、113 项运行测试、12 项发布工具测试、完整本地正式包及 16 组浏览器检查通过，本轮临时材料已清理；结果见[交付与验证记录](../INKO_TRACK_OPENINGS_20261025.md)。

## 目标与接口

复用正在制作曲目的代码生成模型撰写短序，把写作作为制曲必做步骤；不要求用户另外手写序言。制作命令提供该录音的资料与完整歌词作为写作输入，接收结构化短序，随后自动调用 Inko、下载源图与 scene、制作透明开场图、校验并写回曲目配置。普通构建及发布只消费冻结资源，不调用生成服务。

用户已确认采用原创短序：2–3 行、约 20–35 字，内容必须对应实际歌词和录音版本，不冒充经文原句。既有妙法录音是歌曲摘编，不得写成全本诵读。

制作入口为 `npm run tracks:prepare -- --project <id>`。`--brief` 提供当前曲目写作资料；制曲模型生成序言文件后，以 `--preface <file>` 完成后续制作。已有、输入未变且资源完整的曲目直接复用；曲名、录音或歌词变化必须重新制作。`tracks:check` 检查所有公开曲目，构建与打包必须通过检查。缺少专属序言不能被共用提示图替代。

配置增加可选 `opening`，包括 `text`、`kind`（original / excerpt）、`sourceDigest`、`revision`、`attribution`、`asset` 与 `manifest`。`asset` 沿用已有 `src / width / height / bytes / sha256` 合同。逻辑路径位于 `/opening/<project-id>/`，由现有 `assetUrl` 解析。本次两首正式曲目必须有 opening；类型可选只用于旧配置兼容。

## 模块边界

- `deploy/prepare-track.mjs`：写作资料、完整输入摘要、缓存复用、Inko 编排、资源与配置的最后提交、全曲目检查。
- `deploy/handwriting/`：固定版本官方 Inko SDK 的校验下载与透明资源渲染。密钥只保存在制作环境，不写入配置、日志或前端包。
- `public/projects/*.json`、`public/opening/<id>/`：同一曲目的文本、图片及制作清单；文件名含内容摘要。
- `docs/handwriting/<id>/`：保留实际源文件与制作依据；临时脚本、截图和下载缓存在验证后清理。
- `src/config/types.ts`、`schema.ts`：同步新增配置合同，校验文本、资产尺寸与摘要，并绑定所属曲目。
- `OpeningPrompt`、`AutoPlayGuard`、`ReadingSession`：按当前配置显示短序，替换可见“点击开始”；曲名和按钮的开始语义保留。使用现有丝绸与进入行为。
- `package.json`、`deploy/package-release.mjs`、接入规范与仓库制曲说明：把专属开场纳入所有后续曲目的交付门槛。

## 交互与资源纪律

开场仍是现有全屏单一按钮。短序静态显示，手写图校验和解码完成后才替换同文普通文字；加载失败、超时或离线不阻塞点击、Enter、Space 的同步播放调用。切曲时卸载上一张图、取消请求并释放 Blob URL，不新增播放器或会话容器。

沿用原有丝绸、浅色字和曲名层级；短序用紧凑的 2–3 行透明手写图，手机和横屏都留出安全边距。保留 Inko 可见标识与原始 AIGC 元数据，发布不使用临时下载链接。实际报价必须为零才提交手写任务；失败时不改写原曲目配置。

## 验收

1. 两首现有录音各有与歌词相符、互不相同的专属序言与真实 Inko 手写图。
2. 制曲资料、生成、下载、渲染、配置写回可复用；重复运行不重复提交；输入变化、非零报价、缺字、文件损坏与生成失败都被拦截。
3. 类型、运行时配置校验、构建与发布检查覆盖 opening；缺少开场的新曲目无法交付。
4. 真实浏览器检查手机、横屏和桌面开场，覆盖点击、Enter、Space、图片失败、慢加载与切曲；正文、音频和两个 Canvas 沿用原行为。
5. 运行相关自动测试、类型检查与生产构建；查看两张最终图，清理本轮临时文件与测试页面。没有执行的真机或公网验证明确记录。

## 参考

Inko 接口及 scene 处理依据其官方仓库固定版本 `a1e2d4929d8e97807961a536d7f1e224f5e42b31`：

- https://github.com/pretend1111/inko-skill
- https://github.com/pretend1111/inko-skill/blob/a1e2d4929d8e97807961a536d7f1e224f5e42b31/inko-handwriting/references/api.md
- https://github.com/pretend1111/inko-skill/blob/a1e2d4929d8e97807961a536d7f1e224f5e42b31/inko-handwriting/references/scene.md
