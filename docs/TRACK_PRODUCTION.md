# 曲目与专属手写开场制作

新曲目制作包括音频、LRC、锚字、配置以及专属序言。序言由当前负责制曲的代码生成模型依据实际曲目资料自动创作，接着由命令自动完成 Inko 生成和资源接入。用户不需要逐首提供文案。

## 制作顺序

先依照[经典接入规范](CLASSICS_INTEGRATION_SPEC.md)写好完整 `public/projects/<id>.json`，放入匹配的 MP3 与 LRC。读取该录音的写作资料：

```sh
npm run tracks:prepare -- --project <id> --brief
```

制曲模型使用返回的曲名、演唱者、录音说明、完整歌词及 `sourceDigest` 创作短序，保存到 `docs/handwriting/<id>/preface.json`：

```json
{
  "text": "第一行原创短序\n第二行原创短序\n第三行原创短序",
  "kind": "original",
  "sourceDigest": "填写本次 brief 返回的完整摘要"
}
```

推荐 20–35 字、2–3 行，每行至多 16 字。围绕实际唱词意境写作，不照搬统一模板，不冒充经文原句，不写点击提示。录音是摘编歌曲时，不称为全本诵读。文案是制曲的一部分，当前模型直接完成；本工具没有额外调用另一个文案模型。随后运行：

```sh
npm run tracks:prepare -- --project <id> --preface docs/handwriting/<id>/preface.json
npm run tracks:check
```

命令按固定样式 No.012、`lyric-1` 生成一页原始笔迹，检查字形顺序与完整性，制作与丝绸配合的透明浅色短序，并最后写入该曲的 `opening`。页面继续使用已有曲名和全屏开始手势，可见“点击开始”由专属短序取代。默认复用已有图；MP3 内容、LRC、曲名或录音资料改变时必须读取新 brief 并重做短序。沿用原始音频文件名不能绕过内容摘要。

已有且未变的曲目可直接运行 `npm run tracks:prepare -- --project <id>`，命令只校验并复用。单独运行该命令不会调用第二个模型创作文案；新曲目应连续执行上面的完整制曲流程。

## 制作环境

Node 使用项目现有依赖。Python 需要 Pillow 与 NumPy；可设置 `COSCROLL_PYTHON` 指向已有项目虚拟环境。工具从 Inko 官方仓库下载固定版本 SDK 到项目缓存并逐文件校验 SHA-256，许可证与 SDK 一同保存；版本见 `deploy/handwriting/inko-sdk.mjs`。

认证使用 Inko 官方顺序：`INKO_API_KEY`、项目 `.inko/key`、用户的 Inko 配置。项目密钥目录须忽略，权限限制为当前用户。不要把密钥写进序言、配置、源码、提交或日志。浏览器和发布构建均不需要密钥。

制作前 SDK 校验字符、排版和实际报价，`--max-cents 0` 拦截非零报价；固定幂等键允许恢复同一任务。未通过报价、生成、scene 文字或图片校验时不改动当前曲目配置。失败的制作缓存保留供定位及恢复；成功后自动删除临时下载，保留正式来源档案。

## 产物和交付检查

- `public/projects/<id>.json`：普通短序、原创/摘句类型、输入摘要、修订及图片信息。
- `public/opening/<id>/`：含哈希文件名的透明 PNG 和对应制作清单；不含临时下载链接。
- `docs/handwriting/<id>/<revision>/`：原始 PNG、scene ZIP 和制作清单，用于核对字形、来源与隐式元数据。

运行时按图片摘要、大小、尺寸校验，解码后展示；超时、断网或损坏时保持相同短序的普通文字，随时可以点击、Enter 或 Space 开始。切曲或开始后取消旧加载并释放图片资源。

`tracks:check` 检查所有公开曲目的文本、当前音频及歌词摘要、资源归属、图片字节与 AIGC 元数据、清单和修订。普通生产构建与正式打包均强制执行；新曲目缺少专属开场不能交付。还需人工查看最终图片，以及手机、横屏、桌面和失败后备的真实浏览器验证。发布仍依照[发布流程](COSCROLL_RELEASE.md)取得相应授权。
