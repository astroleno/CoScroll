# CoScroll 多工具 review：主线程核查

Claude Code 与 DeepSeek Harness 各有三个子 agent 完成独立审阅，主线程已核查其 findings。Kimi CLI 的三个子 agent 均因账号额度返回 429，未完成，不计作“无问题”。

最终保留 **2 条运行行为问题、1 组自动验证缺口**；另有 1 条尚未证实实际网络影响的候选，以及 2 项维护建议。没有确认 P0/P1 缺陷。原始报告合计 15 条 findings 不等于 15 条成立的产品缺陷。

## 审阅基准与判断方法

用户确认对象为当前 CoScroll 代码与最近上线改动。基准为 `ac872e82eb04ce10632335b3f6e03c7146874116`，主要产品改动为 `65f94ffd28da1c9e9a2acd02a8479332cabcc139`。本轮只写审阅记录，不修改产品或测试，不提交、推送或发布。

各工具独立审阅；主线程随后沿真实调用路径核实触发条件，并对可疑输入做小范围复现。原始工具报告保留原貌，含不准确条目；应以本文的复核结论判断是否需要行动。

共享目录中另有模型交付改动正在产生。主线程发现 `deploy/prepare-models.mjs` 等文件在审阅过程中被其他工作修改，没有覆盖这些改动。本轮结论以指定 Git 基准复核；新模型交付实现不属于本轮上线回归 review。关键复核文件的内容摘要和基准一致性记录见 [verification-results.json](verification-results.json)。

DeepSeek 读到同期修改后，该次运行作废；接受的最终结果来自 `git archive` 导出的固定提交副本。该副本只供读取，不是分支或 worktree；243 个原始输入的 SHA-256 见 [baseline-manifest.json](baseline-manifest.json)。

## 应优先处理的结果

### P2：音频启动最终失败没有界面错误状态与就地重试

来源：DeepSeek `correctness-1`。主线程置信度 0.95；这不是本次区域透射改动引入的新回归。

触发条件是准备阶段的单字节音频探测已经通过，但后续原生音频请求失败或内容无法解码，尚未触发 `canplay`。`prepareProject.ts:21–27` 允许使用已验证配置时长，因此准备成功不保证后续完整录音总能播放。

`AudioEngine.tsx:415–432` 重试两次后只写控制台；组件接口和 `ReadingSession.tsx:805–823` 的调用均没有错误回调。播放失败后 `ReadingSession.tsx:314–324` 的手势播放 catch 会回到未播放状态，而 ready 仍为 false；`EnhancedAudioPlayer.tsx:169` 禁用播放按钮，`ReadingSession.tsx:347` 也拒绝再次启动。页面的配置加载错误提示接收不到这条音频失败。

本轮执行基准 TSX 中的真实错误处理函数，使用假音频对象和可控计时器：**两次 `load()` 重试，末次一条 console error，父组件回调 0 次，ready=false**。这验证的是错误传播路径；没有伪称运行过真实浏览器断网实验。刷新或切走再返回可能恢复，不使用原文“任何情况下永久不可用”的绝对表述。

建议增加明确的音频错误通知、用户可见的失败状态及就地重试入口。具体状态接口和恢复方式应在修复方案中确认；本轮没有实施修改。

### P3：缓冲状态在引擎内更新，但播放器始终收不到

来源：DeepSeek `correctness-2`。主线程置信度 0.99；同样属于已有运行路径。

`AudioEngine.tsx:299–309` 计算并保存 `isBuffering`，但既没有状态通知，也没有 `waiting` 等事件向上层报告；`ReadingSession.tsx:105` 的 `setIsBuffering` 在该文件内没有调用，传给播放器的值恒为 false。`EnhancedAudioPlayer.tsx:174` 的缓冲图标和第 230 行的缓冲指示不会被这条路径触发。

