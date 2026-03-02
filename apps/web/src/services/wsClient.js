// apps/web/src/services/wsClient.js

export function createLightWiseWsClient({
  url,
  tenantId = (process.env.REACT_APP_TENANT_ID || "tenant-001").trim(),
  onStatus = () => {},
  onMessage = () => {},
  onError = () => {},
  autoReconnect = true,
  reconnectDelayMs = 1200,
} = {}) {
  if (!url) throw new Error("wsClient: missing url");

  const u = new URL(url);
  if (tenantId) u.searchParams.set("tenant_id", tenantId);
  const wsUrl = u.toString();

  let ws = null;
  let closedByUser = false;
  let timer = null;

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const setStatus = (s) => onStatus(s);

  const connect = () => {
    clearTimer();
    closedByUser = false;

    setStatus("connecting");
    console.log("🧷 WS connect:", wsUrl);

    ws = new WebSocket(wsUrl);

    ws.onopen = () => setStatus("connected");
    ws.onmessage = (evt) => {
      const raw = evt.data;
      try {
        onMessage(JSON.parse(raw));
      } catch {
        onMessage({ raw });
      }
    };
    ws.onerror = (err) => {
      setStatus("error");
      onError(err);
    };
    ws.onclose = () => {
      setStatus("disconnected");
      ws = null;
      if (closedByUser) return;
      if (!autoReconnect) return;
      timer = setTimeout(connect, reconnectDelayMs);
    };
  };

  const disconnect = () => {
    clearTimer();
    closedByUser = true;
    try {
      ws && ws.close();
    } catch {}
    ws = null;
    setStatus("disconnected");
  };

  const sendJson = (obj) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(obj));
    return true;
  };

  const subscribe = (streetlightId) => {
    const id = String(streetlightId || "").trim();
    if (!id) return false;
    return sendJson({ action: "subscribe", streetlight_id: id });
  };

  return { connect, disconnect, sendJson, subscribe };
}