// apps/web/src/services/wsClient.js
//
// LightWise WebSocket client
// - No auth (per team)
// - Subscribe payload (Max contract):
//     { "action": "subscribe", "streetlight_id": "LW-00042" }
//
// Env (preferred):
//   REACT_APP_WS_URL=wss://.../dev/
// Legacy fallback supported:
//   REACT_APP_LIGHTWISE_WS_URL=wss://... (older name)
//
// NOTE: Your app currently uses useLightWiseWS.js (hook) via Provider.
// This file is kept as a standalone client for future use / debugging.

export function createLightWiseWsClient({
  onStatus = () => {},
  onMessage = () => {},
  debug = false,

  autoReconnect = true,
  reconnectBaseMs = 750,
  reconnectMaxMs = 8000,

  autoSubscribeOnOpen = false,
  defaultStreetlightId = process.env.REACT_APP_DEFAULT_STREETLIGHT_ID || "LW-00042",
} = {}) {
  const wssUrl =
    process.env.REACT_APP_WS_URL ||
    process.env.REACT_APP_LIGHTWISE_WS_URL ||
    "";

  let ws = null;
  let reconnectTimer = null;
  let closedManually = false;
  let reconnectAttempt = 0;

  const state = {
    status: "CLOSED", // CONNECTING | OPEN | CLOSED | ERROR
    lastError: null,
    subscriptions: new Set(),
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
    const raw = reconnectBaseMs * Math.pow(2, reconnectAttempt);
    return Math.min(raw, reconnectMaxMs);
  }

  function scheduleReconnect() {
    if (!autoReconnect) return;
    clearReconnectTimer();

    const delay = nextReconnectDelay();
    reconnectAttempt += 1;

    log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempt})...`);
    reconnectTimer = setTimeout(() => connect(), delay);
  }

  function safeCloseWs() {
    try {
      ws?.close();
    } catch {}
    ws = null;
  }

  function connect() {
    if (!wssUrl) {
      state.lastError = "Missing REACT_APP_WS_URL in .env.local";
      setStatus("ERROR");
      return;
    }

    closedManually = false;
    clearReconnectTimer();
    state.lastError = null;

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

      if (autoSubscribeOnOpen) {
        subscribe(defaultStreetlightId);
      }
    };

    ws.onmessage = (evt) => {
      let data = evt.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          data = { raw: data };
        }
      }
      onMessage(data);
    };

    ws.onerror = (err) => {
      state.lastError = err?.message || "WebSocket error";
      setStatus("ERROR");
      log("ERROR:", err);
    };

    ws.onclose = (evt) => {
      log("CLOSED", { code: evt?.code, reason: evt?.reason });
      safeCloseWs();
      setStatus("CLOSED");
      if (!closedManually) scheduleReconnect();
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

  function subscribe(streetlightId = defaultStreetlightId) {
    const id = String(streetlightId || "").trim();
    if (!id) return false;

    state.subscriptions.add(id);
    return sendJson({ action: "subscribe", streetlight_id: id });
  }

  return {
    connect,
    disconnect,
    subscribe,
    sendJson,
    getState: () => ({
      status: state.status,
      lastError: state.lastError,
      subscriptions: Array.from(state.subscriptions),
    }),
  };
}