本轮让实际处理函数读取“当前时间 9 秒、缓冲到 10 秒”的音频对象：引擎内部 `isBuffering=true`，向父级发出的仍只有 duration、ready、time 三类通知。应补齐缓冲状态传播，并用真实媒体事件定义等待与恢复状态；是否在缓冲时禁用 seek 是交互决定，不把原报告的建议自动当作现有验收要求。

### P2 验证缺口：像素比较与补丁运行行为没有自动失败门槛

合并来源：Claude `V001`、DeepSeek `validation-1` 与 `validation-2`。

受管浏览器辅助程序会记录像素差、GL 错误及局部路径计数，但只断言局部路径计数；没有受管调用入口在发现非零像素差时失败。普通测试对补丁做源码摘要、文本和顺序检查，没有执行 WebGL 的 clear/resolve 行为。它们可分别发现部分错误，不能相互替代。

建议将真实浏览器比较接入可重复执行的验证入口，按本项目既定要求断言像素差为零、GL 无错误，并确认实际进入局部路径。保留初始化、换模型和恢复后的完整更新；不采纳原文建议的 `q.full===0`，因为首帧完整更新是必要行为。也不把“缺少自动门槛”改写成“先前的人工像素与公网验证没有做过”。

## Claude Code 原始 findings 的处理

原始三个子结果见 [claude-code-subagents.json](claude-code-subagents.json)。以下 ID 沿用工具原文；不把原报告的 HIGH/MEDIUM 置信度当作证据。

| 原 ID | 主线程结论 | 证据与影响 |
| --- | --- | --- |
| CORR-001 | 遗留代码中的潜在竞态；当前上线路径不触发 | `useLyricsFromConfig.ts:79–101` 确实缺少取消与过期响应保护，但受管源码中只有该 hook 的定义，没有导入调用；实际会话通过 `prepareProject.ts:76–96` 加载歌词，传递取消信号并在提交前检查。原文让人在 ReadingSession 导航中复现该 hook 问题，调用前提不成立。未来复用该 hook 前应补清理。 |
| CORR-002 | 不成立；预期回退 | `entryBootstrap.ts:19–30` 读取当前 HTML 的可选构建提示，校验 release；不是报告假设的持久化 IndexedDB 缓存。`prepareProject.ts:73–78` 对坏提示回退到发布对象是明确设计，网络失败仍抛错。 |
| CORR-003 | 不成立；生产调用方已传命令版本 | `ReadingSession.tsx:822` 明确传 `seekSignal`；`AudioEngine.tsx:454–462` 只在新命令版本执行 seek，其余观测更新返回。报告声称 ReadingSession 未传此参数，与源码相反。 |
| CORR-004 | 不成立；原文也承认清理存在 | `EnhancedAudioPlayer.tsx:154–161` 的卸载清理执行 `clearTimeout`。原报告自身写明“Current implementation is correct”，且置信度仅 0.4，不应列为缺陷。 |
| V001 | 确认测试入口缺口；不是已复现的视觉回归 | `package.json:17–18` 仅自动运行 `*.test.mjs`，`transmission-region-browser.mjs:36–68` 是独立导出的浏览器辅助函数；受管代码没有它的调用入口。辅助函数收集像素差和 GL 错误，但只对未进入局部路径抛错。应提供可重复的浏览器入口，并明确断言像素差为零及 GL 状态。不能据此宣称先前人工像素验证未执行，也没有证据确认外部 CI 实际配置。 |
| V002 | 依赖声明可收紧；不构成当前构建缺陷 | `package-lock.json:5247–5252` 锁定 Three `0.160.1`；适配器对版本和源码 SHA 双重拒绝不匹配，`next.config.mjs:3` 在构建前调用。因此不会静默使用未审阅补丁。可把 `package.json:30` 改为精确版本，减少以后更新时的困惑。原验证命令 `models:prepare` 也不是加载 Three 适配器的构建入口。 |
| V003 | 复现反证；不成立 | 非有限边界在 `transmissionUpdateRegion.ts:92–95` 返回，尚未写入上次边界，并置 `valid=false`。实测顺序为有效局部矩形 → NaN 返回 null → 恢复帧返回 null（完整更新）→ 下一帧恢复 `[147,147,106,106]`，无 NaN 泄漏。 |
| V004 | 未提供真实触发路径；不收作缺陷 | 帮助函数依赖已发布的静态几何体；同一几何体的 position 版本变化会在 `transmissionUpdateRegion.ts:62–66` 永久回退完整路径。报告假设离线资产生成“竞态或序列化错误”，没有指出现有路径中的错误资产。发布哈希、解码往返和已有几何数据验证也不能被忽略。若未来增加顶点原地修改，应重新定义边界更新契约。 |
| V005 | 代码描述错误；解压异常路径已复核 | 实际使用 `DecompressionStream`，没有 `pako.inflate()`；`preparedModelGeometry.ts:180–182` 清理后重新抛错，不返回 undefined。已有测试包含坏字节拒绝和损坏载荷回退。本轮另将有效 gzip 从 49 字节截至 34 字节，确认拒绝并清理一次部分几何体。生产网络损坏还会先被 `ModelPreloader.ts:224–227` 的长度和摘要拦截。 |

