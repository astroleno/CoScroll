import {prepareThreeTransmissionRegion} from './deploy/three-transmission-region.mjs';

const regionThreeModule = await prepareThreeTransmissionRegion();
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const releaseId = process.env.COSCROLL_RELEASE_ID;

if (basePath && !/^\/[a-zA-Z0-9-]+$/.test(basePath)) {
  throw new Error('NEXT_PUBLIC_BASE_PATH must be empty or a single path segment');
}

/** @type {import('next').NextConfig} */
const config = {
  output: releaseId ? 'export' : undefined,
  trailingSlash: true,
  basePath,
  assetPrefix: process.env.NEXT_PUBLIC_ASSET_BASE?.replace(/\/$/, ''),
  productionBrowserSourceMaps: false,
  experimental: { cpus: 2 },
  webpack(config, {isServer, dev}) {
    // One Three instance for the app, R3F, drei and example loaders.
    config.resolve.alias = {...config.resolve.alias, 'three$': regionThreeModule};
    if (releaseId) config.cache = false;
    // A slow, small framework request can hold the entire reader behind it.
    // Keep the home entry and its bootstrap dependencies together; unrelated
    // experimental routes retain their own chunks and CSS stays independent.
    if (!isServer && !dev && config.optimization.splitChunks) {
      config.optimization.splitChunks.maxInitialRequests = 6;
      config.optimization.splitChunks.cacheGroups.coscrollEntry = {
        name: 'coscroll-entry', priority: 50, enforce: true,
        chunks: chunk => ['app/page', 'app/layout', 'main-app'].includes(chunk.name),
        test(module) {
          const resource = module.nameForCondition?.() || '';
          return !!resource && !/\.(?:css|scss|sass)(?:[?#]|$)/.test(resource);
        },
      };
    }
    return config;
  },
  ...(releaseId ? { generateBuildId: async () => releaseId } : {}),
};

export default config;
