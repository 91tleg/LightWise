// src/services/useLightWiseWS.js

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * useLightWiseWS(wsBaseUrl, options?)
 *
 * - wsBaseUrl example:
 *    - local: "ws://localhost:3001"
 *    - aws:   "wss://x7zn8xoare.execute-api.us-east-1.amazonaws.com/production"
 *
 * Returns:
 *  { status, error, lastMessage, messages, send, subscribe, connect, disconnect }
 */
export function useLightWiseWS(wsBaseUrl, options = {}) {
  const {
    autoReconnect = true,
    reconnectDelayMs = 1500,
    maxMessages = 50,
    debug = false,
    // Keep tenantId optional (safe even if backend ignores it)
    tenantId = process.env.REACT_APP_TENANT_ID || "tenant-001",
  } = options;

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const manualCloseRef = useRef(false);

  const [status, setStatus] = useState(wsBaseUrl ? "connecting" : "idle");
  const [error, setError] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  const [messages, setMessages] = useState([]);

  const wsUrl = useMemo(() => {
    if (!wsBaseUrl) return "";
    try {
      const u = new URL(wsBaseUrl);
      if (tenantId) u.searchParams.set("tenant_id", tenantId);
      return u.toString();
    } catch {
      const sep = wsBaseUrl.includes("?") ? "&" : "?";
      return tenantId ? `${wsBaseUrl}${sep}tenant_id=${encodeURIComponent(tenantId)}` : wsBaseUrl;
    }
  }, [wsBaseUrl, tenantId]);

  const log = useCallback(
    (...args) => {
      if (debug) console.log("[LightWiseWS]", ...args);
    },
    [debug]
  );

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
      } catch {
        // ignore
      }
    }

    setStatus("disconnected");
  }, [clearReconnectTimer]);

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

    ws.onerror = (evt) => {
      log("error", evt);
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
        reconnectTimerRef.current = setTimeout(connect, reconnectDelayMs);
      }
    };
  }, [wsUrl, autoReconnect, reconnectDelayMs, maxMessages, log, clearReconnectTimer]);

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

  // Max contract: subscribe requires streetlight_id
  const subscribe = useCallback(
    (streetlightId) => {
      if (!streetlightId) return false;
      return send({ action: "subscribe", streetlight_id: streetlightId });
    },
    [send]
  );

  useEffect(() => {
    if (!wsUrl) {
      disconnect();
      setStatus("idle");
      return;
    }

    connect();
    return () => disconnect();
  }, [wsUrl, connect, disconnect]);

  return {
    status,
    error,
    lastMessage,
    messages,
    send,
    subscribe,
    connect,
    disconnect,
  };
}