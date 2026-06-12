import React, {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  updateUser,
} from "../services/api";
import { loadPoleMetaMap, upsertPoleMeta } from "../services/poleStorage";
import { formatTimestamp } from "../utils/formatters";
import {
  isValidCoord,
  mergeBackendAndLocalPoles,
  pickBestCenter,
} from "../utils/poleHelpers";
import { validateCoordinate } from "../utils/poleState";
import "../styles/lightwise.css";
import "../styles/admin.css";

const ADMIN_STORAGE_KEY = "lightwise_admin_console_v8";
const LEGACY_DEMO_USER_EMAILS = new Set([
  "avery.brooks@city.gov",
  "jules.chen@city.gov",
]);
const DEFAULT_USER_FORM = {
  name: "",
  email: "",
  role: "operator",
};
const COMMAND_HISTORY_REFRESH_DELAYS_MS = [2000, 8000];
const SECTION_ITEMS = [
  {
    id: "poles",
    label: "Streetlights",
    icon: "pin",
    description: "Manage streetlight names and locations.",
  },
  {
    id: "lorawan",
    label: "Connectivity",
    icon: "radio",
    description: "Send lighting commands to selected streetlights.",
  },
  {
    id: "users",
    label: "Users",
    icon: "user",
    description: "Manage who can access LightWise.",
  },
];

function safeReadAdminState() {
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    const value = raw ? JSON.parse(raw) : null;
    if (!value || typeof value !== "object") return null;

    // User management is remote-owned, so ignore any old cached directory entries.
    return {
      ...value,
      users: [],
    };
  } catch {
    return null;
  }
}

function safeWriteAdminState(value) {
  try {
    const persistableState = { ...(value || {}) };
    delete persistableState.users;
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(persistableState));
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

function isLegacyDemoDevice(device = {}) {
  const devEui = normalizeDevEui(device.devEui);
  const gateway = String(device.gateway || "").trim();
  return /^70B3D57ED00A\d{2}$/.test(devEui) && /^GW-\d{2}$/.test(gateway);
}

function isLocalOnlyUser(user = {}) {
  return !String(user.user_id || "").trim() && !String(user.created_at || "").trim();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeDevEui(value = "") {
  return String(value).toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 16);
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
    devices,
    users: users.length ? users : fallback.users,
  };
}

function getSectionMeta(id) {
  return SECTION_ITEMS.find((item) => item.id === id) || SECTION_ITEMS[0];
}

