# DeepSeek Harness 原始多子 agent review

> 这是 DeepSeek Harness 的独立原文。以下原文中的“主线程复核”指 Harness 自己的协调器，不是 Codex 主线程。最终应结合 [Codex findings 复核](findings-triage.md) 阅读；工具的优先级与“缺少测试”主张仍需复核。

## Codex 记录的执行来源

- 本机桌面应用自带 CLI：`/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh`，版本 `0.2.1-rc.2`，无需安装或改全局命令路径。
- 账号与模型沿用已有配置。子 agent 会话消息报告 `deepseek-official / deepseek-flash`。
- 三个真正的 spawn 子 agent 均返回完整 JSON；没有用 Claude、Kimi 或 Codex 自审代替。
- 接受的本轮执行：2026-10-24 07:06:42–07:13:23 UTC；退出码 `0`。
- 输入为从 Git 基准导出的 243 个文件（约 2.1 MB），副本没有分支或 worktree，审阅后清理。文件摘要见 [baseline-manifest.json](baseline-manifest.json)。
- 只开放文件读取/搜索和内部子任务，禁止写入、终端、外部网络、配置更改及递归派发。
- 先前一次因配置缺少 subagent provider 未启用派发，修正后重跑；随后一次读到了共享目录的同期模型交付修改，因此停止并作废，以下只保留固定提交副本上的结果。

## 工具原文

# CoScroll 独立代码审阅报告

## 1. 审阅范围、版本与执行限制

- 基准副本：`/Users/aitoshuu/Documents/GitHub/CoScroll/.cache/multi-review-20261024/baseline-ac872e8`
- 审阅提交：`ac872e82eb04ce10632335b3f6e03c7146874116`
- 主产品变更：`65f94ffd28da1c9e9a2acd02a8479332cabcc139`
- 审阅对象：当前正式 CoScroll 实现，重点为区域透射更新、音频运行行为、模型加载、测试有效性、打包集成；不是 Whisper 接入方案设计审阅，Whisper 尚未实施。
- 所有 finding 行号均按上述副本内容。
- 只读审阅：未修改产品、测试、配置或 Git 状态；未提交、推送、发布、创建分支或 worktree。
- 未运行完整构建、浏览器、部署、安装或网络操作；未运行测试。副本无 `.git`、`node_modules` 或完整模型载荷，不因此报告缺陷。
- 未读取 `.env`、密钥、凭据、Keychain、用户主目录、会话历史、其他项目、既有 `.cache` 证据或其他审阅报告；未读取 `docs/plans`、`FPS_*`、`src/utils/performanceDiagnostics.ts`、`test/runtime/fixtures/v2-75-geometry-baseline.json`。
- 主线程只对下文 finding 做了少量定点源码复核；未以主代理自审替代三个子 agent。

## 2. 子 agent 执行情况

实际启动并使用恰好三个独立子 agent，未递归创建更多子 agent：

| 角色 | Agent ID | 状态 | 结果 |
|---|---|---|---|
| correctness | `529a76d4-064a-4f7e-bbd1-865a7b633117` | 完成 | 4 条 findings |
| rendering | `2a19a13d-d495-48d2-835e-a7409ad81a18` | 完成 | 0 条 findings |
| validation | `7a823ea6-9b51-4f1a-be57-ca3598a2fdc5` | 完成 | 2 条 findings |

执行说明：三个子任务均收到完整边界、只读限制和 JSON schema。correctness 与 rendering 运行时间明显长于 validation，协调器在多次确认其仍为 `running` 后要求停止继续探索、基于已读证据返回最终 JSON；两者均返回了完整 schema。rendering 的测试缺口第 1 条经主线程核对不成立，未采纳，详见第 6 节。

### 去重结果

- correctness-1 与 correctness-2 都位于 `AudioEngine.tsx`，但分别对应“错误不上报”和“缓冲状态不上报”，根因、触发条件和修复不同，不合并。
- validation-1 与 validation-2 都涉及区域透射验证，但分别对应“像素差异未断言”和“补丁模块未被执行”，保留为两条。
- 未发现跨角色同根重复；最终 6 条 findings：3 条 P2、3 条 P3，无 P0/P1。
- 其中 4 条为产品/运行行为问题，2 条为验证有效性缺陷；后者不冒充产品运行时缺陷。

## 3. Findings（按严重性排列）

### P2

#### correctness-1：音频加载失败在重试耗尽后只进控制台，用户界面永久卡在不可播放状态

- **文件/行号**：`src/components/audio/AudioEngine.tsx:415-432`
- **触发条件**：进入曲目后音频元素请求失败，例如网络中断、服务端 403/404、返回不可解码内容，或准备阶段 `Range: bytes=0-0` 探测通过但完整资源后续不可用。`prepareAudio` 在配置声明了有限正时长时会直接返回该时长，不构造 `Audio` 元素验证可解码性。
- **证据**：
  - `handleAudioError` 仅在 `!stateRef.current.isReady && startupRetriesRef.current < 2` 时最多重试两次；否则执行 `console.error('[AudioEngine] Audio error:', audio.error)` 后返回。
  - `AudioEngineProps`（`AudioEngine.tsx:5-23`）没有音频错误回调；`handleAudioError` 也不调用 `onReady`、`onPlayStateChange` 或父级错误通路。
  - `ReadingSession` 只有 `handleAudioReady` 会 `setIsReady(true)`（`src/components/ReadingSession.tsx:390-393`）；没有音频错误状态或错误提示。
  - `EnhancedAudioPlayer` 播放按钮为 `disabled={(!isReady && !isPlaying) || isBuffering}`（`src/components/audio/EnhancedAudioPlayer.tsx:169`），失败后按钮永久禁用。
