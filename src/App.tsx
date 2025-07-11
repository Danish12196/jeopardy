import GameSetup from "./pages/GameSetup";
import GamePage from "./pages/GamePage";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import GameJoinPage from "./pages/GameJoinPage";

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
      <BrowserRouter basename="/jeopardy">
        <Routes>
          <Route path="/" element={<GameSetup />} />
          <Route path="/game" element={<GameJoinPage />} />
          <Route path="/game/:uniqueID" element={<GamePage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
