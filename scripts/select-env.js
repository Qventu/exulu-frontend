#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Path to store history in project root
const rootDir = process.cwd();
const HISTORY_FILE = path.join(rootDir, '.env-selector-history.json');

// Load history
function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.log('Note: Could not load history file');
  }
  return { paths: [] };
}

// Save history
function saveHistory(history) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (err) {
    console.log('Note: Could not save history file');
  }
}

// Add path to history
function addToHistory(envPath, label = null) {
  const history = loadHistory();

  // Remove if it already exists
  history.paths = history.paths.filter(item => item.path !== envPath);

  // Add to beginning
  history.paths.unshift({
    path: envPath,
    label: label || path.basename(path.dirname(envPath)),
    lastUsed: new Date().toISOString()
  });

  // Keep only last 10
  history.paths = history.paths.slice(0, 10);

  saveHistory(history);
}

// Main function
async function selectEnv() {
  const envLink = path.join(rootDir, '.env');
  const history = loadHistory();

  console.log('\n🔧 Environment Configuration Selector\n');
  console.log('This script allows you to symlink a .env file from your Exulu IMP project');
  console.log('when running the frontend as its own repo. In production, the frontend is');
  console.log('packaged and run in the same root as the Exulu server. This script helps');
  console.log('you mimic that behaviour conveniently while running the source version.\n');

  // Check if current .env is a symlink
  if (fs.existsSync(envLink)) {
    try {
      const stats = fs.lstatSync(envLink);
      if (stats.isSymbolicLink()) {
        const target = fs.readlinkSync(envLink);
        console.log(`Current .env is linked to: ${target}\n`);
      } else {
        console.log('Current .env is a regular file (not a symlink)\n');
      }
    } catch (err) {
      console.log('Could not read current .env status\n');
    }
  }

  // Show recently used paths if available
  if (history.paths && history.paths.length > 0) {
    console.log('Recently used environments:\n');

    // Validate that paths still exist
    const validPaths = history.paths.filter(item => {
      const envFile = path.join(item.path, '.env');
      return fs.existsSync(envFile);
    });

    validPaths.forEach((item, index) => {
      const relPath = path.relative(rootDir, item.path);
      const displayPath = relPath.startsWith('..') ? item.path : relPath || '.';
      console.log(`  ${index + 1}. ${item.label || path.basename(item.path)}`);
      console.log(`     ${displayPath}`);
    });

    console.log(`\n  ${validPaths.length + 1}. Enter new path`);
    console.log('  0. Cancel\n');

    rl.question('Select an option: ', (answer) => {
      const choice = parseInt(answer);

      if (choice === 0) {
        console.log('Cancelled.');
        rl.close();
        process.exit(0);
      }

      if (choice > 0 && choice <= validPaths.length) {
        const selectedItem = validPaths[choice - 1];
        const envFile = path.join(selectedItem.path, '.env');
        createSymlink(envFile, envLink);
        addToHistory(selectedItem.path, selectedItem.label);
        rl.close();
      } else if (choice === validPaths.length + 1) {
        promptForNewPath(envLink);
      } else {
        console.log('❌ Invalid selection');
        rl.close();
        process.exit(1);
      }
    });
  } else {
    promptForNewPath(envLink);
  }
}

function promptForNewPath(envLink) {
  console.log('\nEnter the path to the directory containing the .env file you want to use.');
  console.log('(You can use relative or absolute paths, or press Ctrl+C to cancel)\n');

  rl.question('Path to .env directory: ', (inputPath) => {
    if (!inputPath || inputPath.trim() === '') {
      console.log('❌ No path provided');
      rl.close();
      process.exit(1);
    }

    const resolvedPath = path.resolve(rootDir, inputPath.trim());
    const envFile = path.join(resolvedPath, '.env');

    if (!fs.existsSync(resolvedPath)) {
      console.log(`❌ Directory not found: ${resolvedPath}`);
      rl.close();
      process.exit(1);
    }

    if (!fs.existsSync(envFile)) {
      console.log(`❌ No .env file found at: ${envFile}`);
      rl.close();
      process.exit(1);
    }

    // Ask for optional label
    rl.question('\nOptional: Enter a label for this environment (press Enter to skip): ', (label) => {
      createSymlink(envFile, envLink);
      addToHistory(resolvedPath, label.trim() || null);
      rl.close();
    });
  });
}

function createSymlink(source, target) {
  // Remove existing .env if it exists
  if (fs.existsSync(target)) {
    try {
      const stats = fs.lstatSync(target);
      if (stats.isSymbolicLink()) {
        fs.unlinkSync(target);
        console.log('✓ Removed existing symlink');
      } else {
        // Backup the existing file
        const backup = `${target}.backup.${Date.now()}`;
        fs.renameSync(target, backup);
        console.log(`✓ Backed up existing .env to ${path.basename(backup)}`);
      }
    } catch (err) {
      console.error(`❌ Error handling existing .env: ${err.message}`);
      process.exit(1);
    }
  }

  // Create symlink
  try {
    // On Windows, use 'file' type for symlink
    const type = process.platform === 'win32' ? 'file' : null;
    fs.symlinkSync(source, target, type);
    console.log(`\n✅ Successfully linked .env to: ${source}`);
    console.log('\nYou can now run: npm run dev\n');
  } catch (err) {
    if (process.platform === 'win32' && err.code === 'EPERM') {
      console.error('\n❌ Error creating symlink: Permission denied');
      console.error('\nOn Windows, you need one of the following:');
      console.error('  1. Run this script as Administrator, OR');
      console.error('  2. Enable Developer Mode in Windows Settings, OR');
      console.error('  3. Use WSL (Windows Subsystem for Linux)\n');
      console.error('To enable Developer Mode:');
      console.error('  Settings > Update & Security > For Developers > Developer Mode\n');
      process.exit(1);
    }
    console.error(`❌ Error creating symlink: ${err.message}`);
    process.exit(1);
  }
}

// Handle errors and cleanup
rl.on('close', () => {
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n\nCancelled.');
  rl.close();
});

// Run the script
selectEnv().catch(err => {
  console.error(`❌ Error: ${err.message}`);
  rl.close();
  process.exit(1);
});
