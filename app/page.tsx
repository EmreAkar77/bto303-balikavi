"use client";
import { useState } from "react";
import UnderwaterGame from "@/app/components/UnderwaterGame";

export default function Home() {
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [started, setStarted] = useState(false);

  const handleExit = () => {
    setStarted(false);
    setNickname("");
    setRoomCode("");
  };

  const handleStart = () => {
    const enteredNickname = nickname.trim();
    if (!enteredNickname) return;
    const enteredRoomCode = roomCode.trim().replace(/\D/g, "").slice(0, 6);
    const nextRoomCode = enteredRoomCode || String(Math.floor(100000 + Math.random() * 900000));
    setNickname(enteredNickname);
    setRoomCode(nextRoomCode);
    setStarted(true);
  };

  if (!started) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#001d3d] to-[#003366] text-white p-4">
        <h1 className="mb-8 text-4xl font-bold drop-shadow-lg text-center">DERİN DENİZ — Denizaltı Avı</h1>
        <input
          type="text"
          placeholder="Takma adınız"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="mb-4 w-80 rounded bg-white/10 px-3 py-2 text-white placeholder-white focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        <input
          type="text"
          placeholder="6 haneli oda kodu (boş bırakırsanız oluşturulur)"
          value={roomCode}
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="mb-4 w-80 rounded bg-white/10 px-3 py-2 text-white placeholder-white focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        <p className="mb-4 w-80 text-center text-sm text-white/75">
          Aynı Wi-Fi&apos;daki oyuncular bilgisayarınızın ağ adresinden siteyi açıp bu oda kodunu girebilir.
        </p>
        <button
          onClick={handleStart}
          disabled={!nickname.trim()}
          className="rounded bg-teal-600 px-6 py-3 font-semibold hover:bg-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-300"
        >
          OYUNA DAL
        </button>
        <div className="mt-8 max-w-xl text-center space-y-4">
          <h2 className="text-2xl font-semibold">Kurallar</h2>
          <ul className="list-none space-y-2">
            <li className="flex items-center justify-center">
              <span className="inline-block w-5 h-5 mr-2 bg-[#4fd1c5] rounded-full"></span>
              Mavi balık: +10 puan
            </li>
            <li className="flex items-center justify-center">
              <span className="inline-block w-5 h-5 mr-2 bg-[#fcd34d] rounded-full"></span>
              Sarı balık: -50 puan (puan 0 altına düşmez)
            </li>
            <li className="flex items-center justify-center">
              <span className="inline-block w-5 h-5 mr-2 bg-[#111] rounded-full"></span>
              Siyah balık: Oyun biter
            </li>
          </ul>
        </div>
      </div>
    );
  }

  return <UnderwaterGame nickname={nickname} roomCode={roomCode} onExit={handleExit} />;
}
