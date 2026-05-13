import React, { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import AdminWsControls from "../components/AdminWsControls";
import Layout from "../components/Layout";
import MapEmbed from "../components/MapEmbed";
import UiIcon from "../components/UiIcon";
import { useLightWise } from "../hooks/useLightWise";
import {
  getStreetlightCommandHistory,
  inviteUser,
  listUsers as listTenantUsers,
  removeUser,
  sendStreetlightCommand,
  updateStreetlightMetadata,
} from "../services/api";
import { loadPoleMetaMap, upsertPoleMeta } from "../services/poleStorage";
import { formatTimestamp } from "../utils/formatters";
import {
  DEFAULT_CENTER,
  isValidCoord,
  mergeBackendAndLocalPoles,
  pickBestCenter,
} from "../utils/poleHelpers";
import { toneForHealth, validateCoordinate } from "../utils/poleState";
import "../styles/lightwise.css";
import "../styles/admin.css";

const ADMIN_STORAGE_KEY = "lightwise_admin_console_v8";
const LEGACY_DEMO_USER_EMAILS = new Set([
  "avery.brooks@city.gov",
  "jules.chen@city.gov",
]);
const LEGACY_DEMO_ZONE_NAMES = new Set([
  "downtown core",
  "waterfront",
  "civic campus",
]);
const LEGACY_DEMO_SCHEDULE_NAMES = new Set([
  "day window",
  "night window",
  "waterfront day window",
  "waterfront night window",
]);
const DAY_OPTIONS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIME_OPTIONS = Array.from({ length: 97 }, (_, index) => {
  const minutes = Math.min(index * 15, 24 * 60);
  return {
    value: minutes,
    label: formatMinutes(minutes),
  };
});
const DEFAULT_ZONE_FORM = {
  name: "",
  description: "",
  motionSensitivity: 55,
  polygon: [],
};
const DEFAULT_POLE_FORM = {
  name: "",
  lat: "",
  lng: "",
  zoneId: "",
};
const DEFAULT_SCHEDULE_FORM = {
  name: "",
  zoneId: "",
  startMinute: 0,
  endMinute: 12 * 60,
  dimLevel: 70,
  days: [0, 1, 2, 3, 4, 5, 6],
};
const DEFAULT_DEVICE_FORM = {
  label: "",
  devEui: "",
  poleId: "",
  gateway: "",
  signalRssi: -92,
};
const DEFAULT_USER_FORM = {
  name: "",
  email: "",
  role: "operator",
};
const SECTION_ITEMS = [
  {
    id: "zones",
    label: "Zones",
    icon: "map",
    description: "Draw service boundaries and tune motion sensitivity per area.",
  },
  {
    id: "poles",
    label: "Poles",
    icon: "pin",
    description: "Search assets, update metadata, and bulk assign poles from the map.",
  },
  {
    id: "schedules",
    label: "Schedules",
    icon: "chart",
    description: "Shape dimming windows with a visual timeline instead of raw inputs.",
  },
  {
    id: "lorawan",
    label: "LoRaWAN",
    icon: "radio",
    description: "Register field devices and monitor uplinks and signal quality.",
  },
  {
    id: "users",
    label: "Users",
    icon: "user",
    description: "Add operators, promote admins, and manage access cleanly.",
  },
];

function safeReadAdminState() {
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function safeWriteAdminState(value) {
  try {
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore storage failures in local mock mode
  }
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function isLegacyDemoUser(user = {}) {
  return LEGACY_DEMO_USER_EMAILS.has(String(user.email || "").trim().toLowerCase());
}

function isLegacyDemoZone(zone = {}) {
  return LEGACY_DEMO_ZONE_NAMES.has(String(zone.name || "").trim().toLowerCase());
}

function isLegacyDemoSchedule(schedule = {}) {
  return LEGACY_DEMO_SCHEDULE_NAMES.has(String(schedule.name || "").trim().toLowerCase());
}

function isLegacyDemoDevice(device = {}) {
  const devEui = normalizeDevEui(device.devEui);
  const gateway = String(device.gateway || "").trim();
  return /^70B3D57ED00A\d{2}$/.test(devEui) && /^GW-\d{2}$/.test(gateway);
}

function isLocalOnlyUser(user = {}) {
  return !String(user.user_id || "").trim() && !String(user.created_at || "").trim();
}

function isInviteEndpointUnavailable(error) {
  return String(error?.message || "").startsWith("Failed to fetch (POST ");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function dedupe(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
}

function formatMinutes(totalMinutes) {
  const safeValue = clamp(Number(totalMinutes) || 0, 0, 24 * 60);
  const hour24 = Math.floor(safeValue / 60) % 24;
  const minutes = safeValue % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function summarizeDays(days = []) {
  const sortedDays = [...(Array.isArray(days) ? days : [])].sort((a, b) => a - b);
  if (sortedDays.length === 7) return "Every day";
  if (sortedDays.length === 5 && sortedDays.every((day, index) => day === index)) {
    return "Weekdays";
  }
  if (sortedDays.length === 2 && sortedDays[0] === 5 && sortedDays[1] === 6) {
    return "Weekend";
  }
  return sortedDays.map((day) => DAY_OPTIONS[day] || "").join(", ");
}

function describeSensitivity(value) {
  const level = clamp(Number(value) || 0, 0, 100);

  if (level <= 25) {
    return {
      label: "Calm",
      note: "Only large movement changes will brighten the zone.",
    };
  }

  if (level <= 50) {
    return {
      label: "Balanced",
      note: "Good default for mixed traffic streets and neighborhood edges.",
    };
  }

  if (level <= 75) {
    return {
      label: "Responsive",
      note: "Pedestrian and bike activity will trigger lighting more eagerly.",
    };
  }

  return {
    label: "Hyper-aware",
    note: "Best for civic plazas, crossings, and safety-first corridors.",
  };
}

function describeSignal(signalRssi) {
  const value = Number(signalRssi);

  if (!Number.isFinite(value)) {
    return { label: "Unknown", tone: "neutral" };
  }

  if (value >= -90) {
    return { label: "Strong", tone: "healthy" };
  }

  if (value >= -103) {
    return { label: "Fair", tone: "warning" };
  }

  return { label: "Weak", tone: "critical" };
}

function normalizePoint(point) {
  if (!point || !Number.isFinite(Number(point.lat)) || !Number.isFinite(Number(point.lng))) {
    return null;
  }

  return {
    lat: Number(point.lat),
    lng: Number(point.lng),
  };
}

function normalizeDevEui(value = "") {
  return String(value).toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 16);
}

function formatDevEui(value = "") {
  return normalizeDevEui(value).replace(/(.{4})/g, "$1 ").trim();
}

function isValidEmail(value = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

function createSeedAdminState(operator = null) {
  const users = operator
    ? {
        id: makeId("user"),
        name: operator.name || "Current user",
        email: operator.email || "operator@lightwise.local",
        role: operator.role === "admin" ? "admin" : "operator",
      }
    : null;

  return {
    zones: [],
    schedules: [],
    devices: [],
    users: users ? [users] : [],
  };
}

function reconcileAdminState(currentState, basePoles = [], operator = null) {
  const fallback = createSeedAdminState(operator);
  if (!currentState || typeof currentState !== "object") {
    return fallback;
  }

  const poleIds = new Set(basePoles.map((pole) => pole.streetlight_id));
  const zones = Array.isArray(currentState.zones)
    ? currentState.zones
        .filter((zone) => !isLegacyDemoZone(zone))
        .map((zone) => {
          const polygon = (Array.isArray(zone?.polygon) ? zone.polygon : [])
            .map(normalizePoint)
            .filter(Boolean);

          return zone?.id
            ? {
                id: String(zone.id),
                name: String(zone.name || "").trim(),
                description: String(zone.description || "").trim(),
                motionSensitivity: clamp(Number(zone.motionSensitivity) || 55, 0, 100),
                polygon,
                assignedPoleIds: dedupe(zone.assignedPoleIds).filter((id) => poleIds.has(id)),
              }
            : null;
        })
        .filter(Boolean)
    : [];

  const zoneIds = new Set(zones.map((zone) => zone.id));
  const schedules = Array.isArray(currentState.schedules)
    ? currentState.schedules
        .filter((schedule) => !isLegacyDemoSchedule(schedule))
        .map((schedule) => {
          if (!schedule?.id || !zoneIds.has(schedule.zoneId)) return null;

          const startMinute = clamp(Number(schedule.startMinute) || 18 * 60, 0, 47 * 60);
          const rawEnd = Number(schedule.endMinute);
          const endMinute = clamp(
            Number.isFinite(rawEnd) ? rawEnd : startMinute + 180,
            startMinute + 30,
            48 * 60
          );

          return {
            id: String(schedule.id),
            name: String(schedule.name || "").trim(),
            zoneId: String(schedule.zoneId),
            startMinute,
            endMinute,
            dimLevel: clamp(Number(schedule.dimLevel) || 60, 10, 100),
            days: dedupe(schedule.days)
              .map((day) => Number(day))
              .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
              .sort((a, b) => a - b),
          };
        })
        .filter(Boolean)
    : [];

  const devices = Array.isArray(currentState.devices)
    ? currentState.devices
        .filter((device) => !isLegacyDemoDevice(device))
        .map((device) => {
          if (!device?.id) return null;

          return {
            id: String(device.id),
            label: String(device.label || "").trim(),
            devEui: normalizeDevEui(device.devEui),
            poleId: poleIds.has(device.poleId) ? device.poleId : "",
            gateway: String(device.gateway || "").trim(),
            signalRssi: clamp(Number(device.signalRssi) || -95, -120, -60),
            lastUplink: device.lastUplink || new Date().toISOString(),
          };
        })
        .filter(Boolean)
    : [];

  const users = Array.isArray(currentState.users)
    ? currentState.users
        .filter((user) => !isLegacyDemoUser(user))
        .map((user) => {
          if (!user?.id) return null;

          const role = user.role === "admin" ? "admin" : "operator";
          return {
            id: String(user.id),
            user_id: String(user.user_id || "").trim(),
            name: String(user.name || "").trim(),
            email: String(user.email || "").trim(),
            role,
            created_at: user.created_at || "",
          };
        })
        .filter(Boolean)
    : [];

  if (operator?.email) {
    const operatorEmail = operator.email.trim().toLowerCase();
    const existingIndex = users.findIndex((user) => user.email.toLowerCase() === operatorEmail);
    const operatorEntry = {
      id: existingIndex >= 0 ? users[existingIndex].id : makeId("user"),
      user_id: existingIndex >= 0 ? users[existingIndex].user_id || "" : "",
      name: operator.name || "Current user",
      email: operator.email,
      role: operator.role === "admin" ? "admin" : "operator",
      created_at: existingIndex >= 0 ? users[existingIndex].created_at || "" : "",
    };

    if (existingIndex >= 0) {
      users.splice(existingIndex, 1, operatorEntry);
    } else {
      users.unshift(operatorEntry);
    }
  }

  return {
    zones,
    schedules,
    devices,
    users: users.length ? users : fallback.users,
  };
}

function buildPoleZoneMap(zones = []) {
  return zones.reduce((map, zone) => {
    zone.assignedPoleIds.forEach((poleId) => {
      map[poleId] = zone.id;
    });
    return map;
  }, {});
}

function buildMapBoundsFromPoints(points = [], center = DEFAULT_CENTER) {
  const validPoints = points.map(normalizePoint).filter(Boolean);
  const coords = validPoints.length ? validPoints : [center];
  const minLat = Math.min(...coords.map((item) => item.lat));
  const maxLat = Math.max(...coords.map((item) => item.lat));
  const minLng = Math.min(...coords.map((item) => item.lng));
  const maxLng = Math.max(...coords.map((item) => item.lng));
  const latPad = Math.max((maxLat - minLat) * 0.22, 0.0032);
  const lngPad = Math.max((maxLng - minLng) * 0.22, 0.0032);

  return {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLng: minLng - lngPad,
    maxLng: maxLng + lngPad,
  };
}

function getPercentPosition(lat, lng, bounds) {
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.0001);
  const lngSpan = Math.max(bounds.maxLng - bounds.minLng, 0.0001);
  const left = ((Number(lng) - bounds.minLng) / lngSpan) * 100;
  const top = (1 - (Number(lat) - bounds.minLat) / latSpan) * 100;

  return {
    left: `${clamp(left, 4, 96).toFixed(2)}%`,
    top: `${clamp(top, 6, 94).toFixed(2)}%`,
  };
}

function getPointFromPercent(xPercent, yPercent, bounds) {
  const lat = bounds.maxLat - ((bounds.maxLat - bounds.minLat) * yPercent) / 100;
  const lng = bounds.minLng + ((bounds.maxLng - bounds.minLng) * xPercent) / 100;

  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };
}

function polygonToSvgPoints(points = [], bounds) {
  return points
    .map((point) => {
      const pos = getPercentPosition(point.lat, point.lng, bounds);
      return `${pos.left} ${pos.top}`;
    })
    .join(" ");
}

function getSectionMeta(id) {
  return SECTION_ITEMS.find((item) => item.id === id) || SECTION_ITEMS[0];
}

function getRoleTone(role) {
  return role === "admin" ? "warning" : "neutral";
}

function makeZoneForm(zone = null) {
  return zone
    ? {
        name: zone.name || "",
        description: zone.description || "",
        motionSensitivity: zone.motionSensitivity ?? 55,
        polygon: Array.isArray(zone.polygon) ? zone.polygon : [],
      }
    : { ...DEFAULT_ZONE_FORM };
}

function makePoleForm(pole = null, zoneId = "") {
  return pole
    ? {
        name: pole.name || "",
        lat: pole.lat != null ? String(pole.lat) : "",
        lng: pole.lng != null ? String(pole.lng) : "",
        zoneId: zoneId || "",
      }
    : { ...DEFAULT_POLE_FORM };
}

function makeScheduleForm(schedule = null, zoneId = "") {
  return schedule
    ? {
        name: schedule.name || "",
        zoneId: schedule.zoneId || zoneId || "",
        startMinute: schedule.startMinute ?? DEFAULT_SCHEDULE_FORM.startMinute,
        endMinute: schedule.endMinute ?? DEFAULT_SCHEDULE_FORM.endMinute,
        dimLevel: schedule.dimLevel ?? DEFAULT_SCHEDULE_FORM.dimLevel,
        days: Array.isArray(schedule.days) ? schedule.days : DEFAULT_SCHEDULE_FORM.days,
      }
    : {
        ...DEFAULT_SCHEDULE_FORM,
        zoneId: zoneId || "",
      };
}

function makeDeviceForm(device = null, poleId = "") {
  return device
    ? {
        label: device.label || "",
        devEui: device.devEui || "",
        poleId: device.poleId || poleId || "",
        gateway: device.gateway || "",
        signalRssi: device.signalRssi ?? DEFAULT_DEVICE_FORM.signalRssi,
      }
    : {
        ...DEFAULT_DEVICE_FORM,
        poleId: poleId || "",
      };
}

function makeUserForm(user = null) {
  return user
    ? {
        name: user.name || "",
        email: user.email || "",
        role: user.role || "operator",
      }
    : { ...DEFAULT_USER_FORM };
}

function userNameFromEmail(email) {
  return String(email || "")
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function mergeRemoteUsers(remoteUsers = [], localUsers = [], operator = null) {
  const localByEmail = new Map(
    (Array.isArray(localUsers) ? localUsers : [])
      .filter((user) => user?.email)
      .map((user) => [user.email.toLowerCase(), user])
  );
  const localById = new Map(
    (Array.isArray(localUsers) ? localUsers : [])
      .filter((user) => user?.id)
      .map((user) => [user.id, user])
  );

  const users = (Array.isArray(remoteUsers) ? remoteUsers : [])
    .filter((user) => !isLegacyDemoUser(user))
    .map((user) => {
      const local = localById.get(user.id) || localByEmail.get(String(user.email || "").toLowerCase()) || {};
      const email = user.email || local.email || "";
      return {
        id: user.id || user.user_id || local.id || email,
        user_id: user.user_id || user.id || local.user_id || local.id || email,
        name: user.name || local.name || userNameFromEmail(email) || "User",
        email,
        role: user.role === "admin" ? "admin" : "operator",
        created_at: user.created_at || local.created_at || "",
      };
    });

  if (operator?.email) {
    const operatorEmail = operator.email.trim().toLowerCase();
    const index = users.findIndex((user) => user.email.toLowerCase() === operatorEmail);
    const currentUser = {
      id: index >= 0 ? users[index].id : operator.sub || operator.email,
      user_id: index >= 0 ? users[index].user_id || users[index].id : operator.sub || operator.email,
      name: operator.name || (index >= 0 ? users[index].name : "Current user"),
      email: operator.email,
      role: operator.role === "admin" ? "admin" : "operator",
      created_at: index >= 0 ? users[index].created_at : "",
    };

    if (index >= 0) {
      users.splice(index, 1, currentUser);
    } else {
      users.unshift(currentUser);
    }
  }

  return users;
}

function normalizeCommandAck(message) {
  if (!message || message.event !== "command.ack") return null;
  const data = message.data || {};
  return {
    command_id: data.command_id || "",
    streetlight_id: message.streetlight_id || "",
    command: data.command || "",
    response_code: data.response_code || "",
    reason_code: data.reason_code || "",
    received_at: message.timestamp || new Date().toISOString(),
  };
}

function validateZoneForm(form) {
  const errors = {};

  if (!String(form.name || "").trim()) {
    errors.name = "Zone name is required.";
  }

  if ((Array.isArray(form.polygon) ? form.polygon.length : 0) < 3) {
    errors.polygon = "Add at least three boundary points to save a zone.";
  }

  return errors;
}

function validatePoleForm(form) {
  const errors = {};

  if (!String(form.name || "").trim()) {
    errors.name = "Display name is required.";
  }

  const latError = validateCoordinate(form.lat, "Latitude");
  const lngError = validateCoordinate(form.lng, "Longitude");

  if (latError) errors.lat = latError;
  if (lngError) errors.lng = lngError;

  return errors;
}

function validateScheduleForm(form) {
  const errors = {};

  if (!String(form.name || "").trim()) {
    errors.name = "Schedule name is required.";
  }

  if (!String(form.zoneId || "").trim()) {
    errors.zoneId = "Select a zone for this schedule.";
  }

  if (Number(form.endMinute) <= Number(form.startMinute)) {
    errors.timeline = "The schedule must end after it starts.";
  }

  if (!Array.isArray(form.days) || !form.days.length) {
    errors.days = "Pick at least one day.";
  }

  return errors;
}

function validateDeviceForm(form) {
  const errors = {};

  if (!String(form.label || "").trim()) {
    errors.label = "Device label is required.";
  }

  if (!/^[0-9A-F]{16}$/.test(normalizeDevEui(form.devEui))) {
    errors.devEui = "Enter a 16-character hexadecimal DevEUI.";
  }

  if (!String(form.poleId || "").trim()) {
    errors.poleId = "Assign the device to a pole.";
  }

  return errors;
}

function validateUserForm(form) {
  const errors = {};

  if (!String(form.name || "").trim()) {
    errors.name = "User name is required.";
  }

  if (!isValidEmail(form.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (form.role !== "admin" && form.role !== "operator") {
    errors.role = "Select either admin or operator.";
  }

  return errors;
}

function StatusChip({ tone = "neutral", children }) {
  return <span className={`lwAdminChip ${tone}`}>{children}</span>;
}

function FieldMessage({ error, hint }) {
  if (error) {
    return <div className="lwAdminFieldError">{error}</div>;
  }

  if (hint) {
    return <div className="lwAdminFieldHint">{hint}</div>;
  }

  return null;
}

function SectionCard({ icon, title, subtitle, actions, children }) {
  return (
    <section className="lwAdminCard">
      <div className="lwAdminCardHeader">
        <div className="lwAdminCardTitleWrap">
          <div className="lwAdminCardIcon">
            <UiIcon name={icon} size={18} />
          </div>
          <div>
            <h2 className="lwAdminCardTitle">{title}</h2>
            {subtitle ? <p className="lwAdminCardSubtitle">{subtitle}</p> : null}
          </div>
        </div>

        {actions ? <div className="lwAdminCardActions">{actions}</div> : null}
      </div>

      {children}
    </section>
  );
}

function SectionNav({ activeSection, onChange }) {
  return (
    <aside className="lwAdminSectionNav">
      <div className="lwAdminSectionNavHead">
        <div className="lwAdminSectionEyebrow">Configuration Surface</div>
        <h2 className="lwAdminSectionNavTitle">Admin Modules</h2>
      </div>

      <div className="lwAdminSectionNavList">
        {SECTION_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`lwAdminSectionNavItem${item.id === activeSection ? " isActive" : ""}`}
            onClick={() => onChange(item.id)}
          >
            <div className="lwAdminSectionNavItemTop">
              <span className="lwAdminSectionNavIcon">
                <UiIcon name={item.icon} size={16} />
              </span>
              <span>{item.label}</span>
            </div>
            <span className="lwAdminSectionNavDesc">{item.description}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function TimelineEditor({ scheduleForm, onChange, timelineError }) {
  const startPercent = (Number(scheduleForm.startMinute) / (24 * 60)) * 100;
  const endPercent = (Number(scheduleForm.endMinute) / (24 * 60)) * 100;
  const widthPercent = Math.max(endPercent - startPercent, 4);

  return (
    <div className="lwAdminTimelineEditor">
      <div className="lwAdminTimelineTop">
        <div>
          <div className="lwAdminTimelineLabel">Start</div>
          <div className="lwAdminTimelineValue">{formatMinutes(scheduleForm.startMinute)}</div>
        </div>

        <div className="lwAdminTimelineSummary">
          <span>{summarizeDays(scheduleForm.days)}</span>
          <strong>{scheduleForm.dimLevel}% brightness</strong>
        </div>

        <div>
          <div className="lwAdminTimelineLabel">End</div>
          <div className="lwAdminTimelineValue">{formatMinutes(scheduleForm.endMinute)}</div>
        </div>
      </div>

      <div className="lwAdminTimelineTrackWrap">
        <div className="lwAdminTimelineTrack" />
        <div
          className="lwAdminTimelineWindow"
          style={{ left: `${startPercent}%`, width: `${widthPercent}%` }}
        />

        <input
          className="lwAdminRangeInput lwAdminRangeInputStart"
          type="range"
          min="0"
          max={String((24 * 60) - 30)}
          step="15"
          value={scheduleForm.startMinute}
          onChange={(event) => {
            const nextStart = clamp(
              Number(event.target.value),
              0,
              Number(scheduleForm.endMinute) - 30
            );
            onChange((current) => ({
              ...current,
              startMinute: nextStart,
            }));
          }}
        />

        <input
          className="lwAdminRangeInput lwAdminRangeInputEnd"
          type="range"
          min="30"
          max={String(24 * 60)}
          step="15"
          value={scheduleForm.endMinute}
          onChange={(event) => {
            const nextEnd = clamp(
              Number(event.target.value),
              Number(scheduleForm.startMinute) + 30,
              24 * 60
            );
            onChange((current) => ({
              ...current,
              endMinute: nextEnd,
            }));
          }}
        />
      </div>

      <div className="lwAdminTimelineHours">
        {[0, 4, 8, 12, 16, 20, 24].map((hour) => (
          <span key={hour}>{formatMinutes(hour * 60)}</span>
        ))}
      </div>

      <FieldMessage
        error={timelineError}
        hint="Drag the handles across the timeline to shape the active lighting window."
      />
    </div>
  );
}

function ConfirmModal({ state, onClose }) {
  if (!state) return null;

  return (
    <div className="lwAdminModalBackdrop" role="presentation">
      <div
        className="lwAdminModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-modal-title"
      >
        <div className="lwAdminModalHeader">
          <div>
            <div className="lwAdminSectionEyebrow">Confirmation Required</div>
            <h3 id="admin-modal-title" className="lwAdminModalTitle">
              {state.title}
            </h3>
          </div>
          <StatusChip tone={state.tone === "danger" ? "critical" : "warning"}>
            {state.tone === "danger" ? "Destructive" : "Review"}
          </StatusChip>
        </div>

        <p className="lwAdminModalCopy">{state.message}</p>

        <div className="lwAdminModalActions">
          <button type="button" className="lwAdminSecondaryBtn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`lwAdminPrimaryBtn${state.tone === "danger" ? " isDanger" : ""}`}
            onClick={() => {
              state.onConfirm?.();
              onClose();
            }}
          >
            {state.confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminMapSurface({
  poles,
  zones,
  selectedZoneId,
  selectedPoleId,
  selectedPoleIds,
  previewPoint = null,
  draftPolygon = [],
  drawingEnabled = false,
  bulkMode = false,
  onAddPoint,
  onPoleClick,
}) {
  const validPoles = useMemo(
    () =>
      (Array.isArray(poles) ? poles : []).filter(
        (pole) => isValidCoord(pole?.lat) && isValidCoord(pole?.lng)
      ),
    [poles]
  );

  const center = useMemo(() => {
    if (previewPoint && isValidCoord(previewPoint.lat) && isValidCoord(previewPoint.lng)) {
      return {
        lat: Number(previewPoint.lat),
        lng: Number(previewPoint.lng),
      };
    }

    const selectedPole = validPoles.find((pole) => pole.streetlight_id === selectedPoleId);
    if (selectedPole) {
      return {
        lat: Number(selectedPole.lat),
        lng: Number(selectedPole.lng),
      };
    }

    return pickBestCenter(validPoles);
  }, [previewPoint, selectedPoleId, validPoles]);
  const pointsForBounds = useMemo(() => {
    const polygonPoints = zones.flatMap((zone) => zone.polygon);
    return [
      ...validPoles.map((pole) => ({ lat: Number(pole.lat), lng: Number(pole.lng) })),
      ...polygonPoints,
      ...draftPolygon,
      ...(previewPoint ? [previewPoint] : []),
      center,
    ];
  }, [center, draftPolygon, previewPoint, validPoles, zones]);
  const bounds = useMemo(
    () => buildMapBoundsFromPoints(pointsForBounds, center),
    [center, pointsForBounds]
  );

  function handleOverlayClick(event) {
    if (!drawingEnabled) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const xPercent = ((event.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((event.clientY - rect.top) / rect.height) * 100;
    onAddPoint?.(getPointFromPercent(xPercent, yPercent, bounds));
  }

  return (
    <div className="lwAdminMapSurface">
      <MapEmbed
        title="Admin planning map"
        fillHeight
        interactive={false}
        showInfo={false}
        showLegend={false}
        lat={center.lat}
        lng={center.lng}
        poles={validPoles}
        selectedId={selectedPoleId}
        forceNativePin={Boolean(previewPoint)}
      />

      <div className="lwAdminMapBadgeRow">
        <StatusChip tone="neutral">Static picker</StatusChip>
        <StatusChip tone="neutral">No live updates</StatusChip>
        {drawingEnabled ? <StatusChip tone="warning">Boundary drawing active</StatusChip> : null}
        {bulkMode ? <StatusChip tone="warning">Bulk select active</StatusChip> : null}
      </div>

      <div
        className={`lwAdminMapOverlay${drawingEnabled ? " isDrawing" : ""}`}
        onClick={handleOverlayClick}
        role="presentation"
      >
        <svg className="lwAdminMapSvg" viewBox="0 0 100 100" preserveAspectRatio="none">
          {zones.map((zone) =>
            zone.polygon.length >= 3 ? (
              <polygon
                key={zone.id}
                className={`lwAdminMapPolygon${zone.id === selectedZoneId ? " isSelected" : ""}`}
                points={polygonToSvgPoints(zone.polygon, bounds)}
              />
            ) : null
          )}

          {draftPolygon.length >= 2 ? (
            <polyline
              className="lwAdminMapDraft"
              points={polygonToSvgPoints(draftPolygon, bounds)}
            />
          ) : null}

          {draftPolygon.length >= 3 ? (
            <polygon
              className="lwAdminMapDraftFill"
              points={polygonToSvgPoints(draftPolygon, bounds)}
            />
          ) : null}
        </svg>

        {validPoles.map((pole) => {
          const tone = toneForHealth(pole.health);
          const isActive = pole.streetlight_id === selectedPoleId;
          const isBulkSelected = selectedPoleIds.includes(pole.streetlight_id);
          const position = getPercentPosition(pole.lat, pole.lng, bounds);
          const showLabel = isActive || isBulkSelected;

          return (
            <button
              key={pole.streetlight_id}
              type="button"
              className={`lwAdminMapMarker ${tone}${isActive ? " isActive" : ""}${
                isBulkSelected ? " isBulkSelected" : ""
              }`}
              style={position}
              onClick={(event) => {
                event.stopPropagation();
                onPoleClick?.(pole);
              }}
            >
              <span className="lwAdminMapMarkerDot" />
              {showLabel ? (
                <span className="lwAdminMapMarkerLabel">{pole.streetlight_id}</span>
              ) : null}
            </button>
          );
        })}

        {previewPoint ? (
          <div
            className="lwAdminMapPreviewPin"
            style={getPercentPosition(previewPoint.lat, previewPoint.lng, bounds)}
          >
            <span className="lwAdminMapPreviewDot" />
            <span className="lwAdminMapMarkerLabel">Preview</span>
          </div>
        ) : null}
      </div>

      <div className="lwAdminMapFooter">
        {drawingEnabled
          ? "Click on the map to place each zone vertex. Use three or more points to close a valid boundary."
          : bulkMode
          ? "Click pole markers to add or remove them from the bulk selection set."
          : "This map is intentionally static so administrative edits stay deliberate and stable."}
      </div>
    </div>
  );
}

export default function Admin() {
  const {
    streetlights,
    operator,
    applyStreetlightLocalPatch,
    wsStatus,
    lastMessage,
    subscribe,
  } = useLightWise();
  const [metaMap, setMetaMap] = useState(() => loadPoleMetaMap());
  const [adminState, setAdminState] = useState(null);
  const [activeSection, setActiveSection] = useState("zones");
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [zoneEditorMode, setZoneEditorMode] = useState("edit");
  const [zoneForm, setZoneForm] = useState(DEFAULT_ZONE_FORM);
  const [isDrawingZone, setIsDrawingZone] = useState(false);
  const [zoneStatus, setZoneStatus] = useState(null);
  const [selectedPoleId, setSelectedPoleId] = useState(null);
  const [poleForm, setPoleForm] = useState(DEFAULT_POLE_FORM);
  const [poleSearch, setPoleSearch] = useState("");
  const [poleStatus, setPoleStatus] = useState(null);
  const [bulkZoneId, setBulkZoneId] = useState("");
  const [bulkMapMode, setBulkMapMode] = useState(false);
  const [selectedPoleIds, setSelectedPoleIds] = useState([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);
  const [scheduleEditorMode, setScheduleEditorMode] = useState("edit");
  const [scheduleForm, setScheduleForm] = useState(DEFAULT_SCHEDULE_FORM);
  const [scheduleStatus, setScheduleStatus] = useState(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [deviceEditorMode, setDeviceEditorMode] = useState("edit");
  const [deviceForm, setDeviceForm] = useState(DEFAULT_DEVICE_FORM);
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userEditorMode, setUserEditorMode] = useState("edit");
  const [userForm, setUserForm] = useState(DEFAULT_USER_FORM);
  const [userStatus, setUserStatus] = useState(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSaving, setUserSaving] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState(null);
  const [commandStatus, setCommandStatus] = useState(null);
  const [commandSending, setCommandSending] = useState(false);
  const [commandHistory, setCommandHistory] = useState([]);
  const [lastCommandAck, setLastCommandAck] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  const deferredPoleSearch = useDeferredValue(poleSearch);
  const poles = useMemo(() => {
    const merged = mergeBackendAndLocalPoles(Array.isArray(streetlights) ? streetlights : [], metaMap);
    return [...merged].sort((a, b) =>
      String(a.streetlight_id || "").localeCompare(String(b.streetlight_id || ""))
    );
  }, [metaMap, streetlights]);

  useEffect(() => {
    setAdminState((current) => reconcileAdminState(current || safeReadAdminState(), poles, operator));
  }, [operator, poles]);

  useEffect(() => {
    if (!operator) return;

    let isCurrent = true;
    setUsersLoading(true);

    listTenantUsers()
      .then((remoteUsers) => {
        if (!isCurrent) return;
        setRemoteUsers(remoteUsers);
        setUserStatus(null);
      })
      .catch((error) => {
        if (!isCurrent) return;
        setUserStatus({
          tone: "warning",
          text: error?.message || "User directory sync failed.",
        });
      })
      .finally(() => {
        if (isCurrent) setUsersLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [operator]);

  useEffect(() => {
    if (!operator || !remoteUsers) return;

    setAdminState((current) => {
      const reconciled = reconcileAdminState(current || safeReadAdminState(), poles, operator);
      return {
        ...reconciled,
        users: mergeRemoteUsers(remoteUsers, reconciled.users, operator),
      };
    });
  }, [operator, poles, remoteUsers]);

  useEffect(() => {
    if (adminState) {
      safeWriteAdminState(adminState);
    }
  }, [adminState]);

  const zones = useMemo(() => adminState?.zones ?? [], [adminState?.zones]);
  const schedules = useMemo(() => adminState?.schedules ?? [], [adminState?.schedules]);
  const devices = useMemo(() => adminState?.devices ?? [], [adminState?.devices]);
  const users = useMemo(
    () => (adminState?.users ?? []).filter((user) => !isLegacyDemoUser(user)),
    [adminState?.users]
  );
  const poleZoneMap = useMemo(() => buildPoleZoneMap(zones), [zones]);
  const zoneLookup = useMemo(
    () =>
      zones.reduce((map, zone) => {
        map[zone.id] = zone;
        return map;
      }, {}),
    [zones]
  );
  const selectedZone = useMemo(
    () => zones.find((zone) => zone.id === selectedZoneId) || null,
    [selectedZoneId, zones]
  );
  const selectedPole = useMemo(
    () => poles.find((pole) => pole.streetlight_id === selectedPoleId) || null,
    [poles, selectedPoleId]
  );
  const selectedSchedule = useMemo(
    () => schedules.find((schedule) => schedule.id === selectedScheduleId) || null,
    [schedules, selectedScheduleId]
  );
  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId) || null,
    [devices, selectedDeviceId]
  );
  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) || null,
    [users, selectedUserId]
  );
  const selectedCommandStreetlightId =
    selectedPoleId || selectedDevice?.poleId || poles[0]?.streetlight_id || "";

  const sectionMeta = getSectionMeta(activeSection);
  const editableZones = useMemo(() => {
    if (!selectedZone || zoneEditorMode === "create") return zones;

    return zones.map((zone) =>
      zone.id === selectedZone.id
        ? {
            ...zone,
            polygon: zoneForm.polygon,
          }
      : zone
    );
  }, [selectedZone, zoneEditorMode, zoneForm.polygon, zones]);
  const livePreviewPoint = useMemo(() => {
    if (!selectedPoleId) return null;

    const latError = validateCoordinate(poleForm.lat, "Latitude");
    const lngError = validateCoordinate(poleForm.lng, "Longitude");
    if (latError || lngError) return null;

    const lat = String(poleForm.lat || "").trim();
    const lng = String(poleForm.lng || "").trim();
    if (!lat || !lng) return null;

    return {
      lat: Number(lat),
      lng: Number(lng),
    };
  }, [poleForm.lat, poleForm.lng, selectedPoleId]);
  const previewPoles = useMemo(() => {
    if (!selectedPoleId) return poles;

    return poles.map((pole) => {
      if (pole.streetlight_id !== selectedPoleId) return pole;

      return {
        ...pole,
        name: poleForm.name || pole.name,
        lat: livePreviewPoint ? livePreviewPoint.lat : pole.lat,
        lng: livePreviewPoint ? livePreviewPoint.lng : pole.lng,
      };
    });
  }, [livePreviewPoint, poleForm.name, poles, selectedPoleId]);
  const filteredPoles = useMemo(() => {
    const query = String(deferredPoleSearch || "").trim().toLowerCase();
    if (!query) return poles;

    return poles.filter((pole) => {
      const zone = zoneLookup[poleZoneMap[pole.streetlight_id]];
      const haystack = [
        pole.streetlight_id,
        pole.name || "",
        zone?.name || "",
        pole.health || "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [deferredPoleSearch, poleZoneMap, poles, zoneLookup]);

  const stats = useMemo(
    () => [
      {
        label: "Zones",
        value: zones.length,
        note: "Configured service areas",
      },
      {
        label: "Mapped Poles",
        value: poles.filter((pole) => isValidCoord(pole.lat) && isValidCoord(pole.lng)).length,
        note: "Selectable on the static map",
      },
      {
        label: "LoRaWAN Devices",
        value: devices.length,
        note: "Registered field radios",
      },
      {
        label: "Users",
        value: users.length,
        note: `${users.filter((user) => user.role === "admin").length} admins, ${
          users.filter((user) => user.role === "operator").length
        } operators`,
      },
    ],
    [devices.length, poles, users, zones.length]
  );

  const zoneErrors = useMemo(() => validateZoneForm(zoneForm), [zoneForm]);
  const poleErrors = useMemo(() => validatePoleForm(poleForm), [poleForm]);
  const scheduleErrors = useMemo(() => validateScheduleForm(scheduleForm), [scheduleForm]);
  const deviceErrors = useMemo(() => validateDeviceForm(deviceForm), [deviceForm]);
  const userErrors = useMemo(() => validateUserForm(userForm), [userForm]);

  useEffect(() => {
    if (zoneEditorMode === "create") return;
    if (!zones.length) {
      setSelectedZoneId(null);
      return;
    }

    if (!selectedZoneId || !zones.some((zone) => zone.id === selectedZoneId)) {
      setSelectedZoneId(zones[0].id);
    }
  }, [selectedZoneId, zoneEditorMode, zones]);

  useEffect(() => {
    if (zoneEditorMode === "create") return;
    if (selectedZone) {
      setZoneForm(makeZoneForm(selectedZone));
    }
  }, [selectedZone, zoneEditorMode]);

  useEffect(() => {
    if (!poles.length) {
      setSelectedPoleId(null);
      return;
    }

    if (!selectedPoleId || !poles.some((pole) => pole.streetlight_id === selectedPoleId)) {
      setSelectedPoleId(poles[0].streetlight_id);
    }
  }, [poles, selectedPoleId]);

  useEffect(() => {
    if (selectedPole) {
      setPoleForm(makePoleForm(selectedPole, poleZoneMap[selectedPole.streetlight_id] || ""));
    }
  }, [poleZoneMap, selectedPole]);

  useEffect(() => {
    if (!bulkMapMode && selectedPoleId) {
      setSelectedPoleIds([selectedPoleId]);
      setBulkZoneId(poleZoneMap[selectedPoleId] || "");
    }
  }, [bulkMapMode, poleZoneMap, selectedPoleId]);

  useEffect(() => {
    if (scheduleEditorMode === "create") return;
    if (!schedules.length) {
      setSelectedScheduleId(null);
      return;
    }

    if (!selectedScheduleId || !schedules.some((schedule) => schedule.id === selectedScheduleId)) {
      setSelectedScheduleId(schedules[0].id);
    }
  }, [scheduleEditorMode, schedules, selectedScheduleId]);

  useEffect(() => {
    if (scheduleEditorMode === "create") return;
    if (selectedSchedule) {
      setScheduleForm(makeScheduleForm(selectedSchedule, selectedZoneId || zones[0]?.id || ""));
    }
  }, [scheduleEditorMode, selectedSchedule, selectedZoneId, zones]);

  useEffect(() => {
    if (deviceEditorMode === "create") return;
    if (!devices.length) {
      setSelectedDeviceId(null);
      return;
    }

    if (!selectedDeviceId || !devices.some((device) => device.id === selectedDeviceId)) {
      setSelectedDeviceId(devices[0].id);
    }
  }, [deviceEditorMode, devices, selectedDeviceId]);

  useEffect(() => {
    if (deviceEditorMode === "create") return;
    if (selectedDevice) {
      setDeviceForm(makeDeviceForm(selectedDevice));
    }
  }, [deviceEditorMode, selectedDevice]);

  useEffect(() => {
    if (userEditorMode === "create") return;
    if (!users.length) {
      setSelectedUserId(null);
      return;
    }

    if (!selectedUserId || !users.some((user) => user.id === selectedUserId)) {
      setSelectedUserId(users[0].id);
    }
  }, [selectedUserId, userEditorMode, users]);

  useEffect(() => {
    if (userEditorMode === "create") return;
    if (selectedUser) {
      setUserForm(makeUserForm(selectedUser));
    }
  }, [selectedUser, userEditorMode]);

  useEffect(() => {
    const ack = normalizeCommandAck(lastMessage);
    if (!ack) return;

    setLastCommandAck(ack);
    setCommandStatus({
      tone: ack.response_code === "ACK" ? "healthy" : "critical",
      text: `${ack.command || "Command"} ${ack.response_code || "response"}`,
    });
    setCommandHistory((current) => {
      const updated = current.map((item) =>
        item.command_id === ack.command_id
          ? {
              ...item,
              status: ack.response_code === "ACK" ? "acked" : "nacked",
              response: {
                received_at: ack.received_at,
                response_code: ack.response_code,
                reason_code: ack.reason_code,
              },
            }
          : item
      );

      return updated.some((item) => item.command_id === ack.command_id)
        ? updated
        : [
            {
              command_id: ack.command_id,
              streetlight_id: ack.streetlight_id,
              command: ack.command,
              params: {},
              status: ack.response_code === "ACK" ? "acked" : "nacked",
              dispatched_at: ack.received_at,
              response: {
                received_at: ack.received_at,
                response_code: ack.response_code,
                reason_code: ack.reason_code,
              },
            },
            ...current,
          ];
    });
  }, [lastMessage]);

  useEffect(() => {
    const id = String(selectedCommandStreetlightId || "").trim();
    if (!id) {
      setCommandHistory([]);
      return;
    }

    let isCurrent = true;
    getStreetlightCommandHistory(id)
      .then((history) => {
        if (!isCurrent) return;
        setCommandHistory(Array.isArray(history?.commands) ? history.commands : []);
      })
      .catch((error) => {
        if (!isCurrent) return;
        setCommandStatus({
          tone: "warning",
          text: error?.message || "Command history unavailable.",
        });
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedCommandStreetlightId]);

  function patchAdminState(updater) {
    setAdminState((current) => {
      if (!current) return current;
      return updater(current);
    });
  }

  function assignPolesToZone(poleIds, nextZoneId) {
    const ids = dedupe(poleIds);
    if (!ids.length) return;

    patchAdminState((current) => ({
      ...current,
      zones: current.zones.map((zone) => {
        const remaining = zone.assignedPoleIds.filter((poleId) => !ids.includes(poleId));
        if (zone.id !== nextZoneId) {
          return {
            ...zone,
            assignedPoleIds: remaining,
          };
        }

        return {
          ...zone,
          assignedPoleIds: dedupe([...remaining, ...ids]),
        };
      }),
    }));
  }

  function openConfirmation(nextState) {
    setConfirmState(nextState);
  }

  function beginNewZone() {
    setZoneEditorMode("create");
    setZoneForm(makeZoneForm());
    setSelectedZoneId(null);
    setZoneStatus(null);
    setIsDrawingZone(true);
  }

  function beginNewSchedule() {
    setScheduleEditorMode("create");
    setScheduleForm(makeScheduleForm(null, selectedZoneId || zones[0]?.id || ""));
    setSelectedScheduleId(null);
    setScheduleStatus(null);
  }

  function beginNewDevice() {
    setDeviceEditorMode("create");
    setDeviceForm(makeDeviceForm(null, selectedPoleId || poles[0]?.streetlight_id || ""));
    setSelectedDeviceId(null);
    setDeviceStatus(null);
  }

  function beginNewUser() {
    setUserEditorMode("create");
    setUserForm(makeUserForm());
    setSelectedUserId(null);
    setUserStatus(null);
  }

  function handleZonePointAdd(point) {
    setZoneForm((current) => ({
      ...current,
      polygon: [...current.polygon, point],
    }));
  }

  function handlePoleMapClick(pole) {
    if (bulkMapMode) {
      setSelectedPoleIds((current) =>
        current.includes(pole.streetlight_id)
          ? current.filter((id) => id !== pole.streetlight_id)
          : [...current, pole.streetlight_id]
      );
      return;
    }

    setSelectedPoleId(pole.streetlight_id);
    setPoleStatus(null);
  }

  function handleZoneSave() {
    if (Object.keys(zoneErrors).length) {
      setZoneStatus({ tone: "critical", text: "Fix the highlighted issues before saving the zone." });
      return;
    }

    const nextZone = {
      id: zoneEditorMode === "edit" && selectedZone ? selectedZone.id : makeId("zone"),
      name: zoneForm.name.trim(),
      description: zoneForm.description.trim(),
      motionSensitivity: clamp(Number(zoneForm.motionSensitivity) || 55, 0, 100),
      polygon: zoneForm.polygon.map(normalizePoint).filter(Boolean),
      assignedPoleIds: zoneEditorMode === "edit" && selectedZone ? selectedZone.assignedPoleIds : [],
    };

    patchAdminState((current) => ({
      ...current,
      zones:
        zoneEditorMode === "edit" && selectedZone
          ? current.zones.map((zone) => (zone.id === selectedZone.id ? nextZone : zone))
          : [nextZone, ...current.zones],
    }));

    setZoneEditorMode("edit");
    setSelectedZoneId(nextZone.id);
    setZoneStatus({
      tone: "healthy",
      text: zoneEditorMode === "edit" ? "Zone updated." : "Zone created.",
    });
    setIsDrawingZone(false);
  }

  function handlePoleSave() {
    if (!selectedPoleId) {
      setPoleStatus({ tone: "critical", text: "Select a pole to edit." });
      return;
    }

    if (Object.keys(poleErrors).length) {
      setPoleStatus({ tone: "critical", text: "Fix the pole form validation errors before saving." });
      return;
    }

    const patch = {
      name: poleForm.name.trim(),
      lat: poleForm.lat.trim() ? Number(poleForm.lat) : null,
      lng: poleForm.lng.trim() ? Number(poleForm.lng) : null,
    };

    upsertPoleMeta(selectedPoleId, patch);
    applyStreetlightLocalPatch(selectedPoleId, patch);
    assignPolesToZone([selectedPoleId], poleForm.zoneId || null);
    setMetaMap(loadPoleMetaMap());

    updateStreetlightMetadata(selectedPoleId, patch)
      .then(() => {
        setPoleStatus({ tone: "healthy", text: "Pole details saved." });
      })
      .catch(() => {
        setPoleStatus({
          tone: "warning",
          text: "Pole details saved locally. Server sync failed.",
        });
      });
  }

  function handleBulkZoneAssign() {
    if (!selectedPoleIds.length) {
      setPoleStatus({ tone: "critical", text: "Select one or more poles on the map first." });
      return;
    }

    assignPolesToZone(selectedPoleIds, bulkZoneId || null);
    setPoleStatus({
      tone: "healthy",
      text: bulkZoneId
        ? `Assigned ${selectedPoleIds.length} pole${selectedPoleIds.length === 1 ? "" : "s"} to ${
            zoneLookup[bulkZoneId]?.name || "the selected zone"
          }.`
        : `Removed zone assignments from ${selectedPoleIds.length} selected pole${
            selectedPoleIds.length === 1 ? "" : "s"
          }.`,
    });
  }

  function handleScheduleSave() {
    if (Object.keys(scheduleErrors).length) {
      setScheduleStatus({ tone: "critical", text: "Resolve the schedule validation issues before saving." });
      return;
    }

    const nextSchedule = {
      id: scheduleEditorMode === "edit" && selectedSchedule ? selectedSchedule.id : makeId("schedule"),
      name: scheduleForm.name.trim(),
      zoneId: scheduleForm.zoneId,
      startMinute: Number(scheduleForm.startMinute),
      endMinute: Number(scheduleForm.endMinute),
      dimLevel: clamp(Number(scheduleForm.dimLevel) || 60, 10, 100),
      days: dedupe(scheduleForm.days).sort((a, b) => a - b),
    };

    patchAdminState((current) => ({
      ...current,
      schedules:
        scheduleEditorMode === "edit" && selectedSchedule
          ? current.schedules.map((schedule) =>
              schedule.id === selectedSchedule.id ? nextSchedule : schedule
            )
          : [nextSchedule, ...current.schedules],
    }));

    setScheduleEditorMode("edit");
    setSelectedScheduleId(nextSchedule.id);
    setScheduleStatus({
      tone: "healthy",
      text: scheduleEditorMode === "edit" ? "Schedule updated." : "Schedule created.",
    });
  }

  function handleDeviceSave() {
    if (Object.keys(deviceErrors).length) {
      setDeviceStatus({ tone: "critical", text: "Complete the required LoRaWAN device fields." });
      return;
    }

    const nextDevice = {
      id: deviceEditorMode === "edit" && selectedDevice ? selectedDevice.id : makeId("device"),
      label: deviceForm.label.trim(),
      devEui: normalizeDevEui(deviceForm.devEui),
      poleId: deviceForm.poleId,
      gateway: deviceForm.gateway.trim() || "GW-01",
      signalRssi: clamp(Number(deviceForm.signalRssi) || -95, -120, -60),
      lastUplink:
        deviceEditorMode === "edit" && selectedDevice
          ? selectedDevice.lastUplink
          : new Date().toISOString(),
    };

    patchAdminState((current) => ({
      ...current,
      devices:
        deviceEditorMode === "edit" && selectedDevice
          ? current.devices.map((device) => (device.id === selectedDevice.id ? nextDevice : device))
          : [nextDevice, ...current.devices],
    }));

    setDeviceEditorMode("edit");
    setSelectedDeviceId(nextDevice.id);
    setDeviceStatus({
      tone: "healthy",
      text: deviceEditorMode === "edit" ? "LoRaWAN device updated." : "LoRaWAN device registered.",
    });
  }

  async function handleUserSave() {
    if (Object.keys(userErrors).length) {
      setUserStatus({ tone: "critical", text: "Complete the required user fields." });
      return;
    }

    const nextUser = {
      id: userEditorMode === "edit" && selectedUser ? selectedUser.id : makeId("user"),
      user_id: userEditorMode === "edit" && selectedUser ? selectedUser.user_id || "" : "",
      name: userForm.name.trim(),
      email: userForm.email.trim(),
      role: userForm.role,
      created_at: userEditorMode === "edit" && selectedUser ? selectedUser.created_at || "" : "",
    };

    setUserSaving(true);

    try {
      let savedLocally = false;
      let savedUser = nextUser;

      if (userEditorMode === "create") {
        try {
          savedUser = await inviteUser(nextUser);
        } catch (error) {
          if (!isInviteEndpointUnavailable(error)) {
            throw error;
          }
          savedLocally = true;
          savedUser = nextUser;
        }
      }

      const mergedUser = {
        ...savedUser,
        id: savedUser.id || savedUser.user_id || nextUser.id,
        user_id: savedUser.user_id || nextUser.user_id || "",
        name: savedUser.name || nextUser.name,
        email: savedUser.email || nextUser.email,
        role: savedUser.role || nextUser.role,
        created_at: savedUser.created_at || nextUser.created_at || "",
      };

      patchAdminState((current) => ({
        ...current,
        users:
          userEditorMode === "edit" && selectedUser
            ? current.users.map((user) => (user.id === selectedUser.id ? mergedUser : user))
            : [mergedUser, ...current.users],
      }));

      if (userEditorMode === "create" && !savedLocally) {
        setRemoteUsers((current) => [mergedUser, ...(Array.isArray(current) ? current : [])]);
      }

      setUserEditorMode("edit");
      setSelectedUserId(mergedUser.id);
      setUserStatus({
        tone: savedLocally ? "warning" : "healthy",
        text:
          userEditorMode === "edit"
            ? "User updated locally."
            : savedLocally
            ? "User added locally. Cognito invite service unavailable."
            : "Cognito invite sent.",
      });
    } catch (error) {
      setUserStatus({
        tone: "critical",
        text: error?.message || "User save failed.",
      });
    } finally {
      setUserSaving(false);
    }
  }

  async function handleUserRemove(user) {
    if (!user?.id) return;

    setUserSaving(true);
    try {
      const localOnly = isLocalOnlyUser(user);
      if (!localOnly) {
        await removeUser(user.user_id || user.id);
      }

      patchAdminState((current) => ({
        ...current,
        users: current.users.filter((item) => item.id !== user.id),
      }));
      setRemoteUsers((current) =>
        Array.isArray(current)
          ? current.filter((item) => item.id !== user.id && item.user_id !== user.user_id)
          : current
      );
      setSelectedUserId(null);
      setUserStatus({
        tone: "healthy",
        text: localOnly ? "User removed locally." : "User removed from Cognito.",
      });
    } catch (error) {
      setUserStatus({
        tone: "critical",
        text: error?.message || "User removal failed.",
      });
    } finally {
      setUserSaving(false);
    }
  }

  async function handleDownlinkSubscribe(streetlightId) {
    const id = String(streetlightId || "").trim();
    if (!id) return false;
    return Boolean(subscribe?.(id));
  }

  async function handleDownlinkSend(streetlightId, envelope) {
    const id = String(streetlightId || "").trim();
    if (!id) {
      setCommandStatus({ tone: "critical", text: "Select a streetlight." });
      return false;
    }

    setCommandSending(true);
    setCommandStatus({ tone: "neutral", text: "Dispatching command..." });
    try {
      if (wsStatus === "connected") {
        subscribe?.(id);
      }

      const command = await sendStreetlightCommand(id, envelope);
      const nextCommand = {
        ...command,
        streetlight_id: command.streetlight_id || id,
        params: command.params || envelope.params || {},
        dispatched_at: command.dispatched_at || new Date().toISOString(),
      };
      setCommandHistory((current) => [nextCommand, ...current.filter((item) => item.command_id !== nextCommand.command_id)]);
      setCommandStatus({
        tone: "healthy",
        text: `${nextCommand.command} accepted.`,
      });
      return true;
    } catch (error) {
      setCommandStatus({
        tone: "critical",
        text: error?.message || "Downlink dispatch failed.",
      });
      return false;
    } finally {
      setCommandSending(false);
    }
  }

  if (!adminState) {
    return (
      <Layout>
        <div className="lwAdminWorkspace">
          <div className="lwAdminLoadingCard">Loading admin configuration surface...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {() => (
        <div className="lwAdminWorkspace">
          <div className="lwAdminPageHeader">
            <div>
              <h1 className="lwAdminPageTitle">Admin</h1>
              <p className="lwAdminPageSubtitle">{sectionMeta.description}</p>
            </div>
          </div>

          <div className="lwAdminStatGrid">
            {stats.map((stat) => (
              <div key={stat.label} className="lwAdminStatCard">
                <div className="lwAdminStatLabel">{stat.label}</div>
                <div className="lwAdminStatValue">{stat.value}</div>
                <div className="lwAdminStatNote">{stat.note}</div>
              </div>
            ))}
          </div>

          <div className="lwAdminShell">
            <SectionNav
              activeSection={activeSection}
              onChange={(nextSection) => {
                startTransition(() => setActiveSection(nextSection));
              }}
            />

            <div className="lwAdminSectionBody">
              {activeSection === "zones" ? (
                <div className="lwAdminSectionGrid">
                  <SectionCard
                    icon="map"
                    title="Zone Management"
                    subtitle="Draw district boundaries directly on the planning map."
                    actions={
                      <div className="lwAdminButtonRow">
                        <button type="button" className="lwAdminSecondaryBtn" onClick={beginNewZone}>
                          New Zone
                        </button>
                        <button
                          type="button"
                          className={`lwAdminSecondaryBtn${isDrawingZone ? " isActive" : ""}`}
                          onClick={() => setIsDrawingZone((current) => !current)}
                        >
                          {isDrawingZone ? "Stop Drawing" : "Draw Boundary"}
                        </button>
                      </div>
                    }
                  >
                    <AdminMapSurface
                      poles={previewPoles}
                      zones={editableZones}
                      selectedZoneId={selectedZoneId}
                      selectedPoleId={selectedPoleId}
                      selectedPoleIds={selectedPoleIds}
                      previewPoint={livePreviewPoint}
                      draftPolygon={zoneEditorMode === "create" ? zoneForm.polygon : []}
                      drawingEnabled={isDrawingZone}
                      onAddPoint={handleZonePointAdd}
                      onPoleClick={(pole) => setSelectedPoleId(pole.streetlight_id)}
                    />

                    <div className="lwAdminButtonRow">
                      <button
                        type="button"
                        className="lwAdminGhostBtn"
                        onClick={() =>
                          setZoneForm((current) => ({
                            ...current,
                            polygon: current.polygon.slice(0, -1),
                          }))
                        }
                        disabled={!zoneForm.polygon.length}
                      >
                        Undo Point
                      </button>
                      <button
                        type="button"
                        className="lwAdminGhostBtn"
                        onClick={() =>
                          openConfirmation({
                            title: "Clear boundary draft?",
                            message:
                              "This removes the current polygon from the editor but does not delete any saved zone until you confirm a delete action.",
                            confirmLabel: "Clear boundary",
                            tone: "warning",
                            onConfirm: () =>
                              setZoneForm((current) => ({
                                ...current,
                                polygon: [],
                              })),
                          })
                        }
                        disabled={!zoneForm.polygon.length}
                      >
                        Clear Boundary
                      </button>
                    </div>
                  </SectionCard>

                  <div className="lwAdminStack">
                    <SectionCard
                      icon="settings"
                      title={zoneEditorMode === "create" ? "Create Zone" : "Edit Zone"}
                      subtitle="Boundary points and motion sensitivity save together."
                    >
                      <div className="lwAdminRecordList">
                        {zones.map((zone) => (
                          <button
                            key={zone.id}
                            type="button"
                            className={`lwAdminRecordItem${
                              zone.id === selectedZoneId && zoneEditorMode !== "create" ? " isSelected" : ""
                            }`}
                            onClick={() => {
                              setZoneEditorMode("edit");
                              setSelectedZoneId(zone.id);
                              setIsDrawingZone(false);
                              setZoneStatus(null);
                            }}
                          >
                            <div>
                              <strong>{zone.name}</strong>
                              <span>{zone.assignedPoleIds.length} poles assigned</span>
                            </div>
                            <StatusChip tone="neutral">
                              {describeSensitivity(zone.motionSensitivity).label}
                            </StatusChip>
                          </button>
                        ))}
                      </div>
 
                      <div className="lwAdminFormGrid">
                        <label className="lwAdminField">
                          <span className="lwAdminLabel">Zone name</span>
                          <input
                            className="lwAdminInput"
                            value={zoneForm.name}
                            onChange={(event) =>
                              setZoneForm((current) => ({ ...current, name: event.target.value }))
                            }
                            placeholder="Zone name"
                          />
                          <FieldMessage error={zoneErrors.name} />
                        </label>

                        <label className="lwAdminField lwAdminFieldFull">
                          <span className="lwAdminLabel">Description</span>
                          <textarea
                            className="lwAdminTextarea"
                            value={zoneForm.description}
                            onChange={(event) =>
                              setZoneForm((current) => ({
                                ...current,
                                description: event.target.value,
                              }))
                            }
                            placeholder="Describe the lighting and pedestrian behavior in this zone."
                            rows={3}
                          />
                        </label>

                        <label className="lwAdminField lwAdminFieldFull">
                          <span className="lwAdminLabel">Boundary status</span>
                          <div className="lwAdminInlineSurface">
                            <strong>{zoneForm.polygon.length} points placed</strong>
                            <span>
                              {zoneForm.polygon.length >= 3
                                ? "Boundary is ready to save."
                                : "Add at least three map points."}
                            </span>
                          </div>
                          <FieldMessage error={zoneErrors.polygon} />
                        </label>

                        <div className="lwAdminField lwAdminFieldFull">
                          <span className="lwAdminLabel">Boundary points</span>
                          <div className="lwAdminPointList">
                            {zoneForm.polygon.length ? (
                              zoneForm.polygon.map((point, index) => (
                                <div key={`${point.lat}-${point.lng}-${index}`} className="lwAdminPointRow">
                                  <strong>P{index + 1}</strong>
                                  <span>
                                    {point.lat}, {point.lng}
                                  </span>
                                  <button
                                    type="button"
                                    className="lwAdminGhostBtn"
                                    onClick={() =>
                                      setZoneForm((current) => ({
                                        ...current,
                                        polygon: current.polygon.filter((_, pointIndex) => pointIndex !== index),
                                      }))
                                    }
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))
                            ) : (
                              <div className="lwAdminInlineSurface">
                                <strong>No points yet</strong>
                                <span>Turn on boundary drawing and click the map to place points.</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="lwAdminButtonRow">
                        <button type="button" className="lwAdminPrimaryBtn" onClick={handleZoneSave}>
                          {zoneEditorMode === "create" ? "Create Zone" : "Save Zone"}
                        </button>
                        <button
                          type="button"
                          className="lwAdminSecondaryBtn"
                          onClick={() => {
                            setZoneEditorMode("edit");
                            setZoneStatus(null);
                            if (selectedZone) {
                              setZoneForm(makeZoneForm(selectedZone));
                            } else {
                              setZoneForm(makeZoneForm());
                            }
                            setIsDrawingZone(false);
                          }}
                        >
                          Discard Changes
                        </button>
                        {selectedZone ? (
                          <button
                            type="button"
                            className="lwAdminGhostBtn isDanger"
                            onClick={() =>
                              openConfirmation({
                                title: `Delete ${selectedZone.name}?`,
                                message: `This removes the zone, unassigns ${
                                  selectedZone.assignedPoleIds.length
                                } pole${selectedZone.assignedPoleIds.length === 1 ? "" : "s"}, and deletes ${
                                  schedules.filter((schedule) => schedule.zoneId === selectedZone.id).length
                                } linked schedule(s).`,
                                confirmLabel: "Delete zone",
                                tone: "danger",
                                onConfirm: () => {
                                  patchAdminState((current) => ({
                                    ...current,
                                    zones: current.zones.filter((zone) => zone.id !== selectedZone.id),
                                    schedules: current.schedules.filter(
                                      (schedule) => schedule.zoneId !== selectedZone.id
                                    ),
                                  }));
                                  setZoneEditorMode("edit");
                                  setSelectedZoneId(null);
                                  setZoneStatus({ tone: "healthy", text: "Zone deleted." });
                                },
                              })
                            }
                          >
                            Delete Zone
                          </button>
                        ) : null}
                      </div>

                      {zoneStatus ? <StatusChip tone={zoneStatus.tone}>{zoneStatus.text}</StatusChip> : null}
                    </SectionCard>

                    <SectionCard
                      icon="spark"
                      title="Motion Sensitivity"
                      subtitle="Plain-English tuning for each zone."
                    >
                      <div className="lwAdminSliderList">
                        {zones.map((zone) => {
                          const descriptor = describeSensitivity(zone.motionSensitivity);
                          return (
                            <div key={zone.id} className="lwAdminSliderRow">
                              <div className="lwAdminSliderMeta">
                                <strong>{zone.name}</strong>
                                <span>{descriptor.note}</span>
                              </div>
                              <div className="lwAdminSliderControl">
                                <div className="lwAdminSliderValue">{descriptor.label}</div>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={zone.motionSensitivity}
                                  onChange={(event) => {
                                    const nextValue = Number(event.target.value);
                                    patchAdminState((current) => ({
                                      ...current,
                                      zones: current.zones.map((item) =>
                                        item.id === zone.id
                                          ? { ...item, motionSensitivity: nextValue }
                                          : item
                                      ),
                                    }));
                                    if (zone.id === selectedZoneId && zoneEditorMode !== "create") {
                                      setZoneForm((current) => ({
                                        ...current,
                                        motionSensitivity: nextValue,
                                      }));
                                    }
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </SectionCard>
                  </div>
                </div>
              ) : null}

              {activeSection === "poles" ? (
                <div className="lwAdminSectionGrid">
                  <SectionCard
                    icon="pin"
                    title="Pole Management"
                    subtitle="Select individual poles or switch into bulk selection mode."
                    actions={
                      <div className="lwAdminButtonRow">
                        <button
                          type="button"
                          className={`lwAdminSecondaryBtn${bulkMapMode ? " isActive" : ""}`}
                          onClick={() => setBulkMapMode((current) => !current)}
                        >
                          {bulkMapMode ? "Single Select" : "Bulk Select"}
                        </button>
                        <button
                          type="button"
                          className="lwAdminGhostBtn"
                          onClick={() => setSelectedPoleIds([])}
                          disabled={!selectedPoleIds.length}
                        >
                          Clear Selection
                        </button>
                      </div>
                    }
                  >
                    <AdminMapSurface
                      poles={poles}
                      zones={editableZones}
                      selectedZoneId={selectedZoneId}
                      selectedPoleId={selectedPoleId}
                      selectedPoleIds={selectedPoleIds}
                      previewPoint={livePreviewPoint}
                      bulkMode={bulkMapMode}
                      onPoleClick={handlePoleMapClick}
                    />

                    <div className="lwAdminBulkRow">
                      <div className="lwAdminInlineSurface">
                        <strong>{selectedPoleIds.length} pole(s) selected</strong>
                        <span>
                          {bulkMapMode
                            ? "Use the selector below to bulk assign the highlighted poles."
                            : "Switch to bulk select to assign a zone from the map."}
                        </span>
                      </div>

                      <div className="lwAdminBulkActions">
                        <select
                          className="lwAdminSelect"
                          value={bulkZoneId}
                          onChange={(event) => setBulkZoneId(event.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {zones.map((zone) => (
                            <option key={zone.id} value={zone.id}>
                              {zone.name}
                            </option>
                          ))}
                        </select>
                        <button type="button" className="lwAdminPrimaryBtn" onClick={handleBulkZoneAssign}>
                          Apply to Selected
                        </button>
                      </div>
                    </div>
                  </SectionCard>

                  <div className="lwAdminStack">
                    <SectionCard
                      icon="settings"
                      title="Edit Pole"
                      subtitle="Click any row or marker to load it into the editor."
                    >
                      <div className="lwAdminFormGrid">
                        <label className="lwAdminField">
                          <span className="lwAdminLabel">Display name</span>
                          <input
                            className="lwAdminInput"
                            value={poleForm.name}
                            onChange={(event) =>
                              setPoleForm((current) => ({ ...current, name: event.target.value }))
                            }
                            placeholder="Civic Plaza / 5th Ave"
                          />
                          <FieldMessage error={poleErrors.name} />
                        </label>

                        <label className="lwAdminField">
                          <span className="lwAdminLabel">Zone</span>
                          <select
                            className="lwAdminSelect"
                            value={poleForm.zoneId}
                            onChange={(event) =>
                              setPoleForm((current) => ({ ...current, zoneId: event.target.value }))
                            }
                          >
                            <option value="">Unassigned</option>
                            {zones.map((zone) => (
                              <option key={zone.id} value={zone.id}>
                                {zone.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="lwAdminField">
                          <span className="lwAdminLabel">Latitude</span>
                          <input
                            className="lwAdminInput"
                            value={poleForm.lat}
                            onChange={(event) =>
                              setPoleForm((current) => ({ ...current, lat: event.target.value }))
                            }
                            placeholder="47.6101"
                          />
                          <FieldMessage error={poleErrors.lat} hint="Valid range: -90 to 90" />
                        </label>

                        <label className="lwAdminField">
                          <span className="lwAdminLabel">Longitude</span>
                          <input
                            className="lwAdminInput"
                            value={poleForm.lng}
                            onChange={(event) =>
                              setPoleForm((current) => ({ ...current, lng: event.target.value }))
                            }
                            placeholder="-122.2015"
                          />
                          <FieldMessage error={poleErrors.lng} hint="Valid range: -180 to 180" />
                        </label>

                        <div className="lwAdminField lwAdminFieldFull">
                          <div className="lwAdminInlineSurface">
                            <strong>{selectedPole?.streetlight_id || "No pole selected"}</strong>
                            <span>Last seen {formatTimestamp(selectedPole?.last_seen, "not available")}</span>
                          </div>
                        </div>
                      </div>

                      <div className="lwAdminButtonRow">
                        <button type="button" className="lwAdminPrimaryBtn" onClick={handlePoleSave}>
                          Save Pole
                        </button>
                      </div>

                      {poleStatus ? <StatusChip tone={poleStatus.tone}>{poleStatus.text}</StatusChip> : null}
                    </SectionCard>

                    <SectionCard
                      icon="analytics"
                      title="Pole Table"
                      subtitle="Search by pole ID, name, zone, or health. Click a row to edit."
                    >
                      <label className="lwAdminField">
                        <span className="lwAdminLabel">Search</span>
                        <input
                          className="lwAdminInput"
                          value={poleSearch}
                          onChange={(event) => setPoleSearch(event.target.value)}
                          placeholder="Search poles"
                        />
                      </label>

                      <div className="lwAdminTableWrap">
                        <table className="lwAdminTable">
                          <thead>
                            <tr>
                              <th>Pole</th>
                              <th>Zone</th>
                              <th>Health</th>
                              <th>Coordinates</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredPoles.length ? (
                              filteredPoles.map((pole) => {
                                const zone = zoneLookup[poleZoneMap[pole.streetlight_id]];
                                return (
                                  <tr
                                    key={pole.streetlight_id}
                                    className={pole.streetlight_id === selectedPoleId ? "isSelected" : ""}
                                    onClick={() => {
                                      setSelectedPoleId(pole.streetlight_id);
                                      setBulkMapMode(false);
                                    }}
                                  >
                                    <td>
                                      <strong>{pole.streetlight_id}</strong>
                                      <span>{pole.name || "Unnamed pole"}</span>
                                    </td>
                                    <td>{zone?.name || "Unassigned"}</td>
                                    <td>
                                      <StatusChip tone={toneForHealth(pole.health)}>
                                        {pole.health || "Unknown"}
                                      </StatusChip>
                                    </td>
                                    <td>
                                      {isValidCoord(pole.lat) && isValidCoord(pole.lng)
                                        ? `${pole.lat}, ${pole.lng}`
                                        : "Needs coordinates"}
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan="4" className="lwAdminTableEmpty">
                                  No poles match the current search.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </SectionCard>
                  </div>
                </div>
              ) : null}
 
              {activeSection === "schedules" ? (
                <div className="lwAdminSectionGrid lwAdminSectionGridCompact">
                  <SectionCard
                    icon="chart"
                    title="Visual Schedule Editor"
                    subtitle="Drag the timeline to shape each zone's runtime window."
                    actions={
                      <button type="button" className="lwAdminSecondaryBtn" onClick={beginNewSchedule}>
                        New Schedule
                      </button>
                    }
                  >
                    <div className="lwAdminRecordList">
                      {schedules.map((schedule) => (
                        <button
                          key={schedule.id}
                          type="button"
                          className={`lwAdminRecordItem${
                            schedule.id === selectedScheduleId && scheduleEditorMode !== "create"
                              ? " isSelected"
                              : ""
                          }`}
                          onClick={() => {
                            setScheduleEditorMode("edit");
                            setSelectedScheduleId(schedule.id);
                            setScheduleStatus(null);
                          }}
                        >
                          <div>
                            <strong>{schedule.name}</strong>
                            <span>
                              {zoneLookup[schedule.zoneId]?.name || "Unassigned zone"} ·{" "}
                              {formatMinutes(schedule.startMinute)} to {formatMinutes(schedule.endMinute)}
                            </span>
                          </div>
                          <StatusChip tone="healthy">{schedule.dimLevel}%</StatusChip>
                        </button>
                      ))}
                    </div>
                  </SectionCard>

                  <SectionCard
                    icon="settings"
                    title={scheduleEditorMode === "create" ? "Create Schedule" : "Edit Schedule"}
                    subtitle="Use the timeline and day pills instead of manual timestamps."
                  >
                    <div className="lwAdminFormGrid">
                      <label className="lwAdminField">
                        <span className="lwAdminLabel">Schedule name</span>
                        <input
                          className="lwAdminInput"
                          value={scheduleForm.name}
                          onChange={(event) =>
                            setScheduleForm((current) => ({ ...current, name: event.target.value }))
                          }
                          placeholder="Downtown evening ramp"
                        />
                        <FieldMessage error={scheduleErrors.name} />
                      </label>

                      <label className="lwAdminField">
                        <span className="lwAdminLabel">Zone</span>
                        <select
                          className="lwAdminSelect"
                          value={scheduleForm.zoneId}
                          onChange={(event) =>
                            setScheduleForm((current) => ({ ...current, zoneId: event.target.value }))
                          }
                        >
                          <option value="">Select a zone</option>
                          {zones.map((zone) => (
                            <option key={zone.id} value={zone.id}>
                              {zone.name}
                            </option>
                          ))}
                        </select>
                        <FieldMessage error={scheduleErrors.zoneId} />
                      </label>
                    </div>

                    <div className="lwAdminInlineSurface lwAdminScheduleHint">
                      <strong>Each saved schedule is one time block.</strong>
                      <span>
                        Save multiple rows if a zone needs separate daytime, evening, and overnight windows.
                      </span>
                    </div>

                    <div className="lwAdminFormGrid">
                      <label className="lwAdminField">
                        <span className="lwAdminLabel">Start time</span>
                        <select
                          className="lwAdminSelect"
                          value={scheduleForm.startMinute}
                          onChange={(event) => {
                            const nextStart = Number(event.target.value);
                            setScheduleForm((current) => ({
                              ...current,
                              startMinute: nextStart,
                              endMinute: Math.max(nextStart + 15, Number(current.endMinute)),
                            }));
                          }}
                        >
                          {TIME_OPTIONS.filter((option) => option.value < Number(scheduleForm.endMinute)).map((option) => (
                            <option key={`start-${option.value}`} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="lwAdminField">
                        <span className="lwAdminLabel">End time</span>
                        <select
                          className="lwAdminSelect"
                          value={scheduleForm.endMinute}
                          onChange={(event) =>
                            setScheduleForm((current) => ({
                              ...current,
                              endMinute: Number(event.target.value),
                            }))
                          }
                        >
                          {TIME_OPTIONS.filter((option) => option.value > Number(scheduleForm.startMinute)).map((option) => (
                            <option key={`end-${option.value}`} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <TimelineEditor
                      scheduleForm={scheduleForm}
                      onChange={setScheduleForm}
                      timelineError={scheduleErrors.timeline}
                    />

                    <label className="lwAdminField">
                      <span className="lwAdminLabel">Brightness target</span>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        value={scheduleForm.dimLevel}
                        onChange={(event) =>
                          setScheduleForm((current) => ({
                            ...current,
                            dimLevel: Number(event.target.value),
                          }))
                        }
                      />
                      <FieldMessage hint={`Target brightness: ${scheduleForm.dimLevel}%`} />
                    </label>

                    <div className="lwAdminField">
                      <span className="lwAdminLabel">Active days</span>
                      <div className="lwAdminPillRow">
                        {DAY_OPTIONS.map((day, dayIndex) => {
                          const active = scheduleForm.days.includes(dayIndex);
                          return (
                            <button
                              key={day}
                              type="button"
                              className={`lwAdminDayPill${active ? " isActive" : ""}`}
                              onClick={() =>
                                setScheduleForm((current) => ({
                                  ...current,
                                  days: active
                                    ? current.days.filter((value) => value !== dayIndex)
                                    : [...current.days, dayIndex].sort((a, b) => a - b),
                                }))
                              }
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                      <FieldMessage error={scheduleErrors.days} />
                    </div>

                    <div className="lwAdminButtonRow">
                      <button type="button" className="lwAdminPrimaryBtn" onClick={handleScheduleSave}>
                        {scheduleEditorMode === "create" ? "Create Schedule" : "Save Schedule"}
                      </button>
                      {selectedSchedule ? (
                        <button
                          type="button"
                          className="lwAdminGhostBtn isDanger"
                          onClick={() =>
                            openConfirmation({
                              title: `Delete ${selectedSchedule.name}?`,
                              message:
                                "This removes the schedule from the active zone and cannot be undone from the local planner.",
                              confirmLabel: "Delete schedule",
                              tone: "danger",
                              onConfirm: () => {
                                patchAdminState((current) => ({
                                  ...current,
                                  schedules: current.schedules.filter(
                                    (schedule) => schedule.id !== selectedSchedule.id
                                  ),
                                }));
                                setSelectedScheduleId(null);
                                setScheduleStatus({ tone: "healthy", text: "Schedule deleted." });
                              },
                            })
                          }
                        >
                          Delete Schedule
                        </button>
                      ) : null}
                    </div>

                    {scheduleStatus ? <StatusChip tone={scheduleStatus.tone}>{scheduleStatus.text}</StatusChip> : null}
                  </SectionCard>
                </div>
              ) : null}

              {activeSection === "lorawan" ? (
                <div className="lwAdminSectionGrid lwAdminSectionGridCompact">
                  <div className="lwAdminDownlinkCard">
                    <SectionCard
                      icon="bolt"
                      title="Downlink Control"
                      subtitle="Dispatch LoRaWAN commands and watch command ACKs on the active WebSocket."
                    >
                      <AdminWsControls
                        wsStatus={wsStatus}
                        streetlights={poles}
                        selectedStreetlightId={selectedCommandStreetlightId}
                        commandHistory={commandHistory}
                        commandStatus={commandStatus}
                        isSending={commandSending}
                        lastAck={lastCommandAck}
                        onSubscribe={handleDownlinkSubscribe}
                        onSendCommand={handleDownlinkSend}
                      />
                    </SectionCard>
                  </div>

                  <SectionCard
                    icon="radio"
                    title="LoRaWAN Device Management"
                    subtitle="Track registration, pole assignment, uplink recency, and signal strength."
                    actions={
                      <button type="button" className="lwAdminSecondaryBtn" onClick={beginNewDevice}>
                        Register Device
                      </button>
                    }
                  >
                    <div className="lwAdminTableWrap">
                      <table className="lwAdminTable">
                        <thead>
                          <tr>
                            <th>Device</th>
                            <th>Pole</th>
                            <th>Last uplink</th>
                            <th>Signal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {devices.length ? (
                            devices.map((device) => {
                              const signal = describeSignal(device.signalRssi);
                              return (
                                <tr
                                  key={device.id}
                                  className={device.id === selectedDeviceId ? "isSelected" : ""}
                                  onClick={() => {
                                    setDeviceEditorMode("edit");
                                    setSelectedDeviceId(device.id);
                                    setDeviceStatus(null);
                                  }}
                                >
                                  <td>
                                    <strong>{device.label}</strong>
                                    <span>{formatDevEui(device.devEui)}</span>
                                  </td>
                                  <td>{device.poleId || "Unassigned"}</td>
                                  <td>{formatTimestamp(device.lastUplink, "Never seen")}</td>
                                  <td>
                                    <StatusChip tone={signal.tone}>
                                      {signal.label} ({device.signalRssi} dBm)
                                    </StatusChip>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan="4" className="lwAdminTableEmpty">
                                No LoRaWAN devices registered yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </SectionCard>

                  <SectionCard
                    icon="settings"
                    title={deviceEditorMode === "create" ? "Register Device" : "Edit Device"}
                    subtitle="Validation runs inline while you type."
                  >
                    <div className="lwAdminFormGrid">
                      <label className="lwAdminField">
                        <span className="lwAdminLabel">Label</span>
                        <input
                          className="lwAdminInput"
                          value={deviceForm.label}
                          onChange={(event) =>
                            setDeviceForm((current) => ({ ...current, label: event.target.value }))
                          }
                          placeholder="Main Street gateway radio"
                        />
                        <FieldMessage error={deviceErrors.label} />
                      </label>

                      <label className="lwAdminField">
                        <span className="lwAdminLabel">DevEUI</span>
                        <input
                          className="lwAdminInput"
                          value={formatDevEui(deviceForm.devEui)}
                          onChange={(event) =>
                            setDeviceForm((current) => ({
                              ...current,
                              devEui: normalizeDevEui(event.target.value),
                            }))
                          }
                          placeholder="70B3 D57E D00A 0001"
                        />
                        <FieldMessage error={deviceErrors.devEui} />
                      </label>

                      <label className="lwAdminField">
                        <span className="lwAdminLabel">Pole</span>
                        <select
                          className="lwAdminSelect"
                          value={deviceForm.poleId}
                          onChange={(event) =>
                            setDeviceForm((current) => ({ ...current, poleId: event.target.value }))
                          }
                        >
                          <option value="">Select a pole</option>
                          {poles.map((pole) => (
                            <option key={pole.streetlight_id} value={pole.streetlight_id}>
                              {pole.streetlight_id} - {pole.name || "Unnamed pole"}
                            </option>
                          ))}
                        </select>
                        <FieldMessage error={deviceErrors.poleId} />
                      </label>

                      <label className="lwAdminField">
                        <span className="lwAdminLabel">Gateway</span>
                        <input
                          className="lwAdminInput"
                          value={deviceForm.gateway}
                          onChange={(event) =>
                            setDeviceForm((current) => ({ ...current, gateway: event.target.value }))
                          }
                          placeholder="GW-01"
                        />
                      </label>
                    </div>

                    <label className="lwAdminField">
                      <span className="lwAdminLabel">Signal strength</span>
                      <input
                        type="range"
                        min="-120"
                        max="-60"
                        value={deviceForm.signalRssi}
                        onChange={(event) =>
                          setDeviceForm((current) => ({
                            ...current,
                            signalRssi: Number(event.target.value),
                          }))
                        }
                      />
                      <FieldMessage
                        hint={`${describeSignal(deviceForm.signalRssi).label} signal at ${
                          deviceForm.signalRssi
                        } dBm`}
                      />
                    </label>

                    <div className="lwAdminButtonRow">
                      <button type="button" className="lwAdminPrimaryBtn" onClick={handleDeviceSave}>
                        {deviceEditorMode === "create" ? "Register Device" : "Save Device"}
                      </button>
                      {selectedDevice ? (
                        <button
                          type="button"
                          className="lwAdminGhostBtn isDanger"
                          onClick={() =>
                            openConfirmation({
                              title: `Remove ${selectedDevice.label}?`,
                              message:
                                "The radio will be removed from this admin planner and its pole assignment will be cleared here.",
                              confirmLabel: "Remove device",
                              tone: "danger",
                              onConfirm: () => {
                                patchAdminState((current) => ({
                                  ...current,
                                  devices: current.devices.filter(
                                    (device) => device.id !== selectedDevice.id
                                  ),
                                }));
                                setSelectedDeviceId(null);
                                setDeviceStatus({ tone: "healthy", text: "Device removed." });
                              },
                            })
                          }
                        >
                          Remove Device
                        </button>
                      ) : null}
                    </div>

                    {deviceStatus ? <StatusChip tone={deviceStatus.tone}>{deviceStatus.text}</StatusChip> : null}
                  </SectionCard>
                </div>
              ) : null}

              {activeSection === "users" ? (
                <div className="lwAdminSectionGrid lwAdminSectionGridCompact">
                  <SectionCard
                    icon="user"
                    title="User Management"
                    subtitle="Add, remove, and assign operator or admin roles."
                    actions={
                      <div className="lwAdminButtonRow">
                        {usersLoading ? <StatusChip tone="neutral">Syncing</StatusChip> : null}
                        <button
                          type="button"
                          className="lwAdminSecondaryBtn"
                          onClick={beginNewUser}
                          disabled={userSaving}
                        >
                          Add User
                        </button>
                      </div>
                    }
                  >
                    <div className="lwAdminTableWrap">
                      <table className="lwAdminTable">
                        <thead>
                          <tr>
                            <th>User</th>
                            <th>Role</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.length ? (
                            users.map((user) => (
                              <tr
                                key={user.id}
                                className={user.id === selectedUserId ? "isSelected" : ""}
                                onClick={() => {
                                  setUserEditorMode("edit");
                                  setSelectedUserId(user.id);
                                  setUserStatus(null);
                                }}
                              >
                                <td>
                                  <strong>{user.name}</strong>
                                  <span>{user.email}</span>
                                </td>
                                <td>
                                  <StatusChip tone={getRoleTone(user.role)}>{user.role}</StatusChip>
                                </td>
                                <td>
                                  {operator?.email &&
                                  user.email.toLowerCase() === operator.email.toLowerCase() ? (
                                    <StatusChip tone="healthy">Current session</StatusChip>
                                  ) : (
                                    <StatusChip tone="neutral">Active</StatusChip>
                                  )}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="3" className="lwAdminTableEmpty">
                                No users available.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </SectionCard>

                  <SectionCard
                    icon="settings"
                    title={userEditorMode === "create" ? "Add User" : "Edit User"}
                    subtitle="Invites and removals sync with Cognito."
                  >
                    <div className="lwAdminFormGrid">
                      <label className="lwAdminField">
                        <span className="lwAdminLabel">Name</span>
                        <input
                          className="lwAdminInput"
                          value={userForm.name}
                          onChange={(event) =>
                            setUserForm((current) => ({ ...current, name: event.target.value }))
                          }
                          placeholder="Jordan Lee"
                        />
                        <FieldMessage error={userErrors.name} />
                      </label>

                      <label className="lwAdminField">
                        <span className="lwAdminLabel">Email</span>
                        <input
                          className="lwAdminInput"
                          value={userForm.email}
                          onChange={(event) =>
                            setUserForm((current) => ({ ...current, email: event.target.value }))
                          }
                          placeholder="jordan.lee@city.gov"
                        />
                        <FieldMessage error={userErrors.email} />
                      </label>

                      <label className="lwAdminField">
                        <span className="lwAdminLabel">Role</span>
                        <select
                          className="lwAdminSelect"
                          value={userForm.role}
                          onChange={(event) =>
                            setUserForm((current) => ({ ...current, role: event.target.value }))
                          }
                        >
                          <option value="operator">Operator</option>
                          <option value="admin">Admin</option>
                        </select>
                        <FieldMessage error={userErrors.role} />
                      </label>
                    </div>

                    <div className="lwAdminButtonRow">
                      <button
                        type="button"
                        className="lwAdminPrimaryBtn"
                        onClick={handleUserSave}
                        disabled={userSaving}
                      >
                        {userEditorMode === "create" ? "Add User" : "Save User"}
                      </button>
                      {selectedUser ? (
                        <button
                          type="button"
                          className="lwAdminGhostBtn isDanger"
                          disabled={
                            userSaving ||
                            (operator?.email &&
                              selectedUser.email.toLowerCase() === operator.email.toLowerCase())
                          }
                          onClick={() =>
                            openConfirmation({
                              title: `Remove ${selectedUser.name}?`,
                              message:
                                "This revokes access for the selected user.",
                              confirmLabel: "Remove user",
                              tone: "danger",
                              onConfirm: () => handleUserRemove(selectedUser),
                            })
                          }
                        >
                          Remove User
                        </button>
                      ) : null}
                    </div>

                    {userStatus ? <StatusChip tone={userStatus.tone}>{userStatus.text}</StatusChip> : null}
                  </SectionCard>
                </div>
              ) : null}
            </div>
          </div>

          <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
        </div>
      )}
    </Layout>
  );
}
