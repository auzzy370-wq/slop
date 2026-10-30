#!/usr/bin/env python3
"""Sync ffprobe durations into originals + forgotten-wife catalog TS files."""
from __future__ import annotations

import pathlib
import re
import subprocess

VID = pathlib.Path("/workspace/public/videos")


def probe(path: pathlib.Path) -> float:
    return float(
        subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=nw=1:nk=1",
                str(path),
            ],
            text=True,
        ).strip()
    )


def sync_bfw() -> None:
    durs = {}
    for p in VID.glob("forgotten-wife-ep*.mp4"):
        n = int(p.stem.replace("forgotten-wife-ep", ""))
        durs[n] = round(probe(p))
    path = pathlib.Path("/workspace/src/lib/series/forgotten-wife/catalog.ts")
    text = path.read_text()
    block = (
        "const RENDERED_DURATIONS: Record<number, number> = {\n"
        + "".join(f"  {k}: {durs[k]},\n" for k in sorted(durs))
        + "};"
    )
    text2 = re.sub(
        r"const RENDERED_DURATIONS: Record<number, number> = \{[\s\S]*?\};",
        block,
        text,
        count=1,
    )
    path.write_text(text2)
    print("BFW", len(durs))


def sync_originals() -> None:
    # Discover series ids from video filenames (skip forgotten-wife)
    all_durs: dict[str, dict[int, int]] = {}
    for p in VID.glob("*-ep*.mp4"):
        stem = p.stem
        if stem.startswith("forgotten-wife"):
            continue
        if "-ep" not in stem:
            continue
        sid, _, num = stem.rpartition("-ep")
        try:
            n = int(num)
        except ValueError:
            continue
        all_durs.setdefault(sid, {})[n] = round(probe(p))
    path = pathlib.Path("/workspace/src/lib/series/originals/catalog.ts")
    text = path.read_text()
    # Prefer rewriting the Object.fromEntries initializer to a concrete map
    lines = [
        "export const ORIGINAL_RENDERED_DURATIONS: Record<\n",
        "  string,\n",
        "  Record<number, number>\n",
        "> = {\n",
    ]
    for sid in sorted(all_durs):
        lines.append(f'  "{sid}": {{\n')
        for n in sorted(all_durs[sid]):
            lines.append(f"    {n}: {all_durs[sid][n]},\n")
        lines.append("  },\n")
    lines.append("};\n")
    block = "".join(lines)
    text2, n = re.subn(
        r"export const ORIGINAL_RENDERED_DURATIONS:[\s\S]*?= \{[\s\S]*?\n\};",
        block.rstrip(),
        text,
        count=1,
    )
    if n != 1:
        raise SystemExit(f"failed to rewrite ORIGINAL_RENDERED_DURATIONS (n={n})")
    path.write_text(text2 + ("\n" if not text2.endswith("\n") else ""))
    print("originals", {k: len(v) for k, v in all_durs.items()}, "series", len(all_durs))


if __name__ == "__main__":
    sync_bfw()
    sync_originals()
