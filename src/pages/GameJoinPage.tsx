import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function GameJoinPage() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  const handleJoin = () => {
    const trimmed = code.trim();
    if (trimmed) navigate(`/game/${trimmed}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-animated-gradient text-foreground p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-card/60 backdrop-blur-md p-8 rounded-2xl border border-border/50 shadow-2xl text-center"
      >
        <h1 className="text-4xl font-bold mb-8 text-accent drop-shadow-md">Join a Game</h1>
        <Input
          placeholder="Enter Game Code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          className="h-14 text-center text-2xl uppercase tracking-widest font-mono bg-background/50 border-border/50 focus:border-accent mb-6"
        />
        <Button
          onClick={handleJoin}
          variant="jeopardy"
          className="w-full h-14 text-xl"
        >
          Join Game
        </Button>
      </motion.div>
    </div>
  );
}
