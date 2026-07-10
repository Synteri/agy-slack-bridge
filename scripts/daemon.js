const { SocketModeClient } = require('@slack/socket-mode');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');

// Load dotenv configuration if available
try {
    require('dotenv').config();
} catch (e) {}

// Fallback manual parser for .env or .env.jttw if process.env values are not set
if (!process.env.SLACK_APP_TOKEN) {
    const workspaceDir = path.resolve(__dirname, '..', '..', '..');
    const fallbackPaths = [
        path.join(workspaceDir, '.env'),
        path.join(workspaceDir, '.env.jttw'),
        path.join(__dirname, '..', '.env')
    ];
    for (const envFilePath of fallbackPaths) {
        if (fs.existsSync(envFilePath)) {
            try {
                const envContent = fs.readFileSync(envFilePath, 'utf-8');
                envContent.split('\n').forEach(line => {
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
            } catch (e) {
                console.warn(`Failed to read env file at ${envFilePath}:`, e.message);
            }
        }
    }
}

const appToken = process.env.SLACK_APP_TOKEN;
const botToken = process.env.SLACK_API_KEY || process.env.SLACK_BOT_TOKEN;
const channelId = process.env.SLACK_TTS_CHANNEL;
const daemonPort = parseInt(process.env.DAEMON_PORT || '14321', 10);

const socketModeClient = new SocketModeClient({ appToken });

const messageQueue = [];
const pendingResponses = [];

const downloadsDir = path.join(__dirname, '..', 'scratch', 'slack_downloads');
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
}

function downloadFile(url, dest, token) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const request = https.get(url, { headers: { Authorization: `Bearer ${token}` } }, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close(resolve);
                });
            } else {
                file.destroy();
                fs.unlink(dest, () => {});
                reject(new Error(`Failed to download: ${response.statusCode}`));
            }
        });
        request.on('error', (err) => {
            file.destroy();
            fs.unlink(dest, () => {});
            reject(err);
        });
        file.on('error', (err) => {
            file.destroy();
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

socketModeClient.on('message', async ({ event, body, ack }) => {
    try { await ack(); } catch(e) {}
    
    try {
        if (event && event.channel === channelId && !event.bot_id && !event.subtype) {
            let msg = `[SLACK_USER_MESSAGE] User says: "${event.text || ''}"\n`;
            
            if (event.files && event.files.length > 0) {
                for (const file of event.files) {
                    if (file.mimetype && file.mimetype.startsWith('image/')) {
                        const dest = path.join(downloadsDir, Date.now() + '_' + file.name);
                        try {
                            await downloadFile(file.url_private_download || file.url_private, dest, botToken);
                            msg += `[ATTACHED_IMAGE: ${dest}]\n`;
                        } catch (e) {
                            console.error('Failed to download image', e);
                        }
                    }
                }
            }
            
            // Use HTTP polling system instead of exec inject
            if (pendingResponses.length > 0) {
                const pendingResponse = pendingResponses.shift();
                try {
                    pendingResponse.writeHead(200, { 'Content-Type': 'text/plain' });
                    pendingResponse.end(msg);
                } catch (err) {
                    console.error('Failed to respond to pending poll request:', err.message);
                    messageQueue.push(msg);
                }
            } else {
                messageQueue.push(msg);
            }
        }
    } catch (error) {
        console.error('Error processing Slack Socket Mode message:', error);
    }
});

const server = http.createServer((req, res) => {
    if (req.url === '/poll') {
        if (messageQueue.length > 0) {
            const msg = messageQueue.shift();
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(msg);
        } else {
            // Close any existing pending responses to prevent overlapping Waiters
            while (pendingResponses.length > 0) {
                const oldRes = pendingResponses.shift();
                oldRes.writeHead(200, { 'Content-Type': 'text/plain' });
                oldRes.end('');
            }
            pendingResponses.push(res);
            req.on('close', () => {
                const idx = pendingResponses.indexOf(res);
                if (idx !== -1) pendingResponses.splice(idx, 1);
            });
        }
    } else {
        res.writeHead(404);
        res.end();
    }
});

if (require.main === module) {
    (async () => {
        try {
            server.listen(daemonPort, () => {
                console.log(`Daemon HTTP server running on port ${daemonPort}`);
            });
            await socketModeClient.start();
            console.log('Slack Direct Brain Daemon is connected and running.');
        } catch (e) {
            console.error('Failed to start:', e);
        }
    })();
}

// --- TTS Queue Processor ---
const ttsQueue = [];
let isProcessingTTS = false;
const ttsQueuePath = process.env.TTS_QUEUE_PATH || path.join(__dirname, '..', '..', '..', 'scratch', 'tts_queue.jsonl');
let lastProcessedLine = 0;

// Enforce Rule 13.2 memory safety limit (10MB)
const MAX_QUEUE_FILE_SIZE = 10 * 1024 * 1024;

// Asynchronously initialize queue length on startup
(async () => {
    try {
        const stats = await fs.promises.stat(ttsQueuePath);
        if (stats.size > MAX_QUEUE_FILE_SIZE) {
            console.warn(`[TTS] Queue log file ${ttsQueuePath} exceeds 10MB limit. Resetting tracker to prevent memory issues.`);
        }
        const content = await fs.promises.readFile(ttsQueuePath, 'utf-8');
        lastProcessedLine = content.split('\n').filter(Boolean).length;
    } catch (err) {
        lastProcessedLine = 0;
    }
})();

const ttsInterval = setInterval(async () => {
    try {
        const stats = await fs.promises.stat(ttsQueuePath);
        if (stats.size > MAX_QUEUE_FILE_SIZE) {
            console.warn(`[TTS] Queue log file too large (${stats.size} bytes). Skipping to prevent memory issues.`);
            return;
        }
        const content = await fs.promises.readFile(ttsQueuePath, 'utf-8');
        const lines = content.split('\n').filter(Boolean);
        if (lines.length > lastProcessedLine) {
            for (let i = lastProcessedLine; i < lines.length; i++) {
                try {
                    ttsQueue.push(JSON.parse(lines[i]));
                } catch (e) {}
            }
            lastProcessedLine = lines.length;
            pumpTTSQueue();
        }
    } catch (err) {
        // Queue file might not exist yet, ignore
    }
}, 2000);

function pumpTTSQueue() {
    if (isProcessingTTS || ttsQueue.length === 0) return;
    isProcessingTTS = true;
    const task = ttsQueue.shift();
    
    const pythonExe = process.env.KOKORO_PYTHON_PATH || 'python';
    const scriptPath = path.join(__dirname, 'end_of_turn_tts.py');
    const args = [scriptPath, '--text', task.text];
    if (task.subject) args.push('--subject', task.subject);
    if (task.plan_file) args.push('--plan-file', task.plan_file);
    
    console.log(`[TTS] Spawning generation for subject: ${task.subject || 'No Subject'}`);
    const proc = spawn(pythonExe, args);
    proc.stdout.on('data', data => process.stdout.write(`[TTS] ${data}`));
    proc.stderr.on('data', data => process.stderr.write(`[TTS ERR] ${data}`));
    
    proc.on('close', (code) => {
        console.log(`[TTS] Process exited with code ${code}`);
        isProcessingTTS = false;
        pumpTTSQueue();
    });
}

module.exports = {
    server,
    messageQueue,
    pendingResponses,
    socketModeClient,
    downloadsDir,
    daemonPort,
    ttsInterval
};
