export const MOCK_PROFILE = {
  sub:        "mock-user",
  tenant_id:  "tenant-001",
  first_name: "Demo",
  last_name:  "Operator",
  name:       "Demo Operator",
  email:      "operator@lightwise.local",
  role:       "operator",
};

const MOCK_POLE_BLUEPRINTS = [
  {
    streetlight_id: "LW-00043",
    name: "Civic Center Plaza",
    lat: 47.6108,
    lng: -122.3342,
    health: "OK",
    motion_detected: true,
    light_level: 64,
    temp_c: 17.9,
    humidity: 58.4,
    lux: 34,
    footfall: 0.92,
    dimmingBias: 0.08,
  },
  {
    streetlight_id: "LW-00044",
    name: "Transit Mall East",
    lat: 47.6126,
    lng: -122.3314,
    health: "WARNING",
    motion_detected: false,
    light_level: 57,
    temp_c: 18.7,
    humidity: 55.8,
    lux: 29,
    footfall: 0.88,
    dimmingBias: 0.12,
  },
  {
    streetlight_id: "LW-00045",
    name: "Library Steps",
    lat: 47.6094,
    lng: -122.3371,
    health: "OK",
    motion_detected: true,
    light_level: 52,
    temp_c: 18.1,
    humidity: 60.3,
    lux: 24,
    footfall: 0.58,
    dimmingBias: 0.22,
  },
  {
    streetlight_id: "LW-00046",
    name: "Harbor Promenade",
    lat: 47.6067,
    lng: -122.3339,
    health: "CRITICAL",
    motion_detected: false,
    light_level: 41,
    temp_c: 16.8,
    humidity: 67.4,
    lux: 18,
    footfall: 0.63,
    dimmingBias: 0.3,
  },
  {
    streetlight_id: "LW-00047",
    name: "Market Canopy",
    lat: 47.6084,
    lng: -122.3296,
    health: "OK",
    motion_detected: true,
    light_level: 69,
    temp_c: 19.1,
    humidity: 53.1,
    lux: 31,
    footfall: 0.83,
    dimmingBias: 0.05,
  },
  {
    streetlight_id: "LW-00048",
    name: "Parkside Walk",
    lat: 47.6141,
    lng: -122.3368,
    health: "OK",
    motion_detected: true,
    light_level: 49,
    temp_c: 17.5,
    humidity: 61.5,
    lux: 27,
    footfall: 0.46,
    dimmingBias: 0.26,
  },
  {
    streetlight_id: "LW-00049",
    name: "North Gate",
    lat: 47.6172,
    lng: -122.3321,
    health: "WARNING",
    motion_detected: false,
    light_level: 54,
    temp_c: 17.3,
    humidity: 56.2,
    lux: 23,
    footfall: 0.52,
    dimmingBias: 0.18,
  },
  {
    streetlight_id: "LW-00050",
    name: "South Waterfront",
    lat: 47.6038,
    lng: -122.3304,
    health: "OK",
    motion_detected: true,
    light_level: 61,
    temp_c: 18.4,
    humidity: 57.9,
    lux: 26,
    footfall: 0.71,
    dimmingBias: 0.14,
  },
];

function makeStreetlight(overrides = {}) {
  return {
    health: "OK",
    last_seen: new Date().toISOString(),
    diagnostics: {
      overall_ok: true,
      ambient_health: "SYSTEM_OK",
      mmwave_health: "SYSTEM_OK",
      th_ok: true,
      light_ok: true,
    },
    ...overrides,
  };
}

function getBlueprintById(id) {
  return (
    MOCK_POLE_BLUEPRINTS.find((pole) => pole.streetlight_id === id) ||
    MOCK_POLE_BLUEPRINTS[0]
  );
}

function hashString(value) {
  return String(value || "").split("").reduce((hash, char, index) => {
    return hash + char.charCodeAt(0) * (index + 1);
  }, 0);
}

