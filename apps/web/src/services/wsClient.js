// apps/web/src/services/wsClient.js
//
// LightWise WebSocket client (Learner Lab friendly)
// - No auth (per Kirat)
// - Subscribe payload is ONLY: { action: "subscribe" }
// - Backend currently only replies: { message: "Subscribed successfully" }
// - No real-time broadcast yet (ManageConnections not implemented), so this client
//   focuses on stable connect + subscribe + clean reconnection.
//
// Env:
//   REACT_APP_LIGHTWISE_WS_URL=wss://x7zn8xoare.execute-api.us-east-1.amazonaws.com/production
//
// Usage:
//   const client = createLightWiseWsClient({ onStatus, onMessage, debug: true });
//   client.connect();
//   // optional: client.subscribe() if you want manual subscribe, but connect() auto-subscribes.

export function createLightWiseWsClient({
  onStatus = () => {},
  onMessage = () => {},
  debug = false,

  // reconnect behavior
  autoReconnect = true,
  reconnectBaseMs = 750,
  reconnectMaxMs = 8000,

  // subscribe behavior
  autoSubscribeOnOpen = true,
} = {}) {
  const wssUrl = process.env.REACT_APP_LIGHTWISE_WS_URL;

  let ws = null;
  let reconnectTimer = null;
  let closedManually = false;
  let reconnectAttempt = 0;

  const state = {
    status: "CLOSED", // CONNECTING | OPEN | CLOSED | ERROR
    lastError: null,

    // Kept for compatibility with your existing UI/status payload
    // even though backend doesn't use streetlight ids yet.
    subscriptions: new Set(),

    // tracks whether we've sent the minimal subscribe at least once in this session
    didSubscribeThisSession: false,
  };

  function log(...args) {
    if (debug) console.log("[LightWise WS]", ...args);
  }

  function emitStatus() {
    onStatus({
      status: state.status,
      lastError: state.lastError,
      subscriptions: Array.from(state.subscriptions),
    });
  }

  function setStatus(next) {
    state.status = next;
    emitStatus();
  }

  function clearReconnectTimer() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function nextReconnectDelay() {
    // exponential backoff with cap
    const raw = reconnectBaseMs * Math.pow(2, reconnectAttempt);
    return Math.min(raw, reconnectMaxMs);
  }

  function scheduleReconnect() {
    if (!autoReconnect) return;
    clearReconnectTimer();

    const delay = nextReconnectDelay();
    reconnectAttempt += 1;

    log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempt})...`);
    reconnectTimer = setTimeout(() => {
      connect();
    }, delay);
  }

  function safeCloseWs() {
    try {
      ws?.close();
    } catch {
      // ignore
    }
    ws = null;
  }

  function connect() {
    if (!wssUrl) {
      state.lastError = "Missing REACT_APP_LIGHTWISE_WS_URL in .env";
      setStatus("ERROR");
      return;
    }

    closedManually = false;
    clearReconnectTimer();
    state.lastError = null;
    state.didSubscribeThisSession = false;

    setStatus("CONNECTING");
    log("Connecting:", wssUrl);

    try {
      ws = new WebSocket(wssUrl);
    } catch (e) {
      state.lastError = e?.message || "Failed to create WebSocket";
      setStatus("ERROR");
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      reconnectAttempt = 0;
      setStatus("OPEN");
      log("OPEN");

      // Per Kirat: minimal subscribe payload, no other fields.
      if (autoSubscribeOnOpen) {
        subscribe(); // minimal subscribe
      }
    };

    ws.onmessage = (evt) => {
      let data = evt.data;

      // Try JSON parse; fallback to raw
      if (typeof evt.data === "string") {
        try {
          data = JSON.parse(evt.data);
        } catch {
          // keep raw string
        }
      }

      onMessage(data);
    };

    ws.onerror = (err) => {
      // browsers often provide very little info here
      state.lastError = err?.message || "WebSocket error";
      setStatus("ERROR");
      log("ERROR:", err);
      // do not reconnect here; onclose will fire and handle it
    };

    ws.onclose = (evt) => {
      log("CLOSED", { code: evt?.code, reason: evt?.reason });

      safeCloseWs();
      setStatus("CLOSED");

      if (!closedManually) {
        scheduleReconnect();
      }
    };
  }

  function disconnect() {
    closedManually = true;
    clearReconnectTimer();
    safeCloseWs();
    setStatus("CLOSED");
  }

  function sendJson(obj) {
    if (!ws || state.status !== "OPEN") return false;
    try {
      ws.send(JSON.stringify(obj));
      return true;
    } catch (e) {
      state.lastError = e?.message || "Failed to send WebSocket message";
      setStatus("ERROR");
      return false;
    }
  }

  /**
   * subscribe()
   * Kirat confirmed the ONLY required payload right now is:
   *   { "action": "subscribe" }
   *
   * We keep a streetlightId parameter for forward-compat, but we DO NOT send it
   * until backend supports it.
   */
  function subscribe(streetlightId) {
    // forward-compat: track what UI thinks is "subscribed"
    if (streetlightId) state.subscriptions.add(streetlightId);

    // Avoid spamming subscribe on every reconnect loop if you want:
    // (but currently harmless even if repeated)
    state.didSubscribeThisSession = true;

    return sendJson({ action: "subscribe" });
  }

  return {
    connect,
    disconnect,
    subscribe,

    // optional: if you ever need to inspect client state from outside
    getState: () => ({
      status: state.status,
      lastError: state.lastError,
      subscriptions: Array.from(state.subscriptions),
      didSubscribeThisSession: state.didSubscribeThisSession,
    }),
  };
}