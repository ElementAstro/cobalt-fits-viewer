import { createRuntime } from "../_core/output.mjs";

export function createCaptureRuntime() {
  const stdout = [];
  const stderr = [];
  const runtime = createRuntime({
    stdout: (text) => stdout.push(text),
    stderr: (text) => stderr.push(text),
  });

  return { runtime, stdout, stderr };
}

export function stdoutText(capture) {
  return capture.stdout.join("");
}

export function stderrText(capture) {
  return capture.stderr.join("");
}

export function parseStdoutJson(capture) {
  return JSON.parse(stdoutText(capture));
}

export function mockFetchWith(impl) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return () => {
    globalThis.fetch = original;
  };
}