function seededUnit(seed) {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseIntervalMs(interval) {
  const text = String(interval || "").trim();
  if (!text) return 60 * 60 * 1000;

  const number = Number.parseFloat(text);
  if (!Number.isFinite(number) || number <= 0) return 60 * 60 * 1000;

  if (text.endsWith("s")) return number * 1000;
  if (text.endsWith("m")) return number * 60 * 1000;
  if (text.endsWith("h")) return number * 60 * 60 * 1000;
  if (text.endsWith("d")) return number * 24 * 60 * 60 * 1000;
  return 60 * 60 * 1000;
}

function formatLastSeen(offsetMinutes) {
  return new Date(Date.now() - offsetMinutes * 60 * 1000).toISOString();
}

export function mockListStreetlights(tenantId) {
  return MOCK_POLE_BLUEPRINTS.map((pole, index) =>
    makeStreetlight({
      streetlight_id: pole.streetlight_id,
      name: pole.name,
      site_id: "CITY#SEA",
      location: {
        lat: pole.lat,
        lng: pole.lng,
      },
      tenant_id: tenantId,
      health: pole.health === "WARNING" ? "DEGRADED" : pole.health,
      last_seen: formatLastSeen(index * 7 + 3),
      diagnostics: {
        overall_ok: pole.health !== "CRITICAL",
        ambient_health:
          pole.health === "CRITICAL"
            ? "TOTAL_FAILURE"
            : pole.streetlight_id === "LW-00049"
            ? "DEGRADED"
            : "SYSTEM_OK",
        mmwave_health:
          pole.streetlight_id === "LW-00044" ? "PRIMARY_FAIL" : "SYSTEM_OK",
        th_ok: pole.streetlight_id !== "LW-00046",
        light_ok: pole.health !== "CRITICAL",
      },
    })
  );
}

export function mockGetStreetlight(id, tenantId) {
  const pole = getBlueprintById(id);

  return makeStreetlight({
    streetlight_id: id,
    tenant_id: tenantId,
    name: pole.name,
    site_id: "CITY#SEA",
    model: "LW-2025",
    installed_at: "2026-02-01T18:22:00+00:00",
    lat: pole.lat,
    lng: pole.lng,
    health: pole.health === "WARNING" ? "DEGRADED" : pole.health,
    last_seen: formatLastSeen(4),
    motion_detected: pole.motion_detected,
    diagnostics: {
      overall_ok: pole.health !== "CRITICAL",
      ambient_health:
        pole.health === "CRITICAL"
          ? "TOTAL_FAILURE"
          : pole.streetlight_id === "LW-00049"
          ? "DEGRADED"
          : "SYSTEM_OK",
      mmwave_health:
        pole.streetlight_id === "LW-00044" ? "PRIMARY_FAIL" : "SYSTEM_OK",
      th_ok: pole.streetlight_id !== "LW-00046",
      light_ok: pole.health !== "CRITICAL",
    },
  });
}

function getHealthSample(profile, sampleIndex) {
  if (profile.health === "CRITICAL") {
    if (sampleIndex % 28 >= 8 && sampleIndex % 28 <= 12) return "CRITICAL";
    if (sampleIndex % 19 === 0) return "WARNING";
    return "OK";
  }

  if (profile.health === "WARNING") {
    return sampleIndex % 18 >= 4 && sampleIndex % 18 <= 6 ? "WARNING" : "OK";
  }

  return sampleIndex % 43 === 0 ? "WARNING" : "OK";
}

function getMotionScore(profile, timestamp, sampleIndex) {
  const hour = new Date(timestamp).getHours() + new Date(timestamp).getMinutes() / 60;
  const morningPeak = Math.exp(-((hour - 7.5) ** 2) / 5.2);
  const eveningPeak = Math.exp(-((hour - 18.1) ** 2) / 8.8);
  const daytime = Math.exp(-((hour - 12.5) ** 2) / 22);
  const lateNight = Math.exp(-((hour - 22.3) ** 2) / 6.4);
  const pulse = seededUnit(hashString(profile.streetlight_id) + sampleIndex * 17);

  return (
    profile.footfall * 0.55 +
    morningPeak * 0.52 +
    eveningPeak * 0.68 +
    daytime * 0.22 +
    lateNight * 0.18 +
    pulse * 0.25
  );
}

function buildTelemetrySample(profile, timestamp, stepMs, sampleIndex) {
  const seedBase = hashString(`${profile.streetlight_id}-${timestamp}`);
  const noiseA = seededUnit(seedBase + 11);
  const noiseB = seededUnit(seedBase + 29);
  const noiseC = seededUnit(seedBase + 47);
  const hour = new Date(timestamp).getHours() + new Date(timestamp).getMinutes() / 60;
  const daylightCurve = Math.exp(-((hour - 13) ** 2) / 18);
  const eveningCurve = Math.exp(-((hour - 19.2) ** 2) / 10);
  const motionScore = getMotionScore(profile, timestamp, sampleIndex);
  const motion = motionScore >= 1.05;
  const health = getHealthSample(profile, sampleIndex);

  const nightOutput = 42 + profile.footfall * 22 + eveningCurve * 18 + noiseA * 10;
  const dayOutput = 7 + noiseA * 5;
  const lightLevel = clamp(
    daylightCurve > 0.45 ? dayOutput : nightOutput + (motion ? 10 : -8) - profile.dimmingBias * 24,
    6,
    health === "CRITICAL" ? 58 : 94
  );

  const lux = clamp(
    daylightCurve > 0.2
      ? 240 + daylightCurve * 520 + noiseB * 48
      : 8 + eveningCurve * 18 + motionScore * 7 + noiseB * 8,
    4,
    900
  );

  const temp = 14.8 + daylightCurve * 6.3 + noiseC * 1.7 + profile.footfall * 1.4;
  const humidity = clamp(69 - daylightCurve * 14 + noiseA * 5 + profile.dimmingBias * 7, 41, 82);

  return {
    time: new Date(timestamp).toISOString(),
    lux: Number(lux.toFixed(1)),
    temperature_c: Number(temp.toFixed(1)),
    humidity_pct: Number(humidity.toFixed(1)),
    motion,
    light_level_pct: Number(lightLevel.toFixed(1)),
    health,
    step_ms: stepMs,
  };
}

export function mockGetTelemetry(id, from, to, interval = "1h") {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  const step = Math.max(parseIntervalMs(interval), 60_000);
  const rows = [];
  const profile = getBlueprintById(id);

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return { streetlight_id: id, data: rows };
  }

  let sampleIndex = 0;
  for (let ts = start; ts <= end; ts += step) {
    rows.push(buildTelemetrySample(profile, ts, step, sampleIndex));
    sampleIndex += 1;
  }

  return { streetlight_id: id, data: rows };
}

