"use client";

import { Button } from "@/components/ui/button";
import { useSlopStore } from "@/store/slop-store";
import { toast } from "sonner";

export default function AdminReportsPage() {
  const reports = useSlopStore((s) => s.reports);
  const resolveReport = useSlopStore((s) => s.resolveReport);
  const comments = useSlopStore((s) => s.comments);
  const deleteComment = useSlopStore((s) => s.deleteComment);
  const videos = useSlopStore((s) => s.videos);
  const upsertVideo = useSlopStore((s) => s.upsertVideo);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">
          Reports & moderation
        </h1>
        <p className="mt-1 text-sm text-white/50">
          Review reports, remove spam, disable comments, and record resolutions.
        </p>
      </div>

      <div className="space-y-3">
        {reports.length === 0 && (
          <p className="text-sm text-white/50">No reports in the queue.</p>
        )}
        {reports.map((report) => (
          <div
            key={report.id}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold capitalize">
                {report.contentType} · {report.reason}
              </p>
              <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-bold uppercase">
                {report.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-white/65">{report.details}</p>
            <p className="mt-1 text-xs text-white/35">
              Content id: {report.contentId} ·{" "}
              {new Date(report.createdAt).toLocaleString()}
            </p>
            {report.resolution && (
              <p className="mt-2 text-xs text-[var(--slop-violet)]">
                Resolution: {report.resolution}
              </p>
            )}
            {report.status === "open" && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    if (report.contentType === "comment") {
                      deleteComment(report.contentId);
                    }
                    if (report.contentType === "video") {
                      const video = videos.find((v) => v.id === report.contentId);
                      if (video) {
                        upsertVideo({ ...video, status: "unpublished" });
                      }
                    }
                    resolveReport(report.id, "resolved", "Content removed");
                    toast.success("Report resolved — content action applied");
                  }}
                >
                  Remove content
                </Button>
                {report.contentType === "video" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const video = videos.find((v) => v.id === report.contentId);
                      if (video) {
                        upsertVideo({ ...video, commentsDisabled: true });
                      }
                      resolveReport(
                        report.id,
                        "resolved",
                        "Comments disabled on video",
                      );
                      toast.success("Comments disabled");
                    }}
                  >
                    Disable comments
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    resolveReport(report.id, "dismissed", "No violation found");
                    toast.message("Report dismissed");
                  }}
                >
                  Dismiss
                </Button>
              </div>
            )}
            {report.contentType === "comment" &&
              comments.find((c) => c.id === report.contentId) && (
                <p className="mt-2 rounded-xl bg-black/40 p-2 text-xs text-white/55">
                  “{comments.find((c) => c.id === report.contentId)?.text}”
                </p>
              )}
          </div>
        ))}
      </div>
    </div>
  );
}