## Claude 残余风险和测试缺口的复核

- “卸载后 context-restored 监听器仍执行”的前提不成立：`TransmissionRegionRendering.tsx:18` 移除同一监听器。可以补挂载/卸载集成测试，但不能把不存在的残留监听器当作风险事实。
- “setTimeout 缓存清理插入同步 render 中途”没有成立的执行路径；当前同步 JavaScript 调用不会被计时器回调从中间打断。真实异步解码与所有权边界应按具体路径测试。
- “材质 needsUpdate 后完整一次、再恢复局部”已被 `transmission-region.test.mjs:76–82` 明确断言；本轮重新执行通过。
- “被取消的旧项目准备结果没有释放”与 `projectConfigStore.ts:120` 相反；`project-content.test.mjs:189–200` 明确覆盖过期结果释放，本轮通过。
- 循环边界已有 `loop-and-cache.test.mjs:47–53` 的尾部到头部跳变覆盖；陈旧 seek 的拒绝已有 `loop-and-cache.test.mjs:97–110` 的存储测试，`AudioEngine.tsx:195–219` 也有版本检查和计时器替换。更完整的原生音频事件、延迟 play promise 和计时器集成测试仍有价值，不能把“已有底层测试”写成“完全没有测试”。
- 已有字体准备会在 `prepareProject.ts:81–85` 等待 `document.fonts.load()`；原报告没有复现从该入口启动时的字体竞态。字体失败后显示行为可另做专项验证。

Claude 协调器将原始 MEDIUM/LOW 分别归成 P1/P2，并声称 9 条全部满足证据标准。主线程不采纳这一总计和优先级转换，上表逐条结论优先。

## DeepSeek 其余条目的处理

原文见 [deepseek-harness-review.md](deepseek-harness-review.md)，三个子结果见 [deepseek-harness-subagents.json](deepseek-harness-subagents.json)。

