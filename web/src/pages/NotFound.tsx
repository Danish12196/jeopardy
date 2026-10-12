import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="text-muted-foreground">There's nothing at this address.</p>
      <Button asChild variant="outline">
        <Link to="/">Back to start</Link>
      </Button>
    </main>
  );
}
