export const MOCK_PROFILE = {
  sub:        "mock-user",
  tenant_id:  "tenant-001",
  first_name: "Demo",
  last_name:  "Operator",
  name:       "Demo Operator",
  email:      "operator@lightwise.local",
  role:       "operator",
};

function makeStreetlight(overrides = {}) {
  return {
    health:                "OK",
    last_seen:             new Date().toISOString(),
    motion_detected:       false,
    ambient_primary_ok:    true,
    ambient_secondary_ok:  true,
    th_ok:                 true,
    motion_primary_ok:     true,
    motion_secondary_ok:   true,
    ...overrides,
  };
}

export function mockListStreetlights(tenantId) {
  return [
    makeStreetlight({
      streetlight_id:  "LW-00042",
      tenant_id:       tenantId,
      name:            "main",
      lat:             47.6101,
      lng:             -122.2015,
      motion_detected: true,
    }),
    makeStreetlight({
      streetlight_id: "LW-00043",
      tenant_id:      tenantId,
      name:           "secondary",
      lat:            47.6112,
      lng:            -122.2025,
    }),
  ];
}

export function mockGetStreetlight(id, tenantId) {
  return makeStreetlight({
    streetlight_id: id,
    tenant_id:      tenantId,
    name:           `Streetlight ${id}`,
    lat:            47.6101,
    lng:            -122.2015,
  });
}

export function mockGetTelemetry(id, from, to) {
  const start = new Date(from).getTime();
  const end   = new Date(to).getTime();
  const step  = Math.max(Math.floor((end - start) / 20), 60_000);
  const rows  = [];

  for (let ts = start; ts <= end; ts += step) {
    rows.push({
      time:             new Date(ts).toISOString(),
      lux:              Number((20 + Math.random() * 80).toFixed(2)),
      temperature_c:    Number((15 + Math.random() * 12).toFixed(1)),
      humidity_pct:     Number((45 + Math.random() * 30).toFixed(1)),
      light_level_pct:  Number((10 + Math.random() * 90).toFixed(1)),
    });
  }

  return { streetlight_id: id, data: rows };
}

export function mockUpdateMetadata(id, body) {
  return { message: "updated (mock)", streetlight_id: id, metadata: body };
}
