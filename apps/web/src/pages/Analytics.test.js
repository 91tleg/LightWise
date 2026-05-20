import {
  buildAnalyticsReport,
  buildRawTelemetryCsv,
  getPresetRange,
  normalizeTelemetryRows,
  resolveTelemetryInterval,
} from "./analytics.helpers";

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
        motion_detected: true,
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
        motion_detected: true,
        light_level: 44,
        health: null,
      },
    ]);
  });

  test("handles the updated backend timeseries field names", () => {
    const payload = {
      data: [
        {
          time: "2026-03-09T21:40:00Z",
          lux: "91.2",
          temp_c: "18.6",
          hum_pct: "61.1",
          motion: "1",
          light_pct: "52.4",
        },
      ],
    };

    const result = normalizeTelemetryRows(payload);

    expect(result).toEqual([
      {
        timestamp: "2026-03-09T21:40:00Z",
        lux: 91,
        temp_c: 18.6,
        humidity: 61.1,
        motion: true,
        motion_detected: true,
        light_level: 52,
        health: null,
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

describe("getPresetRange", () => {
  test("live preset covers the last minute", () => {
    const range = getPresetRange("live", new Date("2026-04-21T20:00:00Z"));

    expect(new Date(range.to).getTime() - new Date(range.from).getTime()).toBe(
      60 * 1000
    );
  });
});

describe("resolveTelemetryInterval", () => {
  test("keeps seconds buckets for live-sized ranges", () => {
    expect(
      resolveTelemetryInterval(
        "30s",
        "2026-04-21T12:00:00",
        "2026-04-21T13:00:00"
      )
    ).toBe("30s");
  });

  test("coerces seconds buckets for longer ranges", () => {
    expect(
      resolveTelemetryInterval(
        "30s",
        "2026-04-21T00:00:00",
        "2026-04-21T06:00:00"
      )
    ).toBe("1m");
  });
});

describe("buildAnalyticsReport", () => {
  const streetlights = [
    {
      streetlight_id: "LW-10001",
      name: "Northwest Plaza",
      lat: 47.62,
      lng: -122.33,
      health: "OK",
      last_seen: "2026-03-10T04:00:00",
    },
    {
      streetlight_id: "LW-10002",
      name: "South Pier",
      lat: 47.6,
      lng: -122.3,
      health: "OK",
      last_seen: "2026-03-10T01:00:00",
    },
  ];

  const telemetry = {
    "LW-10001": {
      data: [
        {
          time: "2026-03-10T00:00:00",
          lux: 14,
          temp_c: 19,
          humidity: 60,
          motion: true,
          light_level_pct: 80,
          health: "OK",
        },
        {
          time: "2026-03-10T01:00:00",
          lux: 12,
          temp_c: 19,
          humidity: 60,
          motion: false,
          light_level_pct: 62,
          health: "WARNING",
        },
        {
          time: "2026-03-10T02:00:00",
          lux: 10,
          temp_c: 18,
          humidity: 58,
          motion: true,
          light_level_pct: 48,
          health: "OK",
        },
        {
          time: "2026-03-10T03:00:00",
          lux: 9,
          temp_c: 18,
          humidity: 58,
          motion: true,
          light_level_pct: 56,
          health: "WARNING",
        },
        {
          time: "2026-03-10T04:00:00",
          lux: 8,
          temp_c: 17,
          humidity: 57,
          motion: false,
          light_level_pct: 44,
          health: "OK",
        },
      ],
    },
    "LW-10002": {
      data: [
        {
          time: "2026-03-10T00:00:00",
          lux: 15,
          temp_c: 18,
          humidity: 55,
          motion: false,
          light_level_pct: 90,
          health: "OK",
        },
        {
          time: "2026-03-10T01:00:00",
          lux: 13,
          temp_c: 18,
          humidity: 55,
          motion: true,
          light_level_pct: 84,
          health: "OK",
        },
      ],
    },
  };

  test("aggregates zone, fault, and motion analytics", () => {
    const report = buildAnalyticsReport(streetlights, telemetry, {
      from: "2026-03-10T00:00:00",
      to: "2026-03-10T04:00:00",
      interval: "1h",
    });

    expect(report.zones.map((zone) => zone.zone)).toEqual(
      expect.arrayContaining(["North West", "South East"])
    );
    expect(report.headline.energySavedKwh).toBeGreaterThan(0);
    expect(report.headline.faultsResolved).toBe(2);
    expect(report.headline.activeFaults).toBe(0);
    expect(report.faults.some((fault) => fault.recurring)).toBe(true);
    expect(report.hourlyMotion.find((bucket) => bucket.hour === 0)?.activityPct).toBe(50);
    expect(report.metricSeries.light_level[0]).toMatchObject({
      timestamp: "2026-03-10T00:00:00",
      value: 85,
    });
    expect(report.metricSeries.motion[0]).toMatchObject({
      timestamp: "2026-03-10T00:00:00",
      value: 50,
    });
  });

  test("uses the pole name instead of a fabricated central zone for single-pole analytics", () => {
    const report = buildAnalyticsReport(
      [
        {
          streetlight_id: "LW-00001",
          name: "Main",
          lat: 47.61,
          lng: -122.2,
          health: "OK",
        },
      ],
      {
        "LW-00001": {
          data: [
            {
              time: "2026-03-10T00:00:00",
              lux: 12,
              motion: true,
              light_level_pct: 75,
              health: "OK",
            },
          ],
        },
      },
      {
        from: "2026-03-10T00:00:00",
        to: "2026-03-10T01:00:00",
        interval: "1h",
      }
    );

    expect(report.zones.map((zone) => zone.zone)).toEqual(["Main"]);
    expect(report.rawTelemetryRows[0].zone).toBe("Main");
  });

  test("does not fabricate analytics when telemetry is missing", () => {
    const report = buildAnalyticsReport([streetlights[0]], {}, {
      from: "2026-03-10T00:00:00",
      to: "2026-03-10T04:00:00",
      interval: "1h",
    });

    expect(report.summary.totalPoles).toBe(1);
    expect(report.summary.reportingPoles).toBe(0);
    expect(report.summary.telemetryRows).toBe(0);
    expect(report.headline.energySavedKwh).toBeNull();
    expect(report.headline.uptimePct).toBeNull();
    expect(report.headline.faultsResolved).toBeNull();
    expect(report.zones).toEqual([]);
    expect(report.energySeries).toEqual([]);
    expect(report.faults).toEqual([]);
    expect(report.motionMap).toEqual([]);
    expect(report.hourlyMotion.some((bucket) => bucket.samples > 0)).toBe(false);
  });

  test("keeps live second-level energy values above zero", () => {
    const report = buildAnalyticsReport(
      [
        {
          streetlight_id: "LW-00001",
          name: "Main",
          health: "OK",
        },
      ],
      {
        "LW-00001": {
          data: [
            {
              time: "2026-03-10T00:00:00",
              lux: 14,
              motion: true,
              light_level_pct: 80,
              health: "OK",
            },
          ],
        },
      },
      {
        from: "2026-03-10T00:00:00",
        to: "2026-03-10T00:01:00",
        interval: "5s",
      }
    );

    expect(report.energySeries[0].actualKwh).toBeGreaterThan(0);
    expect(report.energySeries[0].actualKwh).toBeLessThan(0.01);
  });

  test("exports raw telemetry csv with analytics columns", () => {
    const report = buildAnalyticsReport(streetlights, telemetry, {
      from: "2026-03-10T00:00:00",
      to: "2026-03-10T04:00:00",
      interval: "1h",
    });

    const csv = buildRawTelemetryCsv(report);

    expect(csv).toContain("timestamp,pole_id,pole_name,zone,health,motion");
    expect(csv).toContain("LW-10001");
    expect(csv).toContain("Northwest Plaza");
    expect(csv).toContain("actual_kwh");
  });
});
