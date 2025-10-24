#!/usr/bin/env node

const path = require('path');
const { spawn } = require('child_process');

// Get the original working directory where npx was executed
const originalCwd = process.env.INIT_CWD || process.cwd();

// Load dotenv from the host project's directory
require('dotenv').config({ path: path.join(originalCwd, '.env') });
require('dotenv').config({ path: path.join(originalCwd, '.env.local') });
require('dotenv').config({ path: path.join(originalCwd, '.env.production') });
require('dotenv').config({ path: path.join(originalCwd, '.env.production.local') });

// Verify NEXTAUTH_SECRET is loaded
if (!process.env.NEXTAUTH_SECRET) {
  console.error('Warning: NEXTAUTH_SECRET not found in environment variables.');
  console.error('Make sure you have a .env file in your project root with NEXTAUTH_SECRET set.');
  console.error('Folder that was checked:', originalCwd);
}

// Spawn the actual Next.js server
const serverPath = path.join(__dirname, 'dist', 'server.js');
const child = spawn('node', [serverPath], {
  stdio: 'inherit',
  env: process.env,
  cwd: originalCwd
});

child.on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code);
});