| 原 ID/条目 | 主线程结论 | 证据与限制 |
| --- | --- | --- |
| correctness-3：pointercancel 导致意外跳转 | 不成立为所述缺陷 | `EnhancedAudioPlayer.tsx:97–113` 在拖动 change 时已立即 seek。实际函数复现：取消前 seek 为 `[20]`，取消后为 `[20,20]`，没有新增不同目标。是否要在系统取消时回滚属于交互设计，不能假设现有拖动是“松开才提交”的事务。 |
| correctness-4：切曲重复下载 | 保留候选，不计已确认性能缺陷 | `AudioEngine.tsx:86–97` 的依赖清理确实会移除 src 并 load，再由新 effect 恢复；`ClassicExperience.tsx:69` 未给 ReadingSession 换 key，AudioEngine 会复用。可是实际是否形成两次网络传输受浏览器资源选择时机、被动 effect 刷新与缓存影响。本轮未捕获浏览器请求，不能把代码顺序直接换算成确定的带宽和延迟损失。 |
| rendering：缺少区域边界单测 | 不成立 | `transmission-region.test.mjs:47–94` 已覆盖旧/新边界并集、物理像素、相机/模型/材质/尺寸失效、非均匀缩放、各顶点包围和不支持场景回退；本轮执行通过。 |
| rendering：缺少预计算/源模型几何等价测试 | 不成立为“没有测试” | `prepared-models.test.mjs:50`、`:101`、`:240`、`:251` 等已有完整模型 fingerprint、GLB 几何保护和损坏回退对比。本轮没有重跑这一大组，不将静态确认“存在测试”冒充最新通过结果。 |
| validation-2：未执行补丁运行行为 | 采纳为验证缺口，与 validation-1 和 Claude V001 合并 | 文本校验存在且有价值，但不能证明所有实际 WebGL 状态转换；建议优先接入浏览器比较，而非仅为了单测抽出新的内部抽象。 |
| validation：不支持场景恢复、更多守卫分支、context restore 事件集成、HTTP 校验脚本自动运行 | 可增加的覆盖项 | 与“像素比较入口”的主要缺口相关。NaN 恢复已被本轮专项复核反证为 bug；position.version 修改后的长期回退是显式策略，不能要求它在原对象上自动恢复局部路径。线上 HTTP 脚本以前执行过，缺少自动测试入口不等于未曾公网验证。 |
| correctness：外壳必须完全被 opaque 矩形包住 | 不采纳为成立的渲染风险前提 | 该矩形限制的是不透明预通道的 clear/resolve。初始化已完整清理，旧/新不透明覆盖的并集清除移动留下的像素；外壳覆盖更大不自动意味着外部像素过期。仍应以真实场景的像素等价验证覆盖这一不变量。 |
| 其他假设新增网格、未来根目录 public 资产、多个安装器实例等 | 未来扩展约束 | 没有给出当前配置下的失效路径。保留在工具原文供后续设计参考，不计当前缺陷。 |

## 维护建议与尚未证实的范围

- 若重新使用 `useLyricsFromConfig`，先统一权威 LRC 解析与请求取消；当前没有调用方，不作为上线阻塞。
- Three 的依赖声明可改成精确 `0.160.1`，与现有 lockfile 和严格源码适配器保持表达一致；当前构建已有拒绝未审阅版本的保护。
- 切曲重复网络请求候选需要真实浏览器网络证据；不在本轮报告中冒充已复现问题。

## 本轮实际验证

- `node --test test/runtime/loop-and-cache.test.mjs test/runtime/project-content.test.mjs test/runtime/transmission-region.test.mjs`：25 项通过，0 失败，0 跳过。
- NaN → 有效位置恢复：完整更新后正常恢复局部矩形。
- 截断有效 gzip：解码拒绝，部分构造的几何体清理一次。
- 音频错误、缓冲状态和 pointercancel 使用基准真实函数的定点复现；可运行 `node docs/reviews/2026-10-24-coscroll/reproduce-audio-findings.mjs` 重现。该脚本只从指定 Git 提交读源码，使用轻量 hook runner，不声称是 React DOM 或真实网络实验。
- 固定 Git 副本上的相同 25 项测试另行复跑；结果、测试输入补齐过程及 14 个关键文件摘要见 [verification-results.json](verification-results.json)。

本轮未重新运行整套公网浏览器矩阵、构建或部署；以上测试结果不扩大为全项目或所有真实手机的兼容性结论。

## 未完成的工具审阅

Kimi CLI 需要账号额度恢复或用户提供可用入口；当前没有完成的 Kimi findings。该项仍然未完成，不能将两个已完成工具写成三个工具都完成。详见 [kimi-cli-review.md](kimi-cli-review.md)。
