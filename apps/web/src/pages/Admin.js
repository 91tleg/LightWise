import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import ActivityFeed from "../components/ActivityFeed";
import BubbleCard from "../components/BubbleCard";
import AdminWsControls from "../components/AdminWsControls";
import MapEmbed from "../components/MapEmbed.js";
import UiIcon from "../components/UiIcon";
import SkeletonValue from "../components/SkeletonValue";
import { useLightWise } from "../hooks/useLightWise";
import { useLivePoleData } from "../hooks/useLivePoleData";
import { usePoleMetadata } from "../hooks/usePoleMetadata";
import { readActivePoleId } from "../services/activePoleStorage";
import { motionLabel } from "../utils/poleState";
import { formatTimestamp } from "../utils/formatters";
import "../styles/lightwise.css";
import "../styles/admin.css";

export default function Admin() {
  const { wsStatus, subscribe } = useLightWise();
  const [selectedId, setSelectedId] = useState(() => readActivePoleId(null));
  const {
    mapPoles,
    selectedBase,
    nameInput,
    setNameInput,
    latInput,
    setLatInput,
    lngInput,
    setLngInput,
    setIsEditing,
    saveState,
    saveMsg,
    latError,
    lngError,
    formValid,
    previewLat,
    previewLng,
    handleSaveMetadata,
    handleClearCoords,
  } = usePoleMetadata(selectedId);
  const { live, events, telemetryLoading, telemetryError } = useLivePoleData(selectedId);

  useEffect(() => {
    if (!mapPoles.length) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }

    if (!mapPoles.some((pole) => pole.streetlight_id === selectedId)) {
      setSelectedId(mapPoles[0]?.streetlight_id || null);
    }
  }, [mapPoles, selectedId]);

  const motionState =
    typeof live?.motion === "boolean"
      ? live.motion
      : typeof selectedBase?.motion_detected === "boolean"
      ? selectedBase.motion_detected
      : null;
  const motionText =
    typeof motionState === "boolean" ? motionLabel(motionState) : "Waiting for data";
  const lightPct = live?.lightPct ?? selectedBase?.light_level ?? 0;
  const lightText =
    live?.lightPct != null || selectedBase?.light_level != null
      ? `${lightPct}%`
      : "Waiting for data";
  const healthText = live?.health || selectedBase?.health || "Waiting for data";
  const loadingSensors = telemetryLoading && !live;
  const sensorSubtitle = telemetryError
    ? "Telemetry fetch failed. Waiting for live updates."
    : live
    ? "Active sensor stream"
    : "Waiting for sensor updates";
  const selectedLabel = useMemo(() => {
    return nameInput || selectedBase?.name || "Unnamed pole";
  }, [nameInput, selectedBase?.name]);

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
                  value={selectedId || ""}
                  onChange={(e) => {
                    setSelectedId(e.target.value || null);
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
                  disabled={saveState === "saving" || !formValid || !selectedId}
                >
                  <UiIcon name="save" size={16} />
                  <span>{saveState === "saving" ? "Saving..." : "Save Changes"}</span>
                </button>

                <button
                  className="lwAdminSecondaryBtn"
                  type="button"
                  onClick={handleClearCoords}
                  disabled={saveState === "saving" || !selectedId}
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
              sub={sensorSubtitle}
            >
              <div className="lwSensorGrid">
                <div className="lwSensorRow">
                  <span>Lux</span>
                  <SkeletonValue
                    active={loadingSensors}
                    value={live?.lux ?? (telemetryError ? "Unavailable" : "Waiting for data")}
                  />
                </div>

                <div className="lwSensorRow">
                  <span>Temperature</span>
                  <SkeletonValue
                    active={loadingSensors}
                    value={
                      live?.tempC != null
                        ? `${live.tempC}°C`
                        : telemetryError
                        ? "Unavailable"
                        : "Waiting for data"
                    }
                  />
                </div>

                <div className="lwSensorRow">
                  <span>Humidity</span>
                  <SkeletonValue
                    active={loadingSensors}
                    value={
                      live?.humidity != null
                        ? `${live.humidity}%`
                        : telemetryError
                        ? "Unavailable"
                        : "Waiting for data"
                    }
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

              {telemetryError ? (
                <div className="lwAdminStatusMsg error">
                  Telemetry history is unavailable right now. Live WebSocket updates will still
                  appear here.
                </div>
              ) : null}
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
                  <b>Streetlight:</b> {selectedId || "Waiting for selection"}
                </div>
                <div>
                  <b>Display Name:</b> {selectedLabel}
                </div>
                <div>
                  <b>Motion:</b> {motionText}
                </div>
                <div>
                  <b>Brightness Level:</b> {lightText}
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
                  title="Selected pole location"
                  fillHeight
                  lat={previewLat}
                  lng={previewLng}
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
