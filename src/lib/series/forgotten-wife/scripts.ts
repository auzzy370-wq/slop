import type { EpisodeScript, ScriptBeat } from "./types";
import { scriptDurationSec } from "./types";

const d = (text: string, ms = 2200): ScriptBeat => ({
  type: "dialogue",
  speaker: "SOPHIA",
  text,
  durationMs: ms,
});
const a = (speaker: string, text: string, ms = 2400): ScriptBeat => ({
  type: "dialogue",
  speaker,
  text,
  durationMs: ms,
});
const act = (text: string, ms = 2600): ScriptBeat => ({
  type: "action",
  text,
  durationMs: ms,
});
const set = (text: string, ms = 2000): ScriptBeat => ({
  type: "setting",
  text,
  durationMs: ms,
});
const cap = (text: string, ms = 2800): ScriptBeat => ({
  type: "caption",
  text,
  durationMs: ms,
});

/** Episode 1 — full production script from the bible */
function ep1(): EpisodeScript {
  return {
    id: "bfw-01",
    episodeNumber: 1,
    title: "The Invitation",
    hook: "Their third anniversary. His engagement announcement.",
    cliffhanger: "She's the majority shareholder.",
    mood: "betrayal",
    beats: [
      set("LUXURY PENTHOUSE — NIGHT"),
      act("Candles. Two glasses of champagne. Sophia waits for Alexander."),
      act("Her phone vibrates."),
      cap("Alexander Sterling Announces Engagement to Victoria Hayes."),
      act("Sophia opens the photo. Alexander is kissing another woman."),
      d("No… this can't be real.", 2200),
      act("She calls him."),
      a("ALEXANDER", "I'm busy. What do you want?", 2200),
      d("Alex… it's our anniversary.", 2400),
      act("Silence."),
      a("ALEXANDER", "I think you have the wrong number.", 2600),
      act("The call ends."),
      set("THE WEDDING — DAY"),
      act("Sophia walks into a grand ballroom in an elegant white dress."),
      act("Guests turn. Victoria smiles."),
      a("VICTORIA", "Who invited you?", 2000),
      act("Sophia looks straight at Alexander."),
      d("Tell them who I am.", 2200),
      act("Alexander stares."),
      a("ALEXANDER", "Security. Remove this woman.", 2600),
      act("Sophia's eyes fill. Then she smiles."),
      d("You just made the biggest mistake of your life.", 3000),
      act("She turns to leave."),
      a("UNKNOWN MAN", "Wait! Nobody touches her.", 2400),
      act("The ballroom freezes."),
      a("UNKNOWN MAN", "She's the majority shareholder.", 3200),
      cap("CUT TO BLACK."),
    ],
  };
}

type Arc = {
  start: number;
  end: number;
  mood: EpisodeScript["mood"];
  titles: string[];
  beats: (n: number) => ScriptBeat[];
};

