import {
  buildPoleEvent,
  mergePoleSnapshot,
  mergeTelemetrySnapshot,
  toneForPole,
} from "./poleState";

describe("toneForPole", () => {
  test("returns active for motion events", () => {
    expect(
      toneForPole({
        motion_detected: true,
        health: "DEGRADED",
      })
    ).toBe("active");
  });

  test("returns warning for degraded health without motion", () => {
    expect(
      toneForPole({
        motion_detected: false,
        health: "DEGRADED",
      })
    ).toBe("warning");
  });
});

describe("mergeTelemetrySnapshot", () => {
  test("keeps existing fields when the incoming snapshot omits them", () => {
    expect(
      mergeTelemetrySnapshot(
        {
          health: "OK",
          motion_detected: false,
          temp_c: 23,
        },
        {
          light_level: 72,
        }
      )
    ).toEqual({
      health: "OK",
      motion_detected: false,
      temp_c: 23,
      light_level: 72,
    });
  });
});

describe("mergePoleSnapshot", () => {
  test("maps snapshot timestamps onto last_seen and preserves base coordinates", () => {
    expect(
      mergePoleSnapshot(
        {
          streetlight_id: "LW-00042",
          lat: 37.77,
          lng: -122.41,
          health: "OK",
          last_seen: null,
        },
        {
          timestamp: "2026-03-13T04:00:00Z",
          health: "CRITICAL",
        }
      )
    ).toEqual({
      streetlight_id: "LW-00042",
      lat: 37.77,
      lng: -122.41,
      health: "CRITICAL",
      last_seen: "2026-03-13T04:00:00Z",
      motion_detected: null,
      light_level: null,
      ambient_primary_ok: null,
      ambient_secondary_ok: null,
      th_ok: null,
      motion_primary_ok: null,
      motion_secondary_ok: null,
      temp_c: null,
      humidity: null,
      lux: null,
      motion_focus_lat: null,
      motion_focus_lng: null,
      motion_focus_radius_m: null,
    });
  });
});

describe("buildPoleEvent", () => {
  test("uses active tone for motion events", () => {
    expect(
      buildPoleEvent("LW-00042", {
        timestamp: "2026-03-13T04:00:00Z",
        motion_detected: true,
      })
    ).toMatchObject({
      tone: "active",
      label: "Motion detected",
      streetlightId: "LW-00042",
    });
  });
});
