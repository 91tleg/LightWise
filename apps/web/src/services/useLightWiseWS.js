// apps/web/src/services/useLightWiseWS.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Max WS contract:
 *   subscribe payload:
 *     { "action": "subscribe", "streetlight_id": "LW-00042" }
 */
export function useLightWiseWS(wsBaseUrl, options = {}) {
  const {
    autoReconnect = true,
    reconnectDelayMs = 1500,
    maxMessages = 50,
    debug = false,

    autoSubscribeOnOpen = false,
    defaultStreetlightId =
      process.env.REACT_APP_DEFAULT_STREETLIGHT_ID || "LW-00042",
  } = options;

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const manualCloseRef = useRef(false);

  const [status, setStatus] = useState(wsBaseUrl ? "connecting" : "idle");
  const [error, setError] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  const [messages, setMessages] = useState([]);

  const finalWsUrl = useMemo(() => {
    // do NOT force query params; keep the URL exactly as provided
    return (wsBaseUrl || "").trim();
  }, [wsBaseUrl]);

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
    (streetlightId = defaultStreetlightId) => {
      const id = String(streetlightId || "").trim();
      if (!id) return false;
      return send({ action: "subscribe", streetlight_id: id });
    },
    [send, defaultStreetlightId]
  );

  const connect = useCallback(() => {
    if (!finalWsUrl) {
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
      ws = new WebSocket(finalWsUrl);
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

      if (autoSubscribeOnOpen) {
        subscribe(defaultStreetlightId);
      }
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
        reconnectTimerRef.current = setTimeout(() => connect(), reconnectDelayMs);
      }
    };
  }, [
    finalWsUrl,
    autoReconnect,
    reconnectDelayMs,
    maxMessages,
    log,
    clearReconnectTimer,
    subscribe,
    autoSubscribeOnOpen,
    defaultStreetlightId,
  ]);

  useEffect(() => {
    if (!finalWsUrl) {
      disconnect();
      setStatus("idle");
      return;
    }

    connect();
    return () => disconnect();
  }, [finalWsUrl, connect, disconnect]);

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