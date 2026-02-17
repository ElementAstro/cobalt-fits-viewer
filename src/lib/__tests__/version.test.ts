function getVersionInfoWithMocks({
  nativeApplicationVersion,
  nativeBuildVersion,
  runtimeVersion,
  sdkVersion,
}: {
  nativeApplicationVersion: string | null;
  nativeBuildVersion: string | null;
  runtimeVersion: unknown;
  sdkVersion: string | undefined;
}) {
  jest.resetModules();
  jest.doMock("expo-application", () => ({
    nativeApplicationVersion,
    nativeBuildVersion,
  }));
  jest.doMock("expo-constants", () => ({
    __esModule: true,
    default: {
      expoConfig: {
        runtimeVersion,
        sdkVersion,
      },
    },
  }));

  const { getAppVersionInfo } = require("../version");
  return getAppVersionInfo();
}

describe("version", () => {
  it("reads version fields from expo modules", () => {
    expect(
      getVersionInfoWithMocks({
        nativeApplicationVersion: "2.5.0",
        nativeBuildVersion: "250",
        runtimeVersion: "2.5.0-runtime",
        sdkVersion: "54.0.0",
      }),
    ).toEqual({
      nativeVersion: "2.5.0",
      buildVersion: "250",
      runtimeVersion: "2.5.0-runtime",
      sdkVersion: "54.0.0",
    });
  });

  it("uses fallback native version and null runtime version", () => {
    expect(
      getVersionInfoWithMocks({
        nativeApplicationVersion: null,
        nativeBuildVersion: null,
        runtimeVersion: 123,
        sdkVersion: undefined,
      }),
    ).toEqual({
      nativeVersion: "1.0.0",
      buildVersion: null,
      runtimeVersion: null,
      sdkVersion: undefined,
    });
  });
});
