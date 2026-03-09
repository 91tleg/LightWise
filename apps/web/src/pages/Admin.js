import React, { useEffect, useMemo, useRef, useState } from "react";
import Layout from "../components/Layout";
import ActivityFeed from "../components/ActivityFeed";
import BubbleCard from "../components/BubbleCard";
import AdminWsControls from "../components/AdminWsControls";
import MapEmbed from "../components/MapEmbed";
import UiIcon from "../components/UiIcon";
import { useLightWiseWS } from "../services/useLightWiseWS";
import { listStreetlights, updateStreetlightMetadata } from "../services/api";
import { loadPoleMetaMap, upsertPoleMeta } from "../services/poleStorage";
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

function normalizePole(pole, index = 0) {
  const id =
    pole?.streetlight_id ||
    pole?.id ||
    pole?.pole_id ||
    pole?.device_id ||
    pole?.streetlightId ||
    `LW-${String(index + 1).padStart(5, "0")}`;

  return {
    streetlight_id: id,
    name: pole?.name || pole?.label || pole?.display_name || null,
    health: pole?.health || pole?.status || "OK",
    lat:
      pole?.lat ??
      pole?.latitude ??
      pole?.location?.lat ??
      pole?.location?.latitude ??
      null,
    lng:
      pole?.lng ??
      pole?.lon ??
      pole?.longitude ??
      pole?.location?.lng ??
      pole?.location?.lon ??
      pole?.location?.longitude ??
      null,
    motion_detected:
      typeof pole?.motion_detected === "boolean"
        ? pole.motion_detected
        : typeof pole?.motion === "boolean"
        ? pole.motion
        : null,
    light_level:
      typeof pole?.light_level === "number"
        ? pole.light_level
        : typeof pole?.brightness === "number"
        ? pole.brightness
        : null,
    last_seen:
      pole?.last_seen ||
      pole?.timestamp ||
      pole?.updated_at ||
      pole?.lastSeen ||
      null,
    temp_c: pole?.temp_c ?? null,
    humidity: pole?.humidity ?? null,
  };
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
  const tenantId = process.env.REACT_APP_TENANT_ID || "tenant-001";
  const WS_URL =
    process.env.REACT_APP_WS_URL ||
    process.env.REACT_APP_LIGHTWISE_WS_URL ||
    "";

  const [streetlights, setStreetlights] = useState([]);
  const [selectedId, setSelectedId] = useState(DEFAULT_POLE_ID);
  const [metaMap, setMetaMap] = useState(() => loadPoleMetaMap());
  const [events, setEvents] = useState([]);

  const [nameInput, setNameInput] = useState("");
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [saveMsg, setSaveMsg] = useState("");

  const selectedIdRef = useRef(DEFAULT_POLE_ID);
  const lastLoadedPoleIdRef = useRef(null);

  const { status: wsStatus, lastMessage, subscribe } = useLightWiseWS(WS_URL, {
    tenantId,
    debug: false,
  });

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const raw = await listStreetlights();
        const rows = (Array.isArray(raw) ? raw : []).map(normalizePole);

        if (cancelled) return;

        const local = loadPoleMetaMap();
        setMetaMap(local);

        if (rows.length) {
          const merged = rows.map((pole) => mergeLocalMeta(pole, local));
          setStreetlights(merged);

          if (!merged.some((row) => row.streetlight_id === selectedIdRef.current)) {
            setSelectedId(merged[0]?.streetlight_id || DEFAULT_POLE_ID);
          }
        } else {
          setStreetlights([buildFallbackPole(selectedIdRef.current, local)]);
        }
      } catch {
        if (cancelled) return;
        const local = loadPoleMetaMap();
        setMetaMap(local);
        setStreetlights((prev) =>
          prev.length ? prev : [buildFallbackPole(selectedIdRef.current, local)]
        );
      }
    }

    load();
    const timer = setInterval(load, 15000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const mapPoles = useMemo(() => {
    const base = streetlights.length
      ? streetlights
      : [buildFallbackPole(selectedId, metaMap)];

    return base.map((pole) => mergeLocalMeta(pole, metaMap));
  }, [streetlights, selectedId, metaMap]);

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
    if (wsStatus === "connected" && selectedId) {
      subscribe(selectedId);
    }
  }, [wsStatus, selectedId, subscribe]);

  const live = useMemo(() => {
    if (!lastMessage || lastMessage.streetlight_id !== selectedId) return null;

    return {
      motion:
        typeof lastMessage?.data?.motion === "boolean"
          ? lastMessage.data.motion
          : typeof lastMessage?.motion === "boolean"
          ? lastMessage.motion
          : null,
      lightPct: clampPct(
        lastMessage?.data?.light_level ?? lastMessage?.light_level ?? 0
      ),
      lux: lastMessage?.data?.lux ?? lastMessage?.lux ?? null,
      tempC: lastMessage?.data?.temp_c ?? lastMessage?.temp_c ?? null,
      humidity: lastMessage?.data?.humidity ?? lastMessage?.humidity ?? null,
      health: lastMessage?.health || selectedBase?.health || "OK",
      timestamp: lastMessage?.timestamp || new Date().toISOString(),
    };
  }, [lastMessage, selectedId, selectedBase?.health]);

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

    setStreetlights((prev) => {
      const exists = prev.some((pole) => pole.streetlight_id === selectedId);

      if (!exists) {
        return [{ ...buildFallbackPole(selectedId, nextMeta), ...patch }, ...prev];
      }

      return prev.map((pole) =>
        pole.streetlight_id === selectedId ? { ...pole, ...patch } : pole
      );
    });

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

    setStreetlights((prev) =>
      prev.map((pole) =>
        pole.streetlight_id === selectedId
          ? { ...pole, lat: null, lng: null }
          : pole
      )
    );

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

  const loadingSensors = !live;
  const mapHeight = 640;
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(360px, 0.95fr) minmax(520px, 1.45fr)",
            gap: "16px",
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: "16px", minWidth: 0 }}>
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

          <div style={{ display: "grid", gap: "16px", minWidth: 0 }}>
            <BubbleCard
              icon={<UiIcon name="bolt" size={22} />}
              title="Live Light State"
              sub="Current output and health"
            >
              <div className="lwAdminMetricList">
                <div><b>Streetlight:</b> {selectedId}</div>
                <div><b>Display Name:</b> {nameInput || selectedBase?.name || "Unnamed pole"}</div>
                <div><b>Motion:</b> {motionText}</div>
                <div><b>Brightness Level:</b> {lightPct}%</div>
                <div><b>Health:</b> {healthText}</div>
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
              <div
                style={{
                  width: "100%",
                  minWidth: 0,
                  borderRadius: "18px",
                  overflow: "hidden",
                }}
              >
                <MapEmbed
                  key={mapKey}
                  title="Selected pole location"
                  height={mapHeight}
                  fillHeight={false}
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