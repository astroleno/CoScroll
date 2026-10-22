const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const releaseId = process.env.COSCROLL_RELEASE_ID;

if (basePath && !/^\/[a-z0-9-]+$/.test(basePath)) {
  throw new Error('NEXT_PUBLIC_BASE_PATH must be empty or a single path segment');
}

/** @type {import('next').NextConfig} */
const config = {
  output: releaseId ? 'export' : undefined,
  trailingSlash: true,
  basePath,
  assetPrefix: process.env.NEXT_PUBLIC_ASSET_BASE?.replace(/\/$/, ''),
  productionBrowserSourceMaps: false,
  webpack(config, {isServer, dev}) {
    if (releaseId) config.cache = false;
    // The asset CDN currently negotiates HTTP/1.1. Avoid several waves of tiny
    // initial shared chunks while retaining Next's framework/library groups.
    if (!isServer && !dev && config.optimization.splitChunks) {
      config.optimization.splitChunks.maxInitialRequests = 6;
      config.optimization.splitChunks.cacheGroups.coscrollScene = {
        name: 'coscroll-scene', priority: 35, enforce: true,
        chunks: chunk => chunk.name === 'app/page',
        test(module) {
          const resource = module.nameForCondition?.() || '';
          return !!resource && !/node_modules[/\\](?:next|react|react-dom|scheduler)[/\\]/.test(resource);
        },
      };
    }
    return config;
  },
  ...(releaseId ? { generateBuildId: async () => releaseId } : {}),
};

export default config;
