#!/usr/bin/env python3
"""Render a Forgotten Wife episode to a vertical MP4 from its script beats."""
from __future__ import annotations

import json
import re
import subprocess
import sys
import time
import wave
from pathlib import Path

ROOT = Path("/tmp/bfw-render")
STILL_POOL = ROOT / "stills"
WORK = ROOT / "work"
PUBLIC_VID = Path("/workspace/public/videos")
PUBLIC_THUMB = Path("/workspace/public/thumbnails")

VOICES = {
    "SOPHIA": "en-US-JennyNeural",
    "ALEXANDER": "en-US-ChristopherNeural",
    "VICTORIA": "en-US-AriaNeural",
    "RICHARD": "en-US-RogerNeural",
    "UNKNOWN MAN": "en-US-RogerNeural",
    "NARRATOR": "en-US-GuyNeural",
    "DEFAULT": "en-US-GuyNeural",
}

# Map mood -> still filenames in pool
MOOD_STILLS = {
    "betrayal": ["penthouse.jpg", "phone.jpg", "wedding.jpg", "confrontation.jpg", "smile.jpg", "shareholder.jpg"],
    "return": ["lobby.jpg", "boardroom.jpg", "corridor.jpg", "penthouse.jpg", "confrontation.jpg"],
    "power": ["boardroom.jpg", "ceo.jpg", "confrontation.jpg", "smile.jpg", "shareholder.jpg"],
    "secret": ["archive.jpg", "night.jpg", "phone.jpg", "corridor.jpg", "penthouse.jpg"],
    "fall": ["raid.jpg", "night.jpg", "confrontation.jpg", "smile.jpg"],
    "truth": ["press.jpg", "boardroom.jpg", "shareholder.jpg", "smile.jpg"],
    "revenge": ["boardroom.jpg", "ceo.jpg", "confrontation.jpg", "night.jpg"],
    "final": ["rooftop.jpg", "boardroom.jpg", "smile.jpg", "shareholder.jpg", "penthouse.jpg"],
}


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


def load_script(ep: int) -> dict:
    # Read from compiled JSON exported by node, or parse TS lightly via a JSON dump
    dump = ROOT / "scripts.json"
    if not dump.exists():
        raise SystemExit("missing scripts.json — export first")
    data = json.loads(dump.read_text())
    return next(s for s in data if s["episodeNumber"] == ep)


