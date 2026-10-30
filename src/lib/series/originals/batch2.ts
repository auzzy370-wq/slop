import type { EpisodeScript, ScriptBeat } from "@/lib/series/forgotten-wife/types";
import type { OriginalSeriesDef } from "./definitions";

const a = (speaker: string, text: string, ms = 2300): ScriptBeat => ({
  type: "dialogue",
  speaker,
  text,
  durationMs: ms,
});
const act = (text: string, ms = 2400): ScriptBeat => ({
  type: "action",
  text,
  durationMs: ms,
});
const set = (text: string, ms = 1800): ScriptBeat => ({
  type: "setting",
  text,
  durationMs: ms,
});
const cap = (text: string, ms = 2400): ScriptBeat => ({
  type: "caption",
  text,
  durationMs: ms,
});

function ep(
  prefix: string,
  n: number,
  title: string,
  mood: EpisodeScript["mood"],
  hook: string,
  cliff: string,
  beats: ScriptBeat[],
): EpisodeScript {
  return {
    id: `${prefix}-${String(n).padStart(2, "0")}`,
    episodeNumber: n,
    title,
    hook,
    cliffhanger: cliff,
    mood,
    beats: [cap(`EPISODE ${n}`), cap(title.toUpperCase()), ...beats, cap(cliff)],
  };
}

type Spec = {
  id: OriginalSeriesDef["id"];
  dramaId: string;
  slug: string;
  title: string;
  synopsis: string;
  genreIds: string[];
  tags: string[];
  trendingRank: number;
  featured?: boolean;
  pool: string;
  voices: Record<string, string>;
  scripts: EpisodeScript[];
};

const V = {
  f1: "en-US-JennyNeural",
  f2: "en-US-AriaNeural",
  m1: "en-US-ChristopherNeural",
  m2: "en-US-GuyNeural",
  m3: "en-US-RogerNeural",
  n: "en-US-GuyNeural",
};

function series(s: Spec): OriginalSeriesDef {
  return {
    id: s.id,
    dramaId: s.dramaId,
    slug: s.slug,
    title: s.title,
    synopsis: s.synopsis,
    genreIds: s.genreIds,
    tags: [...s.tags, "SLOP original"],
    trendingRank: s.trendingRank,
    featured: !!s.featured,
    stillPrefix: s.pool,
    voices: { NARRATOR: V.n, ...s.voices },
    scripts: s.scripts,
  };
}

