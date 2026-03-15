import { Amplify } from "aws-amplify";
import { COGNITO_ENV } from "./env";

function normalizeDomain(domain = "") {
  return String(domain || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

function normalizeUrl(value = "", fallbackPath = "") {
  const trimmed = String(value || "").trim();
  if (trimmed) {
    return trimmed;
  }

  if (typeof window === "undefined") {
    return "";
  }

  return `${window.location.origin}${fallbackPath}`;
}

function getScopes() {
  return String(COGNITO_ENV.SCOPES || "email openid phone profile")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: COGNITO_ENV.USER_POOL_ID,
      userPoolClientId: COGNITO_ENV.CLIENT_ID,
      loginWith: {
        oauth: {
          domain: normalizeDomain(COGNITO_ENV.DOMAIN),
          scopes: getScopes(),
          redirectSignIn: [normalizeUrl(COGNITO_ENV.REDIRECT_URI, "/callback")],
          redirectSignOut: [normalizeUrl(COGNITO_ENV.LOGOUT_URI, "/")],
          responseType: "code",
        },
      },
    },
  },
};

const hasRequiredConfig =
  amplifyConfig.Auth.Cognito.userPoolId &&
  amplifyConfig.Auth.Cognito.userPoolClientId &&
  amplifyConfig.Auth.Cognito.loginWith.oauth.domain;

if (hasRequiredConfig) {
  Amplify.configure(amplifyConfig);
} else if (typeof window !== "undefined") {
  console.warn("Amplify Auth is missing Cognito configuration values.");
}

export default amplifyConfig;
