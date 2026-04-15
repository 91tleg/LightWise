import { getCombinedSensorHealth } from "./overview.helpers";

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
