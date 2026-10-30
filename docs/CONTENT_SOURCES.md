# SLOP content sources

All catalog titles are **SLOP Originals** — generated vertical episodes with AI scene stills, neural TTS dialogue, and burned-in subtitles.

| Drama | Theme | Episodes | Notes |
| --- | --- | --- | --- |
| **The Billionaire's Forgotten Wife** | Romance / Revenge / Suspense | 60 | Flagship. Sophia vs Alexander Sterling. |
| **Blood Contract** | Revenge / Drama | 8 | Ava's secret marriage clause. |
| **Crown of Ash** | Fantasy / Romance | 8 | Cursed princess + immune prince. |
| **Apartment 7** | Thriller / Suspense | 6 | Smart apartment that predicts murder. |
| **Draft Saved** | Romance / Drama | 6 | A year of unsent texts all send. |
| **Neon Vow** | Romance / Thriller | 6 | Street racer + rival heiress. |

Playback files live under `/public/videos/{series}-ep{n}.mp4`.
Render with `scripts/render-bfw-episode.py` and `scripts/render-original-series.py`, then `scripts/sync-rendered-durations.py`.
