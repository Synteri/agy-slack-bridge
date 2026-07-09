const request = require('http');

// Set env variables for tests
process.env.SLACK_APP_TOKEN = 'xapp-mock-token';
process.env.SLACK_API_KEY = 'xoxb-mock-key';
process.env.SLACK_TTS_CHANNEL = 'C01234567';
process.env.DAEMON_PORT = '14322';

// Mock SocketModeClient
const mockSocketModeClient = {
    on: jest.fn(),
    start: jest.fn().mockResolvedValue({}),
};
jest.mock('@slack/socket-mode', () => {
    return {
        SocketModeClient: jest.fn().mockImplementation(() => mockSocketModeClient)
    };
});

const daemon = require('../scripts/daemon');

describe('Daemon Server Unit Tests', () => {
    let server;
    let messageHandler;

    beforeAll((done) => {
        server = daemon.server;
        // Capture Slack message handler registered by daemon
        const messageCall = mockSocketModeClient.on.mock.calls.find(call => call[0] === 'message');
        if (messageCall) {
            messageHandler = messageCall[1];
        }
        
        server.listen(14322, done);
    });

    afterAll((done) => {
        clearInterval(daemon.ttsInterval);
        server.close(done);
    });

    beforeEach(() => {
        daemon.messageQueue.length = 0;
        daemon.pendingResponses.length = 0;
    });

    test('should register message callback on start', () => {
        expect(messageHandler).toBeDefined();
    });

    test('should push incoming Slack message to queue if no client is polling', async () => {
        const mockAck = jest.fn();
        await messageHandler({
            event: {
                channel: 'C01234567',
                text: 'Hello from Slack',
            },
            ack: mockAck
        });

        expect(mockAck).toHaveBeenCalled();
        expect(daemon.messageQueue.length).toBe(1);
        expect(daemon.messageQueue[0]).toContain('[SLACK_USER_MESSAGE] User says: "Hello from Slack"');
    });

    test('should respond immediately to HTTP poll if queue has messages', (done) => {
        daemon.messageQueue.push('queued message');

        request.get('http://localhost:14322/poll', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                expect(data).toBe('queued message');
                expect(daemon.messageQueue.length).toBe(0);
                done();
            });
        });
    });

    test('should register pending response for long-polling if queue is empty', (done) => {
        const req = request.get('http://localhost:14322/poll', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                expect(data).toContain('Realtime message');
                done();
            });
        });

        // Give the request a moment to establish
        setTimeout(async () => {
            expect(daemon.pendingResponses.length).toBe(1);
            
            // Simulate Slack message arriving
            const mockAck = jest.fn();
            await messageHandler({
                event: {
                    channel: 'C01234567',
                    text: 'Realtime message',
                },
                ack: mockAck
            });
        }, 100);
    });
});
