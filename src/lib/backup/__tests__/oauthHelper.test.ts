type PromptResult = { type: string; params: Record<string, string> };

function loadOAuthModule({
  oneDriveClientId,
  dropboxAppKey,
  promptResult,
  exchangeResult,
}: {
  oneDriveClientId: string;
  dropboxAppKey: string;
  promptResult: PromptResult;
  exchangeResult: {
    accessToken: string;
    refreshToken?: string;
    issuedAt?: number;
    expiresIn?: number;
  };
}) {
  jest.resetModules();
  process.env.EXPO_PUBLIC_ONEDRIVE_CLIENT_ID = oneDriveClientId;
  process.env.EXPO_PUBLIC_DROPBOX_APP_KEY = dropboxAppKey;

  const mockPromptAsync = jest.fn().mockResolvedValue(promptResult);
  const mockExchangeCodeAsync = jest.fn().mockResolvedValue(exchangeResult);
  const mockLoggerInfo = jest.fn();

  jest.doMock("expo-auth-session", () => ({
    AuthRequest: class {
      codeVerifier = "verifier";
      constructor(_config: unknown) {}
      promptAsync = mockPromptAsync;
    },
    exchangeCodeAsync: (...args: unknown[]) => mockExchangeCodeAsync(...args),
    makeRedirectUri: () => "cobalt://redirect",
  }));
  jest.doMock("../../logger", () => ({
    Logger: {
      info: (...args: unknown[]) => mockLoggerInfo(...args),
    },
  }));
  jest.doMock("../providers/onedrive", () => ({
    ONEDRIVE_DISCOVERY: { tokenEndpoint: "https://onedrive/token" },
    ONEDRIVE_SCOPES: ["scope.a", "scope.b"],
  }));
  jest.doMock("../providers/dropbox", () => ({
    DROPBOX_DISCOVERY: { tokenEndpoint: "https://dropbox/token" },
  }));

  const mod = require("../oauthHelper");
  return { ...mod, mockPromptAsync, mockExchangeCodeAsync, mockLoggerInfo };
}

describe("backup oauthHelper", () => {
  it("throws when OneDrive client id is not configured", async () => {
    const { authenticateOneDrive } = loadOAuthModule({
      oneDriveClientId: "",
      dropboxAppKey: "db",
      promptResult: { type: "success", params: { code: "c1" } },
      exchangeResult: { accessToken: "a1" },
    });
    await expect(authenticateOneDrive()).rejects.toThrow("OneDrive Client ID not configured");
  });

  it("throws when Dropbox app key is not configured", async () => {
    const { authenticateDropbox } = loadOAuthModule({
      oneDriveClientId: "od",
      dropboxAppKey: "",
      promptResult: { type: "success", params: { code: "c1" } },
      exchangeResult: { accessToken: "a1" },
    });
    await expect(authenticateDropbox()).rejects.toThrow("Dropbox App Key not configured");
  });

  it("handles cancel/failure prompt result", async () => {
    const { authenticateOneDrive } = loadOAuthModule({
      oneDriveClientId: "od",
      dropboxAppKey: "db",
      promptResult: { type: "cancel", params: {} },
      exchangeResult: { accessToken: "a1" },
    });
    await expect(authenticateOneDrive()).rejects.toThrow("Authentication cancelled");
  });

  it("authenticates OneDrive and Dropbox with exchanged tokens", async () => {
    const one = loadOAuthModule({
      oneDriveClientId: "od-client",
      dropboxAppKey: "db-key",
      promptResult: { type: "success", params: { code: "auth-code" } },
      exchangeResult: {
        accessToken: "token-1",
        refreshToken: "refresh-1",
        issuedAt: 100,
        expiresIn: 3600,
      },
    });

    await expect(one.authenticateOneDrive()).resolves.toEqual({
      provider: "onedrive",
      accessToken: "token-1",
      refreshToken: "refresh-1",
      tokenExpiry: 3_700_000,
    });
    expect(one.mockExchangeCodeAsync).toHaveBeenCalled();
    expect(one.mockLoggerInfo).toHaveBeenCalledWith("OAuthHelper", "OneDrive OAuth completed");

    const two = loadOAuthModule({
      oneDriveClientId: "od-client",
      dropboxAppKey: "db-key",
      promptResult: { type: "success", params: { code: "auth-code-2" } },
      exchangeResult: {
        accessToken: "token-2",
        refreshToken: "refresh-2",
        issuedAt: 100,
        expiresIn: 7200,
      },
    });
    await expect(two.authenticateDropbox()).resolves.toEqual({
      provider: "dropbox",
      accessToken: "token-2",
      refreshToken: "refresh-2",
      tokenExpiry: 7_300_000,
    });
    expect(two.mockLoggerInfo).toHaveBeenCalledWith("OAuthHelper", "Dropbox OAuth completed");
  });
});
