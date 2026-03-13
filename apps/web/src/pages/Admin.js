import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import Layout from "../components/Layout";
import ActivityFeed from "../components/ActivityFeed";
import BubbleCard from "../components/BubbleCard";
import AdminWsControls from "../components/AdminWsControls";
import MapEmbed from "../components/MapEmbed.js";
import UiIcon from "../components/UiIcon";
import { LightWiseContext } from "../context/LightWiseProvider";
import {
  updateStreetlightMetadata,
  getStreetlightTelemetry,
} from "../services/api";
import { loadPoleMetaMap, upsertPoleMeta } from "../services/poleStorage";
import { writeActivePoleId } from "../services/activePoleStorage";
import { normalizeTelemetryRows } from "./analytics.helpers";
import "../styles/lightwise.css";
import "../styles/admin.css";

const DEFAULT_POLE_ID = "LW-00042";

function clampPct(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function asNumberOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatTimestamp(ts) {
  if (!ts) return "Waiting for data";
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return String(ts);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function validateCoordinate(value, type) {
  if (!String(value || "").trim()) return "";
  const num = Number(value);
  if (!Number.isFinite(num)) return `${type} must be a valid number.`;
  if (type === "Latitude" && (num < -90 || num > 90)) {
    return "Latitude must be between -90 and 90.";
  }
  if (type === "Longitude" && (num < -180 || num > 180)) {
    return "Longitude must be between -180 and 180.";
  }
  return "";
}

function SkeletonValue({ active, value }) {
  if (active) return <span className="lwSkeletonLine" aria-hidden="true" />;
  return <span className="lwSensorValue">{value}</span>;
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function mergeLocalMeta(pole, localMeta) {
  const local = localMeta[pole.streetlight_id] || {};
  return {
    ...pole,
    name: hasOwn(local, "name") ? local.name : pole.name,
    lat: hasOwn(local, "lat") ? local.lat : pole.lat,
    lng: hasOwn(local, "lng") ? local.lng : pole.lng,
  };
}

function buildFallbackPole(id = DEFAULT_POLE_ID, localMeta = {}) {
  const local = localMeta[id] || {};
  return {
    streetlight_id: id,
    name: hasOwn(local, "name") ? local.name : null,
    health: "OK",
    lat: hasOwn(local, "lat") ? local.lat : 47.6101,
    lng: hasOwn(local, "lng") ? local.lng : -122.2015,
    motion_detected: false,
    light_level: 0,
    last_seen: null,
    temp_c: null,
    humidity: null,
    lux: null,
  };
}

function getFormValuesForPole(pole, metaMap) {
  const local = metaMap[pole?.streetlight_id] || {};
  return {
    name: hasOwn(local, "name") ? local.name || "" : pole?.name || "",
    lat: hasOwn(local, "lat")
      ? local.lat == null
        ? ""
        : String(local.lat)
      : pole?.lat != null
      ? String(pole.lat)
      : "",
    lng: hasOwn(local, "lng")
      ? local.lng == null
        ? ""
        : String(local.lng)
      : pole?.lng != null
      ? String(pole.lng)
      : "",
  };
}

export default function Admin() {
  const { wsStatus, lastMessage, subscribe, streetlights, applyStreetlightLocalPatch } =
    useContext(LightWiseContext);

  const [selectedId, setSelectedId] = useState(DEFAULT_POLE_ID);
  const [metaMap, setMetaMap] = useState(() => loadPoleMetaMap());
  const [events, setEvents] = useState([]);
  const [latestTelemetry, setLatestTelemetry] = useState(null);
  const [telemetryLoading, setTelemetryLoading] = useState(false);

  const [nameInput, setNameInput] = useState("");
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [saveMsg, setSaveMsg] = useState("");

  const selectedIdRef = useRef(DEFAULT_POLE_ID);
  const lastLoadedPoleIdRef = useRef(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (selectedId) writeActivePoleId(selectedId);
  }, [selectedId]);

  useEffect(() => {
    const refreshLocal = () => setMetaMap(loadPoleMetaMap());
    window.addEventListener("focus", refreshLocal);
    return () => window.removeEventListener("focus", refreshLocal);
  }, []);

  const mapPoles = useMemo(() => {
    const base = streetlights.length
      ? streetlights
      : [buildFallbackPole(selectedId, metaMap)];

    return base.map((pole) => mergeLocalMeta(pole, metaMap));
  }, [streetlights, selectedId, metaMap]);

  useEffect(() => {
    if (!mapPoles.length) return;

    if (!mapPoles.some((row) => row.streetlight_id === selectedIdRef.current)) {
      setSelectedId(mapPoles[0]?.streetlight_id || DEFAULT_POLE_ID);
    }
  }, [mapPoles]);

  const selectedBase = useMemo(() => {
    return (
      mapPoles.find((pole) => pole.streetlight_id === selectedId) ||
      mapPoles[0] ||
      buildFallbackPole(selectedId, metaMap)
    );
  }, [mapPoles, selectedId, metaMap]);

  useEffect(() => {
    if (!selectedBase) return;

    const selectedPoleId = selectedBase.streetlight_id;
    const poleChanged = lastLoadedPoleIdRef.current !== selectedPoleId;

    if (poleChanged || !isEditing) {
      const formValues = getFormValuesForPole(selectedBase, metaMap);
      setNameInput(formValues.name);
      setLatInput(formValues.lat);
      setLngInput(formValues.lng);
      lastLoadedPoleIdRef.current = selectedPoleId;
      setIsEditing(false);
    }
  }, [selectedBase?.streetlight_id, metaMap]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;

    async function loadLatestTelemetry() {
      if (!selectedId) {
        setLatestTelemetry(null);
        return;
      }

      setTelemetryLoading(true);

      const to = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
      const from = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .replace(/\.\d{3}Z$/, "Z");

      try {
        const payload = await getStreetlightTelemetry(selectedId, {
          from,
          to,
          interval: "1h",
        });

        if (cancelled) return;

        const rows = normalizeTelemetryRows(payload);
        const latest = rows.length ? rows[rows.length - 1] : null;
        setLatestTelemetry(latest);
      } catch {
        if (!cancelled) setLatestTelemetry(null);
      } finally {
        if (!cancelled) setTelemetryLoading(false);
      }
    }

    loadLatestTelemetry();

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const live = useMemo(() => {
    const wsForSelected =
      lastMessage && lastMessage.streetlight_id === selectedId ? lastMessage : null;

    if (wsForSelected) {
      return {
        motion:
          typeof wsForSelected?.data?.motion === "boolean"
            ? wsForSelected.data.motion
            : typeof wsForSelected?.motion === "boolean"
            ? wsForSelected.motion
            : null,
        lightPct: clampPct(
          wsForSelected?.data?.light_level ??
            wsForSelected?.light_level ??
            selectedBase?.light_level ??
            latestTelemetry?.light_level ??
            0
        ),
        lux:
          wsForSelected?.data?.lux ??
          wsForSelected?.lux ??
          latestTelemetry?.lux ??
          selectedBase?.lux ??
          null,
        tempC:
          wsForSelected?.data?.temp_c ??
          wsForSelected?.temp_c ??
          latestTelemetry?.temp_c ??
          selectedBase?.temp_c ??
          null,
        humidity:
          wsForSelected?.data?.humidity ??
          wsForSelected?.humidity ??
          latestTelemetry?.humidity ??
          selectedBase?.humidity ??
          null,
        health: wsForSelected?.health || selectedBase?.health || "OK",
        timestamp:
          wsForSelected?.timestamp ||
          latestTelemetry?.timestamp ||
          selectedBase?.last_seen ||
          null,
      };
    }

    if (latestTelemetry || selectedBase) {
      return {
        motion:
          typeof latestTelemetry?.motion === "boolean"
            ? latestTelemetry.motion
            : typeof selectedBase?.motion_detected === "boolean"
            ? selectedBase.motion_detected
            : null,
        lightPct: clampPct(
          latestTelemetry?.light_level ?? selectedBase?.light_level ?? 0
        ),
        lux: latestTelemetry?.lux ?? selectedBase?.lux ?? null,
        tempC: latestTelemetry?.temp_c ?? selectedBase?.temp_c ?? null,
        humidity: latestTelemetry?.humidity ?? selectedBase?.humidity ?? null,
        health: latestTelemetry?.health || selectedBase?.health || "OK",
        timestamp: latestTelemetry?.timestamp || selectedBase?.last_seen || null,
      };
    }

    return null;
  }, [lastMessage, selectedId, selectedBase, latestTelemetry]);

  useEffect(() => {
    if (!lastMessage || lastMessage.streetlight_id !== selectedId) return;

    const item = {
      id: `${selectedId}-${lastMessage.timestamp || Date.now()}`,
      type: "update",
      label:
        typeof live?.motion === "boolean"
          ? live.motion
            ? "Motion detected"
            : "Motion cleared"
          : "Sensor update",
      streetlightId: selectedId,
      timestamp: lastMessage.timestamp || new Date().toISOString(),
      value:
        typeof live?.lightPct === "number" ? `${live.lightPct}%` : "Updated",
      note: live?.health ? `Health ${live.health}` : undefined,
    };

    setEvents((prev) => [item, ...prev].slice(0, 15));
  }, [lastMessage, selectedId, live]);

  const latError = validateCoordinate(latInput, "Latitude");
  const lngError = validateCoordinate(lngInput, "Longitude");
  const formValid = !latError && !lngError;

  async function handleSaveMetadata() {
    if (!selectedId || !formValid) return;

    setSaveState("saving");
    setSaveMsg("");

    const patch = {
      name: nameInput.trim() || null,
      lat: latInput.trim() ? Number(latInput) : null,
      lng: lngInput.trim() ? Number(lngInput) : null,
    };

    upsertPoleMeta(selectedId, patch);
    const nextMeta = loadPoleMetaMap();
    setMetaMap(nextMeta);
    applyStreetlightLocalPatch(selectedId, patch);

    try {
      await updateStreetlightMetadata(selectedId, patch);
      setSaveState("saved");
      setSaveMsg("Changes saved");
    } catch {
      setSaveState("saved");
      setSaveMsg("Saved locally · server sync unavailable");
    }

    setIsEditing(false);

    setTimeout(() => {
      setSaveState("idle");
      setSaveMsg("");
    }, 1600);
  }

  async function handleClearCoords() {
    if (!selectedId) return;

    setSaveState("saving");
    setSaveMsg("");

    const existing = metaMap[selectedId] || {};
    const patch = {
      name: hasOwn(existing, "name")
        ? existing.name
        : selectedBase?.name || null,
      lat: null,
      lng: null,
    };

    upsertPoleMeta(selectedId, patch);
    const nextMeta = loadPoleMetaMap();
    setMetaMap(nextMeta);

    setLatInput("");
    setLngInput("");
    setIsEditing(false);

    applyStreetlightLocalPatch(selectedId, { lat: null, lng: null });

    try {
      await updateStreetlightMetadata(selectedId, { lat: null, lng: null });
      setSaveState("saved");
      setSaveMsg("Coordinates cleared");
    } catch {
      setSaveState("saved");
      setSaveMsg("Coordinates cleared locally");
    }

    setTimeout(() => {
      setSaveState("idle");
      setSaveMsg("");
    }, 1600);
  }

  const mapLat = isEditing
    ? asNumberOrNull(latInput) ?? selectedBase?.lat ?? 47.6101
    : selectedBase?.lat ?? 47.6101;

  const mapLng = isEditing
    ? asNumberOrNull(lngInput) ?? selectedBase?.lng ?? -122.2015
    : selectedBase?.lng ?? -122.2015;

  const lightPct = live?.lightPct ?? selectedBase?.light_level ?? 0;
  const healthText = live?.health || selectedBase?.health || "OK";

  const motionText =
    typeof live?.motion === "boolean"
      ? live.motion
        ? "Detected"
        : "Clear"
      : typeof selectedBase?.motion_detected === "boolean"
      ? selectedBase.motion_detected
        ? "Detected"
        : "Clear"
      : "Clear";
  const loadingSensors = telemetryLoading && !live;
  const mapKey = `${selectedId}-${mapLat}-${mapLng}`;

  return (
    <Layout title="Admin" subtitle="Configuration and rules for active devices.">
      <div className="lwAdminPageClean">
        <div className="lwAdminHeroClean">
          <AdminWsControls
            wsStatus={wsStatus}
            motionState="idle"
            onSimulateMotion={() => true}
            onSubscribeDemo={(id) => subscribe(id)}
            selectedStreetlightId={selectedId}
          />
        </div>

        <div className="lwAdminSplitLayout">
          <div className="lwAdminStack">
            <BubbleCard
              icon={<UiIcon name="settings" size={22} />}
              title="Rules Engine"
              sub="Configuration and validation"
            >
              <div className="lwRuleRow lwRuleRowClean">
                <span className="lwPill green">Auto</span>
                <span className="lwPill orange">Night</span>
                <span className="lwPill red">Motion</span>
              </div>

              <div className="lwAdminFormSection">
                <label className="lwLabel">Streetlight</label>
                <select
                  className="lwInput lwAdminInput"
                  value={selectedId}
                  onChange={(e) => {
                    setSelectedId(e.target.value);
                    setIsEditing(false);
                  }}
                >
                  {mapPoles.map((pole) => (
                    <option key={pole.streetlight_id} value={pole.streetlight_id}>
                      {pole.streetlight_id} — {pole.name || "Unnamed pole"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lwAdminFormSection">
                <label className="lwLabel">Display name</label>
                <input
                  className="lwInput lwAdminInput"
                  value={nameInput}
                  onChange={(e) => {
                    setNameInput(e.target.value);
                    setIsEditing(true);
                  }}
                  placeholder="Main Street 5th Ave"
                  autoComplete="off"
                />
              </div>

              <div className="lwAdminFormGrid">
                <div>
                  <label className="lwLabel">Latitude</label>
                  <input
                    className={`lwInput lwAdminInput ${latError ? "isInvalid" : ""}`}
                    value={latInput}
                    onChange={(e) => {
                      setLatInput(e.target.value);
                      setIsEditing(true);
                    }}
                    placeholder="47.6101"
                    autoComplete="off"
                  />
                  {latError ? (
                    <div className="lwFieldError">{latError}</div>
                  ) : (
                    <div className="lwFieldHint">Valid range: -90 to 90</div>
                  )}
                </div>

                <div>
                  <label className="lwLabel">Longitude</label>
                  <input
                    className={`lwInput lwAdminInput ${lngError ? "isInvalid" : ""}`}
                    value={lngInput}
                    onChange={(e) => {
                      setLngInput(e.target.value);
                      setIsEditing(true);
                    }}
                    placeholder="-122.2015"
                    autoComplete="off"
                  />
                  {lngError ? (
                    <div className="lwFieldError">{lngError}</div>
                  ) : (
                    <div className="lwFieldHint">Valid range: -180 to 180</div>
                  )}
                </div>
              </div>

              <div className="lwAdminActionRow">
                <button
                  className="lwAdminPrimaryBtn"
                  type="button"
                  onClick={handleSaveMetadata}
                  disabled={saveState === "saving" || !formValid}
                >
                  <UiIcon name="save" size={16} />
                  <span>{saveState === "saving" ? "Saving..." : "Save Changes"}</span>
                </button>

                <button
                  className="lwAdminSecondaryBtn"
                  type="button"
                  onClick={handleClearCoords}
                  disabled={saveState === "saving"}
                >
                  Clear Coordinates
                </button>
              </div>

              {saveMsg ? (
                <div className={`lwAdminStatusMsg ${saveState}`}>{saveMsg}</div>
              ) : null}
            </BubbleCard>

            <BubbleCard
              icon={<UiIcon name="activity" size={22} />}
              title="Live Sensor Readings"
              sub={live ? "Active sensor stream" : "Waiting for sensor updates"}
            >
              <div className="lwSensorGrid">
                <div className="lwSensorRow">
                  <span>Lux</span>
                  <SkeletonValue
                    active={loadingSensors}
                    value={live?.lux ?? "Waiting for data"}
                  />
                </div>

                <div className="lwSensorRow">
                  <span>Temperature</span>
                  <SkeletonValue
                    active={loadingSensors}
                    value={live?.tempC != null ? `${live.tempC}°C` : "Waiting for data"}
                  />
                </div>

                <div className="lwSensorRow">
                  <span>Humidity</span>
                  <SkeletonValue
                    active={loadingSensors}
                    value={live?.humidity != null ? `${live.humidity}%` : "Waiting for data"}
                  />
                </div>

                <div className="lwSensorRow">
                  <span>Last Seen</span>
                  <SkeletonValue
                    active={loadingSensors}
                    value={formatTimestamp(live?.timestamp ?? selectedBase?.last_seen)}
                  />
                </div>
              </div>
            </BubbleCard>

            <BubbleCard
              icon={<UiIcon name="radio" size={22} />}
              title="Live Events"
              sub="Latest activity from the selected pole"
            >
              <ActivityFeed events={events} wsStatus={wsStatus} />
            </BubbleCard>
          </div>

          <div className="lwAdminStack">
            <BubbleCard
              icon={<UiIcon name="bolt" size={22} />}
              title="Live Light State"
              sub="Current output and health"
            >
              <div className="lwAdminMetricList">
                <div>
                  <b>Streetlight:</b> {selectedId}
                </div>
                <div>
                  <b>Display Name:</b> {nameInput || selectedBase?.name || "Unnamed pole"}
                </div>
                <div>
                  <b>Motion:</b> {motionText}
                </div>
                <div>
                  <b>Brightness Level:</b> {lightPct}%
                </div>
                <div>
                  <b>Health:</b> {healthText}
                </div>
              </div>

              <div className="lwProgressTrack lwProgressTrackClean">
                <div
                  className="lwProgressFill lwProgressFillClean"
                  style={{ width: `${lightPct}%` }}
                />
              </div>
            </BubbleCard>

            <BubbleCard
              icon={<UiIcon name="map" size={22} />}
              title="Device Map"
              sub="Interactive location view"
            >
              <div className="lwAdminMapShell">
                <MapEmbed
                  key={mapKey}
                  title="Selected pole location"
                  fillHeight
                  lat={mapLat}
                  lng={mapLng}
                  poles={mapPoles}
                  selectedId={selectedId}
                  onSelectPole={(pole) => setSelectedId(pole.streetlight_id)}
                  showLegend
                />
              </div>
            </BubbleCard>
          </div>
        </div>
      </div>
    </Layout>
  );
}
