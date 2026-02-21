import { CryptoDigestAlgorithm, digest, getRandomValues, randomUUID } from "expo-crypto";

type CryptoSubtleLike = {
  digest: (algorithm: unknown, data: BufferSource) => Promise<ArrayBuffer>;
};

type CryptoLike = {
  getRandomValues?: (array: ArrayBufferView) => ArrayBufferView;
  randomUUID?: () => string;
  subtle?: CryptoSubtleLike;
};

function mapDigestAlgorithm(algorithm: unknown): CryptoDigestAlgorithm {
  const raw =
    typeof algorithm === "string"
      ? algorithm
      : typeof algorithm === "object" &&
          algorithm !== null &&
          "name" in algorithm &&
          typeof (algorithm as { name: unknown }).name === "string"
        ? (algorithm as { name: string }).name
        : "";

  const normalized = raw.toUpperCase().replaceAll("_", "-");
  switch (normalized) {
    case "SHA-1":
      return CryptoDigestAlgorithm.SHA1;
    case "SHA-256":
      return CryptoDigestAlgorithm.SHA256;
    case "SHA-384":
      return CryptoDigestAlgorithm.SHA384;
    case "SHA-512":
      return CryptoDigestAlgorithm.SHA512;
    default:
      throw new Error(`Unsupported digest algorithm: ${raw || String(algorithm)}`);
  }
}

const root = globalThis as { crypto?: CryptoLike };
const cryptoObject: CryptoLike = root.crypto ?? (root.crypto = {});

if (typeof cryptoObject.getRandomValues !== "function") {
  cryptoObject.getRandomValues = getRandomValues as unknown as (
    array: ArrayBufferView,
  ) => ArrayBufferView;
}

if (typeof cryptoObject.randomUUID !== "function") {
  cryptoObject.randomUUID = randomUUID as unknown as () => string;
}

if (!cryptoObject.subtle) {
  cryptoObject.subtle = {
    digest(algorithm: unknown, data: BufferSource): Promise<ArrayBuffer> {
      return digest(mapDigestAlgorithm(algorithm), data);
    },
  };
}
