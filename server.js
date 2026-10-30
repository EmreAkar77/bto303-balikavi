/* eslint-disable @typescript-eslint/no-require-imports */
const http = require("http");
const os = require("os");
const next = require("next");
const { Server } = require("socket.io");

const port = Number.parseInt(process.env.PORT || "3000", 10);
const hostname = process.env.HOST || "0.0.0.0";
const dev = process.argv[2] !== "--production" && process.env.NODE_ENV !== "production";
const app = next({ dev, hostname, port });
const rooms = new Map();
const TICK_RATE_MS = 1000 / 60;
const BROADCAST_INTERVAL_MS = 50;
const WORLD_WIDTH = 1200;
const WORLD_HEIGHT = 800;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function findSpawnPosition(room, currentSize) {
  for (let attempt = 0; attempt < 160; attempt++) {
    const candidate = {
      x: randomBetween(0.08, 0.92),
      y: randomBetween(0.08, 0.92),
    };
    const nearestDistance = room.fishes.reduce((closest, fish) => {
      const dx = (fish.x - candidate.x) * WORLD_WIDTH;
      const dy = (fish.y - candidate.y) * WORLD_HEIGHT;
      return Math.min(closest, Math.hypot(dx, dy));
    }, Number.POSITIVE_INFINITY);

    if (nearestDistance >= 70 + currentSize) return candidate;
  }

  return { x: randomBetween(0.08, 0.92), y: randomBetween(0.08, 0.92) };
}

function createFish(room, type) {
  const size = type === "black" ? 30 : 20;
  const position = findSpawnPosition(room, size);
  const angle = randomBetween(0, Math.PI * 2);
  const speed = randomBetween(0.05, 0.12);

  return {
    id: Math.random().toString(36).slice(2, 11),
    x: position.x,
    y: position.y,
    speedX: Math.cos(angle) * speed,
    speedY: Math.sin(angle) * speed,
    type,
    size,
  };
}

function createRoom() {
  const room = { players: new Map(), fishes: [], sequence: 0 };
  const fishTypes = [
    ...Array(15).fill("blue"),
    ...Array(10).fill("yellow"),
    ...Array(5).fill("black"),
  ];

  for (let index = fishTypes.length - 1; index > 0; index--) {
    const otherIndex = Math.floor(Math.random() * (index + 1));
    [fishTypes[index], fishTypes[otherIndex]] = [fishTypes[otherIndex], fishTypes[index]];
  }

  fishTypes.forEach((type) => room.fishes.push(createFish(room, type)));
  return room;
}

function emitPlayers(roomName, room) {
  io.to(roomName).emit("players", Array.from(room.players.values()));
}

function emitState(roomName, room) {
  room.sequence += 1;
  io.to(roomName).emit("state", {
    sequence: room.sequence,
    fishes: room.fishes,
    players: Array.from(room.players.values()),
  });
}

function removePlayer(socket, currentRoom) {
  if (!currentRoom) return;
  const room = rooms.get(currentRoom);
  if (!room || !room.players.delete(socket.id)) return;

  socket.leave(currentRoom);
  if (room.players.size === 0) {
    rooms.delete(currentRoom);
    return;
  }

  emitPlayers(currentRoom, room);
}

const io = new Server({
  connectionStateRecovery: {
    maxDisconnectionDuration: 120_000,
  },
});

