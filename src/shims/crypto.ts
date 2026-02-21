export function createHash(): never {
  throw new Error(
    "[shim:crypto] Node 'createHash' is unavailable in React Native. " +
      "Provide 'crypto.subtle.digest' instead.",
  );
}

const cryptoShim = {
  createHash,
};

export default cryptoShim;
