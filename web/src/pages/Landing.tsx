import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Logo } from "@/components/Logo";
import { ServerStatus } from "@/components/ServerStatus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/room-code";

export function Landing() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const canJoin = isValidRoomCode(code);

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canJoin) navigate(`/room/${code}/play`);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-10 px-4 py-12">
      <header className="space-y-3 text-center">
        <h1>
          <Logo className="text-5xl" />
        </h1>
        <p className="text-lg text-balance text-muted-foreground">
          A buzz-in quiz game for game night. The board goes on the TV, the buzzers are everyone's
          phones.
        </p>
      </header>

      <section aria-labelledby="join-heading" className="space-y-4 rounded-xl border bg-card p-6">
        <h2 id="join-heading" className="text-xl font-bold">
          Join a game
        </h2>
        <form onSubmit={handleJoin} className="flex gap-3">
          <label htmlFor="room-code" className="sr-only">
            Room code
          </label>
          <Input
            id="room-code"
            value={code}
            onChange={(event) => setCode(normalizeRoomCode(event.target.value))}
            placeholder="ABCD"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="h-12 text-center font-mono text-2xl tracking-[0.4em] uppercase md:text-2xl"
          />
          <Button type="submit" size="lg" className="h-12" disabled={!canJoin}>
            Join
          </Button>
        </form>
      </section>

      <section aria-label="Host options" className="grid gap-3 sm:grid-cols-2">
        <Button asChild size="lg" variant="secondary" className="h-12">
          <Link to="/host">Host a game</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-12">
          <Link to="/demo">Try the demo</Link>
        </Button>
      </section>

      <footer className="text-center">
        <ServerStatus />
      </footer>
    </main>
  );
}
