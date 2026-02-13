import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useLightWiseWS(wsUrl, options?)
 *
 * - wsUrl: string like "wss://xxxx.execute-api.us-east-1.amazonaws.com/prod"
 * - Returns:
 *    { status, lastMessage, messages, send, connect, disconnect, error }
 *
 * Status values:
 *  - "idle" | "connecting" | "connected" | "disconnected" | "error"
 */
export function useLightWiseWS(wsUrl, options = {}) {
  const {
    autoReconnect = true,
    reconnectDelayMs = 1500,
    maxMessages = 50,
    debug = false,
  } = options;

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const manualCloseRef = useRef(false);

  const [status, setStatus] = useState(wsUrl ? "connecting" : "idle");
  const [error, setError] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  const [messages, setMessages] = useState([]);

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

    // If a socket is already open/connecting, do nothing
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
      setMessages((prev) => {
        const next = [parsed, ...prev];
        return next.slice(0, maxMessages);
      });
    };

    ws.onerror = (evt) => {
      log("error", evt);
      setStatus("error");
      setError(new Error("WebSocket error"));
    };

    ws.onclose = (evt) => {
      log("closed", evt.code, evt.reason);
      wsRef.current = null;

      // If user manually disconnected, don't reconnect
      if (manualCloseRef.current) {
        setStatus("disconnected");
        return;
      }

      setStatus("disconnected");

      // Auto-reconnect
      if (autoReconnect) {
        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(() => {
          // Reconnect with latest settings
          connect();
        }, reconnectDelayMs);
      }
    };
  }, [
    wsUrl,
    autoReconnect,
    reconnectDelayMs,
    maxMessages,
    log,
    clearReconnectTimer,
  ]);

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

  // Connect automatically when wsUrl or connect/disconnect changes
  useEffect(() => {
    if (!wsUrl) {
      disconnect();
      setStatus("idle");
      return;
    }

    connect();

    return () => {
      disconnect();
    };
  }, [wsUrl, connect, disconnect]);

  return {
    status,
    error,
    lastMessage,
    messages,
    send,
    connect,
    disconnect,
  };
}