def synth(text: str, speaker: str, out_mp3: Path) -> None:
    voice = VOICES.get(speaker.upper(), VOICES["DEFAULT"])
    clean = (
        text.replace("…", "...")
        .replace("—", "-")
        .replace("'", "'")
        .replace("'", "'")
    )
    for attempt in range(4):
        try:
            subprocess.run(
                [
                    "python3",
                    "-m",
                    "edge_tts",
                    "--voice",
                    voice,
                    "--text",
                    clean,
                    "--write-media",
                    str(out_mp3),
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
            )
            return
        except subprocess.CalledProcessError:
            time.sleep(1.2 * (attempt + 1))
    raise RuntimeError(f"TTS failed for: {clean[:60]}")


def pick_still(mood: str, i: int) -> Path:
    names = MOOD_STILLS.get(mood, MOOD_STILLS["betrayal"])
    name = names[i % len(names)]
    path = STILL_POOL / name
    if not path.exists():
        # fallback to any available
        available = sorted(STILL_POOL.glob("*.jpg"))
        if not available:
            raise SystemExit("no stills in pool")
        path = available[i % len(available)]
    return path


def make_clip(still: Path, duration: float, out: Path, zoom_in: bool) -> None:
    frames = max(1, int(duration * 30))
    if zoom_in:
        z = "z='min(zoom+0.0008,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
    else:
        z = "z='if(eq(on,1),1.12,max(zoom-0.0008,1.0))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
    vf = (
        f"scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,"
        f"zoompan={z}:d={frames}:s=720x1280:fps=30,"
        f"eq=contrast=1.05:saturation=1.08,format=yuv420p"
    )
    run(
        [
            "ffmpeg", "-y", "-loop", "1", "-i", str(still),
            "-vf", vf, "-t", f"{duration:.3f}", "-r", "30",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
            "-pix_fmt", "yuv420p", "-an", str(out),
        ]
    )


def render(ep: int) -> Path:
    script = load_script(ep)
    work = WORK / f"ep{ep:02d}"
    audio_dir = work / "audio"
    clips_dir = work / "clips"
    work.mkdir(parents=True, exist_ok=True)
    audio_dir.mkdir(exist_ok=True)
    clips_dir.mkdir(exist_ok=True)

    beats = script["beats"]
    mood = script.get("mood", "betrayal")
    durations: list[float] = []
    padded: list[Path] = []
    cues: list[tuple[float, float, str, str]] = []

    print(f"Rendering ep {ep}: {script['title']} ({len(beats)} beats)")
    t = 0.0
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

        mp3 = audio_dir / f"{i:02d}.mp3"
        wav = audio_dir / f"{i:02d}.wav"
        synth(text, speaker, mp3)
        run(["ffmpeg", "-y", "-i", str(mp3), "-ar", "44100", "-ac", "1", str(wav)])
        min_sec = max(1.4, beat.get("durationMs", 2200) / 1000.0)
        dur = max(min_sec, wav_duration(wav) + 0.3)
        pad = audio_dir / f"{i:02d}_pad.wav"
        run(
            [
                "ffmpeg", "-y", "-i", str(wav),
                "-af", f"apad=whole_dur={dur:.3f}", "-t", f"{dur:.3f}", str(pad),
            ]
        )
        durations.append(dur)
        padded.append(pad)
        label = f"{speaker}: {text}" if kind == "dlg" else text
        cues.append((t, t + dur - 0.05, kind, label if kind == "dlg" else text))
        t += dur

        still = pick_still(mood, i)
        clip = clips_dir / f"{i:02d}.mp4"
        make_clip(still, dur, clip, zoom_in=(i % 2 == 0))
        print(f"  beat {i:02d} {dur:.1f}s")

    concat_v = work / "v.txt"
    concat_a = work / "a.txt"
    concat_v.write_text(
        "".join(f"file '{clips_dir / f'{i:02d}.mp4'}'\n" for i in range(len(beats)))
    )
    concat_a.write_text("".join(f"file '{p}'\n" for p in padded))
    video_raw = work / "video.mp4"
    audio_raw = work / "audio.wav"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_v), "-c", "copy", str(video_raw)])
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_a), "-c", "copy", str(audio_raw)])

    ass = work / "subs.ass"
    header = """[Script Info]
Title: BFW
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Dialogue,Arial,42,&H00FFFFFF,&H000000FF,&H80000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,0,2,40,40,160,1
Style: Narration,Arial,34,&H00D9C8FF,&H000000FF,&H80000000,&H80000000,0,1,0,0,100,100,0,0,1,2,0,2,40,40,160,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = [header]
    for start, end, kind, text in cues:
        style = "Dialogue" if kind == "dlg" else "Narration"
        safe = text.replace("\n", "\\N").replace("{", "(").replace("}", ")")
        lines.append(
            f"Dialogue: 0,{ass_timestamp(start)},{ass_timestamp(end)},{style},,0,0,0,,{safe}\n"
        )
    ass.write_text("".join(lines))

    out = PUBLIC_VID / f"forgotten-wife-ep{ep}.mp4"
    ass_esc = str(ass).replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")
    run(
        [
            "ffmpeg", "-y", "-i", str(video_raw), "-i", str(audio_raw),
            "-vf", f"ass={ass_esc}",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
            "-c:a", "aac", "-b:a", "128k", "-shortest",
            "-movflags", "+faststart", str(out),
        ]
    )
    thumb = PUBLIC_THUMB / f"forgotten-wife-ep{ep}.jpg"
    run(
        [
            "ffmpeg", "-y", "-ss", "1", "-i", str(out),
            "-frames:v", "1", "-update", "1",
            "-vf", "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280",
            str(thumb),
        ]
    )
    probe = json.loads(
        subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration,size", "-of", "json", str(out)],
            text=True,
        )
    )
    print("DONE", out, probe["format"])
    return out


if __name__ == "__main__":
    eps = [int(x) for x in sys.argv[1:]] or [2]
    for ep in eps:
        render(ep)
