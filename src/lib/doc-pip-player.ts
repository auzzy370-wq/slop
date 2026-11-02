/** Document Picture-in-Picture helper — floating window with episode controls. */

export type DocPipEpisodeChrome = {
  episodeNumber: number;
  episodeTotal: number;
  seriesTitle: string;
  hasPrev: boolean;
  hasNext: boolean;
};

export type DocPipCallbacks = {
  onPrev: () => void;
  onNext: () => void;
  onEnded: () => void;
  onClose: (resume: { currentTime: number; paused: boolean }) => void;
};

export type DocPipSession = {
  window: Window;
  video: HTMLVideoElement;
  updateChrome: (chrome: DocPipEpisodeChrome) => void;
  loadEpisode: (src: string, opts?: { currentTime?: number; autoplay?: boolean }) => void;
  close: () => void;
};

type DocumentPipApi = {
  window: Window | null;
  requestWindow: (options?: {
    width?: number;
    height?: number;
    preferInitialWindowPlacement?: boolean;
  }) => Promise<Window>;
};

export function getDocumentPip(): DocumentPipApi | null {
  if (typeof window === "undefined") return null;
  const api = (
    window as Window & { documentPictureInPicture?: DocumentPipApi }
  ).documentPictureInPicture;
  return api ?? null;
}

const PIP_CSS = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #050508;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
  }
  .shell {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #050508;
  }
  video {
    flex: 1 1 auto;
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: #000;
  }
  .bar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 10px calc(10px + env(safe-area-inset-bottom, 0px));
    background: linear-gradient(transparent, rgba(0,0,0,.82));
  }
  .meta {
    flex: 1 1 auto;
    min-width: 0;
    padding: 0 4px;
  }
  .meta .ep {
    display: block;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: #c4b5fd;
  }
  .meta .title {
    display: block;
    margin-top: 2px;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  button {
    appearance: none;
    border: 0;
    border-radius: 12px;
    height: 36px;
    min-width: 36px;
    padding: 0 10px;
    background: rgba(255,255,255,.1);
    color: #fff;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
  }
  button:hover { background: rgba(255,255,255,.18); }
  button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  button.play { min-width: 40px; }
`;

export async function openDocPipPlayer(options: {
  src: string;
  currentTime?: number;
  muted?: boolean;
  volume?: number;
  playbackRate?: number;
  chrome: DocPipEpisodeChrome;
  callbacks: DocPipCallbacks;
}): Promise<DocPipSession | null> {
  const api = getDocumentPip();
  if (!api) return null;

  // Close any prior document PiP window from this page.
  try {
    api.window?.close();
  } catch {
    /* ignore */
  }

  const win = await api.requestWindow({
    width: 360,
    height: 640,
    preferInitialWindowPlacement: true,
  });

  const doc = win.document;
  const style = doc.createElement("style");
  style.textContent = PIP_CSS;
  doc.head.appendChild(style);

  const shell = doc.createElement("div");
  shell.className = "shell";

  const video = doc.createElement("video");
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.preload = "auto";
  video.controls = false;
  video.muted = !!options.muted;
  video.volume = Math.max(0, Math.min(1, options.volume ?? 1));
  video.playbackRate = options.playbackRate ?? 1;

  const bar = doc.createElement("div");
  bar.className = "bar";

  const prevBtn = doc.createElement("button");
  prevBtn.type = "button";
  prevBtn.setAttribute("aria-label", "Previous episode");
  prevBtn.textContent = "‹";

  const nextBtn = doc.createElement("button");
  nextBtn.type = "button";
  nextBtn.setAttribute("aria-label", "Next episode");
  nextBtn.textContent = "›";

  const playBtn = doc.createElement("button");
  playBtn.type = "button";
  playBtn.className = "play";
  playBtn.setAttribute("aria-label", "Play or pause");
  playBtn.textContent = "⏸";

  const meta = doc.createElement("div");
  meta.className = "meta";
  const epEl = doc.createElement("span");
  epEl.className = "ep";
  const titleEl = doc.createElement("span");
  titleEl.className = "title";
  meta.append(epEl, titleEl);

  bar.append(prevBtn, meta, playBtn, nextBtn);
  shell.append(video, bar);
  doc.body.append(shell);

  const updateChrome = (chrome: DocPipEpisodeChrome) => {
    epEl.textContent = `EP ${chrome.episodeNumber}/${chrome.episodeTotal}`;
    titleEl.textContent = chrome.seriesTitle;
    prevBtn.disabled = !chrome.hasPrev;
    nextBtn.disabled = !chrome.hasNext;
  };
  updateChrome(options.chrome);

  const loadEpisode = (
    src: string,
    opts?: { currentTime?: number; autoplay?: boolean },
  ) => {
    video.src = src;
    video.load();
    const applyTime = () => {
      if (opts?.currentTime != null && Number.isFinite(opts.currentTime)) {
        try {
          video.currentTime = Math.max(0, opts.currentTime);
        } catch {
          /* ignore */
        }
      }
    };
    if (video.readyState >= 1) applyTime();
    else video.addEventListener("loadedmetadata", applyTime, { once: true });
    if (opts?.autoplay !== false) {
      void video.play().catch(() => {});
    }
  };

  loadEpisode(options.src, {
    currentTime: options.currentTime,
    autoplay: true,
  });

  const syncPlayLabel = () => {
    playBtn.textContent = video.paused ? "▶" : "⏸";
  };
  video.addEventListener("play", syncPlayLabel);
  video.addEventListener("pause", syncPlayLabel);
  syncPlayLabel();

  prevBtn.addEventListener("click", () => options.callbacks.onPrev());
  nextBtn.addEventListener("click", () => options.callbacks.onNext());
  playBtn.addEventListener("click", () => {
    if (video.paused) void video.play().catch(() => {});
    else video.pause();
  });
  video.addEventListener("ended", () => options.callbacks.onEnded());

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    try {
      win.close();
    } catch {
      /* ignore */
    }
  };

  win.addEventListener("pagehide", () => {
    if (closed) return;
    closed = true;
    options.callbacks.onClose({
      currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
      paused: video.paused,
    });
  });

  return {
    window: win,
    video,
    updateChrome,
    loadEpisode,
    close,
  };
}
