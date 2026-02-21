function unsupported(operation: string): never {
  throw new Error(`[shim:fs/promises] '${operation}' is not supported in React Native runtime.`);
}

export async function mkdir(): Promise<void> {
  unsupported("mkdir");
}

export async function writeFile(): Promise<void> {
  unsupported("writeFile");
}

export async function readFile(): Promise<never> {
  unsupported("readFile");
}

export async function access(): Promise<void> {
  unsupported("access");
}

export async function readdir(): Promise<never[]> {
  unsupported("readdir");
}

const fsPromises = {
  mkdir,
  writeFile,
  readFile,
  access,
  readdir,
};

export default fsPromises;
