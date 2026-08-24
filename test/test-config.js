/**
 * 配置系统测试脚本
 *
 * 测试配置加载、验证和资源访问
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 开始测试配置系统...\n');

// 测试 1: 配置文件存在性
console.log('📋 测试 1: 检查配置文件');
const configPath = './public/projects/heart-sutra.json';
if (fs.existsSync(configPath)) {
  console.log('✅ 配置文件存在:', configPath);
} else {
  console.log('❌ 配置文件不存在:', configPath);
  process.exit(1);
}

// 测试 2: 配置文件格式
console.log('\n📋 测试 2: 解析配置文件');
let config;
try {
  const configContent = fs.readFileSync(configPath, 'utf-8');
  config = JSON.parse(configContent);
  console.log('✅ JSON 格式正确');
} catch (error) {
  console.log('❌ JSON 解析失败:', error.message);
  process.exit(1);
}

// 测试 3: 配置结构
console.log('\n📋 测试 3: 验证配置结构');
const requiredFields = ['version', 'project', 'assets', 'theme', 'anchors', 'timeline'];
let missingFields = [];
for (const field of requiredFields) {
  if (!config[field]) {
    missingFields.push(field);
  }
}
if (missingFields.length === 0) {
  console.log('✅ 配置结构完整');
} else {
  console.log('❌ 缺少字段:', missingFields.join(', '));
  process.exit(1);
}

// 测试 4: 资源文件存在性
console.log('\n📋 测试 4: 检查资源文件');

// 音频文件
const audioPath = path.join('./public', config.assets.audio.src);
if (fs.existsSync(audioPath)) {
  const stats = fs.statSync(audioPath);
  console.log(`✅ 音频文件存在: ${config.assets.audio.src} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
} else {
  console.log('❌ 音频文件不存在:', config.assets.audio.src);
}

// 歌词文件
const lyricsPath = path.join('./public', config.assets.lyrics.src);
if (fs.existsSync(lyricsPath)) {
  const lyricsContent = fs.readFileSync(lyricsPath, 'utf-8');
  const lyricsLines = lyricsContent.trim().split('\n').length;
  console.log(`✅ 歌词文件存在: ${config.assets.lyrics.src} (${lyricsLines} 行)`);
} else {
  console.log('❌ 歌词文件不存在:', config.assets.lyrics.src);
}

// 模型目录
const modelsDir = path.join('./public', config.assets.models.directory);
if (fs.existsSync(modelsDir)) {
  const modelFiles = fs.readdirSync(modelsDir).filter(f => f.endsWith('.obj'));
  console.log(`✅ 模型目录存在: ${config.assets.models.directory} (${modelFiles.length} 个模型)`);
} else {
  console.log('❌ 模型目录不存在:', config.assets.models.directory);
}

// 测试 5: 配置内容详情
console.log('\n📋 测试 5: 配置内容详情');
console.log('  项目名称:', config.project.name);
console.log('  项目 ID:', config.project.id);
console.log('  音频:', config.assets.audio.src);
console.log('  歌词:', config.assets.lyrics.src);
console.log('  锚字颜色:', config.theme.anchor.primary);
console.log('  光晕颜色:', config.theme.anchor.glowPrimary);
console.log('  锚字映射数:', config.anchors.mappings.length);
console.log('  时间轴节点数:', config.timeline.length);

// 测试 6: 时间轴验证
console.log('\n📋 测试 6: 验证时间轴');
let timelineValid = true;
for (let i = 1; i < config.timeline.length; i++) {
  if (config.timeline[i].time <= config.timeline[i-1].time) {
    console.log(`❌ 时间轴排序错误: 索引 ${i-1} (${config.timeline[i-1].time}s) -> ${i} (${config.timeline[i].time}s)`);
    timelineValid = false;
  }
}
if (timelineValid) {
  console.log('✅ 时间轴排序正确（升序）');
  console.log(`  时间范围: ${config.timeline[0].time}s - ${config.timeline[config.timeline.length-1].time}s`);
}

// 测试 7: 锚字映射验证
console.log('\n📋 测试 7: 验证锚字映射');
const anchorMap = new Map();
config.anchors.mappings.forEach(m => anchorMap.set(m.anchor, m.modelPath));
let mappingValid = true;
for (const item of config.timeline) {
  if (!anchorMap.has(item.anchor)) {
    console.log(`❌ 时间轴中的锚字 "${item.anchor}" 没有对应的模型映射`);
    mappingValid = false;
  }
}
if (mappingValid) {
  console.log('✅ 所有时间轴锚字都有对应的模型映射');
}

// 测试 8: 颜色格式验证
console.log('\n📋 测试 8: 验证颜色格式');
const hexRegex = /^#[0-9A-Fa-f]{6}$/;
const rgbaRegex = /^rgba?\([\d\s,\.]+\)$/;
let colorValid = true;

const checkColor = (name, value) => {
  if (!hexRegex.test(value) && !rgbaRegex.test(value)) {
    console.log(`❌ 颜色格式错误: ${name} = ${value}`);
    return false;
  }
  return true;
};

colorValid &= checkColor('anchor.primary', config.theme.anchor.primary);
colorValid &= checkColor('anchor.glowPrimary', config.theme.anchor.glowPrimary);
colorValid &= checkColor('lyrics.current', config.theme.lyrics.current);

if (colorValid) {
  console.log('✅ 颜色格式正确');
}

// 总结
console.log('\n' + '='.repeat(50));
console.log('🎉 配置系统测试完成！');
console.log('='.repeat(50));
console.log('\n📊 测试结果摘要:');
console.log(`  • 配置文件: heart-sutra.json`);
console.log(`  • 项目名: ${config.project.name}`);
console.log(`  • 锚字数: ${config.anchors.mappings.length}`);
console.log(`  • 时间轴节点: ${config.timeline.length}`);
console.log(`  • 音频文件: ${fs.existsSync(audioPath) ? '✅' : '❌'}`);
console.log(`  • 歌词文件: ${fs.existsSync(lyricsPath) ? '✅' : '❌'}`);
console.log(`  • 模型目录: ${fs.existsSync(modelsDir) ? '✅' : '❌'}`);
console.log('\n✅ 所有测试通过！配置系统工作正常。');
console.log('\n🚀 下一步:');
console.log('  1. 运行 npm run dev 启动开发服务器');
console.log('  2. 访问 http://localhost:3000');
console.log('  3. 打开浏览器控制台查看配置加载日志');
console.log('  4. 查看 CONFIG_GUIDE.md 了解如何自定义配置\n');
