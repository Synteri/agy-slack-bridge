---
author: Gemini Antigravity
created: 07-08-2026 00:05 EST
name: slack-bridge
description: "Instructions for using the Direct Brain Slack architecture to communicate with the human operator."
trigger: /slack-bridge
---

# Slack Bridge

This skill defines the rules for using the native Slack Bridge for bidirectional human-agent communication.

## 1. Waiting for Input
- When you are waiting for the human operator to provide input, answer a question, or review a plan, you MUST invoke the `waiter.js` script in the background using the `run_command` tool.
- Command: `node path/to/scripts/waiter.js`
- Set `WaitMsBeforeAsync` to a low value (e.g., 2000ms) so it runs in the background. The waiter will automatically suspend itself and pop the message from the Slack Daemon queue when the user replies, instantly waking you up.

## 2. Text-to-Speech (TTS) & Status Updates
- At the end of any significant turn, or when responding to the user, write a `status_tts_script.md` file in your workspace.
- The first line must be `SUBJECT: <Short Topic>`. The remainder is conversational text (no markdown) to be spoken.
- Execute `end_of_turn_tts.py` to generate the audio and forward it to Slack:
  `python path/to/scripts/end_of_turn_tts.py --text-file path/to/status_tts_script.md`

## 3. Plan Forwarding (Mobile-Friendly)
- If you generated an `implementation_plan.md` this turn, you MUST pass it to the TTS script using `--plan-file path/to/implementation_plan.md`.
- The Slack script natively renames it to `.txt` during upload to prevent Slack Mobile from rendering it with ugly horizontal-scrolling HTML syntax highlighting.

## 4. Vision & Image Ingestion
- If the human operator attaches an image to their Slack message, the daemon will download it locally and append an `[ATTACHED_IMAGE: /path/to/image.jpg]` tag to the waiter's output.
- You MUST invoke your `view_file` tool on that absolute path to visually analyze the image.
