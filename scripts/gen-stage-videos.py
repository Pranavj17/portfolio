#!/usr/bin/env python3
"""Generate per-chapter stage-completion video montages via NVIDIA NIM image API.

For each of 8 chapters defined in scripts/stage-prompts.json:
  1. POST 5 prompts to NVIDIA NIM image-gen endpoint (FLUX.1-schnell preferred)
  2. Save the returned PNG/JPEG stills to /tmp/stage-frames/{chapter}/
  3. Use ffmpeg to assemble the 5 stills into a 5-second MP4 with
     Ken-Burns pan/zoom + crossfade between frames
  4. Write final MP4 to public/videos/{chapter}.mp4

Usage:
    NVIDIA_API_KEY=nvapi-... python scripts/gen-stage-videos.py
    # Optional: regenerate only one chapter
    NVIDIA_API_KEY=nvapi-... python scripts/gen-stage-videos.py --only itics
    # Skip image generation if frames already exist (just re-render videos)
    python scripts/gen-stage-videos.py --skip-gen

Requires: ffmpeg (system binary)
Stdlib only · no pip install needed.

Output: public/videos/{itics,cmr,college,fever104,sakha,scripbox,vwgt,now}.mp4
"""
import argparse
import base64
import json
import os
import pathlib
import subprocess
import sys
import time
import urllib.request
import urllib.error

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
PROMPTS_FILE = REPO_ROOT / "scripts" / "stage-prompts.json"
FRAMES_DIR = pathlib.Path("/tmp/stage-frames")
VIDEOS_DIR = REPO_ROOT / "public" / "videos"

NVIDIA_BASE = "https://ai.api.nvidia.com/v1/genai"
# FLUX.1-schnell is fast (4 steps) and ~$0.003 per image — preferred.
# SDXL is fallback if FLUX access isn't on the key.
MODEL_PRIMARY = "black-forest-labs/flux.1-schnell"
MODEL_FALLBACK = "stabilityai/stable-diffusion-xl"


def die(msg: str, code: int = 1) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(code)


def gen_image(api_key: str, prompt: str, neg: str, size: str, model: str,
              chapter: str, idx: int, out_path: pathlib.Path) -> bool:
    """POST to NVIDIA NIM image endpoint. Returns True on success."""
    url = f"{NVIDIA_BASE}/{model}"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    # NVIDIA NIM image endpoints constrain dims to specific values.
    # 1344×768 = closest 16:9-ish from the allowed set.
    width, height = 1344, 768
    payload = {
        "prompt": prompt,
        "width": width,
        "height": height,
        "seed": (hash(chapter) + idx) & 0x7FFFFFFF,
    }
    if "flux" in model:
        payload["steps"] = 4
    else:
        payload["steps"] = 25
        payload["negative_prompt"] = neg
        payload["cfg_scale"] = 7.0
    print(f"  [{chapter}/{idx + 1}] → {model}")
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        msg = e.read().decode("utf-8", errors="replace")[:250]
        print(f"    HTTP {e.code}: {msg}", file=sys.stderr)
        return False
    except urllib.error.URLError as e:
        print(f"    network error: {e}", file=sys.stderr)
        return False
    # NVIDIA NIM image responses include either `artifacts[0].base64` or `image`
    b64 = None
    if isinstance(data, dict):
        if "artifacts" in data and data["artifacts"]:
            b64 = data["artifacts"][0].get("base64")
        elif "image" in data:
            b64 = data["image"]
        elif "images" in data and data["images"]:
            b64 = data["images"][0]
    if not b64:
        print(f"    no image in response. Keys: {list(data.keys()) if isinstance(data, dict) else type(data)}",
              file=sys.stderr)
        return False
    # Strip data URL prefix if present
    if b64.startswith("data:"):
        b64 = b64.split(",", 1)[1]
    out_path.write_bytes(base64.b64decode(b64))
    print(f"    saved {out_path.name} ({out_path.stat().st_size // 1024} KB)")
    return True