function getRoleTone(role) {
  return role === "admin" ? "warning" : "neutral";
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

function hasDraftValue(draft, key) {
  return Boolean(draft && Object.prototype.hasOwnProperty.call(draft, key));
}

function coordInputValue(value) {
  return value === null || value === undefined ? "" : String(value);
}

function getPoleDraftValue(drafts, pole, key, fallback) {
  const draft = drafts?.[pole?.streetlight_id];
  return hasDraftValue(draft, key) ? draft[key] : fallback;
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

function SectionCard({ icon, title, subtitle, actions, children, className = "" }) {
  return (
    <section className={`lwAdminCard${className ? ` ${className}` : ""}`}>
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
  selectedPoleId,
  previewPoint = null,
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
  return (
    <div className="lwAdminMapSurface">
      <MapEmbed
        title="Admin planning map"
        fillHeight
        interactive
        showInfo={false}
        showLegend={false}
        lat={center.lat}
        lng={center.lng}
        poles={validPoles}
        selectedId={selectedPoleId}
        onSelectPole={onPoleClick}
        fitToPoles
        fitMaxZoom={15}
        previewPoint={previewPoint}
        markerTone="admin"
      />
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
  const [activeSection, setActiveSection] = useState("poles");
  const [selectedPoleId, setSelectedPoleId] = useState(null);
  const [poleDrafts, setPoleDrafts] = useState({});
  const [poleStatus, setPoleStatus] = useState(null);
  const [savingPoleId, setSavingPoleId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userEditorMode, setUserEditorMode] = useState("edit");
  const [userForm, setUserForm] = useState(DEFAULT_USER_FORM);
  const [userStatus, setUserStatus] = useState(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSaving, setUserSaving] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState(null);
  const [selectedCommandStreetlightId, setSelectedCommandStreetlightId] = useState("");
  const [commandStatus, setCommandStatus] = useState(null);
  const [commandSending, setCommandSending] = useState(false);
  const [commandHistory, setCommandHistory] = useState([]);
  const [commandHistoryLoading, setCommandHistoryLoading] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const commandHistoryRequestRef = useRef(0);
  const commandHistoryLoadingRequestRef = useRef(0);
  const commandRefreshTimersRef = useRef([]);

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

  const users = useMemo(
    () => (adminState?.users ?? []).filter((user) => !isLegacyDemoUser(user)),
    [adminState?.users]
  );
  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) || null,
    [users, selectedUserId]
  );
  const sectionMeta = getSectionMeta(activeSection);
  const previewPoles = useMemo(() => {
    return poles.map((pole) => {
      const draft = poleDrafts[pole.streetlight_id];
      if (!draft) return pole;

      const name = getPoleDraftValue(poleDrafts, pole, "name", pole.name || "");
      const latInput = getPoleDraftValue(poleDrafts, pole, "lat", coordInputValue(pole.lat));
      const lngInput = getPoleDraftValue(poleDrafts, pole, "lng", coordInputValue(pole.lng));
      const latError = validateCoordinate(latInput, "Latitude");
      const lngError = validateCoordinate(lngInput, "Longitude");
      const lat = !latError && String(latInput).trim() ? Number(latInput) : pole.lat;
      const lng = !lngError && String(lngInput).trim() ? Number(lngInput) : pole.lng;

      return {
        ...pole,
        name,
        lat,
        lng,
      };
    });
  }, [poleDrafts, poles]);

  const stats = useMemo(
    () => [
      {
        label: "Mapped Streetlights",
        value: poles.filter((pole) => isValidCoord(pole.lat) && isValidCoord(pole.lng)).length,
        note: "Selectable on the map",
      },
      {
        label: "Users",
        value: users.length,
        note: `${users.filter((user) => user.role === "admin").length} admins, ${
          users.filter((user) => user.role === "operator").length
        } operators`,
      },
    ],
    [poles, users]
  );

  const userErrors = useMemo(() => validateUserForm(userForm), [userForm]);

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
    if (!poles.length) {
      setSelectedCommandStreetlightId("");
      return;
    }

    setSelectedCommandStreetlightId((current) => {
      if (current && poles.some((pole) => pole.streetlight_id === current)) {
        return current;
      }

      if (selectedPoleId && poles.some((pole) => pole.streetlight_id === selectedPoleId)) {
        return selectedPoleId;
      }

      return poles[0].streetlight_id;
    });
  }, [poles, selectedPoleId]);

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

    setCommandStatus({
      tone: ack.response_code === "ACK" ? "healthy" : "critical",
      text: ack.response_code === "ACK" ? "Command completed." : "Command rejected.",
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

  const refreshCommandHistory = useCallback(
    async (
      streetlightId = selectedCommandStreetlightId,
      { showLoading = false, updateStatusOnError = true } = {}
    ) => {
      const id = String(streetlightId || "").trim();
      const requestId = commandHistoryRequestRef.current + 1;
      commandHistoryRequestRef.current = requestId;

      if (!id) {
        setCommandHistory([]);
        setCommandHistoryLoading(false);
        return [];
      }

      if (showLoading) {
        commandHistoryLoadingRequestRef.current = requestId;
        setCommandHistoryLoading(true);
      }

      try {
        const history = await getStreetlightCommandHistory(id);
        if (commandHistoryRequestRef.current !== requestId) return null;

        const commands = Array.isArray(history?.commands) ? history.commands : [];
        setCommandHistory(commands);
        return commands;
      } catch (error) {
        if (
          commandHistoryRequestRef.current === requestId &&
          updateStatusOnError
        ) {
          setCommandStatus({
            tone: "warning",
            text: error?.message || "Command history unavailable.",
          });
        }
        return null;
      } finally {
        if (showLoading && commandHistoryLoadingRequestRef.current === requestId) {
          setCommandHistoryLoading(false);
        }
      }
    },
    [selectedCommandStreetlightId]
  );

  const scheduleCommandHistoryRefreshes = useCallback(
    (streetlightId) => {
      const id = String(streetlightId || "").trim();
      if (!id) return;

      COMMAND_HISTORY_REFRESH_DELAYS_MS.forEach((delayMs) => {
        const timer = window.setTimeout(() => {
          commandRefreshTimersRef.current = commandRefreshTimersRef.current.filter(
            (item) => item !== timer
          );
          refreshCommandHistory(id, { updateStatusOnError: false });
        }, delayMs);

        commandRefreshTimersRef.current.push(timer);
      });
    },
    [refreshCommandHistory]
  );

  useEffect(() => {
    refreshCommandHistory(selectedCommandStreetlightId, { showLoading: true });
  }, [refreshCommandHistory, selectedCommandStreetlightId]);

  useEffect(() => {
    return () => {
      commandRefreshTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      commandRefreshTimersRef.current = [];
    };
  }, []);

  function patchAdminState(updater) {
    setAdminState((current) => {
      if (!current) return current;
      return updater(current);
    });
  }

  function openConfirmation(nextState) {
    setConfirmState(nextState);
  }

  function beginNewUser() {
    setUserEditorMode("create");
    setUserForm(makeUserForm());
    setSelectedUserId(null);
    setUserStatus(null);
  }

  function handlePoleMapClick(pole) {
    setSelectedPoleId(pole.streetlight_id);
    setPoleStatus(null);
  }

  async function handlePoleMetadataSave(pole) {
    const id = String(pole?.streetlight_id || "").trim();
    if (!id) {
      setPoleStatus({ tone: "critical", text: "Select a streetlight to edit." });
      return;
    }

    const name = String(getPoleDraftValue(poleDrafts, pole, "name", pole.name || "")).trim();
    const latInput = String(getPoleDraftValue(poleDrafts, pole, "lat", coordInputValue(pole.lat))).trim();
    const lngInput = String(getPoleDraftValue(poleDrafts, pole, "lng", coordInputValue(pole.lng))).trim();

    if (!name) {
      setPoleStatus({ tone: "critical", text: "Display name is required." });
      return;
    }

    const latError = validateCoordinate(latInput, "Latitude");
    const lngError = validateCoordinate(lngInput, "Longitude");

    if (latError || lngError) {
      setPoleStatus({
        tone: "critical",
        text: latError || lngError,
      });
      return;
    }

    const patch = {
      name,
      lat: latInput ? Number(latInput) : null,
      lng: lngInput ? Number(lngInput) : null,
    };

    setSavingPoleId(id);
    upsertPoleMeta(id, patch);
    applyStreetlightLocalPatch(id, patch);
    setMetaMap(loadPoleMetaMap());
    setPoleDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });

    try {
      await updateStreetlightMetadata(id, patch);
      setPoleStatus({ tone: "healthy", text: `${id} details saved.` });
    } catch {
      setPoleStatus({
        tone: "warning",
        text: `${id} details were saved on this device. Try again to share them with the team.`,
      });
    } finally {
      setSavingPoleId("");
    }
  }

  async function handleUserSave() {
    if (userEditorMode === "edit" && !selectedUser) {
      setUserStatus({ tone: "critical", text: "Select a user to edit." });
      return;
    }

    if (Object.keys(userErrors).length) {
      setUserStatus({ tone: "critical", text: "Complete the required user fields." });
      return;
    }

    const nextUser = {
      id: userEditorMode === "edit" && selectedUser ? selectedUser.id : makeId("user"),
      user_id: userEditorMode === "edit" && selectedUser ? selectedUser.user_id || "" : "",
      name: userForm.name.trim(),
      email: userForm.email.trim(),
      role: userEditorMode === "edit" && selectedUser ? selectedUser.role || "operator" : userForm.role,
      created_at: userEditorMode === "edit" && selectedUser ? selectedUser.created_at || "" : "",
    };

    setUserSaving(true);

    try {
      const savedUser =
        userEditorMode === "edit" && selectedUser
          ? await updateUser(selectedUser.user_id || selectedUser.id, nextUser)
          : await inviteUser(nextUser);

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

      setRemoteUsers((current) => {
        if (!Array.isArray(current)) return current;
        return userEditorMode === "edit" && selectedUser
          ? current.map((user) =>
              user.id === selectedUser.id || user.user_id === selectedUser.user_id
                ? mergedUser
                : user
            )
          : [mergedUser, ...current];
      });

      setUserEditorMode("edit");
      setSelectedUserId(mergedUser.id);
      setUserStatus({
        tone: "healthy",
        text: userEditorMode === "edit" ? "User updated." : "Invite sent.",
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

    if (isLocalOnlyUser(user)) {
      setUserStatus({
        tone: "critical",
        text: "User removal is not available yet.",
      });
      return;
    }

    setUserSaving(true);
    try {
      await removeUser(user.user_id || user.id);

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
        text: "User removed.",
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
      const issuedAt = command.created_at || command.dispatched_at || new Date().toISOString();
      const nextCommand = {
        ...command,
        streetlight_id: command.streetlight_id || id,
        command_type: command.command_type || command.command || envelope.command,
        command: command.command || command.command_type || envelope.command,
        params: command.params || envelope.params || {},
        issued_by: command.issued_by || operator?.email || operator?.name || operator?.sub || "",
        created_at: issuedAt,
        dispatched_at: command.dispatched_at || command.sent_at || issuedAt,
      };
      setCommandHistory((current) => [nextCommand, ...current.filter((item) => item.command_id !== nextCommand.command_id)]);
      setCommandStatus({
        tone: "healthy",
        text: `${nextCommand.command} accepted.`,
      });
      scheduleCommandHistoryRefreshes(id);
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
          <div className="lwAdminLoadingCard">Loading admin settings...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {() => (
        <div className={`lwAdminWorkspace${activeSection === "poles" ? " isPoleFocus" : ""}`}>
          {activeSection === "poles" ? null : (
            <>
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
            </>
          )}

          <div className="lwAdminShell">
            <SectionNav
              activeSection={activeSection}
              onChange={(nextSection) => {
                startTransition(() => setActiveSection(nextSection));
              }}
            />

            <div className="lwAdminSectionBody">
              {activeSection === "poles" ? (
                <div className="lwAdminSectionGrid lwAdminPoleSectionGrid">
                  <SectionCard
                    icon="pin"
                    title="Streetlight Management"
                    subtitle="Select individual streetlights and keep their display details current."
                  >
                    <AdminMapSurface
                      poles={previewPoles}
                      selectedPoleId={selectedPoleId}
                      onPoleClick={handlePoleMapClick}
                    />
                  </SectionCard>

                  <SectionCard
                    icon="analytics"
                    title="Streetlight Table"
                    subtitle="Edit display names and coordinates inline. Click a row or marker to focus it on the map."
                    actions={<span className="lwAdminTableCount">{poles.length} streetlight{poles.length === 1 ? "" : "s"}</span>}
                    className="lwAdminPoleTableCard"
                  >
                    <div className="lwAdminTableWrap">
                      <table className="lwAdminTable lwAdminStreetlightTable">
                        <thead>
                          <tr>
                            <th>Streetlight</th>
                            <th>Display Name</th>
                            <th>Coordinates</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {poles.length ? (
                            poles.map((pole) => {
                              const draftName = getPoleDraftValue(
                                poleDrafts,
                                pole,
                                "name",
                                pole.name || ""
                              );
                              const draftLat = getPoleDraftValue(
                                poleDrafts,
                                pole,
                                "lat",
                                coordInputValue(pole.lat)
                              );
                              const draftLng = getPoleDraftValue(
                                poleDrafts,
                                pole,
                                "lng",
                                coordInputValue(pole.lng)
                              );
                              const savedName = pole.name || "";
                              const savedLat = coordInputValue(pole.lat);
                              const savedLng = coordInputValue(pole.lng);
                              const hasMetadataChange =
                                draftName.trim() !== savedName.trim() ||
                                String(draftLat).trim() !== savedLat.trim() ||
                                String(draftLng).trim() !== savedLng.trim();

                              return (
                                <tr
                                  key={pole.streetlight_id}
                                  className={pole.streetlight_id === selectedPoleId ? "isSelected" : ""}
                                  onClick={() => {
                                    setSelectedPoleId(pole.streetlight_id);
                                  }}
                                >
                                  <td className="lwAdminStreetlightIdCell">
                                    <strong>{pole.streetlight_id}</strong>
                                    <span>Last seen {formatTimestamp(pole.last_seen, "not available")}</span>
                                  </td>
                                  <td className="lwAdminStreetlightNameCell">
                                    <input
                                      className="lwAdminInput lwAdminInlineNameInput"
                                      value={draftName}
                                      onClick={(event) => event.stopPropagation()}
                                      onChange={(event) => {
                                        const value = event.target.value;
                                        setSelectedPoleId(pole.streetlight_id);
                                        setPoleDrafts((current) => ({
                                          ...current,
                                          [pole.streetlight_id]: {
                                            ...(current[pole.streetlight_id] || {}),
                                            name: value,
                                          },
                                        }));
                                      }}
                                      placeholder="Unnamed streetlight"
                                      aria-label={`Display name for ${pole.streetlight_id}`}
                                    />
                                  </td>
                                  <td className="lwAdminCoordinateCell">
                                    <div className="lwAdminCoordinateInputs">
                                      <label>
                                        <span>Lat</span>
                                        <input
                                          className="lwAdminInput lwAdminInlineCoordInput"
                                          value={draftLat}
                                          inputMode="decimal"
                                          onClick={(event) => event.stopPropagation()}
                                          onChange={(event) => {
                                            const value = event.target.value;
                                            setSelectedPoleId(pole.streetlight_id);
                                            setPoleDrafts((current) => ({
                                              ...current,
                                              [pole.streetlight_id]: {
                                                ...(current[pole.streetlight_id] || {}),
                                                lat: value,
                                              },
                                            }));
                                          }}
                                          placeholder="47.6101"
                                          aria-label={`Latitude for ${pole.streetlight_id}`}
                                        />
                                      </label>
                                      <label>
                                        <span>Lng</span>
                                        <input
                                          className="lwAdminInput lwAdminInlineCoordInput"
                                          value={draftLng}
                                          inputMode="decimal"
                                          onClick={(event) => event.stopPropagation()}
                                          onChange={(event) => {
                                            const value = event.target.value;
                                            setSelectedPoleId(pole.streetlight_id);
                                            setPoleDrafts((current) => ({
                                              ...current,
                                              [pole.streetlight_id]: {
                                                ...(current[pole.streetlight_id] || {}),
                                                lng: value,
                                              },
                                            }));
                                          }}
                                          placeholder="-122.2015"
                                          aria-label={`Longitude for ${pole.streetlight_id}`}
                                        />
                                      </label>
                                    </div>
                                  </td>
                                  <td className="lwAdminTableActionCell">
                                    <button
                                      type="button"
                                      className="lwAdminSecondaryBtn"
                                      disabled={!hasMetadataChange || savingPoleId === pole.streetlight_id}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handlePoleMetadataSave(pole);
                                      }}
                                    >
                                      {savingPoleId === pole.streetlight_id ? "Saving" : "Save"}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan="4" className="lwAdminTableEmpty">
                                No streetlights available.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {poleStatus ? <StatusChip tone={poleStatus.tone}>{poleStatus.text}</StatusChip> : null}
                  </SectionCard>
                </div>
              ) : null}
              {activeSection === "lorawan" ? (
                <div className="lwAdminSectionGrid lwAdminSectionGridCompact">
                  <div className="lwAdminDownlinkCard">
                      <SectionCard
                        icon="bolt"
                        title="Downlink Control"
                        subtitle="Send lighting commands and review recent command results."
                      >
                        <AdminWsControls
                          streetlights={poles}
                          selectedStreetlightId={selectedCommandStreetlightId}
                          onStreetlightChange={setSelectedCommandStreetlightId}
                          commandHistory={commandHistory}
                          commandStatus={commandStatus}
                          isHistoryLoading={commandHistoryLoading}
                          isSending={commandSending}
                          onSendCommand={handleDownlinkSend}
                          onRefreshCommandHistory={(streetlightId) =>
                            refreshCommandHistory(streetlightId, { showLoading: true })
                          }
                        />
                      </SectionCard>
                  </div>

                </div>
              ) : null}

              {activeSection === "users" ? (
                <div className="lwAdminSectionGrid lwAdminUserSectionGrid">
                  <SectionCard
                    icon="settings"
                    title={userEditorMode === "create" ? "Add User" : "Edit User"}
                    subtitle="Manage who can access LightWise."
                    className="lwAdminUserEditorCard"
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
                          disabled={userEditorMode === "edit"}
                          onChange={(event) =>
                            setUserForm((current) => ({ ...current, email: event.target.value }))
                          }
                          placeholder="jordan.lee@city.gov"
                        />
                        <FieldMessage error={userErrors.email} />
                      </label>

                      {userEditorMode === "create" ? (
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
                      ) : null}
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

                  <SectionCard
                    icon="user"
                    title="User Management"
                    subtitle="Add users, update display names, and remove access."
                    className="lwAdminUserTableCard"
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
                      <table className="lwAdminTable lwAdminUserTable">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Email</th>
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
                                <td className="lwAdminUserNameCell">
                                  <strong className="lwAdminWrappedText" title={user.name}>
                                    {user.name}
                                  </strong>
                                </td>
                                <td className="lwAdminUserEmailCell">
                                  <span className="lwAdminWrappedText" title={user.email}>
                                    {user.email}
                                  </span>
                                </td>
                                <td className="lwAdminUserRoleCell">
                                  <StatusChip tone={getRoleTone(user.role)}>{user.role}</StatusChip>
                                </td>
                                <td className="lwAdminUserStatusCell">
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
                              <td colSpan="4" className="lwAdminTableEmpty">
                                No users available.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
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
