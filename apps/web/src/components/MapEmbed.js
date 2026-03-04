// apps/web/src/components/MapEmbed.js
import React, { useMemo } from "react";

/**
 * Simple map embed without API keys.
 * - If lat/lng provided => shows pin at that coordinate.
 * - Else => shows default Bellevue College map.
 */
export default function MapEmbed({
  title = "Map",
  height = 520,
  lat = null,
  lng = null,
  zoom = 16,
}) {
  const src = useMemo(() => {
    const hasCoords =
      typeof lat === "number" &&
      Number.isFinite(lat) &&
      typeof lng === "number" &&
      Number.isFinite(lng);

    if (hasCoords) {
      return `https://www.google.com/maps?q=${encodeURIComponent(
        `${lat},${lng}`
      )}&z=${encodeURIComponent(String(zoom))}&output=embed`;
    }

    return "https://www.google.com/maps?q=Bellevue%20College%20WA&z=15&output=embed";
  }, [lat, lng, zoom]);

  return (
    <div className="lwMapBox" style={{ height }}>
      <iframe
        title={title}
        src={src}
        className="lwMapFrame"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}