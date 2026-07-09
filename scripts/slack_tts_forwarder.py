"""
author: Gemini Antigravity
created: 07-08-2026 00:05 EST
"""
# slack_tts_forwarder.py — forwards Kokoro TTS audio to Slack
# SLACK_TTS_BOT_TOKEN — env var for Slack bot token (xoxb-...)
# SLACK_TTS_CHANNEL   — env var for Slack channel ID (e.g. C0123456789)
# Usage: python slack_tts_forwarder.py --text "spoken text" --wav-path "path/to/file.wav"
import argparse
import os
import sys
import json
import urllib.request
import urllib.error


def get_upload_url(token, filename, length):
    import urllib.parse
    query = urllib.parse.urlencode({"filename": filename, "length": length})
    url = f"https://slack.com/api/files.getUploadURLExternal?{query}"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {token}"
    })
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())



def upload_to_url(upload_url, file_path, content_type="audio/wav"):
    with open(file_path, "rb") as f:
        data = f.read()
    req = urllib.request.Request(upload_url, data=data, method="POST", headers={
        "Content-Type": content_type
    })
    with urllib.request.urlopen(req) as r:
        return r.status


def complete_upload(token, file_id, channel, title):
    url = "https://slack.com/api/files.completeUploadExternal"
    data = json.dumps({
        "files": [{"id": file_id, "title": title}],
        "channel_id": channel
    }).encode()
    req = urllib.request.Request(url, data=data, headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    })
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def post_text(token, channel, text):
    url = "https://slack.com/api/chat.postMessage"
    data = json.dumps({"channel": channel, "text": text}).encode()
    req = urllib.request.Request(url, data=data, headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    })
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def main():
    parser = argparse.ArgumentParser(description="Forward TTS audio to Slack")
    parser.add_argument("--text", required=True, help="TTS text content")
    parser.add_argument("--wav-path", required=True, help="Path to .wav file")
    parser.add_argument("--plan-file", help="Optional path to implementation_plan.md to upload")
    parser.add_argument("--subject", help="Optional subject line for the Slack message")
    parser.add_argument("--channel", default=os.environ.get("SLACK_TTS_CHANNEL"), help="Slack channel ID")
    parser.add_argument("--token", default=os.environ.get("SLACK_TTS_BOT_TOKEN") or os.environ.get("SLACK_API_KEY"), help="Slack bot token")
    args = parser.parse_args()

    if not args.token:
        print("ERROR: No token. Set SLACK_TTS_BOT_TOKEN or pass --token.", file=sys.stderr)
        sys.exit(1)
    if not args.channel:
        print("ERROR: No channel. Set SLACK_TTS_CHANNEL or pass --channel.", file=sys.stderr)
        sys.exit(1)
    if not os.path.exists(args.wav_path):
        print(f"ERROR: wav file not found: {args.wav_path}", file=sys.stderr)
        sys.exit(1)

    wav_size = os.path.getsize(args.wav_path)
    filename = os.path.basename(args.wav_path)

    try:
        upload_resp = get_upload_url(args.token, filename, wav_size)
        if not upload_resp.get("ok"):
            print(f"ERROR: getUploadURLExternal failed: {upload_resp.get('error')}", file=sys.stderr)
            sys.exit(1)

        upload_to_url(upload_resp["upload_url"], args.wav_path, "audio/wav")

        complete_resp = complete_upload(args.token, upload_resp["file_id"], args.channel, f"TTS: {args.text[:60]}")
        if not complete_resp.get("ok"):
            print(f"ERROR: completeUploadExternal failed: {complete_resp.get('error')}", file=sys.stderr)
            sys.exit(1)

        slack_text = f"*{args.subject}*\n\n*TTS:* {args.text}" if args.subject else f"*TTS:* {args.text}"
        msg_resp = post_text(args.token, args.channel, slack_text)
        if not msg_resp.get("ok"):
            print(f"WARNING: chat.postMessage failed: {msg_resp.get('error')}", file=sys.stderr)

        if args.plan_file and os.path.exists(args.plan_file):
            plan_size = os.path.getsize(args.plan_file)
            plan_filename = os.path.basename(args.plan_file)
            if plan_filename.endswith(".md"):
                plan_filename = plan_filename[:-3] + ".txt"
                
            upload_resp_plan = get_upload_url(args.token, plan_filename, plan_size)
            if upload_resp_plan.get("ok"):
                upload_to_url(upload_resp_plan["upload_url"], args.plan_file, "text/plain")
                complete_resp_plan = complete_upload(args.token, upload_resp_plan["file_id"], args.channel, "Implementation Plan")
                if not complete_resp_plan.get("ok"):
                    print(f"WARNING: plan completeUploadExternal failed: {complete_resp_plan.get('error')}", file=sys.stderr)
            else:
                print(f"WARNING: plan getUploadURLExternal failed: {upload_resp_plan.get('error')}", file=sys.stderr)

        print(f"Slack: sent {filename} to {args.channel}")

    except urllib.error.URLError as e:
        print(f"ERROR: network error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