- **影响**：用户点击进入后音频始终不开始，播放按钮保持禁用，页面无错误文案、无重试入口；若已有 `timelineStore.pendingAudioSeek`，`ReadingSession` 的非 force 时间更新会被持续丢弃（`ReadingSession.tsx:192-194`），歌词/时间轴可能停在 0。
- **置信度**：0.72
- **验证方法**：DevTools 将 audioSrc 请求置为 offline 或返回损坏 mp3，进入曲目；控制台可见两次重试日志后仅 `Audio error`，`isReady` 始终 false，按钮 disabled，页面无 `role="alert"` 或错误文字。静态路径也可从 `handleAudioError` 直接追到缺失的回调。
- **修复方向**：为 `AudioEngine` 增加 `onError`（及可选 `onBufferingChange`）回调；`ReadingSession` 保存音频错误状态，向播放器/页面展示错误与重试入口；重试耗尽后不要只停留在 console 层。
- **主线程复核**：已读 `AudioEngine.tsx:415-432`、`AudioEngine.tsx:492-525`、`ReadingSession.tsx:390-393`、`EnhancedAudioPlayer.tsx:163-175`、`prepareProject.ts:8-27`，确认无遗漏的错误 UI 通路。

#### validation-2：适配器正确性只被测成源码文本，没有测试真正执行补丁后的 Three 模块

- **文件/行号**：`test/runtime/transmission-region.test.mjs:96-114`
- **触发条件**：引入一个保留所有被断言字符串、但改变运行行为的集成回归，例如交换 `deploy/three-transmission-region.mjs:55` 中 provider 的宽高参数、去掉 `deploy/three-transmission-region.mjs:27-29` 的 context-restore 全量更新重置，或在 `_this.clear()` 前不启用 scissor。
- **证据**：
  - 测试导入 `patchThreeTransmissionRegion`，对 Three 源文本应用补丁（`transmission-region.test.mjs:98`）。
  - 第 99-114 行只断言源 SHA 拒绝、一个源码区间的字节相等、字面 token 数量，以及 `clear` 与 `setScissorTest(false)` 的先后关系。
  - 测试从未导入或执行生成的 `.cache/three-transmission-region/*.mjs`，也没有渲染。
  - 唯一执行补丁渲染器的 `test/runtime/transmission-region-browser.mjs` 不被 `package.json:18` 的 `node --test test/runtime/*.test.mjs` 匹配；仓库内也没有其他文件导入它。
- **影响**：适配器可以在运行时回归（provider 参数顺序、`_transmissionRegionNeedsFullUpdate` 状态、scissor/clear 顺序），而 `npm run test:runtime` 仍通过；“适配器被钉住且行为保持”的验收主张强于实际覆盖。
- **置信度**：0.65
- **验证方法**：将 `deploy/three-transmission-region.mjs:55` 的 provider 调用改成 `provider(opaqueObjects, transmissiveObjects, scene, camera, _vector2.y, _vector2.x)`，运行 `node --test test/runtime/transmission-region.test.mjs`：由于测试不执行该模块、也不断言参数顺序，仍会通过。
- **修复方向**：增加能导入/转译补丁模块的行为测试，用 fake renderer/provider/state 驱动 `renderTransmissionPass`，断言 provider 宽高、context restore/resize 后的全量失效，以及 scissor/clear/blit 的顺序与区域。
- **主线程复核**：已读 `transmission-region.test.mjs:96-114`、`deploy/three-transmission-region.mjs:16-100`、`package.json:5-18`；`grep` 确认 `patchThreeTransmissionRegion` 只在测试和 `next.config.mjs` 中被引用，浏览器 helper 无导入方。

#### validation-1：浏览器区域回归没有断言记录的像素差异

- **文件/行号**：`test/runtime/transmission-region-browser.mjs:58-67`
- **触发条件**：让 provider 对每个 pose 都返回非空但过小或错误的矩形，例如丢掉上一帧并集或 3px padding。
- **证据**：
  - 第 58-62 行渲染每个 pose，并计算 `changedPixels`、`maxChannelDifference`、`meanChannelDifference`，与全量更新参考帧比较。
  - 唯一失败条件是第 66 行 `if(q.partial<poses.length)throw ...`。
  - 像素差异只放进 `result` 返回；仓库中没有模块导入 `compareRegionModel`，因此没有自动断言消费这些差异。
  - 错误但非空的矩形仍会使 `partial === poses.length`，helper 正常 resolve。
- **影响**：透射残影和未清除的旧不透明像素可以在“区域路径已执行”的检查下通过；区域更新的视觉正确性没有被自动化门禁覆盖。
- **置信度**：0.7
- **验证方法**：临时让 provider 返回 1x1 矩形，或移除与上一帧的并集，运行该浏览器 helper：会返回非零 `maxChannelDifference`，但不会抛错。正确断言应在这些帧失败。
- **修复方向**：对每个 pose 在 `changedPixels` 或 `maxChannelDifference` 超过小容差时抛错，并断言 `q.full===0`；或增加一个 runner，对返回帧做有界断言并接入自动化。
- **主线程复核**：已读 `transmission-region-browser.mjs:1-73`；`grep` 确认 `compareRegionModel`、`installRegionRegression` 无仓库内导入方。核查注记：该文件头部自述为 “Test-page diagnostics only”，因此本条应理解为“缺少自动化像素断言”，而不是“CI 中已有测试错误地报成功”；若验收流程包含人工查看 frames，则风险相应降低。

### P3

#### correctness-2：缓冲状态在 AudioEngine 内计算后从未上报，播放器缓冲 UI 永远不触发

