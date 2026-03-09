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
  const id =
    pole?.streetlight_id || `LW-${String(index + 1).padStart(5, "0")}`;

  return {
    streetlight_id: id,
    name: pole?.name ?? null,
    health: pole?.health ?? "OK",
    lat: pole?.lat ?? null,
    lng: pole?.lng ?? null,
    motion_detected:
      typeof pole?.motion_detected === "boolean" ? pole.motion_detected : null,
    light_level:
      typeof pole?.light_level === "number" ? pole.light_level : 0,
    last_seen: pole?.last_seen ?? null,
    temp_c: pole?.temp_c ?? null,
    humidity: pole?.humidity ?? null,
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

export function buildFallbackPole(id = "LW-00042", localMeta = {}) {
  const local = localMeta[id] || {};

  return {
    streetlight_id: id,
    name: hasOwn(local, "name") ? local.name : null,
    health: "OK",
    lat: hasOwn(local, "lat") ? local.lat : DEFAULT_CENTER.lat,
    lng: hasOwn(local, "lng") ? local.lng : DEFAULT_CENTER.lng,
    motion_detected: false,
    light_level: 0,
    last_seen: null,
    temp_c: null,
    humidity: null,
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
      name: hasOwn(local, "name") ? local.name : "Unnamed pole",
      health: "OK",
      lat: hasOwn(local, "lat") ? local.lat : null,
      lng: hasOwn(local, "lng") ? local.lng : null,
      light_level: 0,
      motion_detected: false,
      last_seen: null,
      temp_c: null,
      humidity: null,
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