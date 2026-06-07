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

test("renders the native map surface, loading surface, and LightWise markers", async () => {
  const { container } = render(
    <MapEmbed
      title="Network map"
      poles={poles}
      selectedId="LW-00043"
      interactive
      forceNativePin
    />
  );

  expect(await screen.findByLabelText("Select streetlight LW-00043")).toBeTruthy();
  expect(await screen.findByLabelText("Select streetlight LW-00044")).toBeTruthy();
  expect(container.querySelector(".lwMapLoadingSurface")).toBeTruthy();
  expect(container.querySelector(".lwMapRoadLayer")).toBeNull();
  expect(screen.getByRole("application", { name: "Network map" })).toBeTruthy();
  expect(container.querySelector("iframe")).toBeNull();
});

test("renders a marker for a single interactive streetlight", async () => {
  render(
    <MapEmbed
      title="Single streetlight map"
      poles={[poles[0]]}
      selectedId="LW-00043"
      interactive
      forceNativePin
    />
  );

  expect(await screen.findByLabelText("Select streetlight LW-00043")).toBeTruthy();
});

test("hides LightWise pole markers when marker rendering is disabled", () => {
  render(
    <MapEmbed
      title="Hidden marker map"
      poles={poles}
      selectedId="LW-00043"
      interactive
      showPoleMarkers={false}
    />
  );

  expect(screen.queryByLabelText("Select streetlight LW-00043")).toBeNull();
  expect(screen.queryByText("LW-00043")).toBeNull();
  expect(screen.getByRole("application", { name: "Hidden marker map" })).toBeTruthy();
});
