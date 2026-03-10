export function getCombinedSensorHealth(pole) {
  const checks = [
    pole?.ambient_primary_ok,
    pole?.ambient_secondary_ok,
    pole?.th_ok,
    pole?.motion_primary_ok,
    pole?.motion_secondary_ok,
  ].filter((v) => v !== null && v !== undefined);

  if (!checks.length) {
    return { label: "Waiting for data", tone: "neutral" };
  }

  const hasFault = checks.some((v) => v === false);
  if (hasFault) {
    return { label: "Fault detected", tone: "critical" };
  }

  return { label: "All sensors OK", tone: "healthy" };
}