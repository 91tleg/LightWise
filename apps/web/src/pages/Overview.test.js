import {
  getCombinedSensorHealth,
  getOverviewPoleList,
  isPoleTelemetryStale,
} from "./overview.helpers";

describe("getOverviewPoleList", () => {
  test("keeps only the working overview pole when it is present", () => {
    const poles = [
      { streetlight_id: "LW-00043" },
      { streetlight_id: "LW-00100" },
      { streetlight_id: "LW-00044" },
    ];

    expect(getOverviewPoleList(poles)).toEqual([{ streetlight_id: "LW-00100" }]);
  });

  test("falls back to one pole when the working pole is unavailable", () => {
    const poles = [{ streetlight_id: "LW-00043" }, { streetlight_id: "LW-00044" }];

    expect(getOverviewPoleList(poles)).toEqual([{ streetlight_id: "LW-00043" }]);
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

  test("returns false when telemetry is recent", () => {
    expect(
      isPoleTelemetryStale(
        { last_seen: "2026-04-23T18:58:00Z" },
        new Date("2026-04-23T19:00:00Z")
      )
    ).toBe(false);
  });

  test("returns true when telemetry is stale", () => {
    expect(
      isPoleTelemetryStale(
        { last_seen: "2026-04-23T18:40:00Z" },
        new Date("2026-04-23T19:00:00Z")
      )
    ).toBe(true);
  });
});
