# Architecture: Antigravity Direct Brain Slack Bridge

The `agy-slack-bridge` plugin utilizes a multi-process architecture to safely punch through local NATs and firewalls, allowing a cloud-based or mobile human operator to interact directly with their local, autonomous Antigravity agent in real-time.

## Component Overview

1. **Slack App (Cloud)**: Hosts the Socket Mode endpoints and HTTP Web APIs.
2. **Daemon (Local)**: A lightweight, always-on Node.js background process that connects to Slack via Socket Mode. It maintains a local HTTP queue.
3. **Waiter (Local)**: A transient, synchronous script called by the Antigravity agent when it needs human input. It hits the Daemon's local queue and blocks until a message arrives.
4. **TTS Emitter (Local)**: A transient Python script invoked by the agent to convert text responses to audio and upload them to Slack.

## Interaction Flow

```mermaid
sequenceDiagram
    actor User as Human Operator (Slack App)
    participant Slack as Slack API (Cloud)
    participant Daemon as Daemon (Node.js)
    participant Waiter as Waiter (CLI Process)
    participant Agent as Antigravity Agent

    %% Sending a Message
    User->>Slack: Types message or uploads image
    Slack->>Daemon: Pushes event via Socket Mode
    Note over Daemon: Daemon parses text and<br>downloads image via Bot Token
    Daemon->>Daemon: Queues `[SLACK_USER_MESSAGE...]`
    
    %% Agent Polling
    Agent->>Waiter: Executes `node waiter.js` (sync block)
    Waiter->>Daemon: GET `/poll` (HTTP Long Poll)
    Daemon-->>Waiter: Returns queued message
    Waiter-->>Agent: Prints to stdout & exits
    
    %% Agent Responding
    Note over Agent: Agent thinks, generates<br>artifacts or plan
    Agent->>Agent: Writes `status_tts_script.md`
    Agent->>TTS Emitter: Executes `end_of_turn_tts.py`
    TTS Emitter->>Slack: Uploads `.wav` audio & plan file
    Slack-->>User: Plays audio message in chat
```

## Security Model
- **No Inbound Ports**: By utilizing Slack Socket Mode (WebSockets), the daemon requires zero open inbound firewall ports.
- **Secure File Ingestion**: Attached images are downloaded securely over HTTPS using the Bot Token authentication header. No public URLs are ever exposed.
- **Local Enforcement**: The agent never talks directly to Slack for incoming messages; it acts through the heavily restricted `waiter.js` script to prevent uncontrolled prompt injections.