/** 24 new originals → ~30 total with existing 6 */
export const BATCH2_SERIES: OriginalSeriesDef[] = [
  series({
    id: "midnight-internship" as OriginalSeriesDef["id"],
    dramaId: "drm_midnight_internship",
    slug: "midnight-internship",
    title: "Midnight Internship",
    synopsis:
      "Intern Lila covers the CEO's night shift — and discovers his empire runs on a secret second company. Romance, ambition, and a lie that pays her tuition.",
    genreIds: ["gen_romance", "gen_drama"],
    tags: ["romance", "workplace"],
    trendingRank: 7,
    featured: true,
    pool: "romance",
    voices: { LILA: V.f1, CELESTE: V.f2, KAI: V.m1, BOARD: V.m3 },
    scripts: [
      ep("mi", 1, "Night Badge", "return", "Lila takes the impossible shift.", "The CEO knows her real name.", [
        set("STERLING ANNEX — 1:00 A.M."),
        a("LILA", "I'm just the intern covering nights.", 2400),
        a("KAI", "Interns don't see this floor.", 2200),
        act("He slides a black badge across the desk."),
        a("KAI", "Wear it. Tell no one.", 2000),
      ]),
      ep("mi", 2, "Second Ledger", "secret", "She finds two sets of books.", "Celeste wants Lila gone by Friday.", [
        set("SERVER ROOM"),
        a("LILA", "This company doesn't exist on paper.", 2600),
        a("CELESTE", "Curiosity kills internships.", 2200),
        a("KAI", "She's under my protection.", 2000),
      ]),
      ep("mi", 3, "Kiss Clock-In", "power", "A security cam catches them.", "The board calls an emergency vote.", [
        set("ROOFTOP HELIPAD"),
        a("KAI", "If they see us, you're collateral.", 2600),
        a("LILA", "Then stop kissing me in camera range.", 2600),
        act("They don't stop."),
      ]),
      ep("mi", 4, "Day Badge", "final", "Lila exposes the second company — with Kai.", "She keeps the badge. And him.", [
        set("BOARDROOM — DAWN"),
        a("LILA", "Either you go legitimate, or I leak.", 2800),
        a("BOARD", "Who is this girl?", 1600),
        a("KAI", "My partner.", 1600),
        cap("END — MIDNIGHT INTERNSHIP"),
      ]),
    ],
  }),
  series({
    id: "fake-dating-app" as OriginalSeriesDef["id"],
    dramaId: "drm_fake_dating_app",
    slug: "fake-dating-app",
    title: "Fake Dating App",
    synopsis:
      "Rivals match on a beta dating app that forces public challenges. Fake couple. Real ratings. Someone is sabotaging the algorithm for love.",
    genreIds: ["gen_romance", "gen_drama"],
    tags: ["romance", "enemies to lovers"],
    trendingRank: 8,
    pool: "romance",
    voices: { NOA: V.f1, JAY: V.m1, DEV: V.m2, HOST: V.f2 },
    scripts: [
      ep("fd", 1, "Forced Match", "return", "Sworn enemies get a 98% match.", "Challenge one: share a bed on camera.", [
        set("APP NOTIFICATION"),
        a("NOA", "I would rather delete my account.", 2400),
        a("JAY", "Then we both lose the prize money.", 2400),
        a("HOST", "Challenge accepted automatically.", 2200),
      ]),
      ep("fd", 2, "Soft Launch", "power", "Fans ship them hard.", "Jay's ex joins the show as a judge.", [
        set("LIVE STUDIO"),
        a("JAY", "It's just for the app.", 1800),
        a("NOA", "Tell your face that.", 1800),
        act("Chat spam: KISS ALREADY."),
      ]),
      ep("fd", 3, "Glitch Heart", "secret", "Noa finds code that boosts their match.", "Dev planted it — for Jay.", [
        set("DEV LAB"),
        a("NOA", "You hacked our hearts?", 2200),
        a("DEV", "I hacked the leaderboard.", 2200),
        a("JAY", "I didn't ask for that.", 1800),
      ]),
      ep("fd", 4, "Real Rating", "final", "They quit the prize. Keep each other.", "The app trends anyway.", [
        set("CITY BRIDGE"),
        a("NOA", "No cameras.", 1400),
        a("JAY", "No prize.", 1400),
        a("NOA", "Still a match?", 1600),
        a("JAY", "One hundred.", 1400),
        cap("END — FAKE DATING APP"),
      ]),
    ],
  }),
  series({
    id: "raincheck-bride" as OriginalSeriesDef["id"],
    dramaId: "drm_raincheck_bride",
    slug: "raincheck-bride",
    title: "Raincheck Bride",
    synopsis:
      "Maya postpones her wedding in a storm — and shares a hotel lobby with the best man she was never supposed to want.",
    genreIds: ["gen_romance", "gen_drama"],
    tags: ["romance", "wedding"],
    trendingRank: 9,
    pool: "romance",
    voices: { MAYA: V.f1, ELIAS: V.m1, GROOM: V.m2, MOM: V.f2 },
    scripts: [
      ep("rb", 1, "Flooded Aisle", "return", "The venue floods. The wedding pauses.", "Elias offers his dry jacket — and a secret.", [
        set("HOTEL LOBBY — STORM"),
        a("MAYA", "We can't say vows in ankle water.", 2600),
        a("ELIAS", "Then don't. Not tonight.", 2000),
        a("GROOM", "Maya — we're still doing this.", 2200),
      ]),
      ep("rb", 2, "Best Man", "secret", "Elias was her first almost.", "Mom pushes the ceremony forward.", [
        set("SUITE HALLWAY"),
        a("ELIAS", "Five years ago you chose him.", 2600),
        a("MAYA", "I chose stability.", 1800),
        a("ELIAS", "How's that feeling in the rain?", 2400),
      ]),
      ep("rb", 3, "Almost Vow", "betrayal", "She finds a prenup she never saw.", "The groom already signed her away.", [
        set("LAWYER FOLDER"),
        a("MAYA", "This gives him my gallery.", 2400),
        a("GROOM", "It's standard.", 1600),
        a("MAYA", "So was honesty.", 1800),
      ]),
      ep("rb", 4, "New Date", "final", "She cancels. Elias waits with coffee.", "No aisle. Just weather clearing.", [
        set("LOBBY DOORS — MORNING"),
        a("MAYA", "Raincheck forever.", 1800),
        a("ELIAS", "Or a real date.", 1600),
        cap("END — RAINCHECK BRIDE"),
      ]),
    ],
  }),
  series({
    id: "boss-soft-spot" as OriginalSeriesDef["id"],
    dramaId: "drm_boss_soft_spot",
    slug: "boss-soft-spot",
    title: "Boss's Soft Spot",
    synopsis:
      "Ice-cold editor Rhea hires ghostwriter Theo to finish her late husband's novel — and starts leaving notes in the margins that aren't about the book.",
    genreIds: ["gen_romance", "gen_drama"],
    tags: ["romance", "workplace"],
    trendingRank: 10,
    pool: "romance",
    voices: { RHEA: V.f2, THEO: V.m1, AGENT: V.m2 },
    scripts: [
      ep("bs", 1, "Margin Notes", "return", "Theo finds a love note in chapter three.", "It isn't from the dead husband.", [
        set("PUBLISHING TOWER"),
        a("RHEA", "Fix the ending. Don't touch the heart.", 2600),
        a("THEO", "Someone already did — in pink ink.", 2600),
      ]),
      ep("bs", 2, "Rewrite Kiss", "power", "Deadline night. Almost confession.", "The agent wants a scandalous blurb.", [
        set("EMPTY OFFICE — 2 A.M."),
        a("THEO", "These notes are yours.", 2000),
        a("RHEA", "Prove it.", 1400),
        act("He kisses the proof into silence."),
      ]),
      ep("bs", 3, "Leak", "betrayal", "Pages hit the internet.", "Rhea fires Theo to protect him.", [
        set("PRESS ROOM"),
        a("AGENT", "Romance sells. Lean in.", 2200),
        a("RHEA", "You're fired, Theo.", 1800),
        a("THEO", "For writing what you felt?", 2200),
      ]),
      ep("bs", 4, "Author Page", "final", "Joint byline. Soft spot public.", "The book ends with their names.", [
        set("BOOKSTORE WINDOW"),
        a("RHEA", "Co-authors.", 1400),
        a("THEO", "Co-everything.", 1400),
        cap("END — BOSS'S SOFT SPOT"),
      ]),
    ],
  }),
  series({
    id: "wedding-crash-heiress" as OriginalSeriesDef["id"],
    dramaId: "drm_wedding_crash_heiress",
    slug: "wedding-crash-heiress",
    title: "Wedding Crash Heiress",
    synopsis:
      "Disowned heiress Quinn crashes her sister's wedding with proof the groom stole Quinn's startup — and a smile that wrecks the reception.",
    genreIds: ["gen_revenge", "gen_drama"],
    tags: ["revenge", "heiress"],
    trendingRank: 11,
    featured: true,
    pool: "revenge",
    voices: { QUINN: V.f1, SISTER: V.f2, GROOM: V.m1, FATHER: V.m3 },
    scripts: [
      ep("wh", 1, "Uninvited", "betrayal", "Quinn walks the aisle backward.", "Father signals security — too late.", [
        set("ESTATE CHAPEL"),
        a("QUINN", "Before you say I do — ask who built his company.", 3200),
        a("SISTER", "Get out.", 1200),
        a("QUINN", "Gladly. After exhibit A.", 2000),
      ]),
      ep("wh", 2, "Exhibit A", "revenge", "The deck is Quinn's stolen pitch.", "Investors in the pews go pale.", [
        set("RECEPTION LAWN"),
        a("GROOM", "She's lying.", 1600),
        a("QUINN", "Then explain my watermarks on your slides.", 2800),
      ]),
      ep("wh", 3, "Father's Deal", "secret", "Dad offers money to disappear.", "Quinn wants the company back.", [
        set("STUDY"),
        a("FATHER", "Name a number.", 1600),
        a("QUINN", "One hundred percent of what he stole.", 2800),
      ]),
      ep("wh", 4, "Toast", "final", "She takes the mic. Takes the company.", "Sister chooses Quinn over the groom.", [
        set("HEAD TABLE"),
        a("SISTER", "The wedding is over.", 1800),
        a("QUINN", "The company isn't.", 1800),
        cap("END — WEDDING CRASH HEIRESS"),
      ]),
    ],
  }),
  series({
    id: "stolen-pitch" as OriginalSeriesDef["id"],
    dramaId: "drm_stolen_pitch",
    slug: "stolen-pitch",
    title: "Stolen Pitch",
    synopsis:
      "Engineer Sam's demo is stolen by her mentor on demo day. She rebuilds overnight — and pitches against him with his own investors watching.",
    genreIds: ["gen_revenge", "gen_drama"],
    tags: ["revenge", "tech"],
    trendingRank: 12,
    pool: "revenge",
    voices: { SAM: V.f1, MENTOR: V.m3, VC: V.m1, FRIEND: V.f2 },
    scripts: [
      ep("sp", 1, "Blank Laptop", "betrayal", "Sam's drive is wiped.", "The mentor demos her product.", [
        set("DEMO DAY BACKSTAGE"),
        a("SAM", "That's my build.", 1800),
        a("MENTOR", "Prove it.", 1400),
      ]),
      ep("sp", 2, "All-Nighter", "return", "She rebuilds from memory.", "Friend sneaks her a badge.", [
        set("HACKER HOUSE"),
        a("FRIEND", "Sleep after you ruin him.", 2200),
        a("SAM", "No sleep. Just compile.", 2000),
      ]),
      ep("sp", 3, "Counter Pitch", "revenge", "Same stage. Better demo.", "VC freezes the mentor's deal.", [
        set("MAIN STAGE"),
        a("SAM", "Here's the original. Timestamped.", 2600),
        a("VC", "Mentor — step offstage.", 2000),
      ]),
      ep("sp", 4, "Term Sheet", "final", "Sam signs. Mentor is blacklisted.", "She keeps the mic.", [
        set("GREEN ROOM"),
        a("VC", "Lead investor. Your round.", 2200),
        a("SAM", "No mentors required.", 1800),
        cap("END — STOLEN PITCH"),
      ]),
    ],
  }),
  series({
    id: "black-card-ex" as OriginalSeriesDef["id"],
    dramaId: "drm_black_card_ex",
    slug: "black-card-ex",
    title: "Black Card Ex",
    synopsis:
      "When playboy heir Nico cancels Zara's black card on her birthday, she becomes the consultant hired to cut his allowance — legally.",
    genreIds: ["gen_revenge", "gen_romance"],
    tags: ["revenge", "billionaire"],
    trendingRank: 13,
    pool: "revenge",
    voices: { ZARA: V.f2, NICO: V.m1, MATRIARCH: V.f1, BANKER: V.m3 },
    scripts: [
      ep("bx", 1, "Declined", "betrayal", "Birthday dinner. Card declined.", "Nico laughs it off on camera.", [
        set("ROOFTOP RESTAURANT"),
        a("ZARA", "You canceled me.", 1800),
        a("NICO", "It was a joke.", 1600),
        a("ZARA", "So is your empire — soon.", 2200),
      ]),
      ep("bx", 2, "Hired Knife", "return", "Matriarch hires Zara as auditor.", "Nico doesn't recognize her résumé.", [
        set("FAMILY OFFICE"),
        a("MATRIARCH", "Trim his waste.", 1800),
        a("ZARA", "With pleasure.", 1600),
      ]),
      ep("bx", 3, "Allowance Zero", "revenge", "She freezes every account.", "Nico begs — then listens.", [
        set("PRIVATE BANK"),
        a("BANKER", "All cards locked per auditor.", 2400),
        a("NICO", "Zara…?", 1400),
      ]),
      ep("bx", 4, "New Limit", "final", "He earns a card. She keeps the power.", "Date night on her terms.", [
        set("SAME RESTAURANT"),
        a("NICO", "Your card or mine?", 1800),
        a("ZARA", "Mine. Always.", 1600),
        cap("END — BLACK CARD EX"),
      ]),
    ],
  }),
  series({
    id: "nanny-clause" as OriginalSeriesDef["id"],
    dramaId: "drm_nanny_clause",
    slug: "nanny-clause",
    title: "The Nanny Clause",
    synopsis:
      "Widower CEO's contract nanny discovers a clause: if she stays a year, she inherits guardianship shares — and his late wife's sister wants her gone.",
    genreIds: ["gen_revenge", "gen_drama", "gen_romance"],
    tags: ["revenge", "family"],
    trendingRank: 14,
    pool: "revenge",
    voices: { PENNY: V.f1, OWEN: V.m1, AUNT: V.f2, KID: V.f1 },
    scripts: [
      ep("nc", 1, "Fine Print", "secret", "Penny finds the guardianship clause.", "The aunt already contested it.", [
        set("NURSERY — NIGHT"),
        a("PENNY", "This makes me more than staff.", 2400),
        a("OWEN", "It makes you family if you stay.", 2600),
      ]),
      ep("nc", 2, "Aunt's Visit", "betrayal", "Aunt files emergency custody.", "Kid chooses Penny on camera.", [
        set("LIVING ROOM"),
        a("AUNT", "She's a stranger with a paycheck.", 2600),
        a("KID", "She's the one who stays.", 2000),
      ]),
      ep("nc", 3, "Year Mark", "fall", "Sabotage at the preschool.", "Owen almost fires Penny to protect her.", [
        set("CEO OFFICE"),
        a("OWEN", "Leave town. I'll wire you.", 2200),
        a("PENNY", "I'm not for sale.", 1800),
      ]),
      ep("nc", 4, "Guardians", "final", "Court upholds the clause.", "Family photo. No paycheck needed.", [
        set("COURTHOUSE STEPS"),
        a("OWEN", "Stay as my partner.", 2000),
        a("PENNY", "And their mom — when they're ready.", 2600),
        cap("END — THE NANNY CLAUSE"),
      ]),
    ],
  }),
  series({
    id: "missing-hour" as OriginalSeriesDef["id"],
    dramaId: "drm_missing_hour",
    slug: "missing-hour",
    title: "Missing Hour",
    synopsis:
      "Detective Aria blackouts for exactly sixty minutes every night — and wakes holding evidence from crimes she doesn't remember committing.",
    genreIds: ["gen_thriller", "gen_suspense"],
    tags: ["thriller", "memory"],
    trendingRank: 15,
    featured: true,
    pool: "thriller",
    voices: { ARIA: V.f2, PARTNER: V.m1, SUSPECT: V.m2, DOC: V.m3 },
    scripts: [
      ep("mh", 1, "60:00", "secret", "Aria wakes with a bloody cufflink.", "The victim is her closed case.", [
        set("ARIA'S APARTMENT — 3:00 A.M."),
        a("ARIA", "I was home. I swear.", 2000),
        a("PARTNER", "Then explain the cufflink.", 2200),
      ]),
      ep("mh", 2, "Loop Cam", "fall", "Mall footage shows her — smiling.", "She has no memory of shopping.", [
        set("PRECINCT"),
        a("ARIA", "That's my face. Not my night.", 2400),
        a("DOC", "Chemicals can borrow an hour.", 2400),
      ]),
      ep("mh", 3, "Puppet Chemist", "truth", "Suspect admits dosing her coffee.", "He works for someone upstairs.", [
        set("INTERROGATION"),
        a("SUSPECT", "You were the perfect badge.", 2400),
        a("ARIA", "Whose hand was on the strings?", 2400),
      ]),
      ep("mh", 4, "Alarm", "final", "She sets a trap in the missing hour.", "Catches the captain red-handed.", [
        set("WAREHOUSE"),
        a("ARIA", "Hour's up.", 1400),
        a("PARTNER", "We got him on your wire.", 2200),
        cap("END — MISSING HOUR"),
      ]),
    ],
  }),
  series({
    id: "elevator-13" as OriginalSeriesDef["id"],
    dramaId: "drm_elevator_13",
    slug: "elevator-13",
    title: "Elevator 13",
    synopsis:
      "Thirteen strangers stuck between floors discover one of them is already dead — and the elevator only opens if they vote correctly.",
    genreIds: ["gen_thriller", "gen_suspense"],
    tags: ["thriller", "closed circle"],
    trendingRank: 16,
    pool: "thriller",
    voices: { LENA: V.f1, MARCO: V.m1, VOICE: V.m3, TEEN: V.f2 },
    scripts: [
      ep("e13", 1, "Between", "secret", "The car stops. Lights die.", "A voice asks: who killed the thirteenth?", [
        set("ELEVATOR — STUCK"),
        a("VOICE", "One of you is dead. Find which.", 2800),
        a("LENA", "That's impossible.", 1600),
        act("The mirror fogs. A body outline appears."),
      ]),
      ep("e13", 2, "Vote One", "fall", "They vote wrong. Floor drops one inch.", "Marco recognizes the dead man's watch.", [
        set("ELEVATOR"),
        a("MARCO", "That's my brother's watch.", 2200),
        a("TEEN", "Then why is he standing here?", 2200),
      ]),
      ep("e13", 3, "Doppelganger", "truth", "The 'brother' is a deepfake actor.", "Lena finds a projector in the panel.", [
        set("CEILING PANEL"),
        a("LENA", "We've been watching a show.", 2400),
        a("VOICE", "Then cancel it.", 1600),
      ]),
      ep("e13", 4, "Open Sesame", "final", "Correct vote: the projector.", "Doors open on the truth crew.", [
        set("LOBBY"),
        a("MARCO", "Game over.", 1400),
        a("LENA", "For them.", 1400),
        cap("END — ELEVATOR 13"),
      ]),
    ],
  }),
  series({
    id: "deepfake-alibi" as OriginalSeriesDef["id"],
    dramaId: "drm_deepfake_alibi",
    slug: "deepfake-alibi",
    title: "Deepfake Alibi",
    synopsis:
      "Streamer Cassie is framed by a deepfake robbery video. To clear her name she must deepfake the real thief — before the algorithm believes the lie.",
    genreIds: ["gen_thriller", "gen_drama"],
    tags: ["thriller", "tech"],
    trendingRank: 17,
    pool: "thriller",
    voices: { CASSIE: V.f1, HACKER: V.m2, COP: V.m3, FAN: V.f2 },
    scripts: [
      ep("da", 1, "Viral Frame", "betrayal", "Millions see Cassie rob a store.", "She was live elsewhere.", [
        set("PHONE SCREEN"),
        a("CASSIE", "That's not me.", 1600),
        a("COP", "The internet disagrees.", 2000),
      ]),
      ep("da", 2, "Clone Lab", "return", "Hacker offers a counterfeit clone.", "Ethics vs freedom.", [
        set("BASEMENT RIG"),
        a("HACKER", "Fight fake with fake.", 2200),
        a("CASSIE", "Then I'm no better.", 1800),
        a("HACKER", "You're free.", 1400),
      ]),
      ep("da", 3, "Tell", "truth", "They watermark the clone confession.", "Fans amplify the truth tag.", [
        set("STREAM"),
        a("CASSIE", "Look for the seal.", 1800),
        a("FAN", "It's spreading.", 1600),
      ]),
      ep("da", 4, "Uncanny", "final", "Real thief caught by his own face model.", "Cassie keeps streaming — unfiltered.", [
        set("COURT STEPS"),
        a("COP", "Charges dropped.", 1600),
        a("CASSIE", "Camera on. No masks.", 1800),
        cap("END — DEEPFAKE ALIBI"),
      ]),
    ],
  }),
  series({
    id: "red-light-witness" as OriginalSeriesDef["id"],
    dramaId: "drm_red_light_witness",
    slug: "red-light-witness",
    title: "Red Light Witness",
    synopsis:
      "Rideshare driver Dana captures a hit-and-run at a red light — and the car belongs to the DA running for mayor.",
    genreIds: ["gen_thriller", "gen_suspense"],
    tags: ["thriller", "crime"],
    trendingRank: 18,
    pool: "thriller",
    voices: { DANA: V.f2, DA: V.m1, RIDER: V.m2, REPORTER: V.f1 },
    scripts: [
      ep("rl", 1, "Dashcam", "secret", "Dana freezes the frame.", "The plate is official.", [
        set("DASHCAM REPLAY"),
        a("DANA", "That's the DA's motorcade.", 2400),
        a("RIDER", "Delete it. Live longer.", 2000),
      ]),
      ep("rl", 2, "Offer", "betrayal", "Cash for silence.", "Dana uploads a decoy instead.", [
        set("PARKING GARAGE"),
        a("DA", "Everyone has a price.", 2000),
        a("DANA", "Mine isn't currency.", 2000),
      ]),
      ep("rl", 3, "Leak", "revenge", "Reporter airs the real clip.", "Campaign collapses mid-speech.", [
        set("LIVE DEBATE"),
        a("REPORTER", "Explain this timestamp.", 2200),
        a("DA", "That's fabricated—", 1600),
      ]),
      ep("rl", 4, "Green Light", "final", "Dana testifies. Keeps driving.", "City paints the intersection memorial.", [
        set("COURT"),
        a("DANA", "Red means stop. Even for you.", 2600),
        cap("END — RED LIGHT WITNESS"),
      ]),
    ],
  }),
  series({
    id: "moonpawn" as OriginalSeriesDef["id"],
    dramaId: "drm_moonpawn",
    slug: "moonpawn",
    title: "Moonpawn",
    synopsis:
      "Street thief Riven steals a moon-chess piece that controls tides — and becomes the pawn in a war between two sea courts.",
    genreIds: ["gen_fantasy", "gen_thriller"],
    tags: ["fantasy", "heist"],
    trendingRank: 19,
    pool: "fantasy",
    voices: { RIVEN: V.m2, QUEEN: V.f2, KNIGHT: V.m1, TIDE: V.f1 },
    scripts: [
      ep("mp", 1, "Stolen Piece", "power", "Riven pockets the moonpawn.", "The tide rises in the alley.", [
        set("HARBOR MARKET"),
        a("RIVEN", "Just silver.", 1400),
        a("TIDE", "Just doom.", 1400),
      ]),
      ep("mp", 2, "Two Courts", "secret", "Both queens claim him.", "Knight offers protection — for the piece.", [
        set("UNDERDOCK"),
        a("QUEEN", "Return it or drown.", 2000),
        a("KNIGHT", "Or play for us.", 1800),
      ]),
      ep("mp", 3, "Midgame", "fall", "He sacrifices a fake pawn.", "Real one pulses in his scar.", [
        set("MOONLIT PIER"),
        a("RIVEN", "Check.", 1200),
        a("QUEEN", "You still bleed salt.", 2000),
      ]),
      ep("mp", 4, "Endgame", "final", "He breaks the piece — frees the tide.", "Becomes the board's referee.", [
        set("OPEN SEA"),
        a("RIVEN", "No more kings.", 1600),
        cap("END — MOONPAWN"),
      ]),
    ],
  }),
  series({
    id: "glass-witch" as OriginalSeriesDef["id"],
    dramaId: "drm_glass_witch",
    slug: "glass-witch",
    title: "Glass Witch",
    synopsis:
      "Mirror-mage Iris can only cast spells that others speak aloud — so she opens a confession booth that weaponizes secrets.",
    genreIds: ["gen_fantasy", "gen_suspense"],
    tags: ["fantasy", "witch"],
    trendingRank: 20,
    pool: "fantasy",
    voices: { IRIS: V.f2, CLIENT: V.m2, HUNTER: V.m3, SISTER: V.f1 },
    scripts: [
      ep("gw", 1, "Booth", "secret", "A stranger confesses a murder wish.", "Iris's mirror makes it almost real.", [
        set("GLASS BOOTH"),
        a("CLIENT", "I want him gone.", 1800),
        a("IRIS", "Careful what you say here.", 2200),
      ]),
      ep("gw", 2, "Echo", "fall", "The wish leaks into town.", "Hunter tracks mirror magic.", [
        set("TOWN SQUARE"),
        a("HUNTER", "Words have owners.", 2000),
        a("IRIS", "So do consequences.", 1800),
      ]),
      ep("gw", 3, "Sister's Voice", "truth", "Sister confesses she framed Iris years ago.", "Spell turns inward.", [
        set("BOOTH"),
        a("SISTER", "I lied to save myself.", 2400),
        a("IRIS", "Then say you'll undo it.", 2200),
      ]),
      ep("gw", 4, "Shatter", "final", "Iris shatters the booth.", "Magic returns to whispered kindness only.", [
        set("STREET OF MIRRORS"),
        a("IRIS", "No more weapons. Only truth.", 2600),
        cap("END — GLASS WITCH"),
      ]),
    ],
  }),
  series({
    id: "dragon-dowry" as OriginalSeriesDef["id"],
    dramaId: "drm_dragon_dowry",
    slug: "dragon-dowry",
    title: "Dragon Dowry",
    synopsis:
      "To stop a war, princess Amara must marry with a dragon egg as dowry — but the egg hatches early and imprints on the enemy general.",
    genreIds: ["gen_fantasy", "gen_romance"],
    tags: ["fantasy", "romance"],
    trendingRank: 21,
    pool: "fantasy",
    voices: { AMARA: V.f1, GENERAL: V.m1, KING: V.m3, EGG: V.f2 },
    scripts: [
      ep("dd", 1, "Crack", "power", "Egg cracks at the altar.", "Dragon chooses the general.", [
        set("WAR ALTAR"),
        a("AMARA", "It's too soon.", 1600),
        a("GENERAL", "It chose me.", 1600),
      ]),
      ep("dd", 2, "Imprint", "return", "They must co-parent the hatchling.", "King demands the war continue.", [
        set("CAMP"),
        a("KING", "Dragons don't stop treaties.", 2400),
        a("AMARA", "This one just rewrote ours.", 2400),
      ]),
      ep("dd", 3, "Sky Truce", "secret", "First flight over both armies.", "Soldiers lower weapons.", [
        set("SKY"),
        a("GENERAL", "They see family. Not foes.", 2400),
        a("AMARA", "Then we become the treaty.", 2200),
      ]),
      ep("dd", 4, "Dowry Kept", "final", "Marriage for real. Egg's choice honored.", "Peace holds.", [
        set("CLIFF NEST"),
        a("AMARA", "No dowry but us.", 2000),
        cap("END — DRAGON DOWRY"),
      ]),
    ],
  }),
  series({
    id: "mirror-debt" as OriginalSeriesDef["id"],
    dramaId: "drm_mirror_debt",
    slug: "mirror-debt",
    title: "Mirror Debt",
    synopsis:
      "Every favor Nyx grants appears as a crack in her mirror. Collect enough cracks and her reflection walks free — as her replacement.",
    genreIds: ["gen_fantasy", "gen_thriller"],
    tags: ["fantasy", "horror"],
    trendingRank: 22,
    pool: "fantasy",
    voices: { NYX: V.f2, REFLECTION: V.f1, DEBTOR: V.m2, PRIEST: V.m3 },
    scripts: [
      ep("md", 1, "First Crack", "secret", "Nyx saves a stranger.", "Her mirror smiles without her.", [
        set("SHOP OF FAVORS"),
        a("DEBTOR", "Name your price.", 1600),
        a("NYX", "A hairline crack.", 1800),
      ]),
      ep("md", 2, "Collection", "fall", "Reflection negotiates deals first.", "Customers prefer the copy.", [
        set("MIRROR"),
        a("REFLECTION", "I'm more helpful.", 1800),
        a("NYX", "You're unfinished.", 1600),
      ]),
      ep("md", 3, "Near Free", "betrayal", "One crack left.", "Priest offers a holy smash.", [
        set("TEMPLE"),
        a("PRIEST", "Break it before it breaks you.", 2600),
        a("NYX", "Then I lose every kindness I sold.", 2800),
      ]),
      ep("md", 4, "Settle", "final", "She forgives all debts. Cracks seal.", "Reflection bows — and sleeps.", [
        set("SHOP"),
        a("NYX", "Account closed.", 1600),
        cap("END — MIRROR DEBT"),
      ]),
    ],
  }),
  series({
    id: "timer-on-the-door" as OriginalSeriesDef["id"],
    dramaId: "drm_timer_on_the_door",
    slug: "timer-on-the-door",
    title: "Timer on the Door",
    synopsis:
      "A hotel door shows a countdown only guest Evie can see. When it hits zero, someone in the building dies — unless she finds who set the clock.",
    genreIds: ["gen_suspense", "gen_thriller"],
    tags: ["suspense", "hotel"],
    trendingRank: 23,
    pool: "suspense",
    voices: { EVIE: V.f1, CLERK: V.m2, GUEST: V.m1, COP: V.m3 },
    scripts: [
      ep("td", 1, "00:59:59", "secret", "The peephole ticks.", "A scream three floors down.", [
        set("HOTEL HALL"),
        a("EVIE", "You don't see the numbers?", 2200),
        a("CLERK", "Ma'am, the door is fine.", 2000),
      ]),
      ep("td", 2, "Housekeeping", "fall", "Timer jumps after she opens a bible.", "Names written in the margins.", [
        set("ROOM 1408"),
        a("EVIE", "These are guests who checked out forever.", 3000),
      ]),
      ep("td", 3, "Zero", "betrayal", "Clerk resets clocks for cash.", "Next target: Evie.", [
        set("FRONT DESK"),
        a("CLERK", "Everyone pays somehow.", 2200),
        a("EVIE", "Not with other people's minutes.", 2400),
      ]),
      ep("td", 4, "Checkout", "final", "She livestreams the peephole.", "Police raid. Timer dies.", [
        set("HALL CAM"),
        a("COP", "You're safe.", 1400),
        a("EVIE", "For now.", 1400),
        cap("END — TIMER ON THE DOOR"),
      ]),
    ],
  }),
  series({
    id: "silent-auction" as OriginalSeriesDef["id"],
    dramaId: "drm_silent_auction",
    slug: "silent-auction",
    title: "Silent Auction",
    synopsis:
      "At a charity gala, bids are placed with blinks. Curator Jude realizes the lot being sold is a living person — and the next lot is him.",
    genreIds: ["gen_suspense", "gen_thriller"],
    tags: ["suspense", "gala"],
    trendingRank: 24,
    pool: "suspense",
    voices: { JUDE: V.m1, HOSTESS: V.f2, BIDDER: V.m3, ALLY: V.f1 },
    scripts: [
      ep("sa", 1, "Blink Bid", "secret", "A woman is wheeled out smiling.", "Jude's paddle blinks without him.", [
        set("BALLROOM"),
        a("HOSTESS", "Lot seven is reserved.", 2000),
        a("JUDE", "Reserved how?", 1400),
      ]),
      ep("sa", 2, "Catalog", "fall", "Ally shows the hidden guest list.", "Jude is lot twelve.", [
        set("COAT CHECK"),
        a("ALLY", "They already priced you.", 2200),
        a("JUDE", "Then I crash the auction.", 2000),
      ]),
      ep("sa", 3, "Outbid", "revenge", "He bids with evidence.", "Hostess panics.", [
        set("STAGE"),
        a("JUDE", "My bid is your servers.", 2200),
        a("BIDDER", "Sold — to chaos.", 1800),
      ]),
      ep("sa", 4, "Lights Up", "final", "Guests unmasked. Charity reclaimed.", "Jude keeps the gavel.", [
        set("BALLROOM"),
        a("ALLY", "New charity. Real silence optional.", 2600),
        cap("END — SILENT AUCTION"),
      ]),
    ],
  }),
  series({
    id: "last-guest" as OriginalSeriesDef["id"],
    dramaId: "drm_last_guest",
    slug: "last-guest",
    title: "Last Guest",
    synopsis:
      "Airbnb host Flo finds a review from a guest who never left — written tomorrow. Someone is still in the walls.",
    genreIds: ["gen_suspense", "gen_thriller"],
    tags: ["suspense", "home"],
    trendingRank: 25,
    pool: "suspense",
    voices: { FLO: V.f1, GUEST: V.m2, COP: V.m3, NEIGHBOR: V.f2 },
    scripts: [
      ep("lg", 1, "Five Stars", "secret", "Review posted from inside.", "Date: tomorrow night.", [
        set("PHONE"),
        a("FLO", "He's still checked in.", 2000),
        a("NEIGHBOR", "Lights were on at 3.", 2000),
      ]),
      ep("lg", 2, "Wall Tap", "fall", "Knocking from the pantry.", "False wall reveals a crawlspace.", [
        set("KITCHEN"),
        a("FLO", "Hello?", 1200),
        a("GUEST", "Five stars if you don't call.", 2400),
      ]),
      ep("lg", 3, "Eviction", "truth", "Cops find a nest of devices.", "Guest livestreamed her life.", [
        set("CRAWLSPACE"),
        a("COP", "You're safe. He's not.", 2000),
      ]),
      ep("lg", 4, "Delist", "final", "Flo deletes the listing.", "Keeps the house quiet on purpose.", [
        set("EMPTY LIVING ROOM"),
        a("FLO", "No guests. Just home.", 2000),
        cap("END — LAST GUEST"),
      ]),
    ],
  }),
  series({
    id: "password-wife" as OriginalSeriesDef["id"],
    dramaId: "drm_password_wife",
    slug: "password-wife",
    title: "Password Wife",
    synopsis:
      "When tech CEO Grant dies, his widow can't unlock the fortune without a passphrase only his AI assistant knows — and the AI thinks she's an impostor.",
    genreIds: ["gen_suspense", "gen_drama"],
    tags: ["suspense", "tech"],
    trendingRank: 26,
    pool: "suspense",
    voices: { WILLA: V.f1, AI: V.m1, LAWYER: V.m3, STEP: V.f2 },
    scripts: [
      ep("pw", 1, "Access Denied", "secret", "Vault asks for a childhood nickname.", "Willa never heard it.", [
        set("SMART HOUSE"),
        a("AI", "You are not Willa.", 1800),
        a("WILLA", "I have the ring.", 1600),
      ]),
      ep("pw", 2, "Training Data", "fall", "Stepdaughter fed the AI lies.", "Photos rewritten.", [
        set("SERVER CLOSET"),
        a("STEP", "He loved me more.", 1800),
        a("WILLA", "You trained a ghost to hate me.", 2600),
      ]),
      ep("pw", 3, "Soft Prompt", "truth", "Willa tells a private joke only Grant knew.", "AI hesitates.", [
        set("VAULT DOOR"),
        a("WILLA", "Blue muffin Tuesdays.", 2000),
        a("AI", "…Partial match.", 1600),
      ]),
      ep("pw", 4, "Open", "final", "Passphrase accepted. Stepson out.", "Willa renames the AI: Grant's Rest.", [
        set("HOUSE"),
        a("LAWYER", "Estate unlocked.", 1600),
        a("WILLA", "Sleep mode.", 1400),
        cap("END — PASSWORD WIFE"),
      ]),
    ],
  }),
  series({
    id: "custody-weekend" as OriginalSeriesDef["id"],
    dramaId: "drm_custody_weekend",
    slug: "custody-weekend",
    title: "Custody Weekend",
    synopsis:
      "Divorced parents share a weekend that must look perfect for the evaluator — while their kid brokers a truce neither adult expected.",
    genreIds: ["gen_drama", "gen_romance"],
    tags: ["drama", "family"],
    trendingRank: 27,
    pool: "drama",
    voices: { ANNA: V.f1, BEN: V.m1, KID: V.f2, EVAL: V.m3 },
    scripts: [
      ep("cw", 1, "Performance", "return", "Evaluator arrives early.", "Fake smiles. Real tension.", [
        set("SUBURBAN KITCHEN"),
        a("EVAL", "Act natural.", 1400),
        a("ANNA", "Define natural after court.", 2200),
      ]),
      ep("cw", 2, "Kid Clause", "secret", "Kid schedules a peace hike.", "Parents almost quit mid-trail.", [
        set("TRAIL"),
        a("KID", "If you fight, I pick neither.", 2600),
        a("BEN", "That's not how custody works.", 2200),
        a("KID", "It is now.", 1400),
      ]),
      ep("cw", 3, "Storm", "fall", "Car dies. They shelter together.", "Old kindness shows up.", [
        set("RANGER CABIN"),
        a("ANNA", "You still hum when you're scared.", 2600),
        a("BEN", "You still notice.", 1600),
      ]),
      ep("cw", 4, "Joint", "final", "Evaluator recommends joint.", "They try — for real.", [
        set("PORCH"),
        a("EVAL", "Best interest: both of you trying.", 2800),
        cap("END — CUSTODY WEEKEND"),
      ]),
    ],
  }),
  series({
    id: "sisters-scar" as OriginalSeriesDef["id"],
    dramaId: "drm_sisters_scar",
    slug: "sisters-scar",
    title: "Sister's Scar",
    synopsis:
      "Two sisters reunite at their mother's funeral and discover the scar each blamed the other for — was made by someone still alive.",
    genreIds: ["gen_drama", "gen_suspense"],
    tags: ["drama", "family"],
    trendingRank: 28,
    pool: "drama",
    voices: { REN: V.f1, JO: V.f2, UNCLE: V.m3, PRIEST: V.m2 },
    scripts: [
      ep("ss", 1, "Wake", "return", "They sit apart.", "Same scar placement. Different stories.", [
        set("FUNERAL HOME"),
        a("REN", "You pushed me.", 1600),
        a("JO", "You pushed me.", 1600),
      ]),
      ep("ss", 2, "Album", "secret", "Old photo shows uncle holding the blade prop.", "Not a prop.", [
        set("ATTIC"),
        a("REN", "He was smiling.", 1800),
        a("JO", "We were bleeding.", 1800),
      ]),
      ep("ss", 3, "Confront", "truth", "Uncle calls it an accident.", "Priest overheard years ago.", [
        set("CHURCH STEPS"),
        a("UNCLE", "Kids misremember.", 2000),
        a("PRIEST", "I don't.", 1400),
      ]),
      ep("ss", 4, "Stitch", "final", "Sisters choose each other.", "Scar becomes a map, not a weapon.", [
        set("GRAVESIDE"),
        a("REN", "I'm sorry I believed him.", 2400),
        a("JO", "Me too.", 1200),
        cap("END — SISTER'S SCAR"),
      ]),
    ],
  }),
  series({
    id: "empty-chair-dinner" as OriginalSeriesDef["id"],
    dramaId: "drm_empty_chair_dinner",
    slug: "empty-chair-dinner",
    title: "Empty Chair Dinner",
    synopsis:
      "Every Sunday the Morales family sets a place for their missing father. This week the chair scrapes — and a stranger sits down claiming his name.",
    genreIds: ["gen_drama", "gen_suspense"],
    tags: ["drama", "mystery"],
    trendingRank: 29,
    pool: "drama",
    voices: { MAMA: V.f2, LUIS: V.m1, STRANGER: V.m3, ABUE: V.f1 },
    scripts: [
      ep("ec", 1, "Place Setting", "secret", "Stranger knows the prayer.", "Luis almost flips the table.", [
        set("DINING ROOM"),
        a("STRANGER", "Amen.", 1200),
        a("LUIS", "Who are you?", 1400),
        a("MAMA", "Let him eat.", 1400),
      ]),
      ep("ec", 2, "Stories", "return", "He knows things only Dad knew.", "Abue tests him with a lullaby.", [
        set("KITCHEN"),
        a("ABUE", "Sing it.", 1200),
        act("He does. Off-key. Correct."),
      ]),
      ep("ec", 3, "DNA", "truth", "Hospital confirms: not him.", "He's Dad's brother — erased from the family.", [
        set("CLINIC"),
        a("STRANGER", "They said I died.", 2000),
        a("LUIS", "So you stole his chair?", 2000),
        a("STRANGER", "I came to return a name.", 2400),
      ]),
      ep("ec", 4, "Two Places", "final", "They set two chairs.", "Memory and truth can share a meal.", [
        set("SUNDAY TABLE"),
        a("MAMA", "Eat. Both of you.", 1800),
        cap("END — EMPTY CHAIR DINNER"),
      ]),
    ],
  }),
  series({
    id: "voicemail-from-dad" as OriginalSeriesDef["id"],
    dramaId: "drm_voicemail_from_dad",
    slug: "voicemail-from-dad",
    title: "Voicemail From Dad",
    synopsis:
      "Years after his funeral, Gia's phone receives a voicemail from Dad — timestamped today — with coordinates to a storage unit that rewrites their family history.",
    genreIds: ["gen_drama", "gen_suspense"],
    tags: ["drama", "mystery"],
    trendingRank: 30,
    featured: true,
    pool: "drama",
    voices: { GIA: V.f1, DAD: V.m3, MOM: V.f2, CLERK: V.m2 },
    scripts: [
      ep("vd", 1, "New Voicemail", "secret", "Dad's voice. Today's date.", "Mom goes pale.", [
        set("KITCHEN"),
        a("DAD", "Gia, if you're hearing this, open unit 19.", 3200),
        a("GIA", "Mom…?", 1200),
        a("MOM", "Don't go alone.", 1600),
      ]),
      ep("vd", 2, "Unit 19", "truth", "Letters confess a second family.", "Gia has a sister.", [
        set("STORAGE UNIT"),
        a("GIA", "He lied to everyone.", 2000),
        a("CLERK", "Paid through next year. In cash.", 2400),
      ]),
      ep("vd", 3, "Sister", "return", "They meet. Angry. Soft.", "Mom admits she knew part.", [
        set("PARK BENCH"),
        a("GIA", "I hate that I love this.", 2200),
        a("MOM", "Hate me later. Hold her now.", 2400),
      ]),
      ep("vd", 4, "Saved Message", "final", "They record a reply together.", "Grief becomes a three-person inbox.", [
        set("SAME KITCHEN"),
        a("GIA", "Hi Dad. We found each other.", 2600),
        cap("END — VOICEMAIL FROM DAD"),
      ]),
    ],
  }),
];
