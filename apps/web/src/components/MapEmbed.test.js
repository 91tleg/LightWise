import { render, screen } from "@testing-library/react";
import MapEmbed from "./MapEmbed";

const poles = [
  {
    streetlight_id: "LW-00043",
    name: "Civic Center Plaza",
    lat: 47.6108,
    lng: -122.3342,
    health: "OK",
  },
  {
    streetlight_id: "LW-00044",
    name: "Transit Mall East",
    lat: 47.6126,
    lng: -122.3314,
    health: "WARNING",
  },
];

test("renders the real map background, loading surface, and LightWise markers", () => {
  const { container } = render(
    <MapEmbed
      title="Network map"
      poles={poles}
      selectedId="LW-00043"
      interactive
      forceNativePin
    />
  );

  expect(screen.getByLabelText("Select pole LW-00043")).toBeTruthy();
  expect(screen.getByLabelText("Select pole LW-00044")).toBeTruthy();
  expect(container.querySelector(".lwMapLoadingSurface")).toBeTruthy();
  expect(container.querySelector(".lwMapRoadLayer")).toBeNull();
  expect(screen.getByTitle("Network map").getAttribute("src")).toContain(
    "output=embed"
  );
});

test("renders a marker for a single interactive pole", () => {
  render(
    <MapEmbed
      title="Single pole map"
      poles={[poles[0]]}
      selectedId="LW-00043"
      interactive
      forceNativePin
    />
  );

  expect(screen.getByLabelText("Select pole LW-00043")).toBeTruthy();
});
