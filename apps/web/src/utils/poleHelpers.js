const DEFAULT_CENTER = {
  lat: 47.6101,
  lng: -122.2015,
};

export function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

export function isValidCoord(value) {
  const n = Number(value);
  return Number.isFinite(n);
}

/**
 * Normalize streetlight rows based on the API contract.
 * Keep this strict so the frontend matches the Lambda response schema.
 */
export function normalizeStreetlightFromApi(pole, index = 0) {
  const id = pole?.streetlight_id || `LW-${String(index + 1).padStart(5, "0")}`;
  const location = pole?.location || {};
  const diagnostics = pole?.diagnostics || {};

  return {
    streetlight_id: id,
    tenant_id: pole?.tenant_id ?? null,
    name: pole?.name ?? null,
    site_id: pole?.site_id ?? null,
    model: pole?.model ?? null,
    installed_at: pole?.installed_at ?? null,
    health: pole?.health ?? null,
    lat: pole?.lat ?? location?.lat ?? null,
    lng: pole?.lng ?? location?.lng ?? null,
    motion_detected:
      typeof pole?.motion_detected === "boolean" ? pole.motion_detected : null,
    light_level:
      typeof pole?.light_level === "number" ? pole.light_level : null,
    last_seen: pole?.last_seen ?? null,
    diagnostics: {
      overall_ok:
        typeof diagnostics?.overall_ok === "boolean" ? diagnostics.overall_ok : null,
      ambient_health:
        typeof diagnostics?.ambient_health === "string"
          ? diagnostics.ambient_health
          : null,
      mmwave_health:
        typeof diagnostics?.mmwave_health === "string"
          ? diagnostics.mmwave_health
          : null,
      th_ok: typeof diagnostics?.th_ok === "boolean" ? diagnostics.th_ok : null,
      light_ok:
        typeof diagnostics?.light_ok === "boolean" ? diagnostics.light_ok : null,
    },
    overall_ok:
      typeof diagnostics?.overall_ok === "boolean" ? diagnostics.overall_ok : null,
    ambient_health:
      typeof diagnostics?.ambient_health === "string" ? diagnostics.ambient_health : null,
    mmwave_health:
      typeof diagnostics?.mmwave_health === "string" ? diagnostics.mmwave_health : null,
    light_ok: typeof diagnostics?.light_ok === "boolean" ? diagnostics.light_ok : null,
    th_ok:
      typeof diagnostics?.th_ok === "boolean"
        ? diagnostics.th_ok
        : typeof pole?.th_ok === "boolean"
        ? pole.th_ok
        : null,
    ambient_primary_ok:
      typeof pole?.ambient_primary_ok === "boolean" ? pole.ambient_primary_ok : null,
    ambient_secondary_ok:
      typeof pole?.ambient_secondary_ok === "boolean"
        ? pole.ambient_secondary_ok
        : null,
    motion_primary_ok:
      typeof pole?.motion_primary_ok === "boolean" ? pole.motion_primary_ok : null,
    motion_secondary_ok:
      typeof pole?.motion_secondary_ok === "boolean"
        ? pole.motion_secondary_ok
        : null,
    temp_c: pole?.temp_c ?? null,
    humidity: pole?.humidity ?? null,
    lux: pole?.lux ?? null,
    motion_focus_lat: pole?.motion_focus_lat ?? null,
    motion_focus_lng: pole?.motion_focus_lng ?? null,
    motion_focus_radius_m: pole?.motion_focus_radius_m ?? null,
  };
}

export function mergeLocalMetaIntoPole(pole, localMeta = {}) {
  const local = localMeta[pole?.streetlight_id] || {};

  return {
    ...pole,
    name: hasOwn(local, "name") ? local.name : pole.name,
    lat: hasOwn(local, "lat") ? local.lat : pole.lat,
    lng: hasOwn(local, "lng") ? local.lng : pole.lng,
  };
}

export function buildFallbackPole(id, localMeta = {}) {
  const local = localMeta[id] || {};

  return {
    streetlight_id: id || "",
    name: hasOwn(local, "name") ? local.name : null,
    health: null,
    site_id: null,
    model: null,
    installed_at: null,
    lat: hasOwn(local, "lat") ? local.lat : null,
    lng: hasOwn(local, "lng") ? local.lng : null,
    motion_detected: null,
    light_level: null,
    last_seen: null,
    diagnostics: {
      overall_ok: null,
      ambient_health: null,
      mmwave_health: null,
      th_ok: null,
      light_ok: null,
    },
    overall_ok: null,
    ambient_health: null,
    mmwave_health: null,
    light_ok: null,
    th_ok: null,
    temp_c: null,
    humidity: null,
    lux: null,
  };
}

export function getFormValuesForPole(pole, metaMap = {}) {
  const local = metaMap[pole?.streetlight_id] || {};

  return {
    name: hasOwn(local, "name") ? local.name || "" : pole?.name || "",
    lat: hasOwn(local, "lat")
      ? local.lat == null
        ? ""
        : String(local.lat)
      : pole?.lat != null
      ? String(pole.lat)
      : "",
    lng: hasOwn(local, "lng")
      ? local.lng == null
        ? ""
        : String(local.lng)
      : pole?.lng != null
      ? String(pole.lng)
      : "",
  };
}

export function buildLocalOnlyPoles(localMeta = {}) {
  return Object.keys(localMeta || {}).map((id) => {
    const local = localMeta[id] || {};

    return {
      streetlight_id: id,
      name: hasOwn(local, "name") ? local.name : "Unnamed streetlight",
      health: null,
      site_id: null,
      model: null,
      installed_at: null,
      lat: hasOwn(local, "lat") ? local.lat : null,
      lng: hasOwn(local, "lng") ? local.lng : null,
      light_level: null,
      motion_detected: null,
      last_seen: null,
      diagnostics: {
        overall_ok: null,
        ambient_health: null,
        mmwave_health: null,
        th_ok: null,
        light_ok: null,
      },
      overall_ok: null,
      ambient_health: null,
      mmwave_health: null,
      light_ok: null,
      th_ok: null,
      temp_c: null,
      humidity: null,
      lux: null,
    };
  });
}

export function mergeBackendAndLocalPoles(backendPoles = [], localMeta = {}) {
  const mergedBackend = backendPoles.map((pole) =>
    mergeLocalMetaIntoPole(pole, localMeta)
  );

  const seen = new Set(mergedBackend.map((pole) => pole.streetlight_id));

  const localOnly = buildLocalOnlyPoles(localMeta)
    .filter((pole) => !seen.has(pole.streetlight_id))
    .map((pole) => mergeLocalMetaIntoPole(pole, localMeta));

  return [...mergedBackend, ...localOnly];
}

export function pickBestCenter(poles = []) {
  const firstValid = poles.find(
    (pole) => isValidCoord(pole?.lat) && isValidCoord(pole?.lng)
  );

  if (firstValid) {
    return {
      lat: Number(firstValid.lat),
      lng: Number(firstValid.lng),
      selectedId: firstValid.streetlight_id,
    };
  }

  return {
    ...DEFAULT_CENTER,
    selectedId: null,
  };
}

export { DEFAULT_CENTER };
