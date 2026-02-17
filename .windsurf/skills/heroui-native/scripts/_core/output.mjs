export function createRuntime(overrides = {}) {
  return {
    stdout: overrides.stdout ?? ((text) => process.stdout.write(text)),
    stderr: overrides.stderr ?? ((text) => process.stderr.write(text)),
  };
}

export function writeStdout(runtime, text = "") {
  runtime.stdout(`${text}\n`);
}

export function writeStderr(runtime, text = "") {
  runtime.stderr(`${text}\n`);
}

export function log(runtime, options, level, message) {
  if (!options.verbose && level === "debug") {
    return;
  }
  writeStderr(runtime, `# ${message}`);
}

export function emitEnvelope(runtime, options, envelope) {
  writeStdout(runtime, JSON.stringify(envelope, null, 2));
}
