var mockEnv = {
  API_BASE: "https://api.example.com",
  USE_MOCK: false,
  TENANT_ID: "tenant-001",
};

var mockFetchIdTokenSilently = jest.fn();
var mockEmitAuthRequired = jest.fn();
var mockRedirectToSignIn = jest.fn();
var mockPruneStoredPoleState = jest.fn();

jest.mock("../config/env", () => ({
  get LIGHTWISE_ENV() {
    return mockEnv;
  },
}));

jest.mock("./auth", () => ({
  fetchIdTokenSilently: (...args) => mockFetchIdTokenSilently(...args),
  emitAuthRequired: (...args) => mockEmitAuthRequired(...args),
  redirectToSignIn: (...args) => mockRedirectToSignIn(...args),
}));

jest.mock("./poleStorage", () => ({
  pruneStoredPoleState: (...args) => mockPruneStoredPoleState(...args),
}));

import {
  getOperatorProfile,
  getStreetlightTelemetry,
  listStreetlights,
} from "./api";

function jsonResponse(body, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  };
}

describe("api service", () => {
  beforeEach(() => {
    mockEnv.API_BASE = "https://api.example.com";
    mockEnv.USE_MOCK = false;
    mockEnv.TENANT_ID = "tenant-001";
    mockFetchIdTokenSilently.mockReset();
    mockEmitAuthRequired.mockReset();
    mockRedirectToSignIn.mockReset();
    mockPruneStoredPoleState.mockReset();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  test("surfaces operator profile fetch failures when mocks are disabled", async () => {
    mockFetchIdTokenSilently.mockResolvedValue("token-123");
    global.fetch.mockRejectedValue(new TypeError("network down"));

    await expect(getOperatorProfile()).rejects.toThrow(
      "LightWise is having trouble connecting. Please try again."
    );
  });

  test("surfaces streetlight inventory fetch failures instead of falling back", async () => {
    mockFetchIdTokenSilently.mockResolvedValue("token-123");
    global.fetch.mockRejectedValue(new TypeError("service unavailable"));

    await expect(listStreetlights()).rejects.toThrow(
      "LightWise is having trouble connecting. Please try again."
    );
  });

  test("surfaces telemetry fetch failures instead of returning mock telemetry", async () => {
    mockFetchIdTokenSilently.mockResolvedValue("token-123");
    global.fetch.mockRejectedValue(new TypeError("timeout"));

    await expect(
      getStreetlightTelemetry("LW-00043", {
        from: "2026-04-25T00:00:00Z",
        to: "2026-04-25T01:00:00Z",
        interval: "5m",
      })
    ).rejects.toThrow(
      "LightWise is having trouble connecting. Please try again."
    );
  });

  test("still uses explicit mocks when USE_MOCK is enabled", async () => {
    mockEnv.USE_MOCK = true;

    const telemetry = await getStreetlightTelemetry("LW-00043", {
      from: "2026-04-25T00:00:00Z",
      to: "2026-04-25T01:00:00Z",
      interval: "5m",
    });

    expect(Array.isArray(telemetry.data)).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("continues to return live API data when the request succeeds", async () => {
    mockFetchIdTokenSilently.mockResolvedValue("token-123");
    global.fetch.mockResolvedValue(
      jsonResponse({
        data: [{ streetlight_id: "LW-00043", name: "Main & Bellevue way" }],
      })
    );

    const result = await listStreetlights();

    expect(result).toEqual([
      expect.objectContaining({
        streetlight_id: "LW-00043",
        name: "Main & Bellevue way",
      }),
    ]);
  });
});
