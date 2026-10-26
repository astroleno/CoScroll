import { assetUrl } from './assetUrl';
import type { OpeningImageAsset } from '@/config/types';

/** A failed decorative image must never hold up the start gesture. */
export async function loadOpeningImage(asset: OpeningImageAsset, signal: AbortSignal) {
  const response = await fetch(assetUrl(asset.src), { signal, cache: 'force-cache' });
  if (!response.ok) throw new Error('Opening image unavailable');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== asset.bytes) throw new Error('Opening image size mismatch');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  if (sha256 !== asset.sha256) throw new Error('Opening image checksum mismatch');
  signal.throwIfAborted();

  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    signal.throwIfAborted();
    if (image.naturalWidth !== asset.width || image.naturalHeight !== asset.height) {
      throw new Error('Opening image dimensions mismatch');
    }
    return url;
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}
