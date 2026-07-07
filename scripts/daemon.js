const { SocketModeClient } = require('@slack/socket-mode');
const fs = require('fs');
const path = require('path');
const http = require('http');

const envPath = path.join(__dirname, '..', '.env.jttw');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const parts = line.trim().split('=');
    if (parts.length >= 2) {
        envVars[parts[0]] = parts.slice(1).join('=');
    }
});

const appToken = envVars['SLACK_APP_TOKEN'];
const botToken = envVars['SLACK_API_KEY'];
const channelId = envVars['SLACK_TTS_CHANNEL'];

const socketModeClient = new SocketModeClient({ appToken });
const messageQueue = [];
const pendingResponses = [];
const https = require('https');

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
                reject(new Error(`Failed to download: ${response.statusCode}`));
            }
        });
        request.on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

socketModeClient.on('message', async ({ event, body, ack }) => {
    try { await ack(); } catch(e) {}
    
    if (event.channel === channelId && !event.bot_id && !event.subtype) {
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
        
        if (pendingResponses.length > 0) {
            const pendingResponse = pendingResponses.shift();
            pendingResponse.writeHead(200, { 'Content-Type': 'text/plain' });
            pendingResponse.end(msg);
        } else {
            messageQueue.push(msg);
        }
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

(async () => {
    try {
        server.listen(14321, () => {
            console.log('Daemon HTTP server running on port 14321');
        });
        await socketModeClient.start();
        console.log('Slack Direct Brain Daemon is connected and running.');
    } catch (e) {
        console.error('Failed to start:', e);
    }
})();
