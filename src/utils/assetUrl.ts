const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const assetsBase = process.env.NEXT_PUBLIC_ASSET_BASE || `${basePath}/`;
const mediaBase = process.env.NEXT_PUBLIC_MEDIA_BASE || assetsBase;

function logicalPath(path: string): string {
  let relativePath = path.replace(/^(?:\.\/|\/)+/, '');
  const prefix = basePath.replace(/^\//, '');
  const compatiblePrefix = prefix.toLowerCase() === 'coscroll'
    && relativePath.slice(0, prefix.length + 1).toLowerCase() === 'coscroll/';
  if (prefix && (relativePath.startsWith(`${prefix}/`) || compatiblePrefix)) {
    relativePath = relativePath.slice(prefix.length + 1);
  }
  if (relativePath.split(/[/?#]/).some(part => decodeURIComponent(part) === '..') || /%2f|%5c|\\/i.test(relativePath)) {
    throw new Error('Asset paths must stay inside the release');
  }
  return relativePath;
}

function resolveUrl(path: string, base: string): string {
  if (/^(?:https?:|data:|blob:|\/\/)/i.test(path)) return path;
  return `${base.replace(/\/$/, '')}/${logicalPath(path)}`;
}

/** Resolve logical public paths once, including paths read from project JSON. */
export function assetUrl(path: string): string {
  if (/^(?:https?:|data:|blob:|\/\/)/i.test(path)) return path;
  return resolveUrl(path, /^audio\//.test(logicalPath(path)) ? mediaBase : assetsBase);
}

export function mediaUrl(path: string): string {
  return resolveUrl(path, mediaBase);
}
