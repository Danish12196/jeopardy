import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import pb from "@/pb";

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== passwordConfirm) {
      setError("Passwords do not match");
      return;
    }
    try {
      await pb.collection("users").create({
        username,
        email,
        password,
        passwordConfirm,
      });
      await pb.collection("users").authWithPassword(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Failed to register");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-animated-gradient text-foreground p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-card/60 backdrop-blur-md p-8 rounded-2xl border border-border/50 shadow-2xl"
      >
        <h1 className="text-4xl font-bold mb-8 text-accent text-center drop-shadow-md">Sign Up</h1>
        <form onSubmit={handleRegister} className="flex flex-col gap-6">
          <div className="space-y-4">
              <Input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-12 bg-background/50 border-border/50 focus:border-accent"
                required
              />
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 bg-background/50 border-border/50 focus:border-accent"
                required
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 bg-background/50 border-border/50 focus:border-accent"
                required
              />
              <Input
                type="password"
                placeholder="Confirm Password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="h-12 bg-background/50 border-border/50 focus:border-accent"
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
            Create Account
          </Button>
        </form>
        <div className="mt-8 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-accent font-bold hover:underline transition-all">
            Login
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
