import fs from "fs";
import { ORIGINAL_SERIES } from "../src/lib/series/originals/definitions";

const scripts: Record<string, unknown> = {};
const voices: Record<string, unknown> = {};
for (const s of ORIGINAL_SERIES) {
  scripts[s.id] = s.scripts;
  voices[s.id] = s.voices;
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
console.log(
  ORIGINAL_SERIES.map((s) => `${s.id}:${s.scripts.length}`).join(", "),
);
