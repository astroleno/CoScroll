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
  webpack(config) {
    if (releaseId) config.cache = false;
    return config;
  },
  ...(releaseId ? { generateBuildId: async () => releaseId } : {}),
};

export default config;
