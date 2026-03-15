import { AuthProvider } from "./AuthContext";
import { WSProvider } from "./WSContext";
import { StreetlightProvider } from "./StreetlightContext";
import { PoleProvider } from "./PoleContext";
import { EventProvider } from "./EventContext";

export function LightWiseProvider({ children }) {
  return (
    <AuthProvider>
      <WSProvider>
        <StreetlightProvider>
          <PoleProvider>
            <EventProvider>
              {children}
            </EventProvider>
          </PoleProvider>
        </StreetlightProvider>
      </WSProvider>
    </AuthProvider>
  );
}
