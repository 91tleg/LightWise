import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * LightWise WebSocket Hook (DEV contract)
 *
 * Current assumptions (per Kirat):
 *  - WS URL: wss://x7zn8xoare.execute-api.us-east-1.amazonaws.com/dev
 *  - NO tenant_id required in query params or payload
 *  - subscribe payload: { action: "subscribe", streetlight_id: "<ID>" }
 *
 * IMPORTANT:
 *  - Backend has NO "unsubscribe" route.
 *  - To change poles safely, we reconnect and resubscribe.
 *
 * Usage pattern:
 *  const ws = useLightWiseWS(process.env.REACT_APP_WS_URL, { debug: true });
 *  useEffect(() => { ws.setTarget(selectedId); }, [selectedId]);
 *
 * Returns:
 *  {
 *    status, error, lastMessage, messages,
 *    send, subscribe,
 *    connect, disconnect,
 *    targetId, setTarget
 *  }
 */
export function useLightWiseWS(wsBaseUrl, options = {}) {
  const {
    autoReconnect = true,
    reconnectDelayMs = 1500,
    maxMessages = 50,
    debug = false,
  } = options;

  // ✅ IMPORTANT: do NOT append tenant_id to WS URL
  const wsUrl = useMemo(() => {
    const base = String(wsBaseUrl || "").trim();
    return base || "";
  }, [wsBaseUrl]);

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const manualCloseRef = useRef(false);

  // track the currently "desired" streetlight id to subscribe to
  const desiredTargetRef = useRef("");
  // track whether we should auto-subscribe on open
  const shouldAutoSubscribeRef = useRef(false);

  const [status, setStatus] = useState(wsUrl ? "connecting" : "idle");
  const [error, setError] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [targetId, setTargetId] = useState("");

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

  // ✅ Kirat-confirmed subscribe payload
  const subscribe = useCallback(
    (streetlightId) => {
      const id = String(streetlightId || "").trim();
      if (!id) return false;

      const ok = send({ action: "subscribe", streetlight_id: id });
      if (ok) log("subscribe sent", { streetlight_id: id });

      return ok;
    },
    [send, log]
  );

  const connect = useCallback(() => {
    if (!wsUrl) {
      setStatus("idle");
      return;
    }

    // already open/connecting
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

    log("connecting to", wsUrl);

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

      // Auto-subscribe if we have a desired target
      const desired = String(desiredTargetRef.current || "").trim();
      if (desired && shouldAutoSubscribeRef.current) {
        // attempt immediately
        const ok = subscribe(desired);
        if (!ok) log("auto-subscribe failed (socket not open?)", desired);
      }
    };

    ws.onmessage = (evt) => {
      const raw = evt?.data;
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
      // onerror doesn't include details in browsers
      setStatus("error");
      setError(new Error("WebSocket error"));
    };

    ws.onclose = (evt) => {
      log("closed", evt?.code, evt?.reason);
      wsRef.current = null;

      if (manualCloseRef.current) {
        setStatus("disconnected");
        return;
      }

      setStatus("disconnected");

      if (autoReconnect) {
        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(() => {
          if (!manualCloseRef.current) connect();
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
    subscribe,
  ]);

  /**
   * Set / change the target pole.
   * Since there is no "unsubscribe", the safest behavior is:
   *  - store desired target
   *  - if currently connected: reconnect and auto-subscribe on open
   *  - if not connected: connect and auto-subscribe on open
   */
  const setTarget = useCallback(
    (streetlightId) => {
      const id = String(streetlightId || "").trim();

      setTargetId(id);
      desiredTargetRef.current = id;

      // If empty target, do not subscribe; just keep connection (or disconnect if you prefer)
      if (!id) {
        log("setTarget: cleared (no streetlight_id)");
        shouldAutoSubscribeRef.current = false;
        return;
      }

      shouldAutoSubscribeRef.current = true;
      log("setTarget:", id);

      // If we have an open socket, reconnect for guaranteed clean subscription
      const ws = wsRef.current;
      const isOpen = ws && ws.readyState === WebSocket.OPEN;
      const isConnecting = ws && ws.readyState === WebSocket.CONNECTING;

      if (isOpen || isConnecting) {
        // Force reconnect to guarantee the backend subscription is fresh
        log("reconnecting to apply new target:", id);
        disconnect();
        // reconnect immediately
        manualCloseRef.current = false; // allow auto reconnect flow
        connect();
        return;
      }

      // no socket yet, connect now
      connect();
    },
    [connect, disconnect, log]
  );

  // connect on mount + whenever wsUrl changes
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

    targetId,
    setTarget,
  };
}