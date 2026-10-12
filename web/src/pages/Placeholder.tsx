import { Link } from "react-router";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

/** Stand-in for screens that later milestones will build. */
export function Placeholder({ title }: { title: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo className="text-2xl" />
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-muted-foreground">This screen is still being built.</p>
      <Button asChild variant="outline">
        <Link to="/">Back to start</Link>
      </Button>
    </main>
  );
}
