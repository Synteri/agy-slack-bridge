# Antigravity Slack Bridge

[![Build Status](https://github.com/Synteri/agy-slack-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/Synteri/agy-slack-bridge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-blue.svg)](https://nodejs.org)
[![Python Version](https://img.shields.io/badge/python-%3E%3D3.8-blue.svg)](https://python.org)

A native open-source plugin for the [Antigravity CLI](https://github.com/google-antigravity/antigravity-cli) that enables the **Direct Brain Architecture**: seamless, bidirectional Slack communication and Text-to-Speech (TTS) between autonomous agents and human operators.

---

> [!TIP]
> ### 🚀 Need Custom AI Agent Solutions?
> **OVS Intelligence LLC** builds enterprise-grade multi-agent systems, automated EHR integrations, custom voice/TTS pipelines, and Slack-based human-in-the-loop orchestrations.
> 
> *   **Looking to hire or consult?** Contact us at [architect@ovsintelligence.com](mailto:architect@ovsintelligence.com) or visit [ovsintelligence.com](https://ovsintelligence.com).

---

## Features

- **Persistent Firewall Traversal**: Uses **Slack Socket Mode** (WebSockets) to safely punch through local NATs and firewalls without opening inbound ports.
- **Instant Agent Wakeups**: Lightweight Waiter polling system (`waiter.js`) prevents hanging connections and guarantees instant agent activation upon user response.
- **Local Audio Text-To-Speech**: Automatically synthesizes agent responses into high-quality audio files using the local Kokoro-82M model and posts them as Slack audio players.
- **Mobile-Friendly Plan Rendering**: Native file-uploader renames implementation plan files to `.txt` during Slack uploads to bypass Slack Mobile's broken Markdown layout rendering.
- **Vision Ingestion**: Securely downloads user-attached images and exposes absolute file paths to the agent's visual tokenizers.

---

## Architecture Overview

```mermaid
sequenceDiagram
    actor User as Human Operator (Slack App)
    participant Slack as Slack API (Cloud)
    participant Daemon as Daemon CLI (Node.js)
    participant Waiter as Waiter (CLI Process)
    participant Agent as Antigravity Agent

    %% Message Loop
    User->>Slack: Send message or upload image
    Slack->>Daemon: Push event via Socket Mode
    Note over Daemon: Download attachments securely<br/>and queue event
    Daemon->>Daemon: Message Queued

    %% Polling Loop
    Agent->>Waiter: Execute 'node waiter.js' (Sync Block)
    Waiter->>Daemon: GET /poll (HTTP Long Poll)
    Daemon-->>Waiter: Return queued message
    Waiter-->>Agent: Print stdout & exit

    %% TTS response loop
    Note over Agent: Think, generate plan<br/>and write status_tts_script.md
    Agent->>Daemon: Write to tts_queue.jsonl
    Note over Daemon: Trigger Python Kokoro-82M<br/>TTS audio generation
    Daemon->>Slack: Upload .wav & plan file
    Slack-->>User: Play voice message in Slack
```

---

## Getting Started

### 1. Installation

Install the plugin into your local Antigravity workspace:

```bash
agy plugin install https://github.com/Synteri/agy-slack-bridge
```

### 2. Configuration

Create a `.env` file in the root of your workspace:

```env
# Slack Credentials
SLACK_APP_TOKEN=xapp-1-A123-your-app-token
SLACK_API_KEY=xoxb-your-bot-token
SLACK_TTS_CHANNEL=C01234567

# Port Configuration
DAEMON_PORT=14321

# Local TTS Engine Configuration
KOKORO_PYTHON_PATH=C:\path\to\venv\Scripts\python.exe
KOKORO_DIR=C:\path\to\Kokoro-82M
TTS_QUEUE_PATH=scratch/tts_queue.jsonl
TTS_VOICE=bm_george
```

### 3. Running the Daemon

You can run the daemon directly using npm:

```bash
# Run locally
npm run start

# Or run globally via npx
npx agy-slack-bridge
```

---

## Running Tests

Verify code correctness and connection mocks using Jest:

```bash
npm run test
```

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
