# CoScroll 腾讯源站与阿里双入口

2026-10-26 已将正式源站迁到腾讯上海 `122.51.59.89`。两个公网入口继续是 `https://tongye.me/CoScroll/`、`https://aitoshuu.me/CoScroll/`，阿里 `47.103.120.24` 保留 DNS、证书及 HTTPS 网关。

迁移冻结版本为 `coscroll-7d9ac4d71fe38b81`，没有重新构建产品或替换页面功能。腾讯 `/www/wwwroot/coscroll-current` 指向 `/www/wwwroot/coscroll-releases/<release-id>/web`；HTML、Next 导出的 `.txt` 路由载荷及版本标记均在这里。既有 COS/CDN 对象、资源域名和不可变版本前缀保持。

## 配置与后续发布

- 腾讯 `aitoshuu.art` HTTPS 虚拟主机通过 `extension/aitoshuu.art/coscroll-migration.conf` 引入 `snippets/coscroll-tencent-origin.inc`，对应本仓库的 `deploy/nginx/tencent-coscroll-origin.inc`。
- 共享 `$nine_public_host` map 只接受 `tongye.me`、`aitoshuu.me`。map 模板随 InfiDao 的 `deploy/nginx/tencent-public-host-map.conf` 维护，在腾讯的 Nginx http 上下文只安装一次。源站只允许阿里 IP 和回环访问。
- 阿里两个 HTTPS server 引入 `snippets/coscroll-tencent-gateway.inc`，使用 `deploy/nginx/aliyun-coscroll-gateway.inc`。上游固定腾讯 IP，TLS SNI 为 `aitoshuu.art`，必须验证证书；原始公网域名由网关覆盖写入 `X-Forwarded-Host`。
- 正式路径 `/CoScroll/`；小写和大小混写在当前域名用 308 归一，保留子路径和查询参数。共享 `project-prefix-canonical.inc` 继续处理混写，网关单独保留旧小写路径的编码参数。
- 后续沿用 COS/CDN 打包、上传及校验流程，将 `web/` 暂存和版本链接切换操作放在腾讯。旧 `stage-origin` 输出只是本地草案；不能把静态 alias 重新写回阿里。修改共享配置前重新读取现网，合并本项目差异并通过 `nginx -t`。

## 验证与回滚

本轮三个迁移项目合计 4939 个运行文件逐文件核对一致。九项目公网回归 219/219：54 个正式/小写/混写入口、94 个脚本样式引用、26 个深层/404/私有路径检查、14 个接口守卫、18 个 HTTP 升级、4 个首页/WWW 和 9 个跨域内容等价比较通过。两域新增项目响应均标记 `X-Project-Origin: tencent-shanghai`。

真实浏览器确认 tongye 的《妙法莲华经》与 aitoshuu 的《心经》可进入手写开场、渲染三维经卷并播放，播放时间实际前进；地址均保留当前域名。本轮未重做真机、完整曲目、压力或峰值带宽验收。

阿里原发布目录和 `/var/backups/nine-projects-migration-20261026/` 中受影响配置备份保留。仅回滚静态项目时，先核对最新配置和对应版本，再恢复本项目路由，保留其他项目后续更新。临时测试服务、访问密钥和测试目录在验收后清理；活动网关、正式版本及回滚材料保留。
