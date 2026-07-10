/**
 * author: Gemini Antigravity
 * created: 07-08-2026 00:05 EST
 */
const http = require('http');

const daemonPort = parseInt(process.env.DAEMON_PORT || '14321', 10);
const url = `http://localhost:${daemonPort}/poll`;

const req = http.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        process.stdout.write(data);
        process.exit(0);
    });
});

req.setTimeout(300000, () => {
    req.destroy();
    console.error('Timeout waiting for user response from Slack.');
    process.exit(1);
});

req.on('error', (e) => {
    console.error('Daemon not reachable:', e.message);
    process.exit(1);
});
