export async function resolveWithFallback(options) {
  const policy = options.policy ?? "auto";
  const isPrimaryUsable = options.isPrimaryUsable ?? ((value) => Boolean(value));

  if (policy === "only") {
    const fallbackData = await options.fetchFallback();
    return {
      source: "fallback",
      data: fallbackData,
      usedFallback: true,
      primaryError: null,
    };
  }

  try {
    const primaryData = await options.fetchPrimary();
    if (isPrimaryUsable(primaryData) || policy === "never") {
      return {
        source: "api",
        data: primaryData,
        usedFallback: false,
        primaryError: null,
      };
    }

    if (policy === "auto") {
      const fallbackData = await options.fetchFallback();
      return {
        source: "fallback",
        data: fallbackData,
        usedFallback: true,
        primaryError: null,
      };
    }

    return {
      source: "api",
      data: primaryData,
      usedFallback: false,
      primaryError: null,
    };
  } catch (error) {
    if (policy === "never") {
      throw error;
    }

    const fallbackData = await options.fetchFallback();
    return {
      source: "fallback",
      data: fallbackData,
      usedFallback: true,
      primaryError: error,
    };
  }
}
