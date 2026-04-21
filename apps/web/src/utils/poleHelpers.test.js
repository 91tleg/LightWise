import { normalizeStreetlightFromApi } from "./poleHelpers";

describe("normalizeStreetlightFromApi", () => {
  test("reads nested location and diagnostics from the updated list contract", () => {
    expect(
      normalizeStreetlightFromApi({
        streetlight_id: "LW-00100",
        name: "Main Street",
        site_id: "CITY#SEA",
        health: "OK",
        last_seen: "2026-04-14T22:00:00Z",
        motion_detected: true,
        light_level: 76,
        temp_c: 21,
        humidity: 59,
        lux: 44.5,
        location: {
          lat: 47.6101,
          lng: -122.2015,
        },
        diagnostics: {
          overall_ok: true,
          ambient_health: "SYSTEM_OK",
          mmwave_health: "DEGRADED",
          th_ok: true,
          light_ok: true,
        },
      })
    ).toEqual(
      expect.objectContaining({
        streetlight_id: "LW-00100",
        name: "Main Street",
        site_id: "CITY#SEA",
        health: "OK",
        motion_detected: true,
        light_level: 76,
        temp_c: 21,
        humidity: 59,
        lux: 44.5,
        lat: 47.6101,
        lng: -122.2015,
        overall_ok: true,
        ambient_health: "SYSTEM_OK",
        mmwave_health: "DEGRADED",
        th_ok: true,
        light_ok: true,
        diagnostics: {
          overall_ok: true,
          ambient_health: "SYSTEM_OK",
          mmwave_health: "DEGRADED",
          th_ok: true,
          light_ok: true,
        },
      })
    );
  });
});
