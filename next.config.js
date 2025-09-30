/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // 支持加载 glb/gltf 文件
    config.module.rules.push({
      test: /\.(glb|gltf)$/,
      type: 'asset/resource',
    });

    // 支持加载音频文件
    config.module.rules.push({
      test: /\.(mp3|wav|ogg|m4a)$/,
      type: 'asset/resource',
    });

    // 支持加载shader文件
    config.module.rules.push({
      test: /\.(vert|frag|glsl)$/,
      type: 'asset/source',
    });

    return config;
  },
  // 静态文件优化
  images: {
    domains: [],
    formats: ['image/webp', 'image/avif'],
  },
  // 性能优化
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
}

module.exports = nextConfig