- **文件/行号**：`src/components/audio/AudioEngine.tsx:292-314`
- **触发条件**：网络受限或缓冲不足时播放，`handleTimeUpdate` 中 `buffered.end(last) - newTime < 2` 成立。
- **证据**：
  - `handleTimeUpdate` 将结果写入 `stateRef.current.isBuffering`（第 309 行），但 `AudioEngineProps` 没有 `onBufferingChange`，该字段在组件其余代码中从未被读取或上报。
  - `ReadingSession` 的 `const [isBuffering, setIsBuffering] = useState(false)`（`ReadingSession.tsx:105`）在整个文件中没有 `setIsBuffering` 调用；仅在第 902 行把恒为 false 的值传给播放器。
  - `EnhancedAudioPlayer` 的缓冲 spinner（`EnhancedAudioPlayer.tsx:230-236`）、按钮缓冲态（第 174 行）和进度条禁用（第 222 行）因此是死代码。
- **影响**：播放卡顿/等待数据时用户看不到加载提示，播放按钮与进度条仍显示为可交互，用户会误以为界面卡死；缓冲期间无法通过禁用 seek 避免连续无效跳转。
- **置信度**：0.85
- **验证方法**：在 DevTools 中把网络降到极慢，在 `handleTimeUpdate` 内打日志或用 React DevTools 观察：局部 `isBuffering` 会变为 true，但 `ReadingSession` 的 state 始终 false，UI 无 spinner。
- **修复方向**：新增 `onBufferingChange(boolean)`，仅在值变化时上报；`ReadingSession` 用 `setIsBuffering` 接入，或改为 AudioEngine 暴露可订阅状态，避免逐帧 setState。
- **主线程复核**：已读 `AudioEngine.tsx:292-314`、`EnhancedAudioPlayer.tsx:190-236`；`grep` 确认 `setIsBuffering` 无调用。

#### correctness-3：拖动进度条被 pointercancel 取消时仍会提交一次 seek

- **文件/行号**：`src/components/audio/EnhancedAudioPlayer.tsx:108-113`
- **触发条件**：在进度条上按下并拖动后，浏览器派发 `pointercancel`（触摸手势被系统/浏览器接管、指针捕获丢失、来电等中断），此时 `isDraggingRef.current` 仍为 true。
- **证据**：
  - 进度条把 `onPointerUp` 和 `onPointerCancel` 都绑定到同一个 `handleInputEnd`（`EnhancedAudioPlayer.tsx:215-216`）。
  - `handleInputEnd` 只判断 `isDraggingRef.current`，随后无条件执行 `handleSeekDebounced(dragTimeRef.current, true)`，把拖动过程中的最后一个 `dragTime` 作为 seek 提交；没有任何取消分支。
- **影响**：用户取消了拖动却仍会跳转到拖动最后位置，播放位置被意外改变；移动端上会造成歌词/模型与音频同步跳变，且没有视觉提示可以撤销。
- **置信度**：0.7
- **验证方法**：开始拖动进度条后手动派发 `PointerEvent('pointercancel')`，或在触摸设备上触发系统手势取消；观察 `onSeek` 被调用、播放位置跳到 `dragTime`。
- **修复方向**：为 `onPointerCancel` 增加独立取消处理，重置 `isDraggingRef`/`dragTime` 并恢复显示时间；只有 `onPointerUp` 提交最后一次 `dragTime`。
- **主线程复核**：已读 `EnhancedAudioPlayer.tsx:99-113`、`EnhancedAudioPlayer.tsx:199-227`，确认两个事件共用同一提交函数。

#### correctness-4：切换曲目时清理副作用会先抹掉 React 刚写入的新 src，可能导致音频请求发起两次

- **文件/行号**：`src/components/audio/AudioEngine.tsx:86-97`
- **触发条件**：用户切换项目导致 `audioSrc`（或 `sessionRevision`）变化，且浏览器在 React 提交阶段已因新 `src` 启动资源加载。
- **证据**：
  - React 在提交阶段把 `<audio src={audioSrc}>`（`AudioEngine.tsx:495`）的新属性写入 DOM。
  - 随后 `[audioSrc, sessionRevision]` 的被动副作用清理（第 92-96 行）执行 `audio.pause()`、`audio.removeAttribute('src')`、`audio.load()`，把刚提交的新 src 清掉并中止加载。
  - 紧接着新副作用体（第 88 行）判断 `getAttribute('src') !== audioSrc` 后重新设置 `audio.src`，于是同一资源被重新发起请求。
  - 第 89-90 行注释明确说“设置 src（包括 React 的初始 DOM 提交）会启动原生加载；这里再次 load 会取消并重复下载”，但清理阶段实际执行了 `removeAttribute('src') + load()`。
- **影响**：切曲时可能先发起再中止一次音频请求，浪费带宽与服务端连接；在慢网/限量网络上会推迟真正可播放的时间，并可能造成一次多余的元数据状态抖动。
- **置信度**：0.65（依赖浏览器在被动清理前是否已启动网络请求；DOM 顺序本身是确定的）
- **验证方法**：Network 面板切换曲目，观察同一 audio 资源请求出现 “canceled” 后再次发起；或在第 92-96 行与第 88 行加日志，确认 `removeAttribute/load` 发生在 React 设置新 src 之后、第 88 行重新赋值之前。
- **修复方向**：清理副作用只在元素当前 src 仍属于即将卸载的源时才移除；或把“停旧源”和“设置新源”拆开，cleanup 仅 `pause()`，由新 effect 负责换源，避免撤销 React 已提交的属性。
- **主线程复核**：已读 `AudioEngine.tsx:86-97`、`AudioEngine.tsx:492-500`；React 提交与被动清理的先后顺序可静态确认，网络请求是否已启动需运行时验证，故置信度不高。

