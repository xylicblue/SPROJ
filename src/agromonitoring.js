// src/api/agroMonitoring.js

const API_KEY = import.meta.env.VITE_AGROMONITORING_API_KEY;
const API_BASE_URL = "https://api.agromonitoring.com/agro/1.0";
// Function to format our coordinates into GeoJSON
const formatCoordsToGeoJSON = (coords) => {
  // AgroMonitoring needs [longitude, latitude]
  const geoJsonCoords = coords.map((p) => [p.lng, p.lat]);

  // Ensure the polygon is "closed" (first and last points are the same)
  if (
    geoJsonCoords.length > 0 &&
    (geoJsonCoords[0][0] !== geoJsonCoords[geoJsonCoords.length - 1][0] ||
      geoJsonCoords[0][1] !== geoJsonCoords[geoJsonCoords.length - 1][1])
  ) {
    geoJsonCoords.push(geoJsonCoords[0]);
  }

  // The Fix: Wrap the Polygon geometry inside a standard Feature object
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [geoJsonCoords],
    },
  };
};

export const registerPolygonWithAgro = async (farmName, coordinates) => {
  const apiKey = import.meta.env.VITE_AGROMONITORING_API_KEY;
  if (!apiKey) {
    throw new Error("AgroMonitoring API key is not configured.");
  }

  const API_URL = `https://api.agromonitoring.com/agro/1.0/polygons?appid=${apiKey}`;

  const geoJson = formatCoordsToGeoJSON(coordinates);

  const requestBody = {
    name: farmName,
    geo_json: geoJson,
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.message || "Failed to register polygon with AgroMonitoring."
    );
  }

  const data = await response.json();
  return data.id; // Return the unique Polygon ID
};

export const getWeatherForPolygon = async (polyId) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  const response = await fetch(
    `${API_BASE_URL}/weather/forecast?polyid=${polyId}&appid=${API_KEY}`
  );
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Weather API Error:", response.status, errorText);
    throw new Error(`Failed to fetch weather data: ${response.status}`);
  }
  const data = await response.json();
  console.log("Weather API Response:", data);
  // The forecast API returns { list: [...] }, we need to return the list
  return data.list || data;
};

/**
 * Fetches current soil temperature and moisture for a polygon.
 */
export const getSoilDataForPolygon = async (polyId) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  const response = await fetch(
    `${API_BASE_URL}/soil?polyid=${polyId}&appid=${API_KEY}`
  );
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Soil API Error:", response.status, errorText);
    throw new Error(`Failed to fetch soil data: ${response.status}`);
  }
  const data = await response.json();
  console.log("Soil API Response:", data);
  return data;
};

/**
 * Fetches historical NDVI data for a polygon.
 */
export const getNdviHistoryForPolygon = async (polyId) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30;
  const now = Math.floor(Date.now() / 1000);
  const response = await fetch(
    `${API_BASE_URL}/ndvi/history?polyid=${polyId}&start=${thirtyDaysAgo}&end=${now}&appid=${API_KEY}`
  );
  if (!response.ok) {
    const errorText = await response.text();
    console.error("NDVI API Error:", response.status, errorText);
    throw new Error(`Failed to fetch NDVI history: ${response.status}`);
  }
  const data = await response.json();
  console.log("NDVI API Response:", data);
  return data;
};

/**
 * Searches for available satellite imagery for a polygon.
 * Returns metadata including URLs for different image types.
 */
export const searchSatelliteImages = async (polyId) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30;
  const now = Math.floor(Date.now() / 1000);
  const response = await fetch(
    `${API_BASE_URL}/image/search?start=${thirtyDaysAgo}&end=${now}&polyid=${polyId}&appid=${API_KEY}`
  );
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Satellite Image API Error:", response.status, errorText);
    throw new Error(
      `Failed to search for satellite images: ${response.status}`
    );
  }
  const images = await response.json();
  console.log("Satellite Images API Response:", images);
  // Return the most recent available image metadata, if any
  return images.length > 0 ? images[0] : null;
};

/**
 * Fetches current weather data for a polygon (not forecast).
 */
export const getCurrentWeatherForPolygon = async (polyId) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  const response = await fetch(
    `${API_BASE_URL}/weather?polyid=${polyId}&appid=${API_KEY}`
  );
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Current Weather API Error:", response.status, errorText);
    throw new Error(`Failed to fetch current weather: ${response.status}`);
  }
  const data = await response.json();
  console.log("Current Weather API Response:", data);
  return data;
};

/**
 * Fetches UV Index data for a polygon.
 */
export const getUviForPolygon = async (polyId) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  const response = await fetch(
    `${API_BASE_URL}/uvi?polyid=${polyId}&appid=${API_KEY}`
  );
  if (!response.ok) {
    const errorText = await response.text();
    console.error("UVI API Error:", response.status, errorText);
    throw new Error(`Failed to fetch UVI data: ${response.status}`);
  }
  const data = await response.json();
  console.log("UVI API Response:", data);
  return data;
};

/**
 * Fetches historical EVI (Enhanced Vegetation Index) data for a polygon.
 */
export const getEviHistoryForPolygon = async (polyId) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30;
  const now = Math.floor(Date.now() / 1000);
  const response = await fetch(
    `${API_BASE_URL}/evi/history?polyid=${polyId}&start=${thirtyDaysAgo}&end=${now}&appid=${API_KEY}`
  );
  if (!response.ok) {
    const errorText = await response.text();
    console.error("EVI API Error:", response.status, errorText);
    throw new Error(`Failed to fetch EVI history: ${response.status}`);
  }
  const data = await response.json();
  console.log("EVI API Response:", data);
  return data;
};

