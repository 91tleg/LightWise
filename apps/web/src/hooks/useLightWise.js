import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { WSContext } from "../context/WSContext";
import { StreetlightContext } from "../context/StreetlightContext";
import { PoleContext } from "../context/PoleContext";
import { EventContext } from "../context/EventContext";
import { CONTEXT_ENV } from "../config/env";

export function useLightWise() {
  const auth = useContext(AuthContext);
  const ws = useContext(WSContext);
  const streetlight = useContext(StreetlightContext);
  const pole = useContext(PoleContext);
  const event = useContext(EventContext);

  if (!auth || !ws || !streetlight || !pole || !event) {
    throw new Error("useLightWise must be used inside <LightWiseProvider>");
  }

  return {
    env: CONTEXT_ENV,
    ...auth,
    ...ws,
    ...streetlight,
    ...pole,
    ...event,
  };
}
