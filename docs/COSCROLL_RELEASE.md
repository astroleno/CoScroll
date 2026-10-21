# CoScroll：aitoshuu.me/coscroll 发布

沿用 fv_slide / LuBirth 的基础设施：阿里云 Nginx 提供 HTML、Next 静态路由载荷和版本标记；
腾讯上海私有 COS 桶 `tongye-1327162705` 存放不可变对象。
JS、CSS、字体、OBJ、HDR、图片、歌词和项目 JSON 使用 `assets.aitoshuu.me`；音频使用 `media.aitoshuu.me`。
对象全部位于 `releases/aitoshuu-me/coscroll-<source-digest>/`，不覆盖已有对象。
发布脚本启用静态导出；普通 `npm run build` / `npm run start` 保留 Next 的本地生产预览方式。

当前线上版本为 `coscroll-f4c036bd83d4ce9e`，两个入口为 `aitoshuu.me/coscroll/` 和
`tongye.me/coscroll/`。最新复测、发布身份与回滚记录见
[2026-10-21 完整模型预计算验收](MODEL_PRECOMPUTE_RELEASE_20261021.md)。
[此前手机渲染优化](MOBILE_RENDER_RELEASE_20261021.md)、
[此前公网复测](PUBLIC_RELEASE_20261021.md)及更早发布记录保留如下。

## 本地候选验证

```sh
npm run test:deployment
npm run test:runtime
npm run release:package -- --profile local --output .cache/releases/local-1
npm run release:preview -- .cache/releases/local-1
# 在另一个终端运行完整 HTTP、哈希、MIME、缓存、CORS 和全部 MP3 Range 检查：
npm run release:verify -- .cache/releases/local-1 --local
```

预览只监听本机：页面 `http://127.0.0.1:4318/coscroll/`，资源、音频分别使用 4319 和 4320 端口。
浏览器验证桌面和手机尺寸的模型、歌词、播放、暂停、拖动与滚动同步。
回退回归：暂停播放后向后滚动，停止滚动后音频实际位置与进度条应一致；恢复播放从新位置继续。
本地与 CDN 候选具有不同构建身份；本地候选不能用于生产上传或源站计划。

## 生成正式候选与离线计划

```sh
npm run release:package -- --profile cdn --output .cache/releases/cdn-1
node deploy/verify-package.mjs .cache/releases/cdn-1 --production
python3 deploy/upload-cos-release.py .cache/releases/cdn-1
npm run release:plan -- .cache/releases/cdn-1
```

这些命令只在本机生成文件和检查计划，不上传 COS、不读取凭据、不修改源站。
发布身份包含源文件、锁文件、构建与部署配置、精确 Node/Next 版本和交付模式；
构建期间输入发生变化会失败。所有交付文件记录 SHA-256、大小、MIME、缓存规则和 channel。
备份、source map 和系统垃圾文件不进入交付包。Inter 已随应用打包，许可证在 `public/fonts/OFL-Inter.txt`。

主页面使用原字体完整字库的 WOFF2，旧实验页仍可引用 TTF。重新生成时使用隔离依赖：

```sh
python3 -m pip install --no-cache-dir --target .cache/font-tools -r deploy/font-requirements.txt
PYTHONPATH=.cache/font-tools PYTHONDONTWRITEBYTECODE=1 python3 deploy/compress-font.py
```

压缩器逐一验证全部 8106 个字形的轮廓、字符映射和字宽，不裁剪字库。
TTF 为 6,048,788 字节，WOFF2 为 2,447,968 字节。主页面在字体规则挂载后等待字体载入，
再刷新歌词纹理；透明度、颜色和边缘羽化由材质处理，避免每帧重新绘制、上传文字纹理。
当前模型与下一个不同的模型共享下载和解析缓存，首访不再并发加载整套模型。

现有 26 个 OBJ 的完整基础几何和默认外层数据由离线工具生成：

```sh
npm run models:prepare
npm run models:check
```

生成器与自定义参数回退共用 `modelGeometry.ts` 的原算法；默认参数为
`outerOffset=.001, maxEdge=.15, subdivisions=0, creaseAngle=30, smoothShading=true`。
属性和索引按原始类型、完整字节保存，经可逆字节预测和 gzip 压缩，不减面、不量化。
`public/models/prepared/` 保存数据，`prepared-models.json` 记录源文件、生成流程与产物哈希。
发布打包前自动检查来源、生成器、锁文件、数据完整性及文件集合，过期时拒绝构建。