/**
 * Fetches Accumulated Active Temperature (AAT) data for a polygon.
 * Useful for tracking growing degree days.
 * @param {string} polyId - The polygon ID
 * @param {number} threshold - Temperature threshold in Kelvin (default: 283.15K = 10°C)
 */
export const getAccumulatedTemperature = async (polyId, threshold = 283.15) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30;
  const now = Math.floor(Date.now() / 1000);
  const response = await fetch(
    `${API_BASE_URL}/weather/history/accumulated_temperature?polyid=${polyId}&start=${thirtyDaysAgo}&end=${now}&threshold=${threshold}&appid=${API_KEY}`
  );
  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      "Accumulated Temperature API Error:",
      response.status,
      errorText
    );
    throw new Error(
      `Failed to fetch accumulated temperature: ${response.status}`
    );
  }
  const data = await response.json();
  console.log("Accumulated Temperature API Response:", data);
  return data;
};

/**
 * Fetches Accumulated Precipitation data for a polygon.
 */
export const getAccumulatedPrecipitation = async (polyId) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30;
  const now = Math.floor(Date.now() / 1000);
  const response = await fetch(
    `${API_BASE_URL}/weather/history/accumulated_precipitation?polyid=${polyId}&start=${thirtyDaysAgo}&end=${now}&appid=${API_KEY}`
  );
  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      "Accumulated Precipitation API Error:",
      response.status,
      errorText
    );
    throw new Error(
      `Failed to fetch accumulated precipitation: ${response.status}`
    );
  }
  const data = await response.json();
  console.log("Accumulated Precipitation API Response:", data);
  return data;
};

/**
 * Fetches historical weather data for a polygon.
 */
export const getWeatherHistoryForPolygon = async (polyId) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 7;
  const now = Math.floor(Date.now() / 1000);
  const response = await fetch(
    `${API_BASE_URL}/weather/history?polyid=${polyId}&start=${sevenDaysAgo}&end=${now}&appid=${API_KEY}`
  );
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Weather History API Error:", response.status, errorText);
    throw new Error(`Failed to fetch weather history: ${response.status}`);
  }
  const data = await response.json();
  console.log("Weather History API Response:", data);
  return data;
};

/**
 * Fetches all available satellite imagery for a polygon within a date range.
 * Returns full list of images, not just the most recent one.
 */
export const getAllSatelliteImages = async (polyId, days = 30) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  const startDate = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * days;
  const now = Math.floor(Date.now() / 1000);
  const response = await fetch(
    `${API_BASE_URL}/image/search?start=${startDate}&end=${now}&polyid=${polyId}&appid=${API_KEY}`
  );
  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      "All Satellite Images API Error:",
      response.status,
      errorText
    );
    throw new Error(`Failed to fetch all satellite images: ${response.status}`);
  }
  const images = await response.json();
  console.log("All Satellite Images API Response:", images);
  return images;
};

/**
 * Fetches specific satellite image statistics (NDVI, EVI, etc.) for an image.
 * @param {string} imageUrl - The stats URL from the satellite image metadata
 */
export const getSatelliteImageStats = async (imageUrl) => {
  if (!imageUrl) throw new Error("Image URL is required.");
  const response = await fetch(`${imageUrl}&appid=${API_KEY}`);
  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      "Satellite Image Stats API Error:",
      response.status,
      errorText
    );
    throw new Error(
      `Failed to fetch satellite image stats: ${response.status}`
    );
  }
  const data = await response.json();
  console.log("Satellite Image Stats API Response:", data);
  return data;
};

/**
 * Fetches polygon information from AgroMonitoring.
 */
export const getPolygonInfo = async (polyId) => {
  if (!polyId) throw new Error("Polygon ID is required.");
  const response = await fetch(
    `${API_BASE_URL}/polygons/${polyId}?appid=${API_KEY}`
  );
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Polygon Info API Error:", response.status, errorText);
    throw new Error(`Failed to fetch polygon info: ${response.status}`);
  }
  const data = await response.json();
  console.log("Polygon Info API Response:", data);
  return data;
};

/**
 * Fetches all data from AgroMonitoring API for a polygon.
 * This is a convenience function to get all available data in one call.
 */
export const getAllAgroDataForPolygon = async (polyId) => {
  if (!polyId) throw new Error("Polygon ID is required.");

  const results = await Promise.allSettled([
    getWeatherForPolygon(polyId),
    getCurrentWeatherForPolygon(polyId),
    getSoilDataForPolygon(polyId),
    getNdviHistoryForPolygon(polyId),
    getEviHistoryForPolygon(polyId),
    getUviForPolygon(polyId),
    getAccumulatedTemperature(polyId),
    getAccumulatedPrecipitation(polyId),
    getWeatherHistoryForPolygon(polyId),
    searchSatelliteImages(polyId),
    getPolygonInfo(polyId),
  ]);

  const apiNames = [
    "weatherForecast",
    "currentWeather",
    "soil",
    "ndviHistory",
    "eviHistory",
    "uvi",
    "accumulatedTemperature",
    "accumulatedPrecipitation",
    "weatherHistory",
    "latestSatelliteImage",
    "polygonInfo",
  ];

  const data = {};
  const errors = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      data[apiNames[index]] = result.value;
    } else {
      errors.push({ api: apiNames[index], error: result.reason.message });
      data[apiNames[index]] = null;
    }
  });

  return { data, errors };
};
