import type { MediaKind } from "@/lib/pbTypes";

type Props = {
  mediaUrl?: string;
  mediaType?: MediaKind;
  compact?: boolean;
};

export default function QuestionMedia({ mediaUrl, mediaType = "image", compact = false }: Props) {
  if (!mediaUrl) return null;

  if (mediaType === "audio") {
    return (
      <div className="flex flex-col items-center gap-2 my-3 z-10 w-full max-w-md" data-testid="question-media-audio">
        <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-accent/20 text-accent border border-accent/40">
          🎵 Music Round
        </span>
        <audio controls src={mediaUrl} className="w-full" />
      </div>
    );
  }

  if (mediaType === "video") {
    return (
      <div className="my-3 z-10 flex justify-center" data-testid="question-media-video">
        <video
          controls
          src={mediaUrl}
          className={`rounded-xl border border-border/50 shadow-lg ${compact ? "max-h-40" : "max-h-64 md:max-h-72"}`}
        />
      </div>
    );
  }

  return (
    <div className="my-3 z-10 flex justify-center" data-testid="question-media-image">
      <img
        src={mediaUrl}
        alt="Question media"
        className={`rounded-xl border border-border/50 shadow-lg object-contain ${compact ? "max-h-40" : "max-h-64 md:max-h-72"}`}
      />
    </div>
  );
}
