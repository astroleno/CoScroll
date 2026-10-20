#!/usr/bin/env node
import { resolve } from 'node:path';
import { verifyPackage } from './release-lib.mjs';

try {
  if (!process.argv[2]) throw new Error('Usage: verify-package.mjs <package> [--production]');
  const manifest = await verifyPackage(resolve(process.argv[2]), { production: process.argv.includes('--production') });
  console.log(JSON.stringify({ releaseId: manifest.releaseId, deliveryProfile: manifest.deliveryProfile,
    files: manifest.entries.length, artifactClosureSha256: manifest.artifactClosureSha256, hashes: 'passed' }));
} catch (error) { console.error(error.message); process.exitCode = 1; }
