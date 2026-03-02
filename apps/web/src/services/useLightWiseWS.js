import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Contract:
 *  - WS $connect needs tenant_id as query param (demo mode)
 *  - subscribe payload: { action:"subscribe", streetlight_id:"LW-00042" }
 */
export function useLightWiseWS(wsBaseUrl, options = {}) {
  const {
    autoReconnect = true,
    reconnectDelayMs = 1500,
    maxMessages = 50,
    debug = false,
    tenantId = (process.env.REACT_APP_TENANT_ID || "tenant-001").trim(),
  } = options;

  const wsUrl = useMemo(() => {
    const base = (wsBaseUrl || "").trim();
    if (!base) return "";
    const u = new URL(base);
    if (tenantId) u.searchParams.set("tenant_id", tenantId);
    return u.toString();
  }, [wsBaseUrl, tenantId]);

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const manualCloseRef = useRef(false);

  const [status, setStatus] = useState(wsUrl ? "connecting" : "idle");
  const [error, setError] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  const [messages, setMessages] = useState([]);

  const log = useCallback((...args) => debug && console.log("[LightWiseWS]", ...args), [debug]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    manualCloseRef.current = true;
    clearReconnectTimer();
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      try {
        ws.close(1000, "client disconnect");
      } catch {}
    }
    setStatus("disconnected");
  }, [clearReconnectTimer]);

  const send = useCallback((obj) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(JSON.stringify(obj));
      return true;
    } catch (e) {
      setError(e);
      return false;
    }
  }, []);

  const subscribe = useCallback(
    (streetlightId) => {
      const id = String(streetlightId || "").trim();
      if (!id) return false;
      return send({ action: "subscribe", streetlight_id: id });
    },
    [send]
  );

  const connect = useCallback(() => {
    if (!wsUrl) {
      setStatus("idle");
      return;
    }

    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    manualCloseRef.current = false;
    clearReconnectTimer();
    setError(null);
    setStatus("connecting");

    console.log("🧷 WS connect:", wsUrl);

    let ws;
    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      setError(e);
      setStatus("error");
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      log("connected");
      setStatus("connected");
      setError(null);
    };

    ws.onmessage = (evt) => {
      const raw = evt.data;
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = { raw };
      }
      setLastMessage(parsed);
      setMessages((prev) => [parsed, ...prev].slice(0, maxMessages));
    };

    ws.onerror = () => {
      setStatus("error");
      setError(new Error("WebSocket error"));
    };

    ws.onclose = (evt) => {
      log("closed", evt.code, evt.reason);
      wsRef.current = null;

      if (manualCloseRef.current) {
        setStatus("disconnected");
        return;
      }

      setStatus("disconnected");

      if (autoReconnect) {
        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(() => connect(), reconnectDelayMs);
      }
    };
  }, [wsUrl, autoReconnect, reconnectDelayMs, maxMessages, log, clearReconnectTimer]);

  useEffect(() => {
    if (!wsUrl) {
      disconnect();
      setStatus("idle");
      return;
    }
    connect();
    return () => disconnect();
  }, [wsUrl, connect, disconnect]);

  return { status, error, lastMessage, messages, send, subscribe, connect, disconnect };
}