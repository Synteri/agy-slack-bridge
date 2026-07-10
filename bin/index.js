#!/usr/bin/env node

/**
 * author: OVS Intelligence LLC
 * created: 07-09-2026 15:30 EST
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

console.log('Starting Antigravity Slack Bridge CLI Daemon...');

// Search for a local .env file in the current working directory, walking up if not found
let foundEnvPath = null;
let currentDir = process.cwd();
while (currentDir) {
    const checkPath = path.join(currentDir, '.env');
    const checkPathJttw = path.join(currentDir, '.env.jttw');
    if (fs.existsSync(checkPath)) {
        foundEnvPath = checkPath;
        break;
    } else if (fs.existsSync(checkPathJttw)) {
        foundEnvPath = checkPathJttw;
        break;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break; // Reached root
    currentDir = parentDir;
}

if (foundEnvPath) {
    console.log(`Loading environment from ${foundEnvPath}`);
    try {
        require('dotenv').config({ path: foundEnvPath });
    } catch (e) {
        // Fallback manual parse if dotenv is not loaded
        try {
            const content = fs.readFileSync(foundEnvPath, 'utf-8');
            content.split('\n').forEach(line => {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const parts = trimmed.split('=');
                    if (parts.length >= 2) {
                        const key = parts[0].trim();
                        const val = parts.slice(1).join('=').trim();
                        if (!process.env[key]) {
                            process.env[key] = val;
                        }
                    }
                }
            });
        } catch (err) {}
    }
} else {
    console.log('No environment file (.env or .env.jttw) found in current workspace tree. Falling back to system environment variables.');
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
