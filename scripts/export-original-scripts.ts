import fs from "fs";
import { ORIGINAL_SERIES } from "../src/lib/series/originals/catalog";

const scripts: Record<string, unknown> = {};
const voices: Record<string, unknown> = {};
const meta: { id: string; pool: string; title: string; eps: number }[] = [];

for (const s of ORIGINAL_SERIES) {
  scripts[s.id] = s.scripts;
  voices[s.id] = s.voices;
  meta.push({
    id: s.id,
    pool: s.stillPrefix,
    title: s.title,
    eps: s.scripts.length,
  });
}

fs.mkdirSync("/tmp/slop-originals", { recursive: true });
fs.writeFileSync(
  "/tmp/slop-originals/all-scripts.json",
  JSON.stringify(scripts),
);
fs.writeFileSync(
  "/tmp/slop-originals/voices.json",
  JSON.stringify(voices, null, 2),
);
fs.writeFileSync(
  "/tmp/slop-originals/series-meta.json",
  JSON.stringify(meta, null, 2),
);
console.log(
  `series=${ORIGINAL_SERIES.length} eps=${ORIGINAL_SERIES.reduce((n, s) => n + s.scripts.length, 0)}`,
);
