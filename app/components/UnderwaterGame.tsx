'use client';

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

type FishType = "blue" | "yellow" | "black";

type Fish = {
  id: string;
  x: number;
  y: number;
  speedX: number;
  speedY: number;
  type: FishType;
  size: number;
};

type FishVisual = Fish & {
  displayX: number;
  displayY: number;
};

type Player = {
  id: string;
  nickname: string;
  x: number;
  y: number;
  score: number;
  finished: boolean;
};

type PlayerVisual = Player & {
  displayX: number;
  displayY: number;
};

function mergePlayers(players: Player[], currentPlayers: PlayerVisual[]) {
  return players.map((player) => {
    const currentPlayer = currentPlayers.find(({ id }) => id === player.id);
    return {
      ...player,
      displayX: currentPlayer?.displayX ?? player.x,
      displayY: currentPlayer?.displayY ?? player.y,
    };
  });
}

export default function UnderwaterGame({
  nickname,
  onExit,
  roomCode,
}: {
  nickname: string;
  onExit: () => void;
  roomCode?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(64);
  const [gameOver, setGameOver] = useState(false);
  const [roomPlayers, setRoomPlayers] = useState<Player[]>([]);
  const [connectionStatus, setConnectionStatus] = useState("Bağlanıyor...");

  const timeLeftRef = useRef(timeLeft);
  const fishesRef = useRef<FishVisual[]>([]);
  const playersRef = useRef<PlayerVisual[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const playerPosRef = useRef({ x: 0, y: 0 });
  const targetPosRef = useRef({ x: 0, y: 0 });
  const canvasSizeRef = useRef({
    w: typeof window !== "undefined" ? window.innerWidth : 1200,
    h: typeof window !== "undefined" ? window.innerHeight : 800,
  });
  const lastFrameTimeRef = useRef(0);
  const lastMoveSentAtRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const scoreRef = useRef(0);
  const gameOverRef = useRef(false);
  const caughtFishIdsRef = useRef(new Set<string>());
  const nicknameRef = useRef(nickname);
  const gameStartedAtRef = useRef<number | null>(null);
  const positionInitializedRef = useRef(false);

  useEffect(() => {
    nicknameRef.current = nickname;
  }, [nickname]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    const joinRoom = () => socket.emit("join", {
      room: roomCode,
      name: nickname,
      canvasW: canvasSizeRef.current.w,
      canvasH: canvasSizeRef.current.h,
    });

    const updatePlayers = (players: Player[]) => {
      playersRef.current = mergePlayers(players, playersRef.current);
      setRoomPlayers(players);
      const currentPlayer = players.find((player) => player.id === socket.id);
      if (currentPlayer) setScore(currentPlayer.score);
    };

    socket.on("connect", () => {
      setConnectionStatus("Bağlı");
      joinRoom();
    });
    socket.on("disconnect", () => setConnectionStatus("Bağlantı kesildi; yeniden bağlanılıyor..."));
    socket.on("connect_error", () => setConnectionStatus("Sunucuya bağlanılamadı"));
    socket.on("joinError", (message: string) => setConnectionStatus(message));
    socket.on("catchRejected", ({ fishId }: { fishId: string }) => {
      caughtFishIdsRef.current.delete(fishId);
    });
    socket.on(
      "state",
      ({ fishes: serverFishes, players: serverPlayers }: { fishes: Fish[]; players?: Player[] }) => {
        if (Array.isArray(serverPlayers)) {
          playersRef.current = mergePlayers(serverPlayers, playersRef.current);
        }
        if (!Array.isArray(serverFishes) || serverFishes.length === 0) return;

        const existingFishById = new Map(fishesRef.current.map((fish) => [fish.id, fish]));
        const nextFishList = serverFishes.map((fish) => {
          const existing = existingFishById.get(fish.id);
          return {
            ...fish,
            displayX: existing ? existing.displayX : fish.x * canvasSizeRef.current.w,
            displayY: existing ? existing.displayY : fish.y * canvasSizeRef.current.h,
          };
        });

        fishesRef.current = nextFishList;
        const activeIds = new Set(serverFishes.map((fish) => fish.id));
        for (const caughtId of caughtFishIdsRef.current) {
          if (!activeIds.has(caughtId)) caughtFishIdsRef.current.delete(caughtId);
        }
      }
    );

    socket.on("players", updatePlayers);

    socket.on("gameOver", () => {
      setGameOver(true);
      gameOverRef.current = true;
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [nickname, roomCode]);

  useEffect(() => {
    if (gameOver) return;

    const timer = setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          setGameOver(true);
          gameOverRef.current = true;
          socketRef.current?.emit("gameOver");
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameOver]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const isInitialSize = canvasSizeRef.current.w === 0 || canvasSizeRef.current.h === 0;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      canvasSizeRef.current = {
        w: window.innerWidth,
        h: window.innerHeight,
      };
      if (isInitialSize || !positionInitializedRef.current) {
        const center = { x: canvas.width / 2, y: canvas.height / 2 };
        playerPosRef.current = center;
        targetPosRef.current = center;
        positionInitializedRef.current = true;
      }
      socketRef.current?.emit("resize", {
        canvasW: window.innerWidth,
        canvasH: window.innerHeight,
      });
    };

    resize();
    window.addEventListener("resize", resize);

    const handlePointerMove = (event: PointerEvent) => {
      const x = Math.min(Math.max(event.clientX, 0), canvasSizeRef.current.w);
      const y = Math.min(Math.max(event.clientY, 0), canvasSizeRef.current.h);
      targetPosRef.current = { x, y };
      playerPosRef.current = { x, y };
      if (gameStartedAtRef.current === null) {
        gameStartedAtRef.current = performance.now();
      }

      const now = performance.now();
      if (now - lastMoveSentAtRef.current >= 33) {
        lastMoveSentAtRef.current = now;
        socketRef.current?.emit("move", {
          x: canvasSizeRef.current.w === 0 ? 0 : x / canvasSizeRef.current.w,
          y: canvasSizeRef.current.h === 0 ? 0 : y / canvasSizeRef.current.h,
        });
      }
    };

    canvas.style.touchAction = "none";
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerdown", handlePointerMove);

    const drawBackground = () => {
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, "#001d3d");
      gradient.addColorStop(0.5, "#004080");
      gradient.addColorStop(1, "#0066a6");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const floorHeight = canvas.height * 0.1;
      ctx.fillStyle = "#c2b280";
      ctx.fillRect(0, canvas.height - floorHeight, canvas.width, floorHeight);
    };

    const drawFishShape = (fish: FishVisual, x: number, y: number) => {
      ctx.save();
      ctx.translate(x, y);

      if (fish.speedX < 0) {
        ctx.scale(-1, 1);
      }

      const size = fish.size;
      ctx.beginPath();
      ctx.ellipse(0, 0, size, size * 0.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = fish.type === "blue" ? "#4fd1c5" : fish.type === "yellow" ? "#fcd34d" : "#111";
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-size, 0);
      ctx.lineTo(-size - size * 0.5, -size * 0.4);
      ctx.lineTo(-size - size * 0.5, size * 0.4);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(size * 0.3, -size * 0.2, size * 0.12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "black";
      ctx.beginPath();
      ctx.arc(size * 0.35, -size * 0.2, size * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawPlayerFish = (x: number, y: number, name: string) => {
      ctx.save();
      ctx.translate(x, y);

      const size = 30;
      ctx.fillStyle = "#ff6b6b";
      ctx.beginPath();
      ctx.ellipse(0, 0, size, size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-size, 0);
      ctx.lineTo(-size - size * 0.5, -size * 0.4);
      ctx.lineTo(-size - size * 0.5, size * 0.4);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(size * 0.3, -size * 0.2, size * 0.12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "black";
      ctx.beginPath();
      ctx.arc(size * 0.35, -size * 0.2, size * 0.06, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "white";
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "center";
      ctx.fillText(name, 0, -size - 8);
      ctx.restore();
    };

    const bubbleConfig: Array<{ x: number; y: number; r: number; speed: number }> = [];
    for (let i = 0; i < 26; i++) {
      bubbleConfig.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: 2 + Math.random() * 4,
        speed: 0.3 + Math.random() * 0.7,
      });
    }

    const drawBubbles = (deltaSeconds: number) => {
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      bubbleConfig.forEach((bubble) => {
        bubble.y -= bubble.speed * deltaSeconds * 60;
        if (bubble.y < -10) {
          bubble.y = canvas.height + 10;
          bubble.x = Math.random() * canvas.width;
        }
        ctx.beginPath();
        ctx.arc(bubble.x, bubble.y, bubble.r, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    const loop = (now: number) => {
      if (gameOverRef.current) return;

      const deltaSeconds = Math.min((now - lastFrameTimeRef.current) / 1000 || 0.016, 0.05);
      lastFrameTimeRef.current = now;

      const player = playerPosRef.current;
      const target = targetPosRef.current;
      player.x = target.x;
      player.y = target.y;
      const hasGracePeriodElapsed =
        gameStartedAtRef.current !== null &&
        now - gameStartedAtRef.current >= 4000;

      const fishViewport = fishesRef.current;
      for (const fish of fishViewport) {
        const targetX = fish.x * canvasSizeRef.current.w;
        const targetY = fish.y * canvasSizeRef.current.h;
        const lerpFactor = Math.min(1, deltaSeconds * 12);
        fish.displayX += (targetX - fish.displayX) * lerpFactor;
        fish.displayY += (targetY - fish.displayY) * lerpFactor;
      }

      const playerLerpFactor = 1 - Math.exp(-18 * deltaSeconds);
      for (const remotePlayer of playersRef.current) {
        if (remotePlayer.id === socketRef.current?.id) continue;
        remotePlayer.displayX += (remotePlayer.x - remotePlayer.displayX) * playerLerpFactor;
        remotePlayer.displayY += (remotePlayer.y - remotePlayer.displayY) * playerLerpFactor;
      }

      for (const fish of fishViewport) {
        if (caughtFishIdsRef.current.has(fish.id)) continue;
        if (fish.type === "black" && !hasGracePeriodElapsed) continue;

        const dx = fish.displayX - player.x;
        const dy = fish.displayY - player.y;
        const distance = Math.hypot(dx, dy);

        if (distance <= fish.size + 18) {
          caughtFishIdsRef.current.add(fish.id);

          if (fish.type === "blue") {
            const nextScore = scoreRef.current + 10;
            scoreRef.current = nextScore;
            setScore(nextScore);
          } else if (fish.type === "yellow") {
            const nextScore = Math.max(0, scoreRef.current - 50);
            scoreRef.current = nextScore;
            setScore(nextScore);
          } else if (fish.type === "black") {
            socketRef.current?.emit("fishCaught", { fishId: fish.id });
            setGameOver(true);
            gameOverRef.current = true;
            return;
          }

          socketRef.current?.emit("fishCaught", { fishId: fish.id });
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawBackground();
      drawBubbles(deltaSeconds);

      for (const fish of fishViewport) {
        drawFishShape(fish, fish.displayX, fish.displayY);
      }

      for (const playerState of playersRef.current) {
        if (playerState.id === socketRef.current?.id) continue;
        drawPlayerFish(
          playerState.displayX * canvas.width,
          playerState.displayY * canvas.height,
          playerState.nickname
        );
      }

      drawPlayerFish(player.x, player.y, nicknameRef.current);

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    lastFrameTimeRef.current = performance.now();
    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerdown", handlePointerMove);
    };
  }, [gameOver]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  const handleRestart = () => {
    scoreRef.current = 0;
    setScore(0);
    setTimeLeft(64);
    setGameOver(false);
    gameOverRef.current = false;
    gameStartedAtRef.current = null;
    caughtFishIdsRef.current.clear();

    const nextCenter = {
      x: canvasSizeRef.current.w / 2,
      y: canvasSizeRef.current.h / 2,
    };
    playerPosRef.current = nextCenter;
    targetPosRef.current = nextCenter;
    lastFrameTimeRef.current = performance.now();

    socketRef.current?.emit("join", {
      room: roomCode || "default",
      name: nickname,
      canvasW: canvasSizeRef.current.w,
      canvasH: canvasSizeRef.current.h,
      resetScore: true,
    });
  };

  const leaderboard = [...roomPlayers].sort((first, second) => second.score - first.score);

  if (gameOver) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#001d3d] to-[#003366] text-white">
        <h2 className="mb-4 text-3xl font-bold">Oyun Bitti!</h2>
        <p className="mb-2">Skorunuz: {score}</p>
        <div className="mt-4 w-80 max-w-[90vw] rounded-lg bg-slate-950/60 p-4">
          <h3 className="mb-2 font-semibold">Oda sıralaması</h3>
          <ol className="space-y-1">
            {leaderboard.map((player) => (
              <li key={player.id} className="flex justify-between gap-4">
                <span className="truncate">
                  {player.nickname || "Oyuncu"}{player.finished ? " (bitti)" : ""}
                </span>
                <span>{player.score} puan</span>
              </li>
            ))}
          </ol>
        </div>
        <button
          onClick={handleRestart}
          className="mt-4 rounded bg-teal-600 px-6 py-3 font-semibold hover:bg-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-300"
        >
          Yeniden Oyna
        </button>
        <button
          onClick={onExit}
          className="mt-2 rounded bg-gray-600 px-6 py-3 font-semibold hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300"
        >
          Ana Menü
        </button>
      </div>
    );
  }

  return (
    <>
      <canvas ref={canvasRef} className="fixed inset-0" />
      <div className="fixed left-4 top-4 z-10 flex flex-col items-start gap-2 text-white drop-shadow-lg">
        <div className="min-w-32 rounded-lg bg-slate-950/75 px-4 py-2 font-bold shadow-lg">
          ⭐ Puan: {score}
        </div>
        <div className="min-w-32 rounded-lg bg-slate-950/75 px-4 py-2 shadow-lg">
          ⏱ Süre: {timeLeft}s
        </div>
        <div className="max-w-56 truncate rounded-lg bg-slate-950/75 px-4 py-2 shadow-lg">
          Oyuncu: {nickname}
        </div>
      </div>
      <div className="fixed right-4 top-4 z-10 rounded-lg bg-slate-950/60 px-4 py-3 text-white shadow-lg drop-shadow-lg">
        <div className="font-semibold">Oda kodu</div>
        <div className="text-lg font-bold tracking-widest">{roomCode}</div>
        <div className="mt-1 text-xs">{connectionStatus}</div>
        <div className="mt-3 border-t border-white/20 pt-2">
          <div className="mb-1 font-semibold">Oyuncular ({roomPlayers.length})</div>
          <ol className="max-h-48 space-y-1 overflow-y-auto text-sm">
            {leaderboard.map((player) => (
              <li key={player.id} className="flex max-w-64 justify-between gap-4">
                <span className="max-w-40 truncate">
                  {player.nickname || "Oyuncu"}{player.finished ? " (bitti)" : ""}
                </span>
                <span className="shrink-0">{player.score} puan</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <button
        onClick={() => {
          if (window.confirm("Ana menüye dönmek istiyor musunuz?")) {
            onExit();
          }
        }}
        className="fixed right-4 top-20 z-10 rounded bg-gray-800 bg-opacity-70 px-3 py-1 text-white hover:bg-gray-700"
      >
        Ana Menü
      </button>
    </>
  );
}
