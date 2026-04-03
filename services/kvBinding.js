/**
 * Resolve the Worker KV binding used by this project.
 *
 * In Cloudflare Dashboard, the namespace display name and the binding variable
 * name are different concepts. Git-based deployments also make it easy to bind
 * the namespace under a slightly different variable name than expected.
 *
 * To keep the Worker resilient, resolve a small set of likely aliases first,
 * then fall back to a case-insensitive scan of env keys.
 */

const KV_BINDING_CANDIDATES = [
  "NasdaqDashboard",
  "NASDAQ_DASHBOARD",
  "nasdaqdashboard",
  "NASDAQDASHBOARD",
  "Nasdaqdashboard",
];

function isKvLike(value) {
  return !!value && typeof value.get === "function" && typeof value.put === "function";
}

export function resolveKvBinding(env) {
  const safeEnv = env && typeof env === "object" ? env : {};
  const envKeys = Object.keys(safeEnv);

  for (const key of KV_BINDING_CANDIDATES) {
    if (isKvLike(safeEnv[key])) {
      return {
        binding: safeEnv[key],
        bindingName: key,
        checkedKeys: envKeys,
      };
    }
  }

  const normalized = envKeys.find((key) => key.toLowerCase() === "nasdaqdashboard");
  if (normalized && isKvLike(safeEnv[normalized])) {
    return {
      binding: safeEnv[normalized],
      bindingName: normalized,
      checkedKeys: envKeys,
    };
  }

  const fuzzy = envKeys.find(
    (key) =>
      /nasdaq/i.test(key) &&
      /dashboard/i.test(key) &&
      isKvLike(safeEnv[key])
  );
  if (fuzzy) {
    return {
      binding: safeEnv[fuzzy],
      bindingName: fuzzy,
      checkedKeys: envKeys,
    };
  }

  return {
    binding: null,
    bindingName: null,
    checkedKeys: envKeys,
  };
}

export function getKvBinding(env) {
  return resolveKvBinding(env).binding;
}