运行时仅按当前/下一模型读取数据，校验 SHA-256 后异步解压并填入两层几何缓存；
`loadModel/getOffsetGeometry` 和配置接口保持原签名。外部自定义模型、非默认几何参数、
缺少原生解压能力或预计算资源失败时继续使用原算法；原 OBJ 因此保留。
全部模型的基础/外层属性字节及自定义参数结果，对照提取算法前保存的独立校验值回归。

## 经批准后发布

1. 核对候选 release ID、`artifactClosureSha256`、COS 对象范围、Nginx 增量及回滚目标。
2. 必要时安装隔离的上传依赖：
   `python3 -m pip install --no-cache-dir --target .cache/cos-sdk -r deploy/requirements.txt`。
3. 用既有 Keychain 服务 `fv-slide-cos-upload` 在上传进程内取凭据：
   `PYTHONPATH=.cache/cos-sdk python3 deploy/upload-cos-release.py <cdn-package> --apply`。
   上传先 HEAD 比对；新对象使用禁止覆盖标志；冲突停止。凭据不进入日志、清单或前端。
4. `node deploy/verify-release.mjs <cdn-package> --cdn-only` 验证全部 CDN 对象。
5. 将 `web/` 完整暂存到 `/www/wwwroot/coscroll-releases/<release-id>/web`，逐文件比对哈希。
   保留 Next 导出的 `.txt` 路由载荷；不能按 LuBirth 的两文件规则删掉它们。
6. 首次接入时才给现有 `html_aitoshuu.me.conf` 增加 `/coscroll` 路由；后续更新只切换 CoScroll 入口。
   保留现网安全响应头、TLS、首页和 LuBirth 配置。
   `stage-origin.mjs` 提供路由语义草案；实际配置须与现网合并、备份并通过 `nginx -t`。
7. 原子切换 `/www/wwwroot/coscroll-current`，必要时 reload Nginx。
8. `node deploy/verify-release.mjs <cdn-package>` 验证公网文件、重定向、404、缓存和邻站；再做浏览器交互检查。

首次上线前保存现网 vhost 的完整备份和基线。更新时回滚只切回旧 `coscroll-current`；
首次接入失败则还原新增路由和旧入口状态。COS 不可变对象保留，不把删除当作回滚。
云端上传、修改配置和正式切换须在对应发布批准后执行；离线计划本身不授予这些权限。

## 2026-10-20 生产发布记录

- 公网入口：<https://aitoshuu.me/coscroll/>。
- 版本：`coscroll-11630f6d25848056`；交付闭包 SHA-256：
  `78558eaed4d3a88f47b123f6bf0c6fd7a98c84fed53bd1dc673044ab1eaffa51`。
- COS 新增 114 个对象（含清单），资源继续使用既有 assets / media CDN；共享策略保持原样。
- 源站入口：`/www/wwwroot/coscroll-current` →
  `/www/wwwroot/coscroll-releases/coscroll-11630f6d25848056/web`，共 71 个文件。
- 从既有服务器的独立公网出口逐项验证 184 个交付文件的哈希、MIME、缓存和 CORS；
  3 个音频的 206 分段响应、范围、内容均通过。规范跳转保留查询参数，缺失资源返回 404。
  本机网络恢复后，标准 `verify-release.mjs` 也完整通过上述 184 文件和 3 音频检查。
- 公网浏览器已验证桌面播放、暂停、进度跳转、暂停后向后滚动与续播；
  手机模拟 390 × 844、DPR 2 验证显示、进度条触摸拖动与跳转后续播。主页面未捕获运行错误。
- 首页和 LuBirth 的发布入口及页面哈希与上线前一致。
- 首次接入的完整配置备份：
  `/www/server/panel/vhost/nginx/html_aitoshuu.me.conf.coscroll-11630f6d25848056.bak`；
  原配置 SHA-256：`1385b4d75199e0e3fde743f1d0b37fbcc3fc719e7161e6972df6a5e9e090bda9`；
  本次生效配置 SHA-256：`7263c4f493b541e88eb85c6d911ea1246570fe20ddd97eabc365fa2d82e4f43e`。

