import { pruneStoredPoleState } from "./poleStorage";
import { normalizeStreetlightFromApi } from "../utils/poleHelpers";
import { fetchIdTokenSilently, emitAuthRequired, redirectToSignIn } from "./auth";
import { LIGHTWISE_ENV } from "../config/env";
import {
  normalizeOperatorProfile,
  normalizeStreetlightListResponse,
  normalizeTelemetryResponse,
} from "../utils/normalizers";
import {
  MOCK_PROFILE,
  mockGetStreetlightCommands,
  mockListStreetlights,
  mockListUsers,
  mockGetStreetlight,
  mockGetTelemetry,
  mockInviteUser,
  mockRemoveUser,
  mockSendStreetlightCommand,
  mockUpdateMetadata,
  mockUpdateUser,
} from "./api.mock";

const ALLOWED_INTERVALS = new Set([
  "5s", "10s", "30s",
  "1m", "5m", "10m", "15m", "30m",
  "1h", "6h", "12h", "1d", "7d", "30d",
]);

async function apiFetch(path, { method = "GET", body, headers, query } = {}, { token } = {}) {
  const { API_BASE } = LIGHTWISE_ENV;
  if (!API_BASE) throw new Error("LightWise is not ready yet. Please try again later.");

  const url      = buildUrl(path, query);
  const idToken  = String(token || "").trim() || (await fetchIdTokenSilently());

  if (!idToken) {
    emitAuthRequired("missing_token");
    await redirectToSignIn();
    throw apiError("Please sign in again.", 401);
  }

  const hasBody = body !== undefined && body !== null;

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...(headers || {}),
        Authorization: idToken,
      },
      body: hasBody ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    const err = new Error("LightWise is having trouble connecting. Please try again.");
    err.cause = cause;
    throw err;
  }

  if (res.status === 401) {
    emitAuthRequired("http_401");
    await redirectToSignIn();
    throw apiError("Please sign in again.", 401);
  }

  const data = await parseJsonSafely(res);

  if (res.status === 403) {
    throw apiError(cleanApiMessage(data?.error || data?.message, "You do not have permission to do that."), 403, data);
  }
  if (res.status === 404) throw apiError(cleanApiMessage(data?.error || data?.message, "We could not find that item."), 404, data);

  if (!res.ok) {
    const msg = cleanApiMessage(data?.error || data?.message, "Something went wrong. Please try again.");
    throw apiError(msg, res.status, data);
  }

  return data;
}

function apiError(message, status, payload) {
  return Object.assign(new Error(message), { status, payload });
}

function cleanApiMessage(message, fallback) {
  const text = String(message || "").trim();
  if (!text) return fallback;

  const hiddenTerms = [
    "api",
    "aws",
    "backend",
    "cognito",
    "cors",
    "dynamodb",
    "lambda",
    "server",
  ];

  return hiddenTerms.some((term) => text.toLowerCase().includes(term))
    ? fallback
    : text;
}

function buildUrl(path, extraQuery = {}) {
  const { API_BASE } = LIGHTWISE_ENV;
  const base      = API_BASE.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url       = new URL(`${base}${cleanPath}`);

  Object.entries(extraQuery).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  });

  return url.toString();
}

async function parseJsonSafely(res) {
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase() === "admin" ? "admin" : "operator";
}

function nameFromEmail(email) {
  const local = String(email || "").split("@")[0] || "User";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeTenantUser(raw = {}, fallback = {}) {
  const email = String(raw.email ?? fallback.email ?? "").trim();
  const id = String(raw.user_id ?? raw.id ?? raw.sub ?? fallback.id ?? email).trim();

  return {
    id,
    user_id: id,
    name: String(raw.name ?? fallback.name ?? nameFromEmail(email)).trim(),
    email,
    role: normalizeRole(raw.role ?? fallback.role),
    tenant_id: raw.tenant_id ?? raw.tenantId ?? fallback.tenant_id ?? "",
    created_at: raw.created_at ?? raw.createdAt ?? fallback.created_at ?? "",
  };
}

function normalizeUsersResponse(data) {
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.users)
    ? data.users
    : Array.isArray(data?.items)
    ? data.items
    : [];

  return list.map((item) => normalizeTenantUser(item));
}

function normalizeCommandStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  if (status === "PENDING") return "pending";
  if (status === "SENT") return "pending";
  if (status === "ACKNOWLEDGED" || status === "ACKED") return "acked";
  if (status === "FAILED" || status === "NACKED") return "nacked";
  if (status === "TIMEOUT") return "timeout";
  return String(value || "pending").trim().toLowerCase();
}

function normalizeCommandRecord(raw = {}) {
  const response = raw.response || null;
  const status = normalizeCommandStatus(raw.status);
  const commandType = raw.command_type || raw.command || "";
  const createdAt = raw.created_at || raw.createdAt || raw.dispatched_at || "";
  const sentAt = raw.sent_at || raw.sentAt || "";

  return {
    command_id: raw.command_id || raw.id || "",
    streetlight_id: raw.streetlight_id || raw.streetlightId || "",
    command: commandType,
    command_type: commandType,
    params: raw.params || raw.payload || {},
    status,
    issued_by: raw.issued_by || raw.issuedBy || "",
    created_at: createdAt,
    sent_at: sentAt,
    dispatched_at: raw.dispatched_at || sentAt || createdAt,
    response:
      response ||
      (raw.acknowledged_at || raw.reason
        ? {
            received_at: raw.acknowledged_at || "",
            response_code: status === "acked" ? "ACK" : "NACK",
            reason_code: raw.reason || "",
          }
        : null),
  };
}

function normalizeCommandHistoryResponse(data, streetlightId) {
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.commands)
    ? data.commands
    : Array.isArray(data?.items)
    ? data.items
    : [];

  return {
    streetlight_id: data?.streetlight_id || streetlightId,
    commands: list.map((item) => normalizeCommandRecord(item)),
  };
}

export async function getOperatorProfile(token) {
  if (LIGHTWISE_ENV.USE_MOCK) return normalizeOperatorProfile(MOCK_PROFILE);
  const data = await apiFetch("/auth/me", { method: "GET" }, { token });
  return normalizeOperatorProfile(data);
}


export async function listStreetlights() {
  const { USE_MOCK, TENANT_ID } = LIGHTWISE_ENV;
  if (USE_MOCK) {
    const rows = mockListStreetlights(TENANT_ID);
    pruneStoredPoleState(rows.map((row) => row?.streetlight_id));
    return rows.map(normalizeStreetlightFromApi);
  }
  const data = await apiFetch("/streetlights", { method: "GET" });
  const rows = normalizeStreetlightListResponse(data);
  pruneStoredPoleState(rows.map((row) => row?.streetlight_id));
  return rows;
}

export async function getStreetlight(id) {
  if (!id) throw new Error("streetlight id is required");
  const { USE_MOCK, TENANT_ID } = LIGHTWISE_ENV;
  if (USE_MOCK) return normalizeStreetlightFromApi(mockGetStreetlight(id, TENANT_ID));
  const data = await apiFetch(`/streetlights/${encodeURIComponent(id)}`, { method: "GET" });
  return normalizeStreetlightFromApi(data);
}

export async function getStreetlightTelemetry(
  id,
  { from, to, interval = "5m", allowMockFallback = true } = {}
) {
  if (!id)          throw new Error("streetlight id is required");
  if (!from || !to) throw new Error("from and to are required");
  if (!ALLOWED_INTERVALS.has(interval)) {
    throw new Error(`interval must be one of: ${Array.from(ALLOWED_INTERVALS).join(", ")}`);
  }

  if (LIGHTWISE_ENV.USE_MOCK) {
    return allowMockFallback
      ? mockGetTelemetry(id, from, to, interval)
      : { streetlight_id: id, data: [] };
  }

  if (!allowMockFallback) {
    const data = await apiFetch(
      `/streetlights/${encodeURIComponent(id)}/telemetry`,
      {
        method: "GET",
        query: {
          from:     new Date(from).toISOString(),
          to:       new Date(to).toISOString(),
          interval,
        },
      }
    );

    return { streetlight_id: id, data: normalizeTelemetryResponse(data) };
  }

  const data = await apiFetch(
    `/streetlights/${encodeURIComponent(id)}/telemetry`,
    {
      method: "GET",
      query: {
        from:     new Date(from).toISOString(),
        to:       new Date(to).toISOString(),
        interval,
      },
    }
  );

  return { streetlight_id: id, data: normalizeTelemetryResponse(data) };
}

