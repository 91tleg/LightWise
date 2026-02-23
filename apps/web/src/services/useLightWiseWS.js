import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * useLightWiseWS(wsUrl, options?)
 *
 * - wsUrl: string like "wss://xxxx.execute-api.us-east-1.amazonaws.com/prod"
 * - options:
 *    - autoReconnect: boolean
 *    - reconnectDelayMs: number
 *    - maxMessages: number
 *    - debug: boolean
 *    - tenantId: string (demo-mode)
 *    - userId: string (demo-mode)
 *    - autoSubscribeStreetlightIds: string[] (re-subscribe on open/reconnect)
 *
 * - Returns:
 *    { status, lastMessage, messages, send, connect, disconnect, error, subscribe }
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

    // ✅ Demo-mode identity (optional)
    tenantId = process.env.REACT_APP_TENANT_ID || "demo",
    userId = process.env.REACT_APP_USER_ID || "demo",

    // ✅ Auto re-subscribe (optional)
    autoSubscribeStreetlightIds = [],
  } = options;

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const manualCloseRef = useRef(false);

  const [status, setStatus] = useState(wsUrl ? "connecting" : "idle");
  const [error, setError] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  const [messages, setMessages] = useState([]);

  // Tracks subscriptions we’ve made during the session (so reconnect can restore them)
  const subscribedIdsRef = useRef(new Set());

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

  // ✅ Build URL with demo identity query params if not already present
  const finalWsUrl = useMemo(() => {
    if (!wsUrl) return "";

    try {
      // Works with wss:// URLs too
      const url = new URL(wsUrl);

      // Only add if missing (don’t overwrite if you already put them in .env URL)
      if (!url.searchParams.get("tenant_id") && tenantId) {
        url.searchParams.set("tenant_id", tenantId);
      }
      if (!url.searchParams.get("user_id") && userId) {
        url.searchParams.set("user_id", userId);
      }

      return url.toString();
    } catch {
      // If URL parsing fails (rare), fallback to raw wsUrl
      return wsUrl;
    }
  }, [wsUrl, tenantId, userId]);

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

  // ✅ Subscribe helper (this is the exact message Max’s subscribe route expects)
  const subscribe = useCallback(
    (streetlightId) => {
      if (!streetlightId) return false;
      subscribedIdsRef.current.add(streetlightId);

      return send({
        action: "subscribe",
        streetlight_id: streetlightId,
      });
    },
    [send]
  );

  const connect = useCallback(() => {
    if (!finalWsUrl) {
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

      // ✅ Auto-subscribe list (from options)
      for (const id of autoSubscribeStreetlightIds || []) {
        subscribe(id);
      }

      // ✅ Re-subscribe anything we previously subscribed to
      for (const id of subscribedIdsRef.current) {
        subscribe(id);
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
          connect();
        }, reconnectDelayMs);
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
    autoSubscribeStreetlightIds,
  ]);

  // Connect automatically when URL changes
  useEffect(() => {
    if (!finalWsUrl) {
      disconnect();
      setStatus("idle");
      return;
    }

    connect();

    return () => {
      disconnect();
    };
  }, [finalWsUrl, connect, disconnect]);

  return {
    status,
    error,
    lastMessage,
    messages,
    send,
    connect,
    disconnect,
    subscribe, // ✅ new helper
  };
}