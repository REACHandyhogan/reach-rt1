const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const QRCode = require("qrcode");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static("public"));

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, service: "REACH RT1" });
});

const sessions = new Map();

function makeCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

function getSession(code) {
  if (!sessions.has(code)) {
    sessions.set(code, {
      code,
      clients: new Map(),
      state: {
        phase: "waiting",
        speaker: "A",
        timerEndsAt: null,
        questionIndex: 0
      }
    });
  }
  return sessions.get(code);
}

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function broadcast(session, payload) {
  for (const ws of session.clients.values()) send(ws, payload);
}

function snapshot(session) {
  return {
    type: "state",
    session: session.code,
    connected: session.clients.size,
    state: session.state
  };
}

app.get("/api/session", (req, res) => {
  let code = makeCode();
  while (sessions.has(code)) code = makeCode();
  getSession(code);
  res.json({ code });
});

app.get("/api/qr", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send("Missing url");
  try {
    const svg = await QRCode.toString(url, {
      type: "svg",
      margin: 1,
      width: 260
    });
    res.type("image/svg+xml").send(svg);
  } catch (e) {
    res.status(500).send("QR error");
  }
});


function heartbeat() {
  this.isAlive = true;
}

const heartbeatInterval = setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 25000);

wss.on("close", () => clearInterval(heartbeatInterval));

wss.on("connection", (ws, req) => {
  ws.isAlive = true;
  ws.on("pong", heartbeat);
  const u = new URL(req.url, "http://localhost");
  const code = (u.searchParams.get("session") || "").toUpperCase();
  const role = u.searchParams.get("role");
  if (!code || !["A", "B"].includes(role)) {
    ws.close();
    return;
  }

  const session = getSession(code);
  session.clients.set(role, ws);
  ws._session = code;
  ws._role = role;

  send(ws, { type: "role", role });
  broadcast(session, snapshot(session));

  if (session.clients.size === 2 && session.state.phase === "waiting") {
    session.state.phase = "ready";
    broadcast(session, snapshot(session));
  }

  ws.on("message", raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    const s = sessions.get(ws._session);
    if (!s) return;

    if (msg.type === "set_phase") {
      s.state.phase = msg.phase;
      if (msg.speaker) s.state.speaker = msg.speaker;
      s.state.timerEndsAt = null;
      broadcast(s, snapshot(s));
    }

    if (msg.type === "start_timer") {
      s.state.phase = "talking";
      s.state.speaker = msg.speaker;
      s.state.timerEndsAt = Date.now() + 30000;
      broadcast(s, snapshot(s));
      setTimeout(() => {
        const current = sessions.get(s.code);
        if (!current) return;
        if (current.state.timerEndsAt && current.state.timerEndsAt <= Date.now()) {
          current.state.timerEndsAt = null;
          current.state.phase = current.state.speaker === "A" ? "inviteB" : "afterB";
          broadcast(current, snapshot(current));
        }
      }, 30100);
    }

    if (msg.type === "next_question") {
      s.state.questionIndex = (s.state.questionIndex + 1) % 4;
      s.state.phase = "recognize";
      s.state.timerEndsAt = null;
      broadcast(s, snapshot(s));
    }

    if (msg.type === "reset") {
      s.state = { phase: "ready", speaker: "A", timerEndsAt: null, questionIndex: 0 };
      broadcast(s, snapshot(s));
    }
  });

  ws.on("close", () => {
    const s = sessions.get(code);
    if (!s) return;
    if (s.clients.get(role) === ws) s.clients.delete(role);
    broadcast(s, snapshot(s));
    if (s.clients.size === 0) {
      setTimeout(() => {
        const latest = sessions.get(code);
        if (latest && latest.clients.size === 0) sessions.delete(code);
      }, 10 * 60 * 1000);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`REACH RT1 running on http://localhost:${PORT}`);
});