export async function updateStreetlightMetadata(id, body) {
  if (!id)                             throw new Error("streetlight id is required");
  if (!body || typeof body !== "object") throw new Error("body is required");
  if (LIGHTWISE_ENV.USE_MOCK)          return mockUpdateMetadata(id, body);

  return apiFetch(`/streetlights/${encodeURIComponent(id)}/metadata`, {
    method: "PUT",
    body,
  });
}

export async function listUsers() {
  if (LIGHTWISE_ENV.USE_MOCK) return normalizeUsersResponse(mockListUsers());

  const data = await apiFetch("/users", { method: "GET" });
  return normalizeUsersResponse(data);
}

export async function inviteUser(body) {
  if (!body || typeof body !== "object") throw new Error("user body is required");

  const payload = {
    name: String(body.name || "").trim(),
    email: String(body.email || "").trim(),
    role: normalizeRole(body.role),
  };

  if (!payload.email) throw new Error("email is required");

  if (LIGHTWISE_ENV.USE_MOCK) {
    return normalizeTenantUser(mockInviteUser(payload), payload);
  }

  const data = await apiFetch("/invite-user", {
    method: "POST",
    body: payload,
  });
  return normalizeTenantUser(data, payload);
}

export async function updateUser(userId, body) {
  const id = String(userId || "").trim();
  if (!id) throw new Error("user id is required");
  if (!body || typeof body !== "object") throw new Error("user body is required");

  const payload = {
    name: String(body.name || "").trim(),
  };

  if (!payload.name) throw new Error("name is required");

  if (LIGHTWISE_ENV.USE_MOCK) {
    return normalizeTenantUser(mockUpdateUser(id, { ...body, ...payload }), {
      ...body,
      ...payload,
      id,
    });
  }

  const data = await apiFetch(`/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: payload,
  });
  return normalizeTenantUser(data, { ...body, ...payload, id });
}

export async function removeUser(userId) {
  const id = String(userId || "").trim();
  if (!id) throw new Error("user id is required");

  if (LIGHTWISE_ENV.USE_MOCK) return mockRemoveUser(id);

  return apiFetch(`/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function sendStreetlightCommand(id, body) {
  const streetlightId = String(id || "").trim();
  if (!streetlightId) throw new Error("streetlight id is required");
  if (!body || typeof body !== "object") throw new Error("command body is required");

  const payload = {
    command: String(body.command || "").trim(),
    params: body.params && typeof body.params === "object" ? body.params : {},
  };

  if (!payload.command) throw new Error("command is required");

  if (LIGHTWISE_ENV.USE_MOCK) {
    return normalizeCommandRecord(mockSendStreetlightCommand(streetlightId, payload));
  }

  const data = await apiFetch(`/streetlights/${encodeURIComponent(streetlightId)}/commands`, {
    method: "POST",
    body: payload,
  });
  return normalizeCommandRecord({ ...data, params: payload.params });
}

export async function getStreetlightCommandHistory(id, query = {}) {
  const streetlightId = String(id || "").trim();
  if (!streetlightId) throw new Error("streetlight id is required");

  if (LIGHTWISE_ENV.USE_MOCK) {
    return normalizeCommandHistoryResponse(mockGetStreetlightCommands(streetlightId), streetlightId);
  }

  const data = await apiFetch(`/streetlights/${encodeURIComponent(streetlightId)}/commands`, {
    method: "GET",
    query,
  });
  return normalizeCommandHistoryResponse(data, streetlightId);
}
