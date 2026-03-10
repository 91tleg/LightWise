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
        ambient_primary_ok: true,
        ambient_secondary_ok: true,
        th_ok: false,
        motion_primary_ok: true,
        motion_secondary_ok: true,
      })
    ).toEqual({
      label: "Fault detected",
      tone: "critical",
    });
  });

  test("returns healthy when all present sensor checks are true", () => {
    expect(
      getCombinedSensorHealth({
        ambient_primary_ok: true,
        ambient_secondary_ok: true,
        th_ok: true,
        motion_primary_ok: true,
        motion_secondary_ok: true,
      })
    ).toEqual({
      label: "All sensors OK",
      tone: "healthy",
    });
  });

  test("ignores null and undefined values if at least one valid check exists", () => {
    expect(
      getCombinedSensorHealth({
        ambient_primary_ok: true,
        ambient_secondary_ok: null,
        th_ok: undefined,
        motion_primary_ok: true,
        motion_secondary_ok: true,
      })
    ).toEqual({
      label: "All sensors OK",
      tone: "healthy",
    });
  });
});