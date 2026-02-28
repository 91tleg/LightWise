import { useContext } from "react";
import { LightWiseContext } from "../context/LightWiseProvider";

export function useLightWise() {
  const ctx = useContext(LightWiseContext);
  if (!ctx) throw new Error("useLightWise must be used inside <LightWiseProvider>");
  return ctx;
}