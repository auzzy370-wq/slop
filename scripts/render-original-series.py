#!/usr/bin/env python3
"""Render any SLOP original series episode from exported scripts JSON."""
from __future__ import annotations

import json
import subprocess
import sys
import time
import wave
from pathlib import Path

ROOT = Path("/tmp/slop-originals")
STILLS = ROOT / "stills"
WORK = ROOT / "work"
PUBLIC_VID = Path("/workspace/public/videos")
PUBLIC_THUMB = Path("/workspace/public/thumbnails")
SCRIPTS = ROOT / "all-scripts.json"
VOICES_FILE = ROOT / "voices.json"

DEFAULT_VOICE = "en-US-GuyNeural"


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def wav_duration(path: Path) -> float:
    with wave.open(str(path), "rb") as w:
        return w.getnframes() / float(w.getframerate())


def ass_timestamp(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def synth(text: str, voice: str, out_mp3: Path) -> None:
    clean = (
        text.replace("…", "...")
        .replace("—", "-")
        .replace("–", "-")
        .replace("'", "'")
        .replace("'", "'")
    )
    for attempt in range(4):
        try:
            subprocess.run(
                [
                    "python3", "-m", "edge_tts",
                    "--voice", voice,
                    "--text", clean,
                    "--write-media", str(out_mp3),
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
            )
            return
        except subprocess.CalledProcessError:
            time.sleep(1.2 * (attempt + 1))
    raise RuntimeError(f"TTS failed: {clean[:80]}")


def pick_still(series_id: str, mood: str, i: int) -> Path:
    pool = STILLS / series_id
    files = sorted(pool.glob("*.jpg"))
    if not files:
        # global fallback
        files = sorted(STILLS.glob("*/*.jpg"))
    if not files:
        raise SystemExit(f"no stills for {series_id}")
    return files[i % len(files)]


def make_clip(still: Path, duration: float, out: Path, zoom_in: bool) -> None:
    frames = max(1, int(duration * 30))
    if zoom_in:
        z = "z='min(zoom+0.0009,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
    else:
        z = "z='if(eq(on,1),1.12,max(zoom-0.0009,1.0))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
    vf = (
        f"scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,"
        f"zoompan={z}:d={frames}:s=720x1280:fps=30,"
        f"eq=contrast=1.05:saturation=1.06,format=yuv420p"
    )
    run([
        "ffmpeg", "-y", "-loop", "1", "-i", str(still),
        "-vf", vf, "-t", f"{duration:.3f}", "-r", "30",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "24",
        "-pix_fmt", "yuv420p", "-an", str(out),
    ])


def render(series_id: str, ep: int) -> Path:
    data = json.loads(SCRIPTS.read_text())
    voices = json.loads(VOICES_FILE.read_text()).get(series_id, {})
    series = data[series_id]
    script = next(s for s in series if s["episodeNumber"] == ep)
    work = WORK / series_id / f"ep{ep:02d}"
    audio_dir = work / "audio"
    clips_dir = work / "clips"
    audio_dir.mkdir(parents=True, exist_ok=True)
    clips_dir.mkdir(parents=True, exist_ok=True)

    beats = script["beats"]
    mood = script.get("mood", "secret")
    durations: list[float] = []
    padded: list[Path] = []
    cues: list[tuple[float, float, str, str]] = []
    t = 0.0

    print(f"[{series_id}] ep {ep}: {script['title']} ({len(beats)} beats)")
    for i, beat in enumerate(beats):
        btype = beat["type"]
        if btype == "dialogue":
            speaker = beat.get("speaker", "NARRATOR")
            text = beat["text"]
            kind = "dlg"
        else:
            speaker = "NARRATOR"
            text = beat["text"]
            kind = "narr"
        voice = voices.get(speaker, voices.get("NARRATOR", DEFAULT_VOICE))
        mp3 = audio_dir / f"{i:02d}.mp3"
        wav = audio_dir / f"{i:02d}.wav"
        synth(text, voice, mp3)
        run(["ffmpeg", "-y", "-i", str(mp3), "-ar", "44100", "-ac", "1", str(wav)])
        min_sec = max(1.3, beat.get("durationMs", 2200) / 1000.0)
        dur = max(min_sec, wav_duration(wav) + 0.28)
        pad = audio_dir / f"{i:02d}_pad.wav"
        run([
            "ffmpeg", "-y", "-i", str(wav),
            "-af", f"apad=whole_dur={dur:.3f}", "-t", f"{dur:.3f}", str(pad),
        ])
        durations.append(dur)
        padded.append(pad)
        label = f"{speaker}: {text}" if kind == "dlg" else text
        cues.append((t, t + dur - 0.05, kind, label if kind == "dlg" else text))
        t += dur
        still = pick_still(series_id, mood, i)
        clip = clips_dir / f"{i:02d}.mp4"
        make_clip(still, dur, clip, zoom_in=(i % 2 == 0))

    concat_v = work / "v.txt"
    concat_a = work / "a.txt"
    concat_v.write_text("".join(f"file '{clips_dir / f'{i:02d}.mp4'}'\n" for i in range(len(beats))))
    concat_a.write_text("".join(f"file '{p}'\n" for p in padded))
    video_raw = work / "video.mp4"
    audio_raw = work / "audio.wav"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_v), "-c", "copy", str(video_raw)])
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_a), "-c", "copy", str(audio_raw)])

    ass = work / "subs.ass"
    header = """[Script Info]
Title: SLOP
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Dialogue,Arial,40,&H00FFFFFF,&H000000FF,&H80000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,0,2,40,40,150,1
Style: Narration,Arial,32,&H00D9C8FF,&H000000FF,&H80000000,&H80000000,0,1,0,0,100,100,0,0,1,2,0,2,40,40,150,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = [header]
    for start, end, kind, text in cues:
        style = "Dialogue" if kind == "dlg" else "Narration"
        safe = text.replace("\n", "\\N").replace("{", "(").replace("}", ")")
        lines.append(f"Dialogue: 0,{ass_timestamp(start)},{ass_timestamp(end)},{style},,0,0,0,,{safe}\n")
    ass.write_text("".join(lines))

    out = PUBLIC_VID / f"{series_id}-ep{ep}.mp4"
    ass_esc = str(ass).replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")
    run([
        "ffmpeg", "-y", "-i", str(video_raw), "-i", str(audio_raw),
        "-vf", f"ass={ass_esc}",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "24",
        "-c:a", "aac", "-b:a", "96k", "-shortest",
        "-movflags", "+faststart", str(out),
    ])
    thumb = PUBLIC_THUMB / f"{series_id}-ep{ep}.jpg"
    run([
        "ffmpeg", "-y", "-ss", "0.8", "-i", str(out),
        "-frames:v", "1", "-update", "1",
        "-vf", "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280",
        str(thumb),
    ])
    print("DONE", out, f"{out.stat().st_size/1e6:.1f}MB")
    return out


if __name__ == "__main__":
    # usage: series_id ep [ep...]
    if len(sys.argv) < 3:
        raise SystemExit("usage: render-original-series.py <series_id> <ep> [ep...]")
    series_id = sys.argv[1]
    for ep in map(int, sys.argv[2:]):
        render(series_id, ep)
