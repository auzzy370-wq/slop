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
    series_ids = [
        "blood-contract",
        "crown-of-ash",
        "apartment-7",
        "draft-saved",
        "neon-vow",
    ]
    all_durs: dict[str, dict[int, int]] = {s: {} for s in series_ids}
    for sid in series_ids:
        for p in VID.glob(f"{sid}-ep*.mp4"):
            n = int(p.stem.split("-ep")[-1])
            all_durs[sid][n] = round(probe(p))
    path = pathlib.Path("/workspace/src/lib/series/originals/catalog.ts")
    text = path.read_text()
    lines = ["export const ORIGINAL_RENDERED_DURATIONS: Record<string, Record<number, number>> = {\n"]
    for sid in series_ids:
        lines.append(f'  "{sid}": {{\n')
        for n in sorted(all_durs[sid]):
            lines.append(f"    {n}: {all_durs[sid][n]},\n")
        lines.append("  },\n")
    lines.append("};\n")
    block = "".join(lines)
    text2 = re.sub(
        r"export const ORIGINAL_RENDERED_DURATIONS: Record<string, Record<number, number>> =\s*\{[\s\S]*?\};",
        block.rstrip() + ";",
        text,
        count=1,
    )
    path.write_text(text2)
    print("originals", {k: len(v) for k, v in all_durs.items()})


if __name__ == "__main__":
    sync_bfw()
    sync_originals()
