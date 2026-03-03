// apps/web/src/pages/Admin.js

import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import ActivityFeed from "../components/ActivityFeed";
import BubbleCard from "../components/BubbleCard";
import AdminWsControls from "../components/AdminWsControls";
import MapEmbed from "../components/MapEmbed";

import { useLightWiseWS } from "../services/useLightWiseWS";
import { listStreetlights, updateStreetlightMetadata } from "../services/api";
import { loadPoleMetaMap, upsertPoleMeta, clearPoleMeta } from "../services/poleStorage";

import "../styles/lightwise.css";
import "../styles/admin.css";

import adminBg from "../assets/background/adminBackground1.jpeg";

const WS_URL = process.env.REACT_APP_WS_URL || process.env.REACT_APP_LIGHTWISE_WS_URL || "";

function clampPct(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function asNumberOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// readable timestamp (text-only change; no layout change)
function formatTimestamp(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return String(ts);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ✅ Max request: validate lat/lng ranges on frontend
function validateLatLng(latStr, lngStr) {
  const latEmpty = !latStr || latStr.trim() === "";
  const lngEmpty = !lngStr || lngStr.trim() === "";

  // allow both empty (means: no coords)
  if (latEmpty && lngEmpty) return null;

  // one missing
  if (latEmpty || lngEmpty) return "Enter both latitude and longitude.";

  const lat = Number(latStr);
  const lng = Number(lngStr);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return "Latitude and longitude must be valid numbers.";
  }
  if (lat < -90 || lat > 90) {
    return "Latitude must be between -90 and 90.";
  }
  if (lng < -180 || lng > 180) {
    return "Longitude must be between -180 and 180.";
  }
  return null;
}

function normalizeFeedEvent(msg) {
  if (!msg || typeof msg !== "object") return null;
  const id = msg.streetlight_id || msg.streetlightId;
  const ts = msg.timestamp || new Date().toISOString();

  if (typeof msg?.data?.motion === "boolean") {
    return {
      type: "telemetry",
      streetlightId: id || "—",
      timestamp: ts,
      label: msg.data.motion ? "Motion detected" : "No motion",
      value: msg.data.motion ? "true" : "false",
    };
  }

  if (msg.data) {
    return {
      type: "telemetry",
      streetlightId: id || "—",
      timestamp: ts,
      label: "Telemetry update",
      value: "—",
    };
  }

  return null;
}

export default function Admin() {
  const tenantId = process.env.REACT_APP_TENANT_ID || "tenant-001";

  const [streetlights, setStreetlights] = useState([]);
  const [selectedId, setSelectedId] = useState("LW-00042");
  const [apiError, setApiError] = useState("");

  // Local metadata overrides so coords/pins work even if backend returns null
  const [metaMap, setMetaMap] = useState(() => loadPoleMetaMap());

  const { status: wsStatus, lastMessage, subscribe } = useLightWiseWS(WS_URL, {
    tenantId,
    debug: false,
  });

  const [events, setEvents] = useState([]);

  const selectedMeta = metaMap[selectedId] || {};
  const [nameInput, setNameInput] = useState(selectedMeta.name || "");
  const [latInput, setLatInput] = useState(
    selectedMeta.lat === 0 || selectedMeta.lat ? String(selectedMeta.lat) : ""
  );
  const [lngInput, setLngInput] = useState(
    selectedMeta.lng === 0 || selectedMeta.lng ? String(selectedMeta.lng) : ""
  );
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [saveMsg, setSaveMsg] = useState("");
  const [coordError, setCoordError] = useState("");

  // Load streetlights once (Admin still needs list for dropdown + last_seen display)
  useEffect(() => {
    listStreetlights()
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setStreetlights(list);

        if (list.length > 0) {
          const hasSelected = list.some((s) => s.streetlight_id === selectedId);
          if (!hasSelected) setSelectedId(list[0]?.streetlight_id || "LW-00042");
        }
      })
      .catch((e) => setApiError(e?.message || String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When selection changes, load inputs from local meta
  useEffect(() => {
    const meta = metaMap[selectedId] || {};
    setNameInput(meta.name || "");
    setLatInput(meta.lat === 0 || meta.lat ? String(meta.lat) : "");
    setLngInput(meta.lng === 0 || meta.lng ? String(meta.lng) : "");
    setSaveState("idle");
    setSaveMsg("");
    setCoordError("");
  }, [selectedId, metaMap]);

  // Auto-subscribe on connect + whenever selected changes
  useEffect(() => {
    if (wsStatus !== "connected") return;
    if (!selectedId) return;
    subscribe(selectedId);
  }, [wsStatus, selectedId, subscribe]);

  // Convert WS messages into feed events
  useEffect(() => {
    if (!lastMessage) return;
    const evt = normalizeFeedEvent(lastMessage);
    if (!evt) return;
    setEvents((prev) => [evt, ...prev].slice(0, 50));
  }, [lastMessage]);

  const selected = useMemo(
    () => streetlights.find((s) => s.streetlight_id === selectedId) || null,
    [streetlights, selectedId]
  );

  const live = useMemo(() => {
    const msg = lastMessage;
    if (!msg || typeof msg !== "object") return null;
    if (!msg.streetlight_id || !msg.data) return null;
    if (msg.streetlight_id !== selectedId) return null;

    return {
      streetlightId: msg.streetlight_id,
      health: msg.health,
      timestamp: msg.timestamp,
      lux: msg.data?.lux,
      tempC: msg.data?.temp_c,
      humidity: msg.data?.humidity,
      motion: msg.data?.motion,
      lightLevel: msg.data?.light_level,
      diagnostics: msg.diagnostics,
    };
  }, [lastMessage, selectedId]);

  const healthText = live?.health || selected?.health || "—";

  const motionText =
    typeof live?.motion === "boolean"
      ? live.motion
        ? "MOTION DETECTED"
        : "no motion"
      : typeof selected?.motion_detected === "boolean"
      ? selected.motion_detected
        ? "MOTION DETECTED"
        : "no motion"
      : "—";

  const lightPct =
    typeof live?.lightLevel === "number"
      ? clampPct(live.lightLevel)
      : typeof selected?.light_level_pct === "number"
      ? clampPct(selected.light_level_pct)
      : 0;

  // Map uses current input so pin updates as you type
  const mapLat = asNumberOrNull(latInput);
  const mapLng = asNumberOrNull(lngInput);

  async function handleSaveMetadata() {
    setSaveState("saving");
    setSaveMsg("");
    setCoordError("");

    const latStr = latInput?.trim() || "";
    const lngStr = lngInput?.trim() || "";

    const err = validateLatLng(latStr, lngStr);
    if (err) {
      setSaveState("idle");
      setCoordError(err);
      return;
    }

    const patch = {
      ...(nameInput.trim() ? { name: nameInput.trim() } : {}),
      ...(latStr && lngStr ? { lat: Number(latStr), lng: Number(lngStr) } : {}),
    };

    // Local update first (instant pin + name in UI)
    if (Object.keys(patch).length > 0) {
      upsertPoleMeta(selectedId, patch);
      setMetaMap(loadPoleMetaMap());

      // also reflect locally in streetlights list WITHOUT GET (Max request)
      setStreetlights((prev) =>
        (Array.isArray(prev) ? prev : []).map((s) =>
          s.streetlight_id === selectedId ? { ...s, ...patch } : s
        )
      );
    }

    try {
      if (Object.keys(patch).length > 0) {
        await updateStreetlightMetadata(selectedId, patch); // ✅ PUT only
      }
      setSaveState("saved");
      setSaveMsg("Saved");
      setTimeout(() => {
        setSaveState("idle");
        setSaveMsg("");
      }, 1200);
    } catch (e) {
      setSaveState("error");
      setSaveMsg(e?.message || "Save failed (backend not ready)");
    }
  }

  async function handleClearCoords() {
    setSaveState("saving");
    setSaveMsg("");
    setCoordError("");

    clearPoleMeta(selectedId);
    setMetaMap(loadPoleMetaMap());
    setLatInput("");
    setLngInput("");

    // also reflect locally in streetlights list WITHOUT GET
    setStreetlights((prev) =>
      (Array.isArray(prev) ? prev : []).map((s) =>
        s.streetlight_id === selectedId ? { ...s, lat: null, lng: null } : s
      )
    );

    try {
      await updateStreetlightMetadata(selectedId, { lat: null, lng: null }); // ✅ PUT only
      setSaveState("saved");
      setSaveMsg("Cleared");
      setTimeout(() => {
        setSaveState("idle");
        setSaveMsg("");
      }, 1200);
    } catch {
      setSaveState("idle");
      setSaveMsg("Cleared locally");
      setTimeout(() => setSaveMsg(""), 1200);
    }
  }

  return (
    <Layout title="Admin" subtitle="System controls & configuration.">
      {apiError && <div className="lwErrorBanner">API Error: {apiError}</div>}

      <div
        className="lwAdminHero"
        style={{
          backgroundImage: `url(${adminBg})`,
        }}
      >
        <AdminWsControls
          wsStatus={wsStatus}
          motionState="idle"
          onSimulateMotion={() => true} // UI-only
          onSubscribeDemo={(id) => subscribe(id)}
        />
      </div>

      <div className="lwAdminGrid">
        {/* Rules Engine */}
        <BubbleCard icon="🧠" title="Rules Engine" subtitle="Dimming + safety thresholds">
          <div className="lwRuleRow">
            <span className="lwPill">Auto</span>
            <span className="lwPill">Night</span>
            <span className="lwPill">Motion</span>
          </div>

          <div style={{ marginTop: 12 }}>
            <label className="lwLabel">Streetlight</label>
            <select className="lwInput" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {(streetlights.length ? streetlights : [{ streetlight_id: "LW-00042", name: null }]).map((s) => (
                <option key={s.streetlight_id} value={s.streetlight_id}>
                  {s.streetlight_id} — ({s.name || "fallback"})
                </option>
              ))}
            </select>
          </div>

          {/* Metadata editor */}
          <div style={{ marginTop: 14 }}>
            <label className="lwLabel">Display name</label>
            <input
              className="lwInput"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Main Street 5th Ave"
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <div>
                <label className="lwLabel">Latitude</label>
                <input
                  className="lwInput"
                  value={latInput}
                  onChange={(e) => setLatInput(e.target.value)}
                  placeholder="e.g. 47.6101"
                />
              </div>
              <div>
                <label className="lwLabel">Longitude</label>
                <input
                  className="lwInput"
                  value={lngInput}
                  onChange={(e) => setLngInput(e.target.value)}
                  placeholder="e.g. -122.2015"
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
              <button className="lwBtn" onClick={handleSaveMetadata} disabled={saveState === "saving"}>
                {saveState === "saving" ? "Saving..." : "Save"}
              </button>

              <button className="lwBtn" onClick={handleClearCoords} disabled={saveState === "saving"}>
                Clear coordinates
              </button>

              {(coordError || saveMsg) ? (
                <span style={{ fontWeight: 700, opacity: 0.9 }}>{coordError || saveMsg}</span>
              ) : null}
            </div>

            <div className="lwSmallText" style={{ marginTop: 8, opacity: 0.85 }}>
              Pin appears on map when lat/lng are set. Valid ranges: latitude [-90, 90], longitude [-180, 180]. Clearing
              removes the pin instantly.
            </div>
          </div>
        </BubbleCard>

        {/* Live Light State */}
        <BubbleCard icon="💡" title="Live Light State" subtitle={`WS: ${wsStatus} • Health: ${healthText}`}>
          <div className="lwKeyValue">
            <div>
              <b>Streetlight:</b> {selectedId}
            </div>
            <div>
              <b>Motion:</b> {motionText}
            </div>
            <div>
              <b>Brightness (light_level):</b> {lightPct}% (backend/state)
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="lwProgressTrack">
              <div className="lwProgressFill" style={{ width: `${lightPct}%` }} />
            </div>
          </div>
        </BubbleCard>

        {/* Live Sensor Readings */}
        <BubbleCard icon="📡" title="Live Sensor Readings" subtitle={live ? "Receiving telemetry" : "Waiting for telemetry..."}>
          <div className="lwKeyValue">
            <div>
              <b>tenant:</b> {tenantId}
            </div>
            <div>
              <b>Lux:</b> {live?.lux ?? "—"}
            </div>
            <div>
              <b>Temp:</b> {live?.tempC ?? "—"}°C
            </div>
            <div>
              <b>Humidity:</b> {live?.humidity ?? "—"}%
            </div>
            <div>
              <b>Diagnostics:</b> {live?.diagnostics ? "available" : "—"}
            </div>
            <div>
              <b>Last seen:</b> {formatTimestamp(live?.timestamp ?? selected?.last_seen)}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label className="lwLabel">Map pin for selected pole</label>
            <MapEmbed title="Selected pole pin" height={240} lat={mapLat} lng={mapLng} zoom={17} />
          </div>
        </BubbleCard>

        {/* Live Events */}
        <BubbleCard icon="⚡" title={`Live Events (${wsStatus})`} subtitle="Latest WS updates">
          <ActivityFeed items={events} />
        </BubbleCard>
      </div>
    </Layout>
  );
}