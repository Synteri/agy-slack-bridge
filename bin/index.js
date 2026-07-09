#!/usr/bin/env node

/**
 * author: OVS Intelligence LLC
 * created: 07-09-2026 15:30 EST
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

console.log('Starting Antigravity Slack Bridge CLI Daemon...');

// Search for a local .env file in the current working directory
const cwdEnvPath = path.join(process.cwd(), '.env');
if (fs.existsSync(cwdEnvPath)) {
    console.log(`Loading environment from ${cwdEnvPath}`);
    try {
        require('dotenv').config({ path: cwdEnvPath });
    } catch (e) {
        // Fallback if dotenv is not loaded
    }
} else {
    console.log('No local .env file found in current directory. Falling back to system environment variables.');
}

// Locate the daemon script inside the package
const daemonPath = path.join(__dirname, '..', 'scripts', 'daemon.js');

// Spawn the daemon process and pipe outputs
const daemon = spawn('node', [daemonPath], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit'
});

daemon.on('close', (code) => {
    console.log(`Slack Bridge Daemon exited with code ${code}`);
    process.exit(code);
});

process.on('SIGINT', () => {
    daemon.kill('SIGINT');
    process.exit(0);
});

process.on('SIGTERM', () => {
    daemon.kill('SIGTERM');
    process.exit(0);
});
