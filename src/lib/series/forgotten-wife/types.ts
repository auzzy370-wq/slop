export type ScriptBeat =
  | {
      type: "setting";
      text: string;
      durationMs: number;
    }
  | {
      type: "action";
      text: string;
      durationMs: number;
    }
  | {
      type: "dialogue";
      speaker: string;
      text: string;
      durationMs: number;
    }
  | {
      type: "caption";
      text: string;
      durationMs: number;
    };

export interface EpisodeScript {
  id: string;
  episodeNumber: number;
  title: string;
  hook: string;
  cliffhanger: string;
  mood: "betrayal" | "return" | "power" | "secret" | "fall" | "truth" | "revenge" | "final";
  beats: ScriptBeat[];
}

export function scriptDurationSec(script: EpisodeScript): number {
  const ms = script.beats.reduce((sum, b) => sum + b.durationMs, 0);
  return Math.max(45, Math.round(ms / 1000));
}
