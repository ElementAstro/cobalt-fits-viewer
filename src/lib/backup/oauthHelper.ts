/**
 * OAuth 认证辅助工具
 * 使用 expo-auth-session 的非 Hook API 发起 OAuth 流程
 * 适用于 OneDrive / Dropbox
 */

import { AuthRequest, exchangeCodeAsync, makeRedirectUri } from "expo-auth-session";
import { LOG_TAGS, Logger } from "../logger";
import { ONEDRIVE_DISCOVERY, ONEDRIVE_SCOPES } from "./providers/onedrive";
import { DROPBOX_DISCOVERY } from "./providers/dropbox";
import type { CloudProviderConfig } from "./types";

const TAG = LOG_TAGS.OAuthHelper;

const REDIRECT_URI = makeRedirectUri({ scheme: "cobalt" });

// Client IDs — replace with real values or read from env/config
// Users should set these in a config file or env before deploying
const ONEDRIVE_CLIENT_ID = process.env.EXPO_PUBLIC_ONEDRIVE_CLIENT_ID ?? "";
const DROPBOX_APP_KEY = process.env.EXPO_PUBLIC_DROPBOX_APP_KEY ?? "";

/**
 * 启动 OneDrive OAuth 流程并返回 tokens
 */
export async function authenticateOneDrive(): Promise<CloudProviderConfig> {
  if (!ONEDRIVE_CLIENT_ID) {
    throw new Error("OneDrive Client ID not configured. Set EXPO_PUBLIC_ONEDRIVE_CLIENT_ID.");
  }

  const request = new AuthRequest({
    clientId: ONEDRIVE_CLIENT_ID,
    scopes: ONEDRIVE_SCOPES,
    redirectUri: REDIRECT_URI,
  });

  const result = await request.promptAsync(ONEDRIVE_DISCOVERY);

  if (result.type !== "success" || !result.params.code) {
    throw new Error(
      result.type === "cancel" ? "Authentication cancelled" : "Authentication failed",
    );
  }

  // Exchange auth code for tokens
  const tokenResult = await exchangeCodeAsync(
    {
      clientId: ONEDRIVE_CLIENT_ID,
      code: result.params.code,
      redirectUri: REDIRECT_URI,
      extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined,
    },
    ONEDRIVE_DISCOVERY,
  );

  Logger.info(TAG, "OneDrive OAuth completed");

  return {
    provider: "onedrive",
    accessToken: tokenResult.accessToken,
    refreshToken: tokenResult.refreshToken ?? undefined,
    tokenExpiry: tokenResult.issuedAt
      ? (tokenResult.issuedAt + (tokenResult.expiresIn ?? 3600)) * 1000
      : Date.now() + 3600 * 1000,
  };
}

/**
 * 启动 Dropbox OAuth 流程并返回 tokens
 */
export async function authenticateDropbox(): Promise<CloudProviderConfig> {
  if (!DROPBOX_APP_KEY) {
    throw new Error("Dropbox App Key not configured. Set EXPO_PUBLIC_DROPBOX_APP_KEY.");
  }

  const request = new AuthRequest({
    clientId: DROPBOX_APP_KEY,
    redirectUri: REDIRECT_URI,
    scopes: [],
    extraParams: {
      token_access_type: "offline",
    },
  });

  const result = await request.promptAsync(DROPBOX_DISCOVERY);

  if (result.type !== "success" || !result.params.code) {
    throw new Error(
      result.type === "cancel" ? "Authentication cancelled" : "Authentication failed",
    );
  }

  // Exchange auth code for tokens
  const tokenResult = await exchangeCodeAsync(
    {
      clientId: DROPBOX_APP_KEY,
      code: result.params.code,
      redirectUri: REDIRECT_URI,
      extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined,
    },
    DROPBOX_DISCOVERY,
  );

  Logger.info(TAG, "Dropbox OAuth completed");

  return {
    provider: "dropbox",
    accessToken: tokenResult.accessToken,
    refreshToken: tokenResult.refreshToken ?? undefined,
    tokenExpiry: tokenResult.issuedAt
      ? (tokenResult.issuedAt + (tokenResult.expiresIn ?? 14400)) * 1000
      : Date.now() + 14400 * 1000,
  };
}
