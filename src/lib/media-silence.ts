/** Hard-stop every feed/watch media element. Safe to call during click handlers. */
export function hardStopFeedPlayback() {
  if (typeof document === "undefined") return;

  const nodes = document.querySelectorAll<HTMLMediaElement>(
    "video.slop-feed-video, .slop-watch-shell video, .slop-watch-shell audio",
  );

  nodes.forEach((el) => {
    try {
      el.pause();
      el.muted = true;
      el.volume = 0;
      el.removeAttribute("src");
      el.removeAttribute("autoplay");
      while (el.firstChild) el.removeChild(el.firstChild);
      el.load();
    } catch {
      /* ignore */
    }
  });

  if (document.pictureInPictureElement) {
    void document.exitPictureInPicture().catch(() => {});
  }
}
