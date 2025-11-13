#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const runtimeDir = path.join(__dirname, '..', 'server', 'uploads', 'images', 'runtime');

async function resetRuntimeDir() {
  try {
    await fs.promises.rm(runtimeDir, { recursive: true, force: true });
    await fs.promises.mkdir(runtimeDir, { recursive: true });
    console.log(`[clean-runtime-uploads] Reset ${runtimeDir}`);
  } catch (error) {
    console.error('[clean-runtime-uploads] Failed to reset runtime uploads directory:', error);
    process.exitCode = 1;
  }
}

resetRuntimeDir();
