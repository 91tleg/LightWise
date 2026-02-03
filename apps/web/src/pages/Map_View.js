import React from "react";
import Layout from "../components/Layout";
import MapEmbed from "../components/MapEmbed";

export default function Map_View() {

  return (

    // This block wraps the Map page inside the common Layout.
    // It automatically adds the Sidebar and the TopBar,
    // and also sets the page title and subtitle.
    <Layout title="Map" subtitle="Showing Bellevue College area (pins later).">

      {/* 
        This block displays the embedded Google Map on the page.
        It shows the Bellevue College area and sets the map height.
      */}
      <MapEmbed title="Bellevue College Area" height={520} />

    </Layout>
  );
}
