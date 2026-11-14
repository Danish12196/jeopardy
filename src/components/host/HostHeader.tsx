import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

type Props = {
  uniqueID: string | undefined;
  onCopyError: (message: string) => void;
  soundMuted?: boolean;
  onToggleSound?: () => void;
};

export default function HostHeader({ uniqueID, onCopyError, soundMuted, onToggleSound }: Props) {
  const [copiedLink, setCopiedLink] = useState(false);

  const copyJoinLink = async () => {
    if (!uniqueID) return;
    const joinUrl = `${window.location.origin}/game/${uniqueID}`;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      onCopyError(`Copy this join link: ${joinUrl}`);
    }
  };

  return (
    <div className="flex flex-wrap justify-between items-center gap-4 mb-6 bg-card/60 backdrop-blur-md p-4 rounded-xl border border-border/50 shadow-md">
      <h1 className="text-2xl md:text-3xl font-bold text-accent drop-shadow-sm">Host Dashboard</h1>
      <div className="flex flex-wrap items-center gap-3">
        {onToggleSound && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onToggleSound}
            aria-pressed={Boolean(soundMuted)}
            data-testid="host-sound-toggle"
          >
            {soundMuted ? "Sound: Muted" : "Sound: On"}
          </Button>
        )}
        <Button asChild variant="secondary" size="sm">
          <Link to={`/game/${uniqueID}/board`} target="_blank" rel="noopener noreferrer">
            Open TV Board
          </Link>
        </Button>
        <Button variant="secondary" size="sm" onClick={copyJoinLink}>
          {copiedLink ? "Copied!" : "Copy Join Link"}
        </Button>
        <div className="text-lg md:text-xl font-semibold">
          Game Code:{" "}
          <span className="font-mono text-accent bg-black/40 px-3 py-1.5 rounded-lg border border-border/40 tracking-wider shadow-inner">
            {uniqueID}
          </span>
        </div>
      </div>
    </div>
  );
}
