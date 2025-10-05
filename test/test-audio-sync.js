// 测试音频同步功能的脚本
// 在浏览器控制台中运行此脚本来调试问题

console.log('🔍 开始调试音频同步功能...');

// 检查音频元素
const audioElement = document.querySelector('audio');
console.log('🎵 音频元素状态:', {
  src: audioElement?.src,
  readyState: audioElement?.readyState,
  currentTime: audioElement?.currentTime,
  duration: audioElement?.duration,
  paused: audioElement?.paused
});

// 检查歌词文件是否可访问
fetch('/lyrics/心经.lrc')
  .then(response => {
    console.log('📄 歌词文件响应:', response.status, response.statusText);
    return response.text();
  })
  .then(content => {
    console.log('📝 歌词内容前200字符:', content.substring(0, 200));
  })
  .catch(error => {
    console.error('❌ 歌词文件加载失败:', error);
  });

// 检查音频文件是否可访问
fetch('/audio/心经.mp3', { method: 'HEAD' })
  .then(response => {
    console.log('🎶 音频文件响应:', response.status, response.statusText);
  })
  .catch(error => {
    console.error('❌ 音频文件访问失败:', error);
  });

// 检查React组件的状态
console.log('🔍 检查React组件状态...');
setTimeout(() => {
  // 尝试找到锚字显示元素
  const anchorChar = document.querySelector('.anchor-char');
  if (anchorChar) {
    console.log('⚓ 锚字元素:', anchorChar.textContent);
  } else {
    console.log('❌ 未找到锚字元素');
  }

  // 检查歌词容器
  const lyricsContainer = document.querySelector('.lyrics-scroll');
  if (lyricsContainer) {
    console.log('📜 歌词容器元素已找到');
    const lyricLines = lyricsContainer.querySelectorAll('.lyric-line');
    console.log('📝 歌词行数:', lyricLines.length);
    if (lyricLines.length > 0) {
      console.log('📝 第一句歌词:', lyricLines[0].textContent);
    }
  } else {
    console.log('❌ 未找到歌词容器');
  }

  // 检查是否有加载错误提示
  const errorElements = document.querySelectorAll('[class*="error"], [class*="red"]');
  if (errorElements.length > 0) {
    console.log('❌ 发现错误元素:', Array.from(errorElements).map(el => el.textContent));
  }

  // 检查控制台中的歌词加载状态
  const loadingText = document.querySelector('.text-gray-500');
  if (loadingText && loadingText.textContent?.includes('加载')) {
    console.log('⏳ 歌词仍在加载中...');
  }
}, 2000);

// 模拟手动测试播放功能
console.log('📝 测试建议:');
console.log('1. 点击播放按钮测试音频播放');
console.log('2. 检查锚字是否随音频播放变化');
console.log('3. 拖动进度条测试跳转功能');
console.log('4. 滚动歌词测试同步功能');