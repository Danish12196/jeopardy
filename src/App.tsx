import GameSetup from "./pages/GameSetup";
import GameHistory from "./pages/GameHistory";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import GameJoinPage from "./pages/GameJoinPage";
import GameHost from "./pages/GameHost";
import GameBoard from "./pages/GameBoard";
import BuzzerPage from "./pages/BuzzerPage";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import React, { useEffect, useState } from "react";
import pb from "@/pb";

function PrivateRoute({ children }: { children: React.ReactElement }) {
  const [isValid, setIsValid] = useState(() => pb.authStore.isValid);

  useEffect(() => {
    setIsValid(pb.authStore.isValid);
    return pb.authStore.onChange(() => {
      setIsValid(pb.authStore.isValid);
    });
  }, []);

  if (!isValid) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<PrivateRoute><GameSetup /></PrivateRoute>} />
          <Route path="/history" element={<PrivateRoute><GameHistory /></PrivateRoute>} />
          <Route path="/game" element={<GameJoinPage />} />
          <Route path="/game/:uniqueID" element={<BuzzerPage />} />
          <Route path="/game/:uniqueID/board" element={<GameBoard />} />
          <Route path="/game/:uniqueID/host" element={<PrivateRoute><GameHost /></PrivateRoute>} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
