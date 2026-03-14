export const LIGHTWISE_ENV = {
  WS_URL: (
    process.env.REACT_APP_WS_URL || process.env.REACT_APP_LIGHTWISE_WS_URL || ""
  ).trim(),
  API_BASE: (process.env.REACT_APP_API_BASE || "").trim(),
  TENANT_ID: (process.env.REACT_APP_TENANT_ID || "tenant-001").trim(),
  USE_MOCK:
    String(process.env.REACT_APP_USE_MOCK || "false").toLowerCase() === "true",
};

export const WS_CAPABILITIES = {
  subscribe: true,
  controls: false,
};

export const CONTEXT_ENV = {
  ...LIGHTWISE_ENV,
  wsCapabilities: WS_CAPABILITIES,
};
