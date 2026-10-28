# 本轮前端审阅证据

日期：2026-10-28。供 [lama 独立审阅](lama-review.md)、[emil 独立审阅](emil-review.md) 和[综合结论](README.md)引用。

## 对象与方法

- 本地源码：`947c686f1723cbece0df6bcb84dc92339d085970`；当前产品变更包含 `ae0ebc0` 的开场精简与 `441a04d` 的圆字映射修正。
- 浏览器对象：[CoScroll 正式入口](https://aitoshuu.me/CoScroll/)及 `?project=lotus-sutra-zanshi`。DOM release 标识和主站健康信息均为 `coscroll-4f25db7b664a30bf`，source digest 为 `4f25db7b664a30bf2781c374fd66da879777eeb1673cadb738f0ba978d296ea3`。
- 父线程在一个专属 ego-browser 空间执行操作和采集证据；两位 reviewer 分别读取指定 skill、源码并实际查看共享图像，不互读对方结论。共同证据不等于两次独立测试。
- 桌面为 macOS Chromium 156。移动主证据 E09–E12 设置 Android 13 / Pixel 7 / Chrome 156 UA、触摸输入、DPR 1；仍是桌面 Chromium 仿真，不是真机 Android，也不代表 Safari。
- 以实际 DOM 测量记录视口。E02/E03 为 `1450×713、DPR 2`，并非最初计划的 `1440×900`。E04–E07 虽改窄视口，但仍为桌面 UA；正式布局有 UA 分支，因此移动结论以随后补采的 E09–E12 为主。
- 本轮只审正式两首曲目与主流程，没有评估仓库内历史实验页面。既有发布报告只作背景，没有将历史测试当成本轮实测。

## 场景记录

下列编号是本轮记录的场景标识，图像已在审阅中实际查看。截图、采集脚本、原始临时 JSON 与测试空间在文档核对后清理，不作为长期仓库资产；表中记录保留复现条件和观察结果。

| 编号 | 条件与动作 | 事实记录 |
| --- | --- | --- |
| E01 | 桌面 `1440×900`，《心经》新开场 | 深蓝丝绸中央为三行专属手写短序；左上曲名、作者和选曲入口；中央没有重复曲名、水印或“点击开始”字样。 |
| E02 | 桌面 `1450×713`，《心经》暂停在 30 秒，进度条键盘聚焦 | 实际锚字为「空」，状态文案为空；两个 canvas；正文区域高 585px，footer 高 128px；滑块可见聚焦圆点及光晕。部分竖排列在正文下边界处截断，不能与玉字的前后遮挡混为一谈。 |
| E03 | 同一桌面会话打开选曲面板 | 原生 modal dialog 位于右上，宽 380px；焦点在“关闭面板”。心经副标题“王菲 · 歌曲版”，妙法副标题“赞诗 · 神农尝百草·卷一”。面板说明切换后从曲首开始、保留播放或暂停状态。 |
| E03a | 从暂停的心经切换到妙法 | URL、页面标题、左上曲名与配色改变；时间归零，保持暂停，焦点归还选曲按钮；没有重新展示开场。采样瞬间存在正常的“录音加载中…”状态，不能视为持续故障。 |
| E04 | 桌面 UA 窄视口 `390×844`，妙法新开场 | 三行专属短序；播放器和正文隐藏；音频暂停。它只作为窄视口记录，E09 是移动 UA 复核。 |
| E05 / E05s | 同一窄视口，定位妙法 60 秒 | E05 捕获到「生」加载中、上一字仍在画面的瞬间；E05s 等到真实「生」ready，状态文案消失。最终审阅不把 E05 当成持续占位或稳定画面。 |
| E06 / E06a | 窄视口打开面板、按 Escape | 面板从底部呈现，宽 366px、高约 316.59px；Escape 关闭后焦点返回当前曲目按钮。 |
| E06b | 暂停时在正文横向触摸拖动，x 从 290 到 100 | 媒体时间从 60 秒变为约 75.833333 秒，仍为暂停；E11a 在移动 UA 下再次验证。 |
| E07 | 桌面 UA 横向窄窗 `844×390` | main 高 262px，footer 高 128px；仅作矮窗辅助记录，手机取景结论以 E12 为主。 |
| E08 / E08b | 桌面 `1440×900`，开启 `prefers-reduced-motion: reduce`，妙法暂停在约 75.833333 秒 | `matchMedia` 返回 true，媒体暂停；两张相邻截图中玉字姿态继续变化。结合正式链路源码，支持“装饰性持续运动没有随减少动态偏好收敛”的判断；不能据此推断帧率、GPU 成本或流畅性。 |
| E09 | Android UA、触摸仿真 `390×844`，妙法新开场 | 手写短序与左上入口完整，无中央水印/曲名；媒体暂停、正文和播放器隐藏。触摸中央后成功进入并播放，时间推进超过 1 秒。 |
| E10 | 同一移动仿真，暂停并定位妙法 60 秒，等待「生」ready | 状态文案为空；正文高 716px，footer 高 128px，两个 canvas，无横向页面溢出；Play 基础布局为 `32×32px`，range 为 `190×6px`；Play 键盘聚焦有浏览器焦点轮廓。采样时 hover 变换可使按钮边界短暂为约 33.6px，不能把它当成额外 padding。 |
| E11 / E11a | 移动 UA 下打开选曲、Escape 关闭，再横向触摸拖动 | 面板尺寸与 E06 一致；恢复曲目按钮焦点。触摸拖动同样使暂停时间 `60→75.833333`，没有擅自恢复播放。 |
| E12 | 同一 Android UA 会话旋转为 `844×390`，约 75.833333 秒，真实「生」ready | main `844×262px`，footer `844×128px`，footer 占视口约 32.8%；玉字和竖排列均出现上下边界截断。两个 canvas，页面没有横向溢出。模型 ready 与画面取景完整是不同验收项。 |

进度条的键盘操作使用 Home 归零、Shift+ArrowRight 每次前进 10 秒；未使用直接改媒体时间来代替 UI 操作。Enter 进入开场、Play/Pause 点击、选曲、Escape、CDP 可信触摸均在本轮执行。图像右侧偶见粉红色翻译插件按钮，它不属于 CoScroll。

## 源码核对入口

以下源码链接均相对于本目录，行号以本轮 HEAD 为准，后续修改可能移动。

| 主题 | 入口 |
| --- | --- |
| 当前视觉约束与历史说明区分 | [经典接入规范](../../CLASSICS_INTEGRATION_SPEC.md) |
| 纯短序开场及手势按钮 | [AutoPlayGuard.tsx](../../../src/components/AutoPlayGuard.tsx#L34)、[OpeningPrompt.tsx](../../../src/components/OpeningPrompt.tsx#L35) |
| 原生 dialog、关闭及焦点恢复 | [ClassicControls.tsx](../../../src/components/ClassicControls.tsx#L19) |
| 曲目副标题数据与渲染 | [catalog.ts](../../../src/config/catalog.ts#L1)、[ClassicControls.tsx](../../../src/components/ClassicControls.tsx#L46) |
| 播放按钮及原生 range 的布局、键盘和焦点 | [EnhancedAudioPlayer.tsx](../../../src/components/audio/EnhancedAudioPlayer.tsx#L122)、[播放器布局](../../../src/components/audio/EnhancedAudioPlayer.tsx#L162)、[滑块焦点](../../../src/components/audio/EnhancedAudioPlayer.tsx#L270) |
| 正文裁切及 footer 布局 | [ReadingSession.tsx](../../../src/components/ReadingSession.tsx#L849)、[footer](../../../src/components/ReadingSession.tsx#L900) |
| UA/高度分支、字与模型比例、正交相机 | [UnifiedLyricsAndModel.tsx](../../../src/components/layouts/UnifiedLyricsAndModel.tsx#L78) |
| 正式背景每帧推进 | [SilkR3F.tsx](../../../src/components/backgrounds/SilkR3F.tsx#L108) |
| 当前页面选用的背景与参数 | [ClassicExperience.tsx](../../../src/components/ClassicExperience.tsx#L64) |

## 结论边界与清理

本轮是体验审阅，不是新一轮发布验收。没有完成双站全入口矩阵、全曲逐句听校、真机 Safari/Android、屏幕阅读器操作、锁屏/后台、弱网失败注入、长时运行、逐帧录像或 FPS 测量。不据截图声称“全程 60 FPS”“所有模型已测遍”或量化用户心流改善。动效缺口由相邻状态与源码支持，审美与理解成本属于设计判断。

共生成 14 张过程截图，其中包括用于排除中间加载状态、桌面 UA 窄窗和减少动态效果对照的辅助图。保留的交付仅为本目录四份 Markdown 文档；截图及临时采集文件不入仓库。原先用户决定保留的 13 个未跟踪资料不属本轮清理范围。
