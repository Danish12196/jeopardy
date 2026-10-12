import { BrowserRouter, Route, Routes } from "react-router";
import { Landing } from "@/pages/Landing";
import { NotFound } from "@/pages/NotFound";
import { Placeholder } from "@/pages/Placeholder";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/demo" element={<Placeholder title="Demo game" />} />
        <Route path="/host" element={<Placeholder title="Host dashboard" />} />
        <Route path="/host/boards/:boardId" element={<Placeholder title="Board editor" />} />
        <Route path="/room/:code/lobby" element={<Placeholder title="Lobby" />} />
        <Route path="/room/:code/board" element={<Placeholder title="Board display" />} />
        <Route path="/room/:code/host" element={<Placeholder title="Host controls" />} />
        <Route path="/room/:code/play" element={<Placeholder title="Buzzer" />} />
        <Route path="/room/:code/results" element={<Placeholder title="Results" />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