io.on("connection", (socket) => {
  let currentRoom = null;

  socket.on("join", (payload = {}) => {
    const roomName = typeof payload.room === "string" ? payload.room.trim() : "";
    if (!/^\d{6}$/.test(roomName)) {
      socket.emit("joinError", "Oda kodu 6 haneli olmalıdır.");
      return;
    }

    if (currentRoom && currentRoom !== roomName) {
      removePlayer(socket, currentRoom);
    }

    let room = rooms.get(roomName);
    if (!room) {
      room = createRoom();
      rooms.set(roomName, room);
    }

    currentRoom = roomName;
    socket.join(roomName);
    const previousPlayer = room.players.get(socket.id);
    room.players.set(socket.id, {
      id: socket.id,
      nickname: typeof payload.name === "string" ? payload.name.trim().slice(0, 20) : "",
      x: previousPlayer?.x ?? 0.5,
      y: previousPlayer?.y ?? 0.5,
      score: payload.resetScore ? 0 : previousPlayer?.score ?? 0,
      finished: false,
      canvasW: clamp(Number(payload.canvasW) || 1200, 320, 10000),
      canvasH: clamp(Number(payload.canvasH) || 800, 240, 10000),
    });

    emitState(roomName, room);
    emitPlayers(roomName, room);
  });

  socket.on("resize", ({ canvasW, canvasH } = {}) => {
    if (!currentRoom) return;
    const player = rooms.get(currentRoom)?.players.get(socket.id);
    if (!player) return;
    if (Number.isFinite(canvasW) && canvasW > 0) player.canvasW = clamp(canvasW, 320, 10000);
    if (Number.isFinite(canvasH) && canvasH > 0) player.canvasH = clamp(canvasH, 240, 10000);
  });

  socket.on("move", (position = {}) => {
    const player = currentRoom && rooms.get(currentRoom)?.players.get(socket.id);
    if (!player || player.finished || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return;

    player.x = clamp(position.x, 0, 1);
    player.y = clamp(position.y, 0, 1);
  });

  socket.on("fishCaught", ({ fishId } = {}) => {
    if (!currentRoom || typeof fishId !== "string") return;
    const room = rooms.get(currentRoom);
    const player = room?.players.get(socket.id);
    if (!room || !player || player.finished) return;

    const fishIndex = room.fishes.findIndex((fish) => fish.id === fishId);
    if (fishIndex < 0) return;

    const fish = room.fishes[fishIndex];
    const dx = (fish.x - player.x) * player.canvasW;
    const dy = (fish.y - player.y) * player.canvasH;
    if (Math.hypot(dx, dy) > fish.size + 38) {
      socket.emit("catchRejected", { fishId });
      return;
    }

    room.fishes.splice(fishIndex, 1);
    if (fish.type === "blue") player.score += 10;
    if (fish.type === "yellow") player.score = Math.max(0, player.score - 50);
    if (fish.type === "black") player.finished = true;
    room.fishes.push(createFish(room, fish.type));

    emitState(currentRoom, room);
    emitPlayers(currentRoom, room);
  });

  socket.on("gameOver", () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    const player = room?.players.get(socket.id);
    if (!player || player.finished) return;
    player.finished = true;
    emitPlayers(currentRoom, room);
  });

  socket.on("disconnect", () => {
    removePlayer(socket, currentRoom);
  });
});

let lastTick = Date.now();
let elapsedBroadcastMs = 0;
setInterval(() => {
  const now = Date.now();
  const deltaSeconds = Math.min((now - lastTick) / 1000, 0.05);
  lastTick = now;
  elapsedBroadcastMs += deltaSeconds * 1000;

  for (const [roomName, room] of rooms) {
    for (const fish of room.fishes) {
      fish.x += fish.speedX * deltaSeconds;
      fish.y += fish.speedY * deltaSeconds;

      const xPadding = fish.size / WORLD_WIDTH;
      const yPadding = fish.size / WORLD_HEIGHT;
      if (fish.x < xPadding) {
        fish.x = xPadding;
        fish.speedX = Math.abs(fish.speedX);
      } else if (fish.x > 1 - xPadding) {
        fish.x = 1 - xPadding;
        fish.speedX = -Math.abs(fish.speedX);
      }

      if (fish.y < yPadding) {
        fish.y = yPadding;
        fish.speedY = Math.abs(fish.speedY);
      } else if (fish.y > 1 - yPadding) {
        fish.y = 1 - yPadding;
        fish.speedY = -Math.abs(fish.speedY);
      }
    }

    if (elapsedBroadcastMs >= BROADCAST_INTERVAL_MS) emitState(roomName, room);
  }

  if (elapsedBroadcastMs >= BROADCAST_INTERVAL_MS) elapsedBroadcastMs = 0;
}, TICK_RATE_MS);

app.prepare().then(() => {
  const server = http.createServer((request, response) => {
    app.getRequestHandler()(request, response);
  });
  io.attach(server);

  server.listen(port, hostname, () => {
    console.log(`Game server listening on http://localhost:${port}`);
    for (const addresses of Object.values(os.networkInterfaces())) {
      for (const address of addresses || []) {
        if (address.family === "IPv4" && !address.internal) {
          console.log(`Other devices on this network: http://${address.address}:${port}`);
        }
      }
    }
  });
});