## 4. 三个子 agent 的独立结果附录

以下为三个子 agent 的原始 JSON，未改写；行号均按基准副本。

### correctness

```json
{"reviewer":"correctness","findings":[{"id":"correctness-1","priority":"P2","title":"音频加载失败在重试耗尽后只进控制台，用户界面永久卡在不可播放状态","file":"src/components/audio/AudioEngine.tsx","start_line":415,"end_line":432,"confidence":0.72,"trigger":"进入曲目后音频元素请求失败（网络中断、服务端 403/404、返回不可解码内容、Range 探测通过但整段资源不可用）。准备阶段 prepareAudio 只做 bytes=0-0 探测，且在 config.assets.audio.duration 为有限正数时直接返回该声明时长（src/config/prepareProject.ts:21-27），不会构造 Audio 元素验证可解码性，所以这类失败会推迟到 AudioEngine 的 <audio> 元素上暴露。","evidence":"handleAudioError（415-432）在 !isReady 且 startupRetriesRef<2 时最多重试两次（改 audio.load），否则仅 console.error 后返回；AudioEngineProps（5-23）没有任何错误回调，handleAudioError 也不调用 onReady/onPlayStateChange/父级错误通路。ReadingSession 只有 handleAudioReady 会 setIsReady(true)（src/components/ReadingSession.tsx:390-393），isBuffering/错误状态未接；EnhancedAudioPlayer 播放按钮 disabled={(!isReady && !isPlaying) || isBuffering}（src/components/audio/EnhancedAudioPlayer.tsx:169），所以失败后按钮永久禁用，页面无错误文案。","impact":"用户点击进入后音频始终不开始，播放按钮保持禁用、界面无任何错误提示，也没有重试入口；已通过 handleUserInteraction 写入的 pendingAudioSeek 也不会被确认，commitTimeUpdate 的非 force 更新会持续被 pendingAudioSeek 丢弃（src/components/ReadingSession.tsx:192-194），歌词/时间轴停在 0，整首曲目不可用。","verification":"DevTools 中把 audioSrc 请求置为 offline/返回损坏 mp3，进入曲目；控制台可见 “[AudioEngine] Initial audio request failed; retry 1/2”“retry 2/2” 最后 “Audio error”，同时 React state 中 isReady 始终 false、播放按钮 disabled、页面无 role=alert 或错误文字。","suggested_fix":"为 AudioEngine 增加 onError（以及可选的 onBufferingChange）回调，在重试耗尽和永久错误时上报错误码/消息；ReadingSession 保存 audioError 状态并通过 ClassicControls/内联提示展示并提供重试（重新 load 或重新 prepareProject）；不要让失败停在 console 层。"},{"id":"correctness-2","priority":"P3","title":"缓冲状态在 AudioEngine 内计算后从未上报，播放器缓冲 UI 永远不触发","file":"src/components/audio/AudioEngine.tsx","start_line":292,"end_line":314,"confidence":0.85,"trigger":"网络受限或缓冲不足时播放：handleTimeUpdate 中 buffered.end(last) - newTime < 2 成立。","evidence":"handleTimeUpdate（292-314）把结果写入 stateRef.current.isBuffering = isBuffering（309），但 AudioEngineProps（5-23）没有 onBufferingChange，stateRef 的该字段在组件其余代码中从未被读取或上报。ReadingSession 的 const [isBuffering, setIsBuffering] = useState(false)（src/components/ReadingSession.tsx:105）在整个文件中没有 setIsBuffering 调用（grep 仅命中 105 行声明与 902 行传参），所以 EnhancedAudioPlayer 的 isBuffering 恒为 false；其缓冲 spinner（src/components/audio/EnhancedAudioPlayer.tsx:230-236）、按钮缓冲态（174）和进度条禁用（222）均为死代码。","impact":"播放卡顿/等待数据时用户看不到加载提示，播放按钮与进度条仍显示为可交互，用户会误以为已卡死；并且在缓冲期间无法通过禁用 seek 避免连续无效跳转。","verification":"在 DevTools 中把网络降到极慢，播放时在 handleTimeUpdate 里加日志或用 React DevTools 观察：isBuffering 局部变量会变为 true，但 ReadingSession 的 isBuffering state 始终 false、UI 无 spinner。","suggested_fix":"新增 onBufferingChange(boolean) 回调并在 isBuffering 变化时调用；ReadingSession 用 setIsBuffering 接入；或让 AudioEngine 直接暴露状态订阅，避免逐帧 setState。"},{"id":"correctness-3","priority":"P3","title":"拖动进度条被 pointercancel 取消时仍会提交一次 seek","file":"src/components/audio/EnhancedAudioPlayer.tsx","start_line":108,"end_line":113,"confidence":0.7,"trigger":"在进度条上按下并拖动后，浏览器派发 pointercancel（触摸手势被系统/浏览器接管、指针捕获丢失、来电等中断），随后 isDraggingRef.current 仍为 true。","evidence":"进度条同时把 onPointerUp 和 onPointerCancel 绑定到同一个 handleInputEnd（src/components/audio/EnhancedAudioPlayer.tsx:215-216）。handleInputEnd（108-113）只判断 isDraggingRef.current，随后无条件执行 handleSeekDebounced(dragTimeRef.current, true)，即把拖动过程中的最后一个 dragTime 作为 seek 提交；没有任何取消分支。","impact":"用户取消了拖动（例如手势被浏览器中断）却仍会跳转到拖动最后位置，播放位置被意外改变，且没有视觉提示可以撤销；在移动端配合 ReadingSession 的一次性 handleSeek 会造成歌词/模型与音频同步跳变。","verification":"在浏览器中开始拖动进度条后手动派发 PointerEvent('pointercancel')，或在触摸设备上触发系统手势取消；可观察到 onSeek 被调用、播放位置跳到 dragTime（handleInputEnd 的 immediate seek 分支）。","suggested_fix":"新增独立的 cancel 处理（重置 isDraggingRef/dragTime 并恢复 displayTime），onPointerCancel 只取消不提交；仅 onPointerUp 提交最后一次 dragTime。"},{"id":"correctness-4","priority":"P3","title":"切换曲目时清理副作用会先抹掉 React 刚写入的新 src，导致音频请求发起两次","file":"src/components/audio/AudioEngine.tsx","start_line":86,"end_line":97,"confidence":0.65,"trigger":"用户切换项目导致 audioSrc（或 sessionRevision）变化。","evidence":"audioSrc 变化时，React 先在提交阶段把 <audio src={audioSrc}>（495 行）的 src 属性写入 DOM，浏览器据此启动新资源加载；随后 [audioSrc, sessionRevision] 的被动副作用清理（92-96）执行 audio.pause()、audio.removeAttribute('src')、audio.load()，把刚提交的新 src 清掉并中止该次加载；紧接着新副作用体（88 行）判断 getAttribute('src') !== audioSrc 后重新设置 audio.src，于是同一资源被重新发起一次请求。88 行注释本意是“不要重复下载”，但清理阶段的 removeAttribute('src')+load() 恰好造成注释想避免的第二次加载。","impact":"每次切曲都会先发起再中止一次音频请求，浪费带宽与服务端连接，在慢网/限量网络上会推迟真正可播放的时间；若新 src 的 loadedmetadata 恰在清理前到达，还可能出现一次多余的 onDurationChange 后又被重置重载，增加状态抖动。验证：网络面板中切曲可见同一音频的请求被 cancel 后又出现一条新请求。","verification":"Network 面板切曲，观察 audio 资源请求出现 “canceled” 后再次发起；或在 92-96 行与 88 行加日志，确认 removeAttribute/load 发生在 React 设置新 src 之后、88 行重新赋值之前。","suggested_fix":"清理副作用里只在元素当前 src 仍属于即将卸载的源时才 removeAttribute/load；更稳妥的是把“换源/停旧源”与“设置新源”拆开，或在 cleanup 中仅 pause() 并依赖新 effect 的赋值，避免 removeAttribute 撤销 React 已提交的属性。"}],"residual_risks":["transmissionUpdateRegion 的裁剪区域只由 opaque 对象的包围盒推导（src/rendering/transmissionUpdateRegion.ts:49-110），要求透明外壳（transmissive 对象）的屏幕覆盖范围不超出内层 opaque 包围盒加 3 像素；本轮未验证真实 jade 资产的 outer 壳层几何/偏移是否满足该包含关系，若不满足会采样到未更新的 transmission target 像素。","区域渲染补丁只在 opaque.length===1 且 transmissive.length===1 时启用；若歌词或其它辅助 mesh 进入 opaque 列表，优化会静默退回全量路径，行为虽安全但无法从代码确认实际场景的列表数量。","AudioEngine 的启动重试定时器在 load() 后重新触发 error 的链路上依赖 startupRetriesRef 计数与 canplay 清定时器；离线→恢复网络的边界时序（定时器回调与 canplay 竞争）未在本轮静态审阅中验证。","prepareProject 在 abort 路径 catch 中立即 release() 模型保留引用，但并发中的 preloader.loadModel(initialModel) 可能仍在飞；late resolve/reject 是否会重新占用或影响已释放的引用取决于 ModelPreloader 内部实现，本轮未展开验证。","src/hooks/useLyricsFromConfig.ts 的私有 parseLRC 与 src/config/lyrics.ts 的权威解析器规则不一致（要求两位分钟与 2-3 位小数、不校验秒数/空唱词）；当前该 hook 无调用方（grep 仅命中自身），一旦接入会产生与配置解析不同的时间轴结果。"],"testing_gaps":["没有任何自动化覆盖音频启动失败重试耗尽后的用户可见结果（isReady 仍为 false、错误提示、可重试入口）。","没有覆盖 prepareProject/prepareAudio 的 abort 竞争：快速连续 loadProject、30s 超时、切曲时 Promise.race 与 Promise.all 的收尾（release 与 listener 移除）。","没有覆盖 AudioEngine 在 audioSrc/sessionRevision 变化时的资源生命周期（是否重复请求、readyState/onReady 是否被重置、旧 seek 的 seeked 是否清除新 seek 的保护）。","没有覆盖 EnhancedAudioPlayer 的 pointercancel、键盘 Home/End/Arrow/Shift+Arrow 的边界行为（0 与 duration 处跨 cycle 的取整）。","transmission region 的单测只在合成 fixture 上验证包围盒/裁剪数学与补丁文本，没有断言该 provider 在真实 UnifiedLyricsAndModel/Jade 场景中真正启用（opaque=1、transmissive=1）及 transmissive 外壳落在更新区域内。"]}
```

