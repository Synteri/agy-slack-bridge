"""
author: Gemini Antigravity
created: 07-08-2026 00:05 EST
"""
import os
import sys
import argparse
import time
import subprocess
import traceback

workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))

def load_env():
    env_jttw = os.path.join(workspace_dir, ".env.jttw")
    if os.path.exists(env_jttw):
        with open(env_jttw, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip() and not line.startswith('#'):
                    parts = line.strip().split('=', 1)
                    if len(parts) == 2 and not os.environ.get(parts[0]):
                        os.environ[parts[0]] = parts[1]

def main():
    parser = argparse.ArgumentParser(description="End of Turn TTS Generator and Slack Forwarder")
    parser.add_argument("--text-file", default="", help="Path to the TTS script markdown file")
    parser.add_argument("--text", default="", help="Raw text content to synthesize")
    parser.add_argument("--subject", default="", help="Subject line for the Slack message")
    parser.add_argument("--plan-file", default="", help="Path to the implementation plan markdown file")
    parser.add_argument("--voice", default="bm_george", help="Voice ID for Kokoro")
    args = parser.parse_args()

    text = args.text
    subject = args.subject

    if args.text_file and os.path.exists(args.text_file):
        with open(args.text_file, 'r', encoding='utf-8') as f:
            file_text = f.read().strip()
            
        if file_text:
            lines = file_text.split('\n')
            if lines[0].startswith("SUBJECT:"):
                subject = lines[0][8:].strip()
                text = '\n'.join(lines[1:]).strip()
            else:
                text = file_text

    if not text:
        print("No text provided.")
        sys.exit(0)


    load_env()
    token = os.environ.get("SLACK_API_KEY")
    channel = os.environ.get("SLACK_TTS_CHANNEL")

    if not token or not channel:
        print("ERROR: Missing SLACK_API_KEY or SLACK_TTS_CHANNEL in environment.")
        sys.exit(1)

    # Initialize Kokoro Engine
    kokoro_dir = os.environ.get("KOKORO_DIR") or os.path.abspath(os.path.join(workspace_dir, "Tooling", "Kokoro-82M"))
    if kokoro_dir:
        sys.path.append(kokoro_dir)
    
    try:
        from tts_engine import KokoroEngine
        import numpy as np
        import soundfile as sf
    except ImportError as e:
        print(f"Failed to import Kokoro dependencies: {e}")
        print("Make sure you are running this script in the correct virtual environment or that dependencies are installed globally.")
        sys.exit(1)

    try:
        print(f"Generating TTS for: {text[:60]}...")
        engine = KokoroEngine(lang_code='a')
        
        audio_chunks = list(engine.generate_yield(text, voice=args.voice))
        if not audio_chunks:
            print("No audio generated.")
            sys.exit(1)
            
        combined = np.concatenate(audio_chunks)
        req_id = f"eot_{int(time.time())}"
        wav_path = os.path.join(workspace_dir, "lexis", "tts_cache", f"{req_id}.wav")
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(wav_path), exist_ok=True)
        
        sf.write(wav_path, combined, engine.sample_rate)
        print(f"Saved audio to {wav_path}.")

        # Forward to Slack
        forwarder_script = os.path.join(workspace_dir, 'plugins', 'agy-slack-bridge', 'scripts', 'slack_tts_forwarder.py')
        cmd = [
            sys.executable,
            forwarder_script,
            '--text', text,
            '--wav-path', wav_path,
            '--token', token,
            '--channel', channel
        ]
        if subject:
            cmd.extend(['--subject', subject])
        if args.plan_file:
            cmd.extend(['--plan-file', args.plan_file])
        
        print(f"Forwarding to Slack channel {channel}...")
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"Forwarding failed: {result.stderr}")
            sys.exit(1)
            
        print("Successfully sent end-of-turn TTS message to Slack.")
    except Exception as e:
        print(f"An error occurred: {e}")
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
