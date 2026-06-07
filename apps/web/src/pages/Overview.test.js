import {
  getCombinedSensorHealth,
  getOverviewConnectionSummary,
  getOverviewPoleList,
  isPoleTelemetryStale,
} from "./overview.helpers";

describe("getOverviewPoleList", () => {
  test("returns every pole with an id", () => {
    const poles = [
      { streetlight_id: "LW-00043" },
      { streetlight_id: "LW-00100" },
      { streetlight_id: "LW-00044" },
      { streetlight_id: "" },
    ];

    expect(getOverviewPoleList(poles)).toEqual([
      { streetlight_id: "LW-00043" },
      { streetlight_id: "LW-00100" },
      { streetlight_id: "LW-00044" },
    ]);
  });

  test("returns an empty list when no poles are available", () => {
    expect(getOverviewPoleList(null)).toEqual([]);
  });
});

describe("getCombinedSensorHealth", () => {
  test("returns neutral when no sensor values exist", () => {
    expect(getCombinedSensorHealth({})).toEqual({
      label: "Waiting for data",
      tone: "neutral",
    });
  });

  test("returns critical when any sensor has fault", () => {
    expect(
      getCombinedSensorHealth({
        diagnostics: {
          overall_ok: false,
          ambient_health: "TOTAL_FAILURE",
          mmwave_health: "SYSTEM_OK",
          th_ok: false,
          light_ok: false,
        },
      })
    ).toEqual({
      label: "Fault detected",
      tone: "critical",
    });
  });

  test("returns healthy when all present sensor checks are true", () => {
    expect(
      getCombinedSensorHealth({
        diagnostics: {
          overall_ok: true,
          ambient_health: "SYSTEM_OK",
          mmwave_health: "SYSTEM_OK",
          th_ok: true,
          light_ok: true,
        },
      })
    ).toEqual({
      label: "All sensors OK",
      tone: "healthy",
    });
  });

  test("returns warning when a sensor is degraded", () => {
    expect(
      getCombinedSensorHealth({
        diagnostics: {
          overall_ok: true,
          ambient_health: "DEGRADED",
          mmwave_health: "SYSTEM_OK",
          th_ok: true,
          light_ok: true,
        },
      })
    ).toEqual({
      label: "Sensors degraded",
      tone: "warning",
    });
  });
});

describe("isPoleTelemetryStale", () => {
  test("returns true when last_seen is missing", () => {
    expect(isPoleTelemetryStale({}, new Date("2026-04-23T19:00:00Z"))).toBe(true);
  });

  test("returns false when telemetry is within the heartbeat window", () => {
    expect(
      isPoleTelemetryStale(
        { last_seen: "2026-04-23T18:59:30Z" },
        new Date("2026-04-23T19:00:00Z")
      )
    ).toBe(false);
  });

  test("returns true when the heartbeat window has elapsed", () => {
    expect(
      isPoleTelemetryStale(
        { last_seen: "2026-04-23T18:58:30Z" },
        new Date("2026-04-23T19:00:00Z")
      )
    ).toBe(true);
  });
});

describe("getOverviewConnectionSummary", () => {
  test("summarizes mixed online and offline streetlights", () => {
    const now = new Date("2026-04-23T19:00:00Z");
    const poles = [
      { streetlight_id: "LW-00001", last_seen: "2026-04-23T18:59:45Z" },
      { streetlight_id: "LW-00002", last_seen: "2026-04-23T18:58:30Z" },
      { streetlight_id: "LW-00003", last_seen: "2026-04-23T18:58:00Z" },
      { streetlight_id: "LW-00004", last_seen: null },
      { streetlight_id: "LW-00005", last_seen: "bad-date" },
    ];

    expect(getOverviewConnectionSummary(poles, now)).toEqual({
      total: 5,
      online: 1,
      offline: 4,
      status: "1/5 Online",
      note: "4 offline / 5 total",
      tone: "warning",
    });
  });

  test("summarizes all offline streetlights", () => {
    const now = new Date("2026-04-23T19:00:00Z");

    expect(
      getOverviewConnectionSummary(
        [{ streetlight_id: "LW-00001", last_seen: "2026-04-23T18:58:00Z" }],
        now
      )
    ).toEqual({
      total: 1,
      online: 0,
      offline: 1,
      status: "All Offline",
      note: "1 streetlight offline",
      tone: "critical",
    });
  });
});