### rendering

```json
{"reviewer":"rendering","findings":[],"residual_risks":["区域透射仅在 `transmissiveObjects`/`opaqueObjects` 各恰为 1、正交相机、scene.background 为 null、clearAlpha<1、WebGL2 且无 WEBGL_multisampled_render_to_texture 时生效；任一条件不满足即整帧回退全量更新，故正确性依赖这些守卫与 Three 渲染列表分类保持一致，未来若在主管线新增不透明或透射网格需重新评估。","`deploy/three-transmission-region.mjs` 以固定源码 SHA-256 校验 node_modules/three/build/three.module.js（`package.json` 中 three 为 ^0.160.0，需实际安装 0.160.1 才通过），并依赖 `state.scissor`、`isWebGL2`、`extensions.has`、`_this.xr.isPresenting` 等内部符号；基准副本无 node_modules，无法逐字核对补丁与 Three 0.160.1 源文件的插入位置和签名，需在可构建环境中确认补丁实际生效。","区域矩形按上一次可用的遮挡覆盖做并集，遮挡网格被剔除/透明/被替换导致 provider 提前返回 null 时只置 valid=false 并保留旧的 left/bottom/right/top；该路径下一帧必然走全量更新，但若未来改动去掉 `!this.valid` 全量条件，旧矩形会带来错误裁剪，属于需要保持的隐含不变量。","`TransmissionRegionRendering` 通过给 renderer 实例挂 `transmissionUpdateRegion` 注入、并在卸载时恢复 previous；依赖 useLayoutEffect 清理顺序和仅主 Canvas 安装。若同一 renderer 挂载多个实例或 gl 在不清算旧实例时重建，注入状态可能与预期不一致（当前受管调用方只挂载一次）。","`preparedModels` 的预计算路径在 `DecompressionStream` 缺失、fetch/完整性校验/解码失败时静默回退到 OBJ/GLTF 加载；回退路径在运行时同步执行 mergeVertices/偏移几何生成，可能造成首帧卡顿，但功能上不丢模型。"],"testing_gaps":["缺少针对 `TransmissionUpdateRegion` 的单元测试，覆盖：相机投影/视图矩阵变化、几何或材质身份变化、position.version 变化、宽高变化、旧矩形并集、边界钳制与 8 个包围盒角点投影到物理像素的换算（含 dpr≠1）。","缺少受管集成用例验证区域透射的视觉等价性：旋转中遮挡网格的残影像素、透明歌词存在时的分类、showInnerLayer/showOuterLayer 关闭、模型切换加载失败保留前一对几何体等场景与全量更新路径的逐像素对比。","`next.config.mjs` 中 Three 补丁与 webpack `three$` 别名缺少构建期/CI 校验用例（版本不符或 SHA 不匹配时应显式失败、补丁后模块被 R3F/drei/examples 共享同一实例），本轮未执行构建故未验证。","缺少 ModelPreloader 预计算模型路径与 OBJ 回退路径的等价性测试（同一模型两条路径的 base/outer 几何顶点数据、包围盒与预设外扩偏移是否一致）。","缺少对 `getOffsetGeometry` 失败回退（catch 中把 baseGeometry 存入 offset 缓存）以及 offset 缓存被 trimCache 回收时仍被网格引用场景的覆盖。"]}
```

