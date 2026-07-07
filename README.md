# Antigravity Slack Bridge

A native open-source plugin for Antigravity that enables the **Direct Brain Architecture**: seamless, bidirectional Slack communication and Text-to-Speech (TTS) between autonomous agents and human operators.

> **Compatibility note:** This plugin was built and run with **Antigravity Desktop**. The installation command below uses the `agy` CLI, but the runtime paths in this repository are workspace-relative rather than Desktop-specific, so any Antigravity environment that installs the plugin under `plugins/agy-slack-bridge` should use the same setup.

## Features
- **Persistent Connection**: Uses Slack Socket Mode to bypass firewalls and maintain a 24/7 connection.
- **Instant Wakeups**: The `waiter.js` polling architecture guarantees instant agent wakeups without orphaned connections.
- **Audio TTS**: Forwards agent responses as native Slack audio attachments.
- **Mobile-Friendly Artifacts**: Uploads implementation plans using `.txt` extensions to bypass Slack Mobile's broken Markdown renderer.
- **Vision Ingestion**: Automatically downloads user-attached images and forwards the absolute paths to the agent for visual analysis.

## Setup

1. Install this plugin into your Antigravity workspace:
   ```bash
   agy plugin install https://github.com/OVS-Intelligence/agy-slack-bridge
   ```
2. Create a Slack App in your workspace and enable **Socket Mode**.
3. Obtain your App Token (`xapp-...`) and Bot Token (`xoxb-...`).
4. Set the following environment variables in a `.env` file at the root of your workspace:
   ```env
   SLACK_APP_TOKEN=xapp-...
   SLACK_API_KEY=xoxb-...
   SLACK_TTS_CHANNEL=C01234567
   ```
5. Run the background daemon from the workspace root:
   ```bash
   node plugins/agy-slack-bridge/scripts/daemon.js
   ```

## Usage

The included `slack-bridge` skill automatically instructs your agents to use the Waiter script (`scripts/waiter.js`) to pause execution and the Emitter scripts (`scripts/end_of_turn_tts.py`) to send audio responses.

## Roadmap

*   **TTS Engine Abstraction**: Currently, the TTS scripts assume a local `Kokoro-82M` python environment. Future feature branches will abstract this to support plug-and-play TTS models (e.g., OpenAI TTS, ElevenLabs, or system-native TTS) via environment variables.
