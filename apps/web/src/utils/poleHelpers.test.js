import {
  mergeBackendAndLocalPoles,
  normalizeStreetlightFromApi,
} from "./poleHelpers";

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

describe("mergeBackendAndLocalPoles", () => {
  test("can prefer shared backend coordinates over stale local metadata", () => {
    expect(
      mergeBackendAndLocalPoles(
        [
          {
            streetlight_id: "LW-00001",
            name: "Main",
            lat: 47.6,
            lng: -122.2,
          },
        ],
        {
          "LW-00001": {
            name: "Local Main",
            lat: 1,
            lng: 2,
          },
        },
        { preferBackendCoordinates: true }
      )
    ).toEqual([
      {
        streetlight_id: "LW-00001",
        name: "Local Main",
        lat: 47.6,
        lng: -122.2,
      },
    ]);
  });

  test("keeps local coordinates for local-only streetlights", () => {
    expect(
      mergeBackendAndLocalPoles(
        [],
        {
          "LW-LOCAL": {
            name: "Local only",
            lat: 47.61,
            lng: -122.2,
          },
        },
        { preferBackendCoordinates: true }
      )
    ).toEqual([
      expect.objectContaining({
        streetlight_id: "LW-LOCAL",
        name: "Local only",
        lat: 47.61,
        lng: -122.2,
      }),
    ]);
  });
});
