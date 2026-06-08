import React, {
  startTransition,
  useCallback,
  useDeferredValue,
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
const DEFAULT_POLE_FORM = {
  name: "",
  lat: "",
  lng: "",
};
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

function makePoleForm(pole = null) {
  return pole
    ? {
        name: pole.name || "",
        lat: pole.lat != null ? String(pole.lat) : "",
        lng: pole.lng != null ? String(pole.lng) : "",
      }
    : { ...DEFAULT_POLE_FORM };
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
  const [poleForm, setPoleForm] = useState(DEFAULT_POLE_FORM);
  const [poleSearch, setPoleSearch] = useState("");
  const [poleStatus, setPoleStatus] = useState(null);
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

  const users = useMemo(
    () => (adminState?.users ?? []).filter((user) => !isLegacyDemoUser(user)),
    [adminState?.users]
  );
  const selectedPole = useMemo(
    () => poles.find((pole) => pole.streetlight_id === selectedPoleId) || null,
    [poles, selectedPoleId]
  );
  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) || null,
    [users, selectedUserId]
  );
  const sectionMeta = getSectionMeta(activeSection);
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
      const haystack = [
        pole.streetlight_id,
        pole.name || "",
        isValidCoord(pole.lat) && isValidCoord(pole.lng)
          ? `${pole.lat} ${pole.lng}`
          : "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [deferredPoleSearch, poles]);

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

  const poleErrors = useMemo(() => validatePoleForm(poleForm), [poleForm]);
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
    if (selectedPole) {
      setPoleForm(makePoleForm(selectedPole));
    }
  }, [selectedPole]);

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

  function handlePoleSave() {
    if (!selectedPoleId) {
      setPoleStatus({ tone: "critical", text: "Select a streetlight to edit." });
      return;
    }

    if (Object.keys(poleErrors).length) {
      setPoleStatus({ tone: "critical", text: "Fix the streetlight form validation errors before saving." });
      return;
    }

    const patch = {
      name: poleForm.name.trim(),
      lat: poleForm.lat.trim() ? Number(poleForm.lat) : null,
      lng: poleForm.lng.trim() ? Number(poleForm.lng) : null,
    };

    upsertPoleMeta(selectedPoleId, patch);
    applyStreetlightLocalPatch(selectedPoleId, patch);
    setMetaMap(loadPoleMetaMap());

    updateStreetlightMetadata(selectedPoleId, patch)
      .then(() => {
        setPoleStatus({ tone: "healthy", text: "Streetlight details saved." });
      })
      .catch(() => {
        setPoleStatus({
          tone: "warning",
          text: "Streetlight details were saved on this device. Try again to share them with the team.",
        });
      });
  }

  async function handleUserSave() {
    if (userEditorMode === "edit" && !selectedUser) {
      setUserStatus({ tone: "critical", text: "Select a user to edit." });
      return;
    }

    if (userEditorMode === "edit") {
      setUserStatus({
        tone: "critical",
        text: "Editing users is not available yet.",
      });
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
      role: userForm.role,
      created_at: userEditorMode === "edit" && selectedUser ? selectedUser.created_at || "" : "",
    };

    setUserSaving(true);

    try {
      const savedUser = await inviteUser(nextUser);

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
        return [mergedUser, ...current];
      });

      setUserEditorMode("edit");
      setSelectedUserId(mergedUser.id);
      setUserStatus({
        tone: "healthy",
        text: "Invite sent.",
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
                      previewPoint={livePreviewPoint}
                      onPoleClick={handlePoleMapClick}
                    />
                  </SectionCard>

                  <div className="lwAdminStack">
                    <SectionCard
                      icon="settings"
                      title="Edit Streetlight"
                      subtitle="Click any row or marker to load it into the editor."
                      className="lwAdminPoleEditorCard"
                    >
                      <div className="lwAdminFormGrid lwAdminPoleFormGrid">
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
                            <strong>{selectedPole?.streetlight_id || "No streetlight selected"}</strong>
                            <span>Last seen {formatTimestamp(selectedPole?.last_seen, "not available")}</span>
                          </div>
                        </div>
                      </div>

                      <div className="lwAdminButtonRow">
                        <button type="button" className="lwAdminPrimaryBtn" onClick={handlePoleSave}>
                          Save Streetlight
                        </button>
                      </div>

                      {poleStatus ? <StatusChip tone={poleStatus.tone}>{poleStatus.text}</StatusChip> : null}
                    </SectionCard>

                    <SectionCard
                      icon="analytics"
                      title="Streetlight Table"
                      subtitle="Search by streetlight ID, name, or coordinates. Click a row to edit."
                      actions={<span className="lwAdminTableCount">{filteredPoles.length} streetlight{filteredPoles.length === 1 ? "" : "s"}</span>}
                      className="lwAdminPoleTableCard"
                    >
                      <label className="lwAdminField lwAdminPoleTableSearch">
                        <span className="lwAdminLabel">Search</span>
                        <input
                          className="lwAdminInput"
                          value={poleSearch}
                          onChange={(event) => setPoleSearch(event.target.value)}
                          placeholder="Search streetlights"
                        />
                      </label>

                      <div className="lwAdminTableWrap">
                        <table className="lwAdminTable">
                          <thead>
                            <tr>
                              <th>Streetlight</th>
                              <th>Coordinates</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredPoles.length ? (
                              filteredPoles.map((pole) => (
                                <tr
                                  key={pole.streetlight_id}
                                  className={pole.streetlight_id === selectedPoleId ? "isSelected" : ""}
                                  onClick={() => {
                                    setSelectedPoleId(pole.streetlight_id);
                                  }}
                                >
                                  <td>
                                    <strong>{pole.streetlight_id}</strong>
                                    <span>{pole.name || "Unnamed streetlight"}</span>
                                  </td>
                                  <td className="lwAdminCoordinateCell">
                                    {isValidCoord(pole.lat) && isValidCoord(pole.lng)
                                      ? `${pole.lat}, ${pole.lng}`
                                      : "Needs coordinates"}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="2" className="lwAdminTableEmpty">
                                  No streetlights match the current search.
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
                                  <strong>{user.name}</strong>
                                </td>
                                <td className="lwAdminUserEmailCell">
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
                              <td colSpan="4" className="lwAdminTableEmpty">
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
                    subtitle="Manage who can access LightWise."
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