本次操作证据保存在 `.cache/production-coscroll-11630f6d25848056/`。
首次接入的回滚工具 `.cache/production-origin.py rollback` 会先核对当前配置与入口，
再恢复备份、验证配置、重载 Nginx 并移除本次入口；配置发生后续变化时拒绝覆盖。

CDN 可能重排 Cache-Control 指令，校验按完整指令集合比较。
音频在完整响应中声明 `Accept-Ranges: bytes`，分段响应验证 206、Content-Range 和真实字节；
分段响应无需重复该声明。校验器支持有限重试，下载内容在内存中比较。
这些发布后校验器修正没有改变上述已上传交付物和闭包。

## 公网性能与手机竖屏复核（2026-10-20）

本轮在同一公网版本上复核，未修改产品交互或视觉实现。
使用 ego-browser 的 Chromium、浏览器缓存禁用、CDN 已预热；帧率是共享本机环境中的单次采样，
没有隔离系统负载，也不代表真实手机 GPU 性能。LCP 记录的是 DOM 内容，不能单独判定 Canvas 场景已完全呈现。

| 测试条件 | 结果 |
| --- | --- |
| 桌面 1440 × 900，当前网络，无 CPU 降速 | 约 17.0 秒达到可播放状态；LCP 约 13.1 秒；启动后 6 秒平均约 14 FPS |
| 竖屏 390 × 844，DPR 2，4 Mbps 下载、80 ms 延迟、CPU 4 倍降速 | 约 14.9 秒达到可播放状态，音频正常；此时字体状态仍为 loading |
| 竖屏 390 × 844，恢复正常 CPU，资源载入后播放 | 6 秒平均约 2.3 FPS，出现严重掉帧；同一环境的空白页对照约 60 FPS |
| 竖屏 360 × 800 与 390 × 844，触摸操作 | 无页面横向溢出；播放、暂停、进度条拖动及跳转后续播通过 |
| 歌词区域横向触摸滑动 | 未通过：180 px 滑动应改变约 15 秒，只改变了 2.5 秒；第一段 pointermove 后触发 pointercancel |

桌面采样窗口已完成约 23.7 MiB 下载，尚有 2 个请求未结束，因此这不是完整访问流量上限。
其中 12 个 OBJ 模型约 14.9 MiB，整套中文字库约 5.77 MiB，贴图约 2.37 MiB；
资源全部上 CDN 并不代表首访负载已经缩小。

横滑事件记录为 pointerdown → pointermove → pointercancel，歌词交互层的 touch-action 为 auto。
手机基本控件可用，但完整手势体验和移动端流畅度尚未验收通过；未进行 iOS/Android 真机测试。
后续应优先验证触摸手势策略、保持字形的字体子集、模型按需预载与渲染成本。
本轮不把这些审阅发现自动转成产品改动。

原始测量和事件证据保存在 `.cache/performance-20261020/`，竖屏截图已人工检查。
部署防护测试 8/8、TypeScript 检查通过；生产文件和音频分段检查继续沿用上面的完整公网验证结果。

当前 Next 14.0.4 的依赖审计仍有已知告警，本方案部署静态导出，不运行 Next 服务，
不发布 `.next/server`。这不等于依赖审计通过；框架升级需另行验证兼容性。

## 第二轮优化与发布（2026-10-20）

最终公网版本为 `coscroll-43fe2f5e582083ed`，交付闭包 SHA-256 为
`4d6d74aca58197ed53ed01a8c68cbb2380a7f9ffed61e378b568f95bb7751c7d`。
本轮保留书法字形、玉石双层材质、丝绸背景和歌词的深度、羽化效果。

- 歌词交互层接管触摸手势，避免第一段移动后被浏览器取消；负数预览时间按音频循环归一化。
- 文字纹理只在内容、字体或排版方向改变时生成，颜色、透明度和羽化改由材质处理。
  字体载入完成后才刷新缓存，避免将系统字体永久留在纹理中。
- 当前模型与下一不同模型共用正在进行的下载和解析；取消启动时加载整套模型。
- 全字库 WOFF2 的 8106 个字形、映射与字宽均校验一致，体积减少约 60%。
- 修复延迟返回的播放请求覆盖暂停状态的问题。受控延迟 1.5 秒时，旧版会出现
  音频已暂停、按钮仍显示 Pause 的不一致；新版保持音频暂停、按钮显示 Play。