### validation

```json
{"reviewer":"validation","findings":[{"id":"validation-1","priority":"P2","title":"Browser region regression never asserts the recorded pixel differences","file":"test/runtime/transmission-region-browser.mjs","start_line":58,"end_line":67,"confidence":0.7,"trigger":"Run compareRegionModel with a regression that makes the provider return a too-small or otherwise incorrect rectangle (for example dropping the previous-frame union or the 3px padding) while still returning a non-null rect for every pose.","evidence":"Lines 58-62 render every pose and compute changedPixels/maxChannelDifference/meanChannelDifference against full-update references, but the only failure condition is line 66 `if(q.partial<poses.length)throw ...`. The computed pixel differences are merely returned in `result`; no module in the repository imports compareRegionModel, so no in-repo assertion consumes them. A wrong/under-covering rect still yields partial===poses.length and the helper resolves successfully.","impact":"Transmission trails and stale opaque pixels can ship while the only end-to-end region check reports success; visual correctness of the partial update is not actually gated.","verification":"Temporarily make the provider return a 1x1 rectangle (or remove the union with the previous pose) and run the browser helper: it returns frames with nonzero maxChannelDifference and does not throw. A correct assertion should fail on those frames.","suggested_fix":"After each pose throw when changedPixels or maxChannelDifference exceeds a small tolerance (and assert q.full===0 for the sequence), or add a runner that asserts the returned frames against documented bounds."},{"id":"validation-2","priority":"P2","title":"Adapter correctness is tested only as text; no test executes the patched Three module","file":"test/runtime/transmission-region.test.mjs","start_line":96,"end_line":114,"confidence":0.65,"trigger":"Introduce an integration regression that keeps all asserted strings but breaks behavior, e.g. swap width/height in the provider call at deploy/three-transmission-region.mjs:55, stop resetting `_transmissionRegionNeedsFullUpdate` on context restore (line 27-29), or skip enabling the scissor before `_this.clear()` (the test only checks clear before scissor(false)).","evidence":"The test imports patchThreeTransmissionRegion (line 9) and applies it to source text (line 98); lines 99-114 assert source-SHA rejection, byte equality of a slice, literal token counts and two ordering relations. It never imports the generated `.cache/three-transmission-region/*.mjs` and never renders. The only executing test of the patched renderer is test/runtime/transmission-region-browser.mjs, which is not matched by package.json:18 `node --test test/runtime/*.test.mjs` and is imported by no other file (only self-references for installRegionRegression/compareRegionModel/disposeRegionRegression).","impact":"The adapter can regress at runtime (wrong provider arguments, stale full-update flag, missing scissor/clear ordering) while `npm run test:runtime` still passes; the acceptance claim that the adapter is pinned and preserves behavior is stronger than the actual coverage.","verification":"Change the provider invocation in deploy/three-transmission-region.mjs to `provider( opaqueObjects, transmissiveObjects, scene, camera, _vector2.y, _vector2.x )` and run `node --test test/runtime/transmission-region.test.mjs`: it still passes because argument order is not asserted and the patched module is never executed.","suggested_fix":"Add a test that imports/transpiles the patched module (or extracts renderTransmissionPass into a testable function) and drives it with fake renderer/provider/state objects, asserting provider width/height, the full-update invalidation after simulated context restore and target resize, and scissor/clear ordering."}],"residual_risks":["deploy/package-release.mjs:61 classifies every non-audio public/ file as an asset, while deploy/release-lib.mjs:114-115 only admits assets under _next/static|fonts|models|textures|lyrics|projects|images; a future root-level public asset (favicon/og image) would abort release:package after the full build instead of failing early.","test/runtime/transmission-region-browser.mjs:4-8 requires exactly two R3F stores and one transmission===0 plus one transmission>0 physical mesh; if another opaque/transmissive physical mesh is added the helper throws or the region path silently disables, with no assertion that the production page actually took the partial path.","The exact rect numbers in transmission-region.test.mjs:50-57 and the window.__renderProbe/window.__coscrollPerf dependencies in transmission-region-browser.mjs couple validation to test-only instrumentation that production does not guarantee, so they can silently stop representing the shipped renderer."],"testing_gaps":["test/runtime/transmission-region.test.mjs:85-94 only exercises permanent rejection states; no case restores a supported state (side=FrontSide, background=null, userData, boundingBox, position version) after a rejected frame to prove `this.valid=false` forces a full update before partial updates resume.","Rejection branches at src/rendering/transmissionUpdateRegion.ts:43-61 for width<1/height<1, scene.overrideMaterial!==null, material.displacementMap, isInstancedMesh, missing position/'version', and non-physical opaque material are untested.","test/deploy/release.test.mjs exercises release-lib offline but never runs verify-release.mjs against preview-release.mjs, so HTTP stored/decoded hashes, content-encoding, MIME, cache policy, CORS, media Range 206/content-range and canonical/missing-resource behavior are untested.","The adapter's `_transmissionRegionNeedsFullUpdate` transitions (provider identity change, render-target size change, webglcontextrestored reset) are only checked by source-string assertions, never behaviorally; the context-restore event wiring in src/rendering/TransmissionRegionRendering.tsx:15-18 is untested."]}
```

## 5. 残余风险

以下不是已确认的实际缺陷，主线程未逐条动态验证；按主题去重后保留。

1. **区域透射启用条件很窄，且会静默回退**：只有 `opaque.length===1`、`transmissive.length===1`、正交相机、`scene.background===null`、`clearAlpha<1`、WebGL2 且无 `WEBGL_multisampled_render_to_texture` 时才启用；任一条件不满足即全量更新。行为安全，但若未来新增不透明/透射 mesh，优化可能静默失效，需要重新评估守卫与渲染列表分类。来源：rendering、correctness。

2. **区域矩形只由 opaque 包围盒推导，未验证 outer 壳层包含关系**：`src/rendering/transmissionUpdateRegion.ts:49-110` 只投影 opaque 对象的包围盒；要保证正确，transmissive 外壳的屏幕覆盖不能超出该包围盒加 3px。真实 jade 资产的 outer 偏移/壳层几何是否满足该条件未验证；不满足时会采样到未更新的 transmission target 像素。来源：correctness。

3. **Three 补丁依赖固定源码 SHA 与内部符号**：`deploy/three-transmission-region.mjs:8-9` 固定 `0.160.1` 的源码哈希，并依赖 `state.scissor`、`isWebGL2`、`extensions.has`、`_this.xr.isPresenting` 等内部符号；副本无 `node_modules`，无法逐字核对补丁插入位置。若实际安装版本或 Three 内部实现变化，构建期应失败，但本轮未验证。来源：rendering。

4. **旧矩形并集的隐含不变量**：provider 在遮挡网格被剔除/透明/替换时只置 `valid=false` 并保留旧 `left/bottom/right/top`；当前下一帧必然全量更新，所以安全。但如果未来改动去掉 `!this.valid` 全量条件，旧矩形会造成错误裁剪。来源：rendering。

5. **provider 注入依赖单实例生命周期**：`TransmissionRegionRendering` 通过给 renderer 实例挂 `transmissionUpdateRegion` 注入，并在卸载时恢复 previous；当前受管调用方只挂载一次，但同一 renderer 多实例或 gl 重建时可能不一致。来源：rendering。

6. **浏览器 helper 与测试专用探针的耦合**：`transmission-region-browser.mjs:4-8` 要求恰好两个 R3F store、一个 `transmission===0` 和一个 `transmission>0` 的 physical mesh；`window.__renderProbe`、`window.__coscrollPerf` 不是生产保证的接口。新增 mesh 或移除探针会使验证静默失去代表性。来源：validation。

7. **发布打包的 public 根级资源会晚失败**：`deploy/package-release.mjs:61` 把所有非 audio 的 `public/` 文件归为 `assets`，而 `deploy/release-lib.mjs:114-115` 只接受 `_next/static|fonts|models|textures|lyrics|projects|images` 前缀；未来新增 favicon/og image 等根级资源会在完整构建后才报错。来源：validation（主线程已核对行号与逻辑）。

8. **音频重试定时器与 canplay 的竞争**：`handleAudioError` 的 `startupRetryTimerRef` 依赖 `startupRetriesRef` 计数与 `handleCanPlay` 清定时器；离线→恢复网络的边界时序（定时器回调与 canplay 竞争）未静态验证。来源：correctness。

9. **`prepareProject` abort 与 preloader 在飞请求**：abort 路径立即 `release()` 模型保留引用，但并发中的 `preloader.loadModel(initialModel)` 可能仍在飞；late resolve/reject 是否影响已释放引用取决于 `ModelPreloader` 内部实现，未展开。来源：correctness。

10. **私有 `parseLRC` 与权威解析器规则不一致**：`src/hooks/useLyricsFromConfig.ts` 的私有解析器要求两位分钟、2-3 位小数，且不校验秒数/空唱词；当前该 hook 无调用方，一旦接入会产生与 `src/config/lyrics.ts` 不同的时间轴结果。来源：correctness。

11. **preparedModels 回退路径的首帧成本**：`DecompressionStream` 缺失、fetch/完整性校验/解码失败时静默回退到 OBJ/GLTF，回退时同步执行 `mergeVertices`/偏移几何生成，可能首帧卡顿，但功能上不丢模型。来源：rendering。

## 6. 测试缺口

以下为未覆盖场景，不等于已确认缺陷；已列为 finding 的 validation-1/validation-2 不再重复展开。

1. **区域状态恢复**：`transmission-region.test.mjs:85-94` 只测永久拒绝状态；没有在拒绝后恢复支持状态（`side=FrontSide`、`background=null`、`userData`、`boundingBox`、position version），证明 `valid=false` 会先强制一次全量更新再恢复部分更新。来源：validation。

2. **拒绝分支覆盖不足**：`src/rendering/transmissionUpdateRegion.ts:43-61` 的 `width<1/height<1`、`scene.overrideMaterial!==null`、`material.displacementMap`、`isInstancedMesh`、缺少 position/`version`、opaque 非 physical 材质等分支没有对应用例。来源：validation。

3. **真实场景启用与外壳包含**：没有自动化用例断言 provider 在真实 `UnifiedLyricsAndModel`/Jade 场景中确实以 1 opaque + 1 transmissive 启用，也没有验证 transmissive 外壳落在更新区域内；`dpr≠1` 没有显式用例。来源：validation、correctness、rendering。

4. **适配器行为**：context restore、render-target resize、provider identity 变化、scissor/clear/blit 顺序只被源码字符串断言覆盖，未被行为测试执行。来源：validation、validation-2。

5. **像素级视觉等价**：没有自动断言 `changedPixels`/`maxChannelDifference`；浏览器 helper 目前只提交“区域路径执行次数”，差异数据留给人工解读。来源：validation-1。

6. **音频失败与交互边界**：没有自动化覆盖启动失败重试耗尽后的用户可见结果、`isBuffering` 上报、`pointercancel`、键盘 Home/End/Arrow/Shift+Arrow 在 0 与 duration 边界的取整。来源：correctness。

7. **异步资源生命周期**：没有覆盖 `prepareProject`/`prepareAudio` 的 abort 竞争（快速连续 loadProject、30s 超时、切曲时 `Promise.race`/`Promise.all` 收尾），也没有覆盖 `AudioEngine` 在 `audioSrc/sessionRevision` 变化时是否重复请求、readyState/onReady 是否重置、旧 seek 的 `seeked` 是否清除新 seek 保护。来源：correctness。

8. **发布验证的 HTTP 行为**：`test/deploy/release.test.mjs` 只离线测试 `release-lib`，没有让 `verify-release.mjs` 对 `preview-release.mjs` 运行，因此存储/解码哈希、content-encoding、MIME、缓存策略、CORS、媒体 Range 206/content-range、canonical/缺失资源行为均未覆盖。来源：validation。

9. **模型加载回退等价性**：没有测试 prepared 模型路径与 OBJ/GLTF 回退路径的 base/outer 顶点数据、包围盒与预设外扩偏移是否一致；也没有覆盖 `getOffsetGeometry` 失败回退和 offset 缓存被 `trimCache` 回收时仍被网格引用的场景。来源：rendering。

### 关于 rendering 测试缺口的核查说明

rendering 子代理第 1 条 testing_gap 称“缺少针对 `TransmissionUpdateRegion` 的单元测试”。主线程核对后认为该条不成立：仓库实际存在 `test/runtime/transmission-region.test.mjs`，并覆盖了相机投影/视图变化、几何/材质/宽高变化、旧矩形并集、边界钳制以及旋转/非均匀缩放下的八角点投影。该条不采纳；其中“`dpr≠1` 没有显式用例”这一子项保留在第 6 节第 3 条。rendering 其余关于真实资产外壳包含、ModelPreloader 回退等价性的缺口保留为参考。

## 7. 结论

- 未发现 P0/P1 缺陷。最终 6 条 findings：3 条 P2、3 条 P3。
- 产品/运行行为方面，最值得优先处理的是 **correctness-1**：音频加载失败后没有用户可见错误和重试入口，播放器永久禁用。其余三条 P3 分别涉及缓冲状态未上报、`pointercancel` 误提交 seek、切曲时可能的重复音频请求。
- 验证方面，**validation-2** 说明核心 Three 补丁没有行为级自动化测试；**validation-1** 说明区域路径的像素差异没有自动断言。两者不会直接改变运行时行为，但会削弱“区域透射已验收”的主张。
- rendering 子代理返回 0 条证据充分的缺陷。主线程对 `transmissionUpdateRegion.ts`、`TransmissionRegionRendering.tsx`、`three-transmission-region.mjs` 和 `next.config.mjs` 的定点复核未发现新的、可沿真实路径证明的渲染缺陷；主要风险集中在启用条件、真实资产外壳包含关系和测试覆盖，而非当前代码的确定性错误。
- 本轮未执行构建、测试、浏览器或网络验证；所有验证方法均需在可构建环境中复核。
