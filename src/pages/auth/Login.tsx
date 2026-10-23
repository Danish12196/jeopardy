import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import pb from "@/pb";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await pb.collection("users").authWithPassword(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Failed to login");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-animated-gradient text-foreground p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-card/80 backdrop-blur-xl p-8 rounded-2xl border border-border/50 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />

        <h1 className="text-4xl font-bold mb-8 text-accent text-center drop-shadow-md tracking-wider uppercase relative z-10">Jeopardy</h1>
        <form onSubmit={handleLogin} className="flex flex-col gap-6 relative z-10">
          <div className="space-y-4">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 bg-background/80 border-border/50 focus:border-accent text-foreground"
                required
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 bg-background/80 border-border/50 focus:border-accent text-foreground"
                required
              />
          </div>

          <AnimatePresence>
            {error && (
                <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-destructive text-sm font-bold bg-destructive/10 p-3 rounded-lg border border-destructive/20 text-center"
                >
                    {error}
                </motion.p>
            )}
          </AnimatePresence>

          <Button type="submit" variant="jeopardy" className="w-full h-14 text-lg">
            Login
          </Button>
        </form>

        <div className="mt-6 flex items-center gap-4 relative z-10">
            <div className="h-px bg-border flex-1" />
            <span className="text-sm text-muted-foreground uppercase font-bold tracking-wider">or</span>
            <div className="h-px bg-border flex-1" />
        </div>

        <div className="mt-6 relative z-10">
            <Button variant="secondary" className="w-full h-14 text-lg font-bold border-2 border-border/50" asChild>
                <Link to="/game">Join a Game (Player)</Link>
            </Button>
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground relative z-10">
          Don't have an account?{" "}
          <Link to="/register" className="text-accent font-bold hover:underline transition-all hover:text-yellow-300">
            Sign up
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
