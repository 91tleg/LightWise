import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_OPTIONS = {
  autoReconnect:    true,
  reconnectDelayMs: 1500,
  maxReconnectMs:   30000,
  backoffFactor:    2,
  maxMessages:      50,
  debug:            false,
  getToken:         null,
};

export function useWebSocket(wsBaseUrl, options = {}) {
  const {
    autoReconnect,
    reconnectDelayMs,
    maxReconnectMs,
    backoffFactor,
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
  const reconnectCountRef = useRef(0);

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

  const getReconnectDelay = useCallback(() => {
    const delay = reconnectDelayMs * Math.pow(backoffFactor, reconnectCountRef.current);
    // add jitter ±20% to avoid thundering herd
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    return Math.min(delay + jitter, maxReconnectMs);
  }, [reconnectDelayMs, backoffFactor, maxReconnectMs]);

  const disconnect = useCallback(() => {
    manualCloseRef.current = true;
    connectAttemptRef.current += 1;
    reconnectCountRef.current = 0;
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
      const token = getToken ? String((await getToken()) || "").trim() : "";
      if (manualCloseRef.current || connectAttemptRef.current !== attemptId) return;
      socket = token
        ? new WebSocket(wsUrl, ["Bearer", token])
        : new WebSocket(wsUrl);
    } catch (e) {
      if (manualCloseRef.current || connectAttemptRef.current !== attemptId) return;
      setError(e);
      setStatus("error");
      if (autoReconnect) {
        const delay = getReconnectDelay();
        reconnectCountRef.current += 1;
        log(`reconnecting in ${Math.round(delay)}ms (attempt ${reconnectCountRef.current})`);
        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(connect, delay);
      }
      return;
    }

    wsRef.current = socket;

    socket.onopen = () => {
      log("connected");
      reconnectCountRef.current = 0;
      setStatus("connected");
      setError(null);
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
        const delay = getReconnectDelay();
        reconnectCountRef.current += 1;
        log(`reconnecting in ${Math.round(delay)}ms (attempt ${reconnectCountRef.current})`);
        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(connect, delay);
      }
    };
  }, [wsUrl, autoReconnect, getReconnectDelay, maxMessages, getToken, log, clearReconnectTimer]);

  useEffect(() => {
    if (!wsUrl) { disconnect(); setStatus("idle"); return; }
    connect();
    return () => disconnect();
  }, [wsUrl, connect, disconnect]);

  return { status, error, lastMessage, messages, send, subscribe, connect, disconnect };
}
