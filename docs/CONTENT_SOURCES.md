# SLOP content sources

All catalog titles are **SLOP Originals** — generated vertical episodes with AI scene stills, neural TTS dialogue, and burned-in subtitles.

**29 series / 130 episodes** in the live catalog (plus uploaded series).

## Batch 1

| Drama | Theme | Episodes | Notes |
| --- | --- | --- | --- |
| **Blood Contract** | Revenge / Drama | 8 | Ava's secret marriage clause. |
| **Crown of Ash** | Fantasy / Romance | 8 | Cursed princess + immune prince. |
| **Apartment 7** | Thriller / Suspense | 6 | Smart apartment that predicts murder. |
| **Draft Saved** | Romance / Drama | 6 | A year of unsent texts all send. |
| **Neon Vow** | Romance / Thriller | 6 | Street racer + rival heiress. |

## Batch 2 (24 × 4-episode originals)

Romance / revenge: Midnight Internship, Fake Dating App, Raincheck Bride, Boss Soft Spot, Wedding Crash Heiress, Stolen Pitch, Black Card Ex, Nanny Clause.

Thriller / suspense: Missing Hour, Elevator 13, Deepfake Alibi, Red Light Witness, Timer on the Door, Silent Auction, Last Guest.

Fantasy: Moonpawn, Glass Witch, Dragon Dowry, Mirror Debt.

Drama: Password Wife, Custody Weekend, Sister's Scar, Empty Chair Dinner, Voicemail from Dad.

Definitions: `src/lib/series/originals/{definitions,batch2,catalog}.ts`.

Playback files are `{R2_PUBLIC_BASE_URL}/videos/{series}-ep{n}.mp4`, with posters, thumbnails, and banners on the same host. When `R2_PUBLIC_BASE_URL` is unset, the app falls back to `public/videos`, `public/thumbnails`, `public/posters`, and `public/banners` on disk. Those binaries are not deployed (they are gitignored). Upload them once with `node scripts/upload-public-media-to-r2.mjs` before a production deploy.

```bash
npx tsx scripts/export-original-scripts.ts
python3 scripts/render-original-series.py <series-id> 1 2 3 4
python3 scripts/sync-rendered-durations.py
```
