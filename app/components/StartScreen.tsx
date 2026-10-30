"use client";
import { useState } from "react";
import Game from "@/components/Game";

export default function StartScreen() {
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [started, setStarted] = useState(false);

  const handleStart = () => {
    // In demo mode we ignore room code and just start the game
    setStarted(true);
  };

  if (started) {
    return <Game nickname={nickname} />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#001d3d] to-[#003366] text-white">
      <h1 className="mb-8 text-4xl font-bold drop-shadow-lg">
        Derin Deniz: Denizaltı Avı
      </h1>
      <div className="mb-4 w-80 max-w-full space-y-2">
        <input
          type="text"
          placeholder="Takma adınız"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="w-full rounded bg-white/10 px-3 py-2 text-white placeholder-white focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        <input
          type="text"
          placeholder="Oda kodu (opsiyonel)"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
          className="w-full rounded bg-white/10 px-3 py-2 text-white placeholder-white focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
      </div>
      <button
        onClick={handleStart}
        className="mt-4 rounded bg-teal-600 px-6 py-3 font-semibold hover:bg-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-300"
        disabled={!nickname}
      >
        Oyuna Başla
      </button>
    </div>
  );
}