const ARCS: Arc[] = [
  {
    start: 2,
    end: 5,
    mood: "betrayal",
    titles: ["Public Humiliation", "The Denial", "Father's Letter", "The Decision"],
    beats: (n) => {
      const map: Record<number, ScriptBeat[]> = {
        2: [
          set("STERLING BALLROOM — CONTINUOUS"),
          act("Security reaches for Sophia. The unknown man blocks them."),
          a("VICTORIA", "This is my wedding day.", 2200),
          d("Then you should know you're marrying a liar.", 2600),
          a("ALEXANDER", "I don't know who you are. I've never seen you before.", 3400),
          act("Gasps ripple through the guests."),
          d("Three years, Alexander. Look at me.", 2600),
          a("ALEXANDER", "Get her out.", 1800),
          act("Sophia is escorted into the rain."),
          cap("She does not cry. Not yet."),
        ],
        3: [
          set("SOPHIA'S APARTMENT — NIGHT"),
          act("Wedding photos flood every screen."),
          d("He looked me in the eye… and erased me.", 2800),
          act("She opens a locked drawer. A gold wedding band."),
          cap("Property of Sophia Williams-Sterling."),
          act("A knock. A courier. An envelope stamped CONFIDENTIAL."),
          a("COURIER", "From the estate of Jonathan Williams.", 2600),
          act("Sophia's hands shake as she breaks the seal."),
          cap("You are the controlling shareholder of Sterling Dynamics."),
        ],
        4: [
          set("WILLIAMS ESTATE LAW OFFICE — DAY"),
          a("LAWYER", "Your father never told you because he feared the Sterlings.", 3200),
          d("How much of the company?", 2000),
          a("LAWYER", "Fifty-one percent. Effective immediately.", 2600),
          act("Sophia stares at the papers."),
          d("Alexander was never protecting me.", 2600),
          a("LAWYER", "He was protecting the empire from you.", 2800),
          cap("Everything he built… sits on her name."),
        ],
        5: [
          set("CITY OVERLOOK — DAWN"),
          act("Sophia watches the Sterling tower catch the first light."),
          d("He forgot me.", 1800),
          act("She slips the wedding ring into her pocket."),
          d("I won't forget him.", 2200),
          cap("SOPHIA WILLIAMS IS GOING BACK."),
          act("She cuts her hair. Changes her name on the badge."),
          d("New identity. Same blood.", 2400),
          cap("Next: she walks into his boardroom."),
        ],
      };
      return map[n] ?? map[2];
    },
  },
  {
    start: 6,
    end: 10,
    mood: "return",
    titles: [
      "Ghost in the Lobby",
      "Cracks in the Empire",
      "Victoria's Shadow",
      "Quiet Shares",
      "Mysterious Majority",
    ],
    beats: (n) => {
      const lines: Record<number, ScriptBeat[]> = {
        6: [
          set("STERLING DYNAMICS — LOBBY"),
          act("Sophia enters as consultant Elena Voss."),
          a("RECEPTIONIST", "Badge, please.", 1600),
          d("Elena Voss. Strategy division.", 2200),
          act("Alexander walks past. Doesn't look twice."),
          cap("He built a life without her. She's building a war inside it."),
        ],
        7: [
          set("EXECUTIVE FLOOR — DAY"),
          a("ALEXANDER", "Who leaked the Q3 numbers?", 2200),
          a("AIDE", "We don't know. The board is panicking.", 2400),
          act("Sophia watches from a glass corridor."),
          d("Feel that, Alex? That's gravity.", 2600),
          cap("His company starts bleeding… on purpose."),
        ],
        8: [
          set("VICTORIA'S PENTHOUSE — NIGHT"),
          a("VICTORIA", "Find the woman from the wedding.", 2400),
          a("HIRED MAN", "She's gone. Like she never existed.", 2400),
          a("VICTORIA", "People like her don't disappear. Dig.", 2600),
          cap("Victoria wants Sophia erased. For good."),
        ],
        9: [
          set("PRIVATE TRADING FLOOR — NIGHT"),
          act("Sophia buys through shell companies."),
          a("BROKER", "Another three percent under Frost Holdings.", 2800),
          d("Keep my name off every ledger.", 2400),
          cap("Share by share… the tower changes hands."),
        ],
        10: [
          set("BOARDROOM — EMERGENCY MEETING"),
          a("CHAIR", "We have a new majority shareholder.", 2600),
          a("ALEXANDER", "Impossible. I control this company.", 2600),
          a("CHAIR", "Not anymore.", 1800),
          act("A sealed envelope slides to the center of the table."),
          cap("Name redacted. Power absolute."),
        ],
      };
      return lines[n] ?? lines[6];
    },
  },
  {
    start: 11,
    end: 15,
    mood: "power",
    titles: [
      "Unmasked",
      "The Woman Who Owns Him",
      "Victoria Plots",
      "Richard Digs",
      "Anonymous Warning",
    ],
    beats: (n) => {
      const lines: Record<number, ScriptBeat[]> = {
        11: [
          set("BOARDROOM — CONTINUOUS"),
          act("The envelope opens. A name. A face."),
          a("CHAIR", "Sophia Williams.", 2000),
          act("Alexander goes still."),
          d("Surprise.", 1400),
          a("ALEXANDER", "Sophia…", 1600),
          d("You remember me now?", 2200),
        ],
        12: [
          set("CEO OFFICE — AFTER THE VOTE"),
          a("ALEXANDER", "What do you want?", 1800),
          d("Everything you promised. And everything you stole.", 3000),
          a("ALEXANDER", "I can explain.", 1600),
          d("You had three years to explain.", 2400),
          cap("She doesn't raise her voice. She raises the stakes."),
        ],
        13: [
          set("PRIVATE CLUB — NIGHT"),
          a("VICTORIA", "She walks into my fiancé's company like a queen.", 3000),
          a("VICTORIA", "I want her reputation ruined by Friday.", 2800),
          cap("Victoria doesn't fight fair. She never has."),
        ],
        14: [
          set("STERLING MANOR — STUDY"),
          a("RICHARD", "The Williams inheritance was supposed to stay buried.", 3200),
          act("He burns a copy. Keeps the original."),
          a("RICHARD", "If Sophia learns what her father really left her…", 3000),
          cap("Richard knows a secret bigger than shares."),
        ],
        15: [
          set("SOPHIA'S HOTEL SUITE — NIGHT"),
          act("A note under the door. No signature."),
          cap("They will kill for what you inherited."),
          d("Who sent this?", 1800),
          act("Across the street, a figure watches her window."),
          cap("The game just turned lethal."),
        ],
      };
      return lines[n] ?? lines[11];
    },
  },
  {
    start: 16,
    end: 20,
    mood: "secret",
    titles: [
      "Negotiation",
      "No Forgiveness",
      "Hired Eyes",
      "Blood Connection",
      "Father's Lies",
    ],
    beats: (n) => {
      const lines: Record<number, ScriptBeat[]> = {
        16: [
          set("SKYLINE RESTAURANT — NIGHT"),
          a("ALEXANDER", "Name your price.", 1800),
          d("You can't afford me anymore.", 2200),
          a("ALEXANDER", "Sophia, please.", 1600),
          d("Please is what you say when you've already lost.", 3000),
        ],
        17: [
          set("PARKING GARAGE — AFTER DINNER"),
          a("ALEXANDER", "I never stopped loving you.", 2400),
          d("Love doesn't announce an engagement.", 2600),
          act("She walks away. He doesn't follow."),
          cap("Forgiveness is not on the table."),
        ],
        18: [
          set("VICTORIA'S CAR — NIGHT"),
          a("VICTORIA", "Follow her. Every coffee. Every call.", 2600),
          a("INVESTIGATOR", "And if I find a marriage?", 2200),
          a("VICTORIA", "Then we make it disappear.", 2400),
        ],
        19: [
          set("CITY ARCHIVES — DAY"),
          act("Sophia finds a birth record with a familiar name."),
          d("This can't be right…", 2000),
          cap("A Sterling. A Williams. One bloodline crossing."),
          a("ARCHIVIST", "Some files were sealed by Richard Sterling himself.", 3200),
        ],
        20: [
          set("ALEXANDER'S OFFICE — NIGHT"),
          act("Alexander confronts Richard with a folder."),
          a("ALEXANDER", "You lied to me about Sophia for years.", 2800),
          a("RICHARD", "I protected this family.", 2200),
          a("ALEXANDER", "You destroyed the only honest thing I had.", 3000),
          cap("The son's loyalty cracks."),
        ],
      };
      return lines[n] ?? lines[16];
    },
  },
  {
    start: 21,
    end: 25,
    mood: "secret",
    titles: [
      "Victoria Knows",
      "Missing Certificate",
      "Almost the Truth",
      "Conspiracy File",
      "Everything Changes",
    ],
    beats: (n) => {
      const lines: Record<number, ScriptBeat[]> = {
        21: [
          set("VICTORIA'S CLOSET SAFE"),
          act("Photos. A marriage license. Sophia and Alexander."),
          a("VICTORIA", "He married her.", 2000),
          a("VICTORIA", "And he left her alive. Mistake.", 2600),
        ],
        22: [
          set("COURTHOUSE RECORDS — DAY"),
          d("The certificate was here last week.", 2400),
          a("CLERK", "That file was pulled by court order.", 2400),
          cap("Signed: R. Sterling."),
          d("They're erasing us.", 2000),
        ],
        23: [
          set("RAIN-SOAKED STREET"),
          a("ALEXANDER", "My father threatened your life if I claimed you.", 3200),
          d("So you chose the company.", 2200),
          a("ALEXANDER", "I chose your pulse over my pride.", 2800),
          d("Then why is Victoria wearing my future?", 2800),
        ],
        24: [
          set("SOPHIA'S LAPTOP — NIGHT"),
          act("Encrypted emails. Wire transfers. A plan dated three years ago."),
          cap("OPERATION SILENT BRIDE"),
          d("They manufactured our secrecy.", 2600),
          cap("Love was never the strategy. Control was."),
        ],
        25: [
          set("HOSPITAL CORRIDOR — FLASHBACK EDGE"),
          act("A nurse's note. A date. Sophia's name."),
          cap("Patient discharged. Pregnancy test: inconclusive / pending."),
          d("What did they take from me?", 2400),
          act("Alexander receives the same photo by anonymous text."),
          cap("A secret that could rewrite every episode so far."),
        ],
      };
      return lines[n] ?? lines[21];
    },
  },
  {
    start: 26,
    end: 30,
    mood: "secret",
    titles: [
      "Maybe a Child",
      "Anonymous Photograph",
      "Victoria Unravels",
      "Inheritance Under Fire",
      "Life-Altering Secret",
    ],
    beats: (n) => {
      const lines: Record<number, ScriptBeat[]> = {
        26: [
          set("PRIVATE CLINIC — DAY"),
          a("DOCTOR", "We can't confirm without older records.", 2800),
          d("Someone destroyed those records.", 2400),
          cap("Sophia may have been pregnant when she left."),
        ],
        27: [
          set("ALEXANDER'S PHONE"),
          act("A photo: Sophia leaving a clinic."),
          a("ALEXANDER", "Who sent this?", 1800),
          cap("UNKNOWN NUMBER: Ask your father what he did to her."),
        ],
        28: [
          set("ENGAGEMENT PARTY PREP"),
          a("VICTORIA", "If there was a baby, this wedding dies.", 2800),
          act("She smashes a champagne glass."),
          cap("Desperation makes her dangerous."),
        ],
        29: [
          set("COURT FILING ROOM"),
          a("RICHARD", "Challenge her claim. Fraud. Coercion. Anything.", 3000),
          a("ATTORNEY", "Her documents are clean.", 2000),
          a("RICHARD", "Then dirty them.", 1800),
        ],
        30: [
          set("ALEXANDER — ALONE"),
          act("He finds a sealed medical envelope in Richard's vault."),
          cap("SUBJECT: S. WILLIAMS — REDACTED OUTCOME"),
          a("ALEXANDER", "Dad… what did you do?", 2400),
          cap("The secret could change his entire life."),
        ],
      };
      return lines[n] ?? lines[26];
    },
  },
  {
    start: 31,
    end: 35,
    mood: "fall",
    titles: ["Framed", "Protect Her or the Company", "Victoria's Past", "The Witness", "Vanished"],
    beats: (n) => {
      const lines: Record<number, ScriptBeat[]> = {
        31: [
          set("FEDERAL RAID — STERLING TOWER"),
          a("AGENT", "Sophia Williams, you're under investigation for wire fraud.", 3400),
          d("This is a setup.", 1800),
          cap("Planted transfers. Her signature forged."),
        ],
        32: [
          set("WAR ROOM"),
          a("ALEXANDER", "If I clear her, the board destroys me.", 2800),
          a("AIDE", "If you don't, she goes to prison.", 2400),
          act("Alexander stares at Sophia's booking photo."),
          cap("Love or empire. He can't keep both."),
        ],
        33: [
          set("TABLOID OFFICE"),
          act("Old photos of Victoria. Another name. Another fiancé."),
          cap("Victoria Hayes was born Victoria Cole."),
          a("REPORTER", "Two missing persons connected to her. Never charged.", 3200),
        ],
        34: [
          set("SAFE HOUSE DOOR"),
          a("WITNESS", "I forged the transfers. Victoria paid me.", 3000),
          act("A gunshot outside. The witness drops."),
          cap("Someone doesn't want the truth breathing."),
        ],
        35: [
          set("CITY CAMERAS — MONTAGE"),
          act("Sophia's hotel. Empty. Phone abandoned."),
          a("ALEXANDER", "Find her. Now.", 1800),
          cap("SOPHIA WILLIAMS IS GONE."),
        ],
      };
      return lines[n] ?? lines[31];
    },
  },
  {
    start: 36,
    end: 40,
    mood: "truth",
    titles: [
      "Father Orchestrated It",
      "Evidence Returns",
      "Victoria Exposed",
      "Richard Runs",
      "Family Secret",
    ],
    beats: (n) => {
      const lines: Record<number, ScriptBeat[]> = {
        36: [
          set("STERLING MANOR — BASEMENT"),
          act("Alexander finds the Operation Silent Bride master file."),
          a("ALEXANDER", "You ordered me to forget her.", 2600),
          a("RICHARD", "I ordered you to survive.", 2200),
          cap("The betrayal had an architect. His father."),
        ],
        37: [
          set("PRESS CONFERENCE STEPS"),
          act("Sophia returns in black. Camera lights explode."),
          d("I have the original transfers. And Victoria's voice on tape.", 3400),
          cap("The ghost walks back into daylight."),
        ],
        38: [
          set("LIVE BROADCAST"),
          act("The tape plays. Victoria hiring the forger."),
          a("VICTORIA", "That isn't me—", 1600),
          a("ANCHOR", "Then why is your engagement ring in the frame?", 2800),
          cap("Victoria's empire of smiles collapses."),
        ],
        39: [
          set("PRIVATE AIRSTRIP — NIGHT"),
          a("PILOT", "Mr. Sterling, we need to leave now.", 2400),
          act("Richard's car never makes the runway."),
          cap("Blue lights. Handcuffs. The patriarch falls."),
        ],
        40: [
          set("WILLIAMS FAMILY CRYPT"),
          act("Sophia opens a second vault her father left."),
          cap("DNA MATCH: STERLING / WILLIAMS — CLASSIFIED"),
          d("We're not just enemies…", 2200),
          cap("A blood secret that rewrites the war."),
        ],
      };
      return lines[n] ?? lines[36];
    },
  },
  {
    start: 41,
    end: 45,
    mood: "revenge",
    titles: [
      "Dismantling the Empire",
      "Alexander Loses All",
      "Victoria's Last Trick",
      "Traitor Beside Her",
      "Real Mastermind",
    ],
    beats: (n) => {
      const lines: Record<number, ScriptBeat[]> = {
        41: [
          set("BOARD VOTE — FINAL"),
          d("Motion to strip Alexander Sterling of executive authority.", 3000),
          act("Hands rise. His name is deleted from the door."),
          cap("Sophia doesn't smile. She continues."),
        ],
        42: [
          set("EMPTY CEO OFFICE"),
          a("ALEXANDER", "I have nothing left.", 2000),
          d("Now you know how I felt in the rain.", 2800),
          cap("The billionaire is bankrupt of power."),
        ],
        43: [
          set("VICTORIA — INTERROGATION"),
          a("VICTORIA", "I'll testify… if you give me immunity.", 2800),
          a("PROSECUTOR", "Against who?", 1600),
          a("VICTORIA", "Against the person who paid me to marry him.", 3000),
          cap("Her final knife has a new target."),
        ],
        44: [
          set("SOPHIA'S INNER CIRCLE"),
          act("Her trusted aide's phone lights up: RICHARD PAYMENT RECEIVED."),
          d("You were my only friend here.", 2400),
          a("AIDE", "Friends don't inherit empires.", 2400),
          cap("The knife was inside the room."),
        ],
        45: [
          set("HIDDEN SERVER ROOM"),
          act("A login older than the company. A name Sophia never expected."),
          cap("MASTERMIND: JONATHAN WILLIAMS — DECEASED?"),
          d("Dad…?", 1400),
          cap("The real architect may still be alive."),
        ],
      };
      return lines[n] ?? lines[41];
    },
  },
  {
    start: 46,
    end: 50,
    mood: "revenge",
    titles: [
      "Alexander Risks All",
      "Why She Was Removed",
      "Hidden Document",
      "Biggest Decision",
      "Murder Before Truth",
    ],
    beats: (n) => {
      const lines: Record<number, ScriptBeat[]> = {
        46: [
          set("WAREHOUSE AMBUSH"),
          act("Sophia is dragged toward a van. Alexander crashes through."),
          a("ALEXANDER", "Take me. Leave her.", 2200),
          d("You don't get to die for me and call it love.", 3000),
          cap("He risks the last thing he has: his life."),
        ],
        47: [
          set("PRISON INTERVIEW ROOM"),
          a("RICHARD", "Your mother was a Williams. Your claim threatened a merger older than you.", 3600),
          d("So you sold my marriage.", 2200),
          a("RICHARD", "I sold a war before it started.", 2400),
        ],
        48: [
          set("SAFE DEPOSIT BOX"),
          act("A document dated the day Sophia was born."),
          cap("FULL BENEFICIAL OWNERSHIP — IRREVOCABLE"),
          d("This doesn't just give me the company…", 2600),
          cap("It gives her the holding company above it."),
        ],
        49: [
          set("ROOFTOP — NIGHT"),
          a("ALEXANDER", "Destroy us. Or rebuild with me.", 2600),
          d("If I choose you, I forgive a crime against myself.", 3200),
          cap("The biggest decision of her life."),
        ],
        50: [
          set("COURTHOUSE STEPS — DAWN"),
          a("WITNESS", "I can name the mastermind—", 2200),
          act("A silenced shot. The body falls."),
          d("NO!", 1200),
          cap("Someone is murdered before they can reveal the truth."),
        ],
      };
      return lines[n] ?? lines[46];
    },
  },
  {
    start: 51,
    end: 55,
    mood: "final",
    titles: [
      "Who Ordered the Hit",
      "Marriage Confession",
      "Victoria's Endgame",
      "Confronting the Past",
      "Empire Collapses",
    ],
    beats: (n) => {
      const lines: Record<number, ScriptBeat[]> = {
        51: [
          set("CRIME LAB"),
          a("DETECTIVE", "The gun traces to a shell company under Frost Holdings.", 3200),
          d("That's my shell… someone hijacked it.", 2600),
          cap("They want the murder pinned on Sophia."),
        ],
        52: [
          set("EMPTY CHURCH"),
          a("ALEXANDER", "I married you in secret because I loved you. I denied you because I was terrified.", 3600),
          d("Terror is not an alibi.", 2200),
          a("ALEXANDER", "Then let me spend forever earning one.", 2800),
        ],
        53: [
          set("AIRPORT CUSTOMS"),
          act("Victoria tries to flee with stolen drives."),
          a("AGENT", "Victoria Hayes, stop."),
          a("VICTORIA", "You'll never prove—", 1800),
          act("The drives unlock. Every crime. Her face."),
          cap("No more masks."),
        ],
        54: [
          set("ANNIVERSARY PENTHOUSE — REVISITED"),
          act("Same table. No champagne. Only truth."),
          d("I waited three years for a man who never arrived.", 3000),
          a("ALEXANDER", "I'm here now. Late. But here.", 2400),
          cap("The past sits between them like a third guest."),
        ],
        55: [
          set("STERLING TOWER — PLAZA"),
          act("The logo comes down. Workers cheer and cry."),
          cap("THE STERLING FAMILY EMPIRE COLLAPSES."),
          d("It's over.", 1600),
          a("ALEXANDER", "Or it's finally starting.", 2200),
        ],
      };
      return lines[n] ?? lines[51];
    },
  },
  {
    start: 56,
    end: 60,
    mood: "final",
    titles: [
      "Total Control",
      "Another Chance",
      "The Hidden Inheritance",
      "Mysterious Evidence",
      "Season Finale Twist",
    ],
    beats: (n) => {
      const lines: Record<number, ScriptBeat[]> = {
        56: [
          set("NEW BOARDROOM — DAY"),
          a("CHAIR", "All in favor of CEO Sophia Williams?", 2600),
          act("Unanimous."),
          d("Sterling Dynamics is under new ownership.", 2600),
          cap("She takes complete control."),
        ],
        57: [
          set("CITY BRIDGE — SUNSET"),
          a("ALEXANDER", "I'm not asking to be your husband tonight. Just a chance.", 3200),
          d("A chance is more than you gave me.", 2400),
          act("She doesn't say yes. She doesn't say no."),
          cap("The door cracks open."),
        ],
        58: [
          set("FATHER'S FINAL VAULT"),
          act("Behind the shares: a second key. A second company."),
          cap("NORTHSEA LABS — 100% BENEFICIAL OWNER"),
          d("Dad… what is this?", 2000),
          cap("An inheritance nobody knew existed."),
        ],
        59: [
          set("LOBBY — NIGHT"),
          act("A stranger in a gray coat. A drive. A letter."),
          a("STRANGER", "Your father is alive. And he's watching.", 3000),
          d("Prove it.", 1400),
          act("The stranger smiles. Vanishes into the crowd."),
        ],
        60: [
          set("SOPHIA'S OFFICE — LATE"),
          act("She plugs in the drive. A live camera feed opens."),
          a("JONATHAN WILLIAMS", "Hello, Sophia.", 2200),
          d("You're dead.", 1600),
          a("JONATHAN WILLIAMS", "Death was the cover. Season two is the truth.", 3400),
          cap("END OF SEASON ONE"),
          cap("THE BILLIONAIRE'S FORGOTTEN WIFE — CONTINUES"),
        ],
      };
      return lines[n] ?? lines[56];
    },
  },
];

