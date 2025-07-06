import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import GamePage from "./game";
import GameSetup from "./gameSetup";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function Home() {
  return <GameSetup />;
}
