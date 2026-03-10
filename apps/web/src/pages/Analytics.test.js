import { normalizeTelemetryRows } from "./analytics.helpers";

describe("normalizeTelemetryRows", () => {
  test("handles array payload directly", () => {
    const payload = [
      {
        timestamp: "2026-03-09T21:30:00Z",
        data: {
          lux: 123.7,
          temp_c: 22.34,
          humidity: 60.66,
          motion: true,
          light_level: 78.8,
          health: "OK",
        },
      },
    ];

    const result = normalizeTelemetryRows(payload);

    expect(result).toEqual([
      {
        timestamp: "2026-03-09T21:30:00Z",
        lux: 124,
        temp_c: 22.3,
        humidity: 60.7,
        motion: true,
        light_level: 79,
        health: "OK",
      },
    ]);
  });

  test("handles payload.data wrapper", () => {
    const payload = {
      data: [
        {
          time: "2026-03-09T21:35:00Z",
          lux: 88.2,
          temp_c: 19.99,
          humidity: 50.01,
          motion: "true",
          light_level: 44.4,
        },
      ],
    };

    const result = normalizeTelemetryRows(payload);

    expect(result).toEqual([
      {
        timestamp: "2026-03-09T21:35:00Z",
        lux: 88,
        temp_c: 20,
        humidity: 50,
        motion: true,
        light_level: 44,
        health: "OK",
      },
    ]);
  });

  test("falls back to row index when timestamp is missing", () => {
    const payload = [
      {
        data: {
          lux: 10,
          temp_c: 20,
          humidity: 30,
          motion: false,
          light_level: 40,
        },
      },
    ];

    const result = normalizeTelemetryRows(payload);

    expect(result[0].timestamp).toBe("row-0");
  });

  test("returns empty array for unsupported payload", () => {
    expect(normalizeTelemetryRows(null)).toEqual([]);
    expect(normalizeTelemetryRows({})).toEqual([]);
  });
});