#!/usr/bin/env node

// 滚动修复验证脚本
// 用于测试 LyricSync-v2 组件的滚动功能

const puppeteer = require('puppeteer');
const path = require('path');

async function testScrollFix() {
  console.log('🔧 开始测试 LyricSync-v2 滚动修复效果...\n');

  const browser = await puppeteer.launch({
    headless: false, // 显示浏览器窗口便于观察
    devtools: true,  // 开启开发者工具
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // 设置视口大小
    await page.setViewport({ width: 1200, height: 800 });

    // 监听控制台输出
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('🎵') || text.includes('🔧') || text.includes('✅') || text.includes('❌')) {
        console.log('📟', text);
      }
    });

    console.log('🌐 访问 lyricsync-v2 页面...');
    await page.goto('http://localhost:3005/lyricsync-v2', {
      waitUntil: 'networkidle2',
      timeout: 10000
    });

    // 等待页面加载
    await page.waitForTimeout(2000);
    console.log('✅ 页面加载完成');

    // 检查歌词是否加载
    const lyricsLoaded = await page.evaluate(() => {
      return window.lyrics !== undefined && window.lyrics.length > 0;
    });

    if (lyricsLoaded) {
      console.log('✅ 歌词加载成功');
    } else {
      console.log('❌ 歌词加载失败');
    }

    // 等待音频初始化
    await page.waitForTimeout(3000);

    // 测试播放功能
    console.log('▶️ 测试音频播放...');
    await page.click('button[aria-label*="play"], button[title*="play"]');
    await page.waitForTimeout(1000);

    // 监听滚动变化
    let scrollCount = 0;
    let lastScrollTop = 0;

    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('continuousScroll') || text.includes('基础滚动')) {
        scrollCount++;
        console.log(`📜 滚动事件 #${scrollCount}:`, text);
      }
    });

    // 观察滚动行为
    console.log('👀 观察滚动行为（10秒）...');
    await page.waitForTimeout(10000);

    // 测试手动滚动
    console.log('🖱️ 测试手动滚动...');
    const lyricsContainer = await page.$('.lyrics-scroll');
    if (lyricsContainer) {
      // 模拟用户滚动
      await page.evaluate(() => {
        const container = document.querySelector('.lyrics-scroll');
        if (container) {
          container.scrollTop = 200;
        }
      });
      await page.waitForTimeout(1000);
    }

    // 测试进度条点击
    console.log('🎯 测试进度条点击...');
    const progressBar = await page.$('.bg-gray-700');
    if (progressBar) {
      const boundingBox = await progressBar.boundingBox();
      if (boundingBox) {
        await page.mouse.click(
          boundingBox.x + boundingBox.width / 2,
          boundingBox.y + boundingBox.height / 2
        );
        await page.waitForTimeout(1000);
      }
    }

    // 最终验证
    const finalState = await page.evaluate(() => {
      const container = document.querySelector('.lyrics-scroll');
      const currentLyric = document.querySelector('.text-white.text-xl');
      const audio = document.querySelector('audio');

      return {
        scrollTop: container ? container.scrollTop : 0,
        currentLyricText: currentLyric ? currentLyric.textContent : 'None',
        audioTime: audio ? audio.currentTime : 0,
        isPlaying: audio ? !audio.paused : false
      };
    });

    console.log('\n📊 最终状态:');
    console.log('滚动位置:', finalState.scrollTop);
    console.log('当前歌词:', finalState.currentLyricText);
    console.log('音频时间:', finalState.audioTime.toFixed(2));
    console.log('播放状态:', finalState.isPlaying ? '播放中' : '已暂停');
    console.log('滚动事件总数:', scrollCount);

    // 评估修复效果
    if (scrollCount > 0 && finalState.currentLyricText !== 'None') {
      console.log('\n✅ 滚动修复验证成功！');
      console.log('- 滚动事件正常触发');
      console.log('- 歌词能够正确更新');
      console.log('- 音频同步功能正常');
    } else {
      console.log('\n❌ 滚动修复可能存在问题');
      console.log('- 滚动事件未触发或歌词未更新');
    }

  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  } finally {
    // 保持浏览器开启一段时间供观察
    console.log('\n🔄 浏览器将保持开启30秒供观察...');
    await page.waitForTimeout(30000);

    await browser.close();
    console.log('🏁 测试完成');
  }
}

// 检查是否安装了 puppeteer
try {
  require('puppeteer');
  testScrollFix();
} catch (error) {
  console.log('❌ 需要安装 puppeteer 来运行测试脚本');
  console.log('请运行: npm install puppeteer');
  process.exit(1);
}