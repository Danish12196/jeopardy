import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { qrMatrix, qrPath } from "@/lib/qr";

export default function QrJoinButton({ uniqueID }: { uniqueID: string | undefined }) {
  const [open, setOpen] = useState(false);
  const joinUrl = uniqueID ? `${window.location.origin}/game/${uniqueID}` : "";
  const qr = useMemo(() => (joinUrl ? qrPath(qrMatrix(joinUrl)) : null), [joinUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!qr) return null;
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} data-testid="qr-join-button">
        Join QR
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Join QR code"
          data-testid="qr-join-modal"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl p-6 text-center space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <svg
              viewBox={`0 0 ${qr.size} ${qr.size}`}
              className="w-72 h-72 bg-white rounded-lg"
              shapeRendering="crispEdges"
              role="img"
              aria-label={`QR code to join game ${uniqueID}`}
              data-testid="qr-join-svg"
            >
              <path d={qr.d} fill="#000" />
            </svg>
            <p className="font-mono text-sm text-muted-foreground break-all max-w-72">{joinUrl}</p>
            <Button variant="brand" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
