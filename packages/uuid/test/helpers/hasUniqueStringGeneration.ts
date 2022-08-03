export function hasUniqueStringGeneration(fn: () => string, iterations = 1e3) {
  const map: Record<string, boolean> = {};

  for (let i = 0; i < iterations; i++) {
    const uuid = fn();

    // It was already generated
    if (map[uuid]) {
      return false;
    }

    // Save information about previous generation
    map[uuid] = true;
  }

  return true;
}
