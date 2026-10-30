"use client";
import { useEffect, useState } from "react";

type GameProps = {
  nickname: string;
};

export default function Game({ nickname }: GameProps) {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(180);
  const [gameOver, setGameOver] = useState(false);

  // Timer countdown
  useEffect(() => {
    if (gameOver) return;

    const timer = setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          setGameOver(true);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameOver]);

  const handleCatch = (type: "normal" | "poison" | "black") => {
    if (gameOver) return;
    if (type === "normal") {
      setScore((s) => s + 10);
    } else if (type === "poison") {
      setScore((s) => Math.max(0, s - 20));
    } else if (type === "black") {
      setGameOver(true);
    }
  };

  const restart = () => {
    setScore(0);
    setTimeLeft(180);
    setGameOver(false);
  };

  if (gameOver) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#001d3d] to-[#003366] text-white">
        <h2 className="mb-4 text-3xl font-bold">Oyun Bitti!</h2>
        <p className="mb-2">Skorunuz: {score}</p>
        <button
          onClick={restart}
          className="mt-4 rounded bg-teal-600 px-6 py-3 font-semibold hover:bg-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-300"
        >
          Yeniden Oyna
        </button>
        <a
          href="/leaderboard"
          className="mt-2 text-teal-300 underline"
        >
          Liderlik Tablosu
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#001d3d] to-[#003366] text-white">
      <h2 className="mb-2 text-2xl font-semibold">{nickname} - Oyun Başladı</h2>
      <div className="mb-4 flex w-64 justify-between">
        <span>⏱ {timeLeft}s</span>
        <span>⭐ {score}</span>
      </div>
      <div className="flex gap-4">
        <button
          onClick={() => handleCatch("normal")}
          className="rounded bg-green-600 px-4 py-2 hover:bg-green-500"
        >
          🎣 Normal Balık (+10)
        </button>
        <button
          onClick={() => handleCatch("poison")}
          className="rounded bg-yellow-600 px-4 py-2 hover:bg-yellow-500"
        >
          ☣️ Zehirli Balık (-20)
        </button>
        <button
          onClick={() => handleCatch("black")}
          className="rounded bg-gray-800 px-4 py-2 hover:bg-gray-700"
        >
          🦈 Kara Balık (Bitiş)
        </button>
      </div>
    </div>
  );
}
