# CoScroll 曲目制作约定

本文件只补充本仓库的制曲流程；用户的执行边界、批准要求与既有视觉规范继续适用。

用户要求新增曲目、接入新的 MP3/LRC 或替换录音时，必须同时完成专属序言，不把它留作可选的后续任务：

1. 按 `docs/CLASSICS_INTEGRATION_SPEC.md` 准备真实录音、LRC 和完整曲目配置。
2. 执行 `npm run tracks:prepare -- --project <id> --brief`，读取该录音的资料和歌词。
3. **由当前正在制曲的模型自动撰写**原创短序，推荐 20–35 字、2–3 行，每行最多 16 字。紧扣实际歌词意境，不冒充经文引句；不把摘编歌曲写成全本诵读。无须让用户另外撰写或逐首提醒。
4. 将 `{text, kind: "original", sourceDigest}` 保存到 `docs/handwriting/<id>/preface.json`，执行 `npm run tracks:prepare -- --project <id> --preface docs/handwriting/<id>/preface.json`。工具自动生成 Inko 手写图、保留来源和生成标识、写回配置。不得用普通字体伪装 Inko 结果。
5. 执行 `npm run tracks:check`，检查真实浏览器中的开场和手势播放，完成相关测试并清理截图、临时文件和测试页面。输入未变时复用已验收资源。

执行细节与认证方式见 `docs/TRACK_PRODUCTION.md`。生成失败、缺少认证或检查失败时，保留原配置并如实说明；不得静默换回共用“点击开始”图片后声称完成。提交、推送和公网发布仍分别需要用户授权。