- 首次音频加载失败后最多自动重试两次，间隔 1 秒、2 秒；切换音源或卸载时取消旧重试。
  已经成功就绪的曲目不通过该机制重新加载。
- 部署防护测试 8/8、模型加载回归测试 3/3、生产构建与 TypeScript 检查通过。

COS 上传 115 个新对象（含清单）；源站暂存并校验 71 个文件后，原子切换
`/www/wwwroot/coscroll-current` 到 `/www/wwwroot/coscroll-releases/coscroll-43fe2f5e582083ed/web`。
Nginx 配置 SHA-256 仍为 `7263c4f493b541e88eb85c6d911ea1246570fe20ddd97eabc365fa2d82e4f43e`。
回滚目标为前一个优化包 `coscroll-3159eb1b1a147b2f`；它和原始版本
`coscroll-11630f6d25848056` 的源站目录及 COS 对象均保留。

切换前，从源站独立公网出口完整验证 114 个 CDN 交付文件及全部 3 个音频分段；切换后从同一出口，
通过 HTTPS 完整验证 185 个交付文件的哈希、MIME、缓存和跨域规则、全部音频分段、
规范跳转及 404。首页与 LuBirth 页面哈希和最终切换前基线一致。
此前本机全量重测曾遇到 CDN TLS 连接超时，未将该超时记为内容校验通过，
也未跳过文件；上面的独立出口验证覆盖全部文件。

发布证据位于 `.cache/production-coscroll-43fe2f5e582083ed/`，交互与性能证据位于
`.cache/iteration-20261020/`。本轮回滚工具为 `python3 .cache/iteration-origin-final.py rollback`，
会先比对当前入口、配置和邻站链接，拒绝覆盖后续部署。

音频浏览器回归脚本为 `test/runtime/audio-browser.js` 与
`test/runtime/audio-retry-limit-browser.js`。在专用、启用触摸的临时 Playwright 会话打开站点后，
通过 `run-code --filename <script>` 执行。前者注入一次网络失败和延迟播放请求，
同时验证暂停、左右各 180 px 横滑、循环回退、360 px 进度条拖动与续播；
后者持续中断音频请求，验证只显式重载两次、总计三个失败后停止。
这些故障注入记录与普通访问记录分别保存，不将预期的失败请求算作正常网络测试。

最终公网浏览器回归通过上述两份脚本：第一次请求被中断后，第 2 次请求成功就绪；
延迟播放请求返回后，音频保持暂停且按钮为 Play；两向 180 px 横滑均准确改变 15 秒，
完整收到 pointerup，未出现 pointercancel。循环回退、360 × 800 进度拖动与续播通过。
持续故障用例显式重载 2 次、收到 3 次错误后停止。

| 采样条件 | 帧率与文字上传 |
| --- | --- |
| 旧版公网，Ego Chromium，390 × 844、DPR 2、Android UA | 6 秒约 2.14 FPS，54 次 Canvas 文字上传 |
| 优化布局本地生产包，相同 Ego 尺寸与 UA | 6 秒约 29.50 FPS，0 次文字上传 |
| 最终公网，独立 Chrome for Testing 155，390 × 844、DPR 2、Android UA | 6 秒约 59.34 FPS，p95 帧间隔 17.7 ms，0 次文字上传 |

最终公网普通访问采样约 9.45 秒达到可播放、字体载入状态；启动只请求当前与下一个模型，
共 2 个 OBJ，未捕获页面运行错误。字体与图形截图已人工检查。
桌面 1440 × 900 的播放、暂停、进度跳转、歌词回退及从新位置续播通过，未出现页面横向溢出。
上述帧率来自 requestAnimationFrame 采样；浏览器版本、交付环境和系统负载不同，
没有清空 CDN 或 GPU 缓存，也没有隔离系统负载，不作为标准化提升倍数或真机 GPU 帧率。
旧版与优化布局的完成下载采样约 23.7 / 8.6 MiB，各仍有 2 个请求进行中，不代表完整流量上限。
未做 iOS 或 Android 真机测试。

本轮代码提交为 `42297de`（渲染与下载优化）和 `1a2eb65`（音频状态与首次加载恢复），
沿用原来的 `decoupled` 分支。

