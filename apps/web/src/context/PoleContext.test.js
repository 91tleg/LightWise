import React, { useContext } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthContext } from "./AuthContext";
import { PoleContext, PoleProvider } from "./PoleContext";
import { StreetlightContext, StreetlightProvider } from "./StreetlightContext";
import { WSContext } from "./WSContext";

var mockListStreetlights = jest.fn();
var mockLoadPoles = jest.fn(() => ["LW-00044", "LW-00045"]);
var mockSavePoles = jest.fn();

jest.mock("../services/api", () => ({
  listStreetlights: (...args) => mockListStreetlights(...args),
}));

jest.mock("../services/poleStorage", () => ({
  loadPoles: (...args) => mockLoadPoles(...args),
  savePoles: (...args) => mockSavePoles(...args),
}));

function Probe() {
  const { streetlights, applyStreetlightLocalPatch } = useContext(StreetlightContext);
  const { poles } = useContext(PoleContext);

  return (
    <>
      <div data-testid="streetlights">
        {streetlights.map((row) => row.streetlight_id).join(",")}
      </div>
      <div data-testid="poles">{poles.join(",")}</div>
      <button
        type="button"
        onClick={() =>
          applyStreetlightLocalPatch("LW-99999", { name: "local-only mock pole" })
        }
      >
        patch unknown
      </button>
    </>
  );
}

function renderProviders(wsValue) {
  return render(
    <AuthContext.Provider value={{ isAuthenticated: true }}>
      <WSContext.Provider value={wsValue}>
        <StreetlightProvider>
          <PoleProvider>
            <Probe />
          </PoleProvider>
        </StreetlightProvider>
      </WSContext.Provider>
    </AuthContext.Provider>
  );
}

describe("PoleProvider subscriptions", () => {
  beforeEach(() => {
    mockListStreetlights.mockReset();
    mockLoadPoles.mockClear();
    mockSavePoles.mockReset();
  });

  test("subscribes only to poles fetched from the API", async () => {
    const subscribe = jest.fn();

    mockListStreetlights.mockResolvedValue([
      {
        streetlight_id: "LW-00043",
        name: "Main & Bellevue way",
      },
    ]);

    const { rerender } = renderProviders({
      wsStatus: "connected",
      lastMessage: null,
      subscribe,
    });

    await waitFor(() =>
      expect(screen.getByTestId("streetlights").textContent).toBe("LW-00043")
    );

    await waitFor(() =>
      expect(screen.getByTestId("poles").textContent).toBe("LW-00043")
    );

    expect(mockLoadPoles).not.toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledWith("LW-00043");

    rerender(
      <AuthContext.Provider value={{ isAuthenticated: true }}>
        <WSContext.Provider
          value={{
            wsStatus: "connected",
            lastMessage: {
              streetlight_id: "LW-99999",
              timestamp: "2026-04-25T12:00:00Z",
              data: { motion: true },
            },
            subscribe,
          }}
        >
          <StreetlightProvider>
            <PoleProvider>
              <Probe />
            </PoleProvider>
          </StreetlightProvider>
        </WSContext.Provider>
      </AuthContext.Provider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("streetlights").textContent).toBe("LW-00043")
    );

    fireEvent.click(screen.getByRole("button", { name: "patch unknown" }));

    expect(screen.getByTestId("streetlights").textContent).toBe("LW-00043");
    await waitFor(() =>
      expect(screen.getByTestId("poles").textContent).toBe("LW-00043")
    );
    expect(subscribe).toHaveBeenCalledTimes(1);
  });
});
