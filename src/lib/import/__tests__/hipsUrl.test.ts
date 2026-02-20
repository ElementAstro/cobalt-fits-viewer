import { parseHiPSCutoutRequest } from "../hipsUrl";

describe("parseHiPSCutoutRequest", () => {
  it("returns null for regular URL", () => {
    expect(parseHiPSCutoutRequest("https://example.com/image.fits")).toBeNull();
  });

  it("parses explicit hips=1 cutout request", () => {
    const request = parseHiPSCutoutRequest(
      "https://example.com/hips?hips=1&source=https%3A%2F%2Fhips.example.org%2Fsurvey&ra=83.63&dec=22.01&fov=1.2",
    );
    expect(request).not.toBeNull();
    expect(request?.hipsInput).toBe("https://hips.example.org/survey");
    expect(request?.options.backend).toBe("local");
    expect(request?.options.cutout).toEqual(
      expect.objectContaining({
        width: 512,
        height: 512,
        ra: 83.63,
        dec: 22.01,
        fov: 1.2,
        projection: "TAN",
      }),
    );
  });

  it("parses hipsId and optional settings", () => {
    const request = parseHiPSCutoutRequest(
      "https://example.com/cutout?hipsId=CDS/P/2MASS/K&ra=10&dec=-20&fov=2.5&width=1024&height=768&backend=auto&timeoutMs=9000",
    );
    expect(request?.hipsInput).toBe("https://example.com/cutout");
    expect(request?.options.hipsId).toBe("CDS/P/2MASS/K");
    expect(request?.options.backend).toBe("auto");
    expect(request?.options.timeoutMs).toBe(9000);
    expect(request?.options.cutout.width).toBe(1024);
    expect(request?.options.cutout.height).toBe(768);
    expect(request?.suggestedFilename).toMatch(/^hips_CDS_P_2MASS_K\.fits$/);
  });

  it("throws if required cutout coordinates are missing", () => {
    expect(() =>
      parseHiPSCutoutRequest("https://example.com/hips?hips=1&dec=22.01&fov=1.2"),
    ).toThrow("requires ra");
  });

  it("throws if remote backend has no hipsId", () => {
    expect(() =>
      parseHiPSCutoutRequest(
        "https://example.com/hips?hips=1&backend=remote&ra=83.63&dec=22.01&fov=1.2",
      ),
    ).toThrow("requires `hipsId`");
  });
});
