const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/route", async (req, res) => {
  try {
    const { originCoords, destCoords } = req.body;

    if (
      !Array.isArray(originCoords) ||
      !Array.isArray(destCoords) ||
      originCoords.length !== 2 ||
      destCoords.length !== 2
    ) {
      return res.status(400).json({
        error: "Invalid payload. Expected originCoords and destCoords as [lng, lat].",
      });
    }

    const [originLng, originLat] = originCoords;
    const [destLng, destLat] = destCoords;

    const url =
      "http://router.project-osrm.org/route/v1/driving/" +
      originLng +
      "," +
      originLat +
      ";" +
      destLng +
      "," +
      destLat +
      "?overview=full&geometries=geojson";

    const { data } = await axios.get(url);

    if (!data || !data.routes || !data.routes.length) {
      return res.status(502).json({ error: "OSRM returned no routes." });
    }

    const route = data.routes[0];

    res.json({
      route: route.geometry,
      distance_meters: route.distance,
      duration_seconds: route.duration,
    });
  } catch (err) {
    const status = (err.response && err.response.status) || 502;
    res.status(status).json({
      error: "Failed to fetch route from OSRM.",
      details: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log("Server listening on port " + PORT);
});
