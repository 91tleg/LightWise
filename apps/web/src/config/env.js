export const LIGHTWISE_ENV = {
  WS_URL: (
    process.env.REACT_APP_WS_URL || process.env.REACT_APP_LIGHTWISE_WS_URL || ""
  ).trim(),
  API_BASE: (process.env.REACT_APP_API_BASE || "").trim(),
  TENANT_ID: (process.env.REACT_APP_TENANT_ID || "tenant-001").trim(),
  USE_MOCK:
    String(process.env.REACT_APP_USE_MOCK || "false").toLowerCase() === "true",
};

export const COGNITO_ENV = {
  USER_POOL_ID: (process.env.REACT_APP_COGNITO_USER_POOL_ID || "").trim(),
  DOMAIN: (process.env.REACT_APP_COGNITO_DOMAIN || "").trim(),
  CLIENT_ID: (process.env.REACT_APP_COGNITO_CLIENT_ID || "").trim(),
  REDIRECT_URI: (process.env.REACT_APP_COGNITO_REDIRECT_URI || "").trim(),
  LOGOUT_URI: (process.env.REACT_APP_COGNITO_LOGOUT_URI || "").trim(),
  SCOPES: (process.env.REACT_APP_COGNITO_SCOPES || "email openid phone profile").trim(),
};

export const WS_CAPABILITIES = {
  subscribe: true,
  controls: false,
};

export const CONTEXT_ENV = {
  ...LIGHTWISE_ENV,
  wsCapabilities: WS_CAPABILITIES,
};
