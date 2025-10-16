# CoScroll 部署指南

## Vercel 部署步骤

### 1. 准备工作
确保所有静态资源都在 `public/` 目录下：
- ✅ 音频文件：`/audio/心经_2.mp3`
- ✅ 字体文件：`/fonts/润植家康熙字典美化体.ttf`
- ✅ 3D模型：`/models/10k_obj/*.obj`
- ✅ 纹理文件：`/textures/*.hdr`, `*.jpg`

### 2. Vercel 部署
1. 将代码推送到 GitHub
2. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
3. 点击 "New Project"
4. 选择你的 GitHub 仓库
5. 配置设置：
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: 默认（Next.js 自动处理）
   - **Install Command**: `npm ci`
   - **Node.js Version**: 20.x

### 3. 环境变量
当前项目不需要额外的环境变量配置。

### 4. 部署后验证
- 访问分配的域名
- 检查音频播放（需要用户交互）
- 验证 3D 模型加载
- 测试歌词同步功能

### 5. 性能优化
- 静态资源已配置长期缓存（1年）
- 3D 模型使用智能预加载
- 音频文件支持渐进式加载

### 6. 故障排除
如果部署失败：
1. 检查 Node.js 版本是否为 20.x
2. 确认所有静态资源都在 Git 中
3. 查看 Vercel 构建日志
4. 验证 `package.json` 中的依赖版本

### 7. 自定义域名（可选）
1. 在 Vercel 项目设置中添加自定义域名
2. 配置 DNS 记录
3. 启用 HTTPS（自动）

## 本地测试
```bash
npm run build
npm run start
```

## 注意事项
- 首次访问需要用户交互才能播放音频（浏览器策略）
- 3D 模型较大，首次加载可能需要时间
- 建议在移动端测试响应式设计