def render_chapter_video(chapter: str, frame_paths: list, out_mp4: pathlib.Path,
                         seconds_per_frame: float = 1.0) -> bool:
    """ffmpeg: assemble stills into an MP4 with crossfade transitions.
    Simple + reliable: scale each still, fps=30, chain crossfades, cap duration."""
    if len(frame_paths) != 5:
        print(f"  expected 5 frames, got {len(frame_paths)}", file=sys.stderr)
        return False
    duration_per_clip = seconds_per_frame + 0.3
    total_duration = seconds_per_frame * 5 + 0.3
    inputs = []
    for fp in frame_paths:
        inputs.extend(["-loop", "1", "-t", str(duration_per_clip), "-i", str(fp)])
    filter_parts = []
    for i in range(5):
        # Subtle slow pan via crop filter (Ken-Burns lite without zoompan bug)
        # Direction alternates per frame for variety
        pan_x = "0.04*t" if i % 2 == 0 else "-0.04*t"
        filter_parts.append(
            f"[{i}:v]scale=1100:619,crop=1024:576:'(in_w-out_w)/2+{pan_x}*in_w':"
            f"(in_h-out_h)/2,setsar=1,fps=30[v{i}]"
        )
    chain = "[v0]"
    offset = seconds_per_frame
    for i in range(1, 5):
        nxt = f"[xf{i}]" if i < 4 else "[outv]"
        filter_parts.append(
            f"{chain}[v{i}]xfade=transition=fade:duration=0.3:offset={offset}{nxt}"
        )
        chain = nxt
        offset += seconds_per_frame
    fc = ";".join(filter_parts)
    cmd = [
        "ffmpeg", "-y",
        *inputs,
        "-filter_complex", fc,
        "-map", "[outv]",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30",
        "-preset", "fast", "-crf", "23",
        "-t", str(total_duration),
        "-movflags", "+faststart",
        str(out_mp4),
    ]
    print(f"  ffmpeg → {out_mp4.name}")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"  ffmpeg failed (rc={res.returncode}):\n{res.stderr[-500:]}", file=sys.stderr)
        return False
    print(f"  ✓ {out_mp4.name} ({out_mp4.stat().st_size // 1024} KB)")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="Generate only this chapter id")
    ap.add_argument("--skip-gen", action="store_true",
                    help="Skip image generation, just re-render videos from existing frames")
    ap.add_argument("--model", help="Override the model id (default: FLUX, fallback: SDXL)")
    args = ap.parse_args()

    if not PROMPTS_FILE.exists():
        die(f"prompts file not found: {PROMPTS_FILE}")
    prompts = json.loads(PROMPTS_FILE.read_text())
    meta = prompts.get("_meta", {})
    style_suffix = meta.get("style_suffix", "")
    negative = meta.get("negative", "")
    size = meta.get("image_size", "1024x576")
    seconds_per_frame = float(meta.get("seconds_per_frame", 1.0))

    api_key = os.environ.get("NVIDIA_API_KEY", "").strip()
    if not args.skip_gen and not api_key:
        die("NVIDIA_API_KEY env var not set · either export it or run with --skip-gen "
            "to only re-render videos from existing frames in /tmp/stage-frames/")

    model = args.model or MODEL_PRIMARY
    VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
    FRAMES_DIR.mkdir(parents=True, exist_ok=True)

    chapters = [k for k in prompts.keys() if not k.startswith("_")]
    if args.only:
        if args.only not in chapters:
            die(f"unknown chapter: {args.only} · valid: {chapters}")
        chapters = [args.only]

    summary = {"success": [], "fail": []}
    for ch in chapters:
        cfg = prompts[ch]
        mood = cfg.get("mood", "")
        scenes = cfg.get("scenes", [])
        if len(scenes) != 5:
            print(f"WARN: chapter {ch} has {len(scenes)} scenes, need 5 · skipping", file=sys.stderr)
            summary["fail"].append(ch)
            continue
        print(f"\n=== {cfg.get('label', ch)} ({ch}) ===")
        chapter_dir = FRAMES_DIR / ch
        chapter_dir.mkdir(parents=True, exist_ok=True)

        frame_paths = []
        for i, scene in enumerate(scenes):
            out_png = chapter_dir / f"frame_{i:02d}.png"
            if args.skip_gen:
                if not out_png.exists():
                    print(f"  missing {out_png} and --skip-gen set · aborting {ch}", file=sys.stderr)
                    summary["fail"].append(ch)
                    frame_paths = []
                    break
                frame_paths.append(out_png)
                continue
            prompt = f"{scene}. {mood}. {style_suffix}".strip()
            ok = gen_image(api_key, prompt, negative, size, model, ch, i, out_png)
            if not ok and model == MODEL_PRIMARY:
                # Try fallback model once
                print(f"  retry with fallback model {MODEL_FALLBACK}")
                ok = gen_image(api_key, prompt, negative, size, MODEL_FALLBACK, ch, i, out_png)
            if not ok:
                print(f"  FAILED frame {i} for {ch} · skipping chapter", file=sys.stderr)
                summary["fail"].append(ch)
                frame_paths = []
                break
            frame_paths.append(out_png)
            time.sleep(0.4)   # be polite to the API

        if not frame_paths:
            continue
        out_mp4 = VIDEOS_DIR / f"{ch}.mp4"
        if render_chapter_video(ch, frame_paths, out_mp4, seconds_per_frame):
            summary["success"].append(ch)
        else:
            summary["fail"].append(ch)

    print("\n=== SUMMARY ===")
    print(f"  generated: {summary['success']}")
    print(f"  failed:    {summary['fail']}")


if __name__ == "__main__":
    main()