function buildEpisode(n: number): EpisodeScript {
  if (n === 1) return ep1();
  const arc = ARCS.find((a) => n >= a.start && n <= a.end);
  if (!arc) return ep1();
  const idx = n - arc.start;
  const title = arc.titles[idx] ?? `Episode ${n}`;
  const body = arc.beats(n);
  const hookBeat = body.find((b) => b.type === "caption" || b.type === "action");
  const last = body[body.length - 1];
  return {
    id: `bfw-${String(n).padStart(2, "0")}`,
    episodeNumber: n,
    title,
    hook:
      hookBeat && "text" in hookBeat
        ? hookBeat.text.slice(0, 80)
        : `Episode ${n}`,
    cliffhanger: last && "text" in last ? last.text : "To be continued.",
    mood: arc.mood,
    beats: [
      cap(`EPISODE ${n}`),
      cap(title.toUpperCase()),
      ...body,
      cap("TO BE CONTINUED"),
    ],
  };
}

export const FORGOTTEN_WIFE_SCRIPTS: EpisodeScript[] = Array.from(
  { length: 60 },
  (_, i) => buildEpisode(i + 1),
);

export function getForgottenWifeScript(
  episodeNumber: number,
): EpisodeScript | undefined {
  return FORGOTTEN_WIFE_SCRIPTS.find((s) => s.episodeNumber === episodeNumber);
}

export function forgottenWifeDuration(episodeNumber: number): number {
  const s = getForgottenWifeScript(episodeNumber);
  return s ? scriptDurationSec(s) : 60;
}