## 开场 shader 与公网复核（2026-10-20）

线上版本为 `coscroll-80f24b659f7e9f82`，交付闭包 SHA-256 为
`a2a505e5f2d25e0103404a6e90b892f216eb9c93490e6c06b6968d3a1cf75f51`。

开场保留「点击开始／心经」两行文字，在其后显示既有的深青色丝绸 shader。
`HomePage` 将背景提升到封面和正文共用的层，开始后只调整层级并显示正文、播放器；
背景 Canvas 始终保留，不重建、不新增第三个 WebGL 画布，也没有新增素材或依赖。
`AutoPlayGuard` 使用透明的全屏按钮接收触摸、点击及键盘输入，保留原有开始播放回调。
动态视口高度覆盖手机竖屏；shader 未载入时，共用背景层提供原来的深色底色。

类型检查、生产构建、部署测试 8/8、模型加载测试 3/3 通过。
COS 新增 115 个不可变对象（含清单），源站暂存并校验 71 个文件。
原子切换前发现 LuBirth 有并行部署，防护检查拒绝首次切换；重新核对现网后，
保留其新入口 `lubirth-996b699a19bca700`，只切换 CoScroll。
Nginx 配置 SHA-256 仍为 `7263c4f493b541e88eb85c6d911ea1246570fe20ddd97eabc365fa2d82e4f43e`。
从源站独立公网出口通过 HTTPS 完整验证 185 个文件、3 个音频分段、哈希、MIME、
缓存、跨域规则、308 查询参数保留和 404。首页及 LuBirth 页面哈希与最终切换前基线一致。

正式公网的 Chrome for Testing 155，Android UA、390 × 844、DPR 2，禁用浏览器缓存，
在前台各采样约 6 秒。除 requestAnimationFrame 外，也统计实际背景 WebGL 绘制调用，
并确认 shader 的时间 uniform 持续更新。

| 状态 | 页面帧率 / 背景实际绘制 | p95 帧间隔 | Canvas 文字上传 |
| --- | --- | --- | --- |
| 开场封面 | 60.16 / 60.16 FPS | 17.5 ms | 0 |
| 开始播放后的正文 | 60.04 / 60.04 FPS | 17.2 ms | 0 |

本次音频与字体就绪约 12.48 秒，该等待条件不代表首屏绘制时间；首访资源准备仍有优化空间。
启动只请求当前与下一不同模型，共 2 个 OBJ。封面全屏、正文和播放器在开始前隐藏，
触摸开始后显示且仍是同一个背景 Canvas；播放、暂停均通过，未捕获页面运行错误。
左右各 180 px 横滑准确改变 15 秒，未出现 pointercancel；从 0 秒回退到 359.256327 秒、
续播及 360 × 800 进度条触摸拖动均通过，无页面横向溢出。
公网封面和正文截图已人工检查。未做 iOS/Android 真机测试，未隔离系统负载、
未清空 CDN 或 GPU 缓存，因此这些数据不作为真机 GPU 帧率或标准化性能对比。

桌面 1440 × 900、DPR 1 的 Tab 聚焦及 Enter 开始、播放和暂停通过。
首次封面采样 59.45 FPS，正文曾测得 36.59 FPS、p95 50 ms，保留该波动记录。
随后使用同一份采样脚本进行对照：专用测试浏览器临时载入旧版 HTML 与旧版真实 CDN 资源，
正文为 60.04 FPS；取消该替换后，真实公网新版正文为 59.58 FPS、p95 17.6 ms。
两版背景画布均为 1440 × 900 像素，正文画布均为 1440 × 772 像素。
本次对照未复现持续的帧率下降；共享机器上的单次采样仍会波动，不能据此保证所有设备持续 60 FPS。
对照期间没有切换生产入口；正式公网验收日志与候选页对照日志分别保留。

最新发布证据位于 `.cache/production-coscroll-80f24b659f7e9f82/`；浏览器日志与截图位于
`.cache/iteration-20261020/`，文件名以 `shader-public-` 开头。
本轮回滚工具为 `python3 .cache/shader-origin.py rollback`，目标为上一版
`coscroll-43fe2f5e582083ed`，执行前仍校验现有配置、CoScroll 入口及邻站链接。
旧源站目录和 COS 对象继续保留。
