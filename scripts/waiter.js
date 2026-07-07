const http = require('http');

const req = http.get('http://localhost:14321/poll', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        process.stdout.write(data);
        process.exit(0);
    });
});
req.on('error', (e) => {
    console.error('Daemon not reachable:', e.message);
    process.exit(1);
});
