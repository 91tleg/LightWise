import React from "react";
import Layout from "../components/Layout";
import MapEmbed from "../components/MapEmbed";

export default function Map_View() {
  return (
    <Layout title="Map" subtitle="Showing Bellevue College area (pins later).">
      <MapEmbed title="Bellevue College Area" height={520} />
    </Layout>
  );
}
