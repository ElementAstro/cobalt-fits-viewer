afterEach(() => {
  try {
    const { resetLoggerForTests } = require("./src/lib/logger/logger");
    resetLoggerForTests();
  } catch {
    // ignore logger reset failures during isolated module tests
  }
});

afterAll(() => {
  if (process.env.DEBUG_ACTIVE_HANDLES !== "1") return;
  const getActiveHandles = process._getActiveHandles;
  if (typeof getActiveHandles !== "function") return;

  const interestingHandles = getActiveHandles.call(process).filter((handle) => {
    const name = handle?.constructor?.name;
    return name && !["Socket", "WriteStream", "ReadStream", "TTY", "Pipe"].includes(name);
  });

  if (interestingHandles.length === 0) return;

  const label = typeof expect?.getState === "function" ? expect.getState().testPath : "unknown";
  console.log(
    `[active-handles] ${label}`,
    interestingHandles.map((handle) => handle?.constructor?.name ?? typeof handle),
  );
});
