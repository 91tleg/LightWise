import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_OPTIONS = {
  autoReconnect:    true,
  reconnectDelayMs: 1500,
  maxMessages:      50,
  debug:            false,
  getToken:         null,
};

export function useWebSocket(wsBaseUrl, options = {}) {
  const {
    autoReconnect,
    reconnectDelayMs,
    maxMessages,
    debug,
    getToken,
  } = { ...DEFAULT_OPTIONS, ...options };

  const wsUrl = useMemo(() => (wsBaseUrl || "").trim(), [wsBaseUrl]);

  const wsRef             = useRef(null);
  const reconnectTimerRef = useRef(null);
  const manualCloseRef    = useRef(false);
  const subscribedIdsRef  = useRef(new Set());
  const connectAttemptRef = useRef(0);

  const [status,      setStatus]      = useState(wsUrl ? "connecting" : "idle");
  const [error,       setError]       = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  const [messages,    setMessages]    = useState([]);

  const log = useCallback((...args) => {
    if (debug) console.log("[useWebSocket]", ...args);
  }, [debug]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    manualCloseRef.current = true;
    connectAttemptRef.current += 1;
    clearReconnectTimer();
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      try { ws.close(1000, "client disconnect"); } catch {}
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

  const subscribe = useCallback((streetlightId) => {
    const id = String(streetlightId || "").trim();
    if (!id) return false;
    subscribedIdsRef.current.add(id);
    return send({ action: "subscribe", streetlight_id: id });
  }, [send]);

  const connect = useCallback(async () => {
    if (!wsUrl) { setStatus("idle"); return; }

    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return;

    const attemptId = connectAttemptRef.current + 1;
    connectAttemptRef.current = attemptId;
    manualCloseRef.current = false;
    clearReconnectTimer();
    setError(null);
    setStatus("connecting");

    let socket;
    try {
      const token = getToken ? await getToken() : null;
      if (manualCloseRef.current || connectAttemptRef.current !== attemptId) return;
      socket = token ? new WebSocket(wsUrl, [token]) : new WebSocket(wsUrl);
    } catch (e) {
      if (manualCloseRef.current || connectAttemptRef.current !== attemptId) return;
      setError(e);
      setStatus("error");
      return;
    }

    wsRef.current = socket;

    socket.onopen = () => {
      log("connected");
      setStatus("connected");
      setError(null);
      // Re-subscribe to all tracked ids after reconnect
      subscribedIdsRef.current.forEach((id) => {
        try {
          socket.send(JSON.stringify({ action: "subscribe", streetlight_id: id }));
          log("re-subscribed", id);
        } catch (e) {
          setError(e);
        }
      });
    };

    socket.onmessage = (evt) => {
      let parsed;
      try { parsed = JSON.parse(evt.data); } catch { parsed = { raw: evt.data }; }
      setLastMessage(parsed);
      setMessages((prev) => [parsed, ...prev].slice(0, maxMessages));
    };

    socket.onerror = () => {
      setStatus("error");
      setError(new Error("WebSocket error"));
    };

    socket.onclose = (evt) => {
      log("closed", evt.code, evt.reason);
      if (wsRef.current === socket) wsRef.current = null;
      setStatus("disconnected");
      if (!manualCloseRef.current && autoReconnect) {
        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(connect, reconnectDelayMs);
      }
    };
  }, [wsUrl, autoReconnect, reconnectDelayMs, maxMessages, getToken, log, clearReconnectTimer]);

  useEffect(() => {
    if (!wsUrl) { disconnect(); setStatus("idle"); return; }
    connect();
    return () => disconnect();
  }, [wsUrl, connect, disconnect]);

  return { status, error, lastMessage, messages, send, subscribe, connect, disconnect };
}