export function mockUpdateMetadata(id, body) {
  return { message: "updated (mock)", streetlight_id: id, metadata: body };
}

export function mockListUsers() {
  return [
    {
      user_id: MOCK_PROFILE.sub,
      name: MOCK_PROFILE.name,
      email: MOCK_PROFILE.email,
      role: MOCK_PROFILE.role,
      tenant_id: MOCK_PROFILE.tenant_id,
      created_at: "2026-02-01T18:22:00Z",
    },
    {
      user_id: "mock-admin-avery",
      name: "Avery Brooks",
      email: "avery.brooks@city.gov",
      role: "admin",
      tenant_id: MOCK_PROFILE.tenant_id,
      created_at: "2026-02-03T15:12:00Z",
    },
    {
      user_id: "mock-operator-jules",
      name: "Jules Chen",
      email: "jules.chen@city.gov",
      role: "operator",
      tenant_id: MOCK_PROFILE.tenant_id,
      created_at: "2026-02-06T11:40:00Z",
    },
  ];
}

export function mockInviteUser(body = {}) {
  const email = String(body.email || "").trim();
  const name = String(body.name || "").trim() || email.split("@")[0] || "Invited user";

  return {
    user_id: `mock-user-${hashString(email || name)}`,
    name,
    email,
    role: body.role === "admin" ? "admin" : "operator",
    tenant_id: MOCK_PROFILE.tenant_id,
    created_at: new Date().toISOString(),
  };
}

export function mockRemoveUser(userId) {
  return { message: "User removed (mock)", user_id: userId };
}

export function mockSendStreetlightCommand(id, body = {}) {
  return {
    command_id: `cmd-mock-${Date.now().toString(36)}`,
    streetlight_id: id,
    command: body.command,
    params: body.params || {},
    status: "pending",
    dispatched_at: new Date().toISOString(),
  };
}

export function mockGetStreetlightCommands(id) {
  return {
    streetlight_id: id,
    commands: [],
  };
}
