// apps/web/src/services/wsClient.js

export function createLightWiseWsClient({
  onStatus = () => {},
  onMessage = () => {},
  debug = false,
} = {}) {
  const wssUrl = process.env.REACT_APP_LIGHTWISE_WS_URL;

  let ws = null;
  let reconnectTimer = null;
  let closedManually = false;

  const state = {
    status: "CLOSED", // CONNECTING | OPEN | CLOSED | ERROR
    lastError: null,
    subscriptions: new Set(),
  };

  function log(...args) {
    if (debug) console.log("[LightWise WS]", ...args);
  }

  function setStatus(next) {
    state.status = next;
    onStatus({
      status: state.status,
      lastError: state.lastError,
      subscriptions: Array.from(state.subscriptions),
    });
  }

  function connect() {
    if (!wssUrl) {
      state.lastError = "Missing REACT_APP_LIGHTWISE_WS_URL in .env";
      setStatus("ERROR");
      return;
    }

    closedManually = false;
    clearTimeout(reconnectTimer);

    setStatus("CONNECTING");
    log("Connecting:", wssUrl);

    ws = new WebSocket(wssUrl);

    ws.onopen = () => {
      setStatus("OPEN");
      log("OPEN");

      // re-subscribe after reconnect
      for (const streetlightId of state.subscriptions) {
        subscribe(streetlightId);
      }
    };

    ws.onmessage = (evt) => {
      let data = evt.data;
      try {
        data = JSON.parse(evt.data);
      } catch {
        // keep raw string
      }
      onMessage(data);
    };

    ws.onerror = (err) => {
      state.lastError = err?.message || "WebSocket error";
      setStatus("ERROR");
      log("ERROR:", err);
    };

    ws.onclose = () => {
      ws = null;
      setStatus("CLOSED");
      log("CLOSED");
      if (!closedManually) scheduleReconnect();
    };
  }

  function scheduleReconnect() {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => connect(), 1500);
  }

  function disconnect() {
    closedManually = true;
    clearTimeout(reconnectTimer);
    try {
      ws?.close();
    } catch {}
    ws = null;
    setStatus("CLOSED");
  }

  function sendJson(obj) {
    if (!ws || state.status !== "OPEN") return false;
    ws.send(JSON.stringify(obj));
    return true;
  }

  function subscribe(streetlightId) {
    if (!streetlightId) return false;
    state.subscriptions.add(streetlightId);

    // This matches Max’s demo-mode subscribe handler
    return sendJson({
      action: "subscribe",
      streetlight_id: streetlightId,
    });
  }

  return { connect, disconnect, subscribe };
}