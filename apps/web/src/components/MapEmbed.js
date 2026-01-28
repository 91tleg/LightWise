// This component displays an embedded Google Map centered on Bellevue College,
// inside a box with a configurable height, so it can be reused on the Map page.

import React from "react";

export default function MapEmbed({ title = "Bellevue College", height = 520 }) {
  const src =
    "https://www.google.com/maps?q=Bellevue%20College%20WA&z=15&output=embed";

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
