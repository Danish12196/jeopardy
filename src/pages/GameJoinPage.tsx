import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function GameJoinPage() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  const handleJoin = () => {
    const trimmed = code.trim();
    if (trimmed) navigate(`/game/${trimmed}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-950 text-white p-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-3xl font-bold mb-6">Join a Game</h1>
        <Input
          placeholder="Enter Game Code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="mb-4 text-black"
        />
        <Button
          onClick={handleJoin}
          className="bg-yellow-400 hover:bg-yellow-500 font-bold w-full"
        >
          Join Game
        </Button>
      </div>
    </div>
  );
}
