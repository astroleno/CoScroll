# CoScroll：aitoshuu.me/coscroll 发布

沿用 fv_slide / LuBirth 的基础设施：阿里云 Nginx 提供 HTML、Next 静态路由载荷和版本标记；
腾讯上海私有 COS 桶 `tongye-1327162705` 存放不可变对象。
JS、CSS、字体、OBJ、HDR、图片、歌词和项目 JSON 使用 `assets.aitoshuu.me`；音频使用 `media.aitoshuu.me`。
对象全部位于 `releases/aitoshuu-me/coscroll-<source-digest>/`，不覆盖已有对象。
发布脚本启用静态导出；普通 `npm run build` / `npm run start` 保留 Next 的本地生产预览方式。

## 本地候选验证

```sh
npm run test:deployment
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
6. 只给现有 `html_aitoshuu.me.conf` 增加 `/coscroll` 路由，并保留现网安全响应头、TLS、首页和 LuBirth 配置。
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
