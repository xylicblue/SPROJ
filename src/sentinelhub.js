// src/api/sentinelHub.js
// Sentinel Hub API integration for satellite imagery and vegetation indices

import { supabase } from "./createclient";

const SENTINEL_API_BASE = "https://services.sentinel-hub.com";

/**
 * Get OAuth2 access token from Sentinel Hub via Supabase Edge Function
 * Tokens are cached in Supabase to avoid hitting rate limits
 */
const getAccessToken = async () => {
  // Try to get cached token from Supabase
  const { data: tokenData, error } = await supabase
    .from("sentinel_tokens")
    .select("*")
    .single();

  // Check if token exists and is still valid (with 5 min buffer)
  if (
    tokenData &&
    new Date(tokenData.expires_at) > new Date(Date.now() + 5 * 60 * 1000)
  ) {
    return tokenData.access_token;
  }

  // Token expired or doesn't exist - get new one via Edge Function
  const { data, error: fnError } = await supabase.functions.invoke(
    "sentinel-auth",
    {
      body: {},
    }
  );

  if (fnError) {
    console.error("Error getting Sentinel token:", fnError);
    throw new Error("Failed to authenticate with Sentinel Hub");
  }

  return data.access_token;
};

/**
 * Format coordinates to WKT (Well-Known Text) format for Sentinel API
 */
const coordsToWKT = (coords) => {
  // coords is array of {lat, lng} objects
  const wktCoords = coords.map((p) => `${p.lng} ${p.lat}`).join(", ");
  // Close the polygon
  const firstPoint = coords[0];
  return `POLYGON((${wktCoords}, ${firstPoint.lng} ${firstPoint.lat}))`;
};

/**
 * Format coordinates to bounding box [minLng, minLat, maxLng, maxLat]
 */
const coordsToBBox = (coords) => {
  const lngs = coords.map((p) => p.lng);
  const lats = coords.map((p) => p.lat);
  return [
    Math.min(...lngs),
    Math.min(...lats),
    Math.max(...lngs),
    Math.max(...lats),
  ];
};

/**
 * Format coordinates to GeoJSON Polygon
 */
const coordsToGeoJSON = (coords) => {
  const geoCoords = coords.map((p) => [p.lng, p.lat]);
  // Close the polygon
  geoCoords.push([coords[0].lng, coords[0].lat]);
  return {
    type: "Polygon",
    coordinates: [geoCoords],
  };
};

/**
 * Search for available Sentinel-2 scenes for a given area
 */
export const searchSentinelScenes = async (coords, days = 30) => {
  const token = await getAccessToken();
  const bbox = coordsToBBox(coords);

  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const searchBody = {
    bbox: bbox,
    datetime: `${startDate}T00:00:00Z/${endDate}T23:59:59Z`,
    collections: ["sentinel-2-l2a"],
    limit: 10,
    filter: {
      op: "<=",
      args: [{ property: "eo:cloud_cover" }, 30], // Max 30% cloud cover
    },
  };

  const response = await fetch(
    `${SENTINEL_API_BASE}/api/v1/catalog/1.0.0/search`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(searchBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Sentinel Search Error:", response.status, errorText);
    throw new Error(`Failed to search Sentinel scenes: ${response.status}`);
  }

  const data = await response.json();
  console.log("Sentinel Scenes:", data);
  return data.features || [];
};

/**
 * Get NDVI image from Sentinel-2
 */
export const getSentinelNDVI = async (coords, width = 512, height = 512) => {
  const token = await getAccessToken();
  const bbox = coordsToBBox(coords);

  const evalscript = `
    //VERSION=3
    function setup() {
      return {
        input: ["B04", "B08", "dataMask"],
        output: { bands: 4 }
      };
    }

    function evaluatePixel(sample) {
      let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
      
      // Color mapping for NDVI
      if (ndvi < -0.2) return [0.05, 0.05, 0.05, sample.dataMask]; // Water/shadows
      if (ndvi < 0) return [0.75, 0.75, 0.75, sample.dataMask];    // Bare soil
      if (ndvi < 0.1) return [0.86, 0.78, 0.55, sample.dataMask];  // Sparse vegetation
      if (ndvi < 0.2) return [0.93, 0.91, 0.71, sample.dataMask];  // Light vegetation
      if (ndvi < 0.3) return [0.78, 0.89, 0.55, sample.dataMask];  // Moderate vegetation
      if (ndvi < 0.4) return [0.55, 0.80, 0.38, sample.dataMask];  // Good vegetation
      if (ndvi < 0.5) return [0.30, 0.70, 0.24, sample.dataMask];  // Dense vegetation
      if (ndvi < 0.6) return [0.16, 0.58, 0.14, sample.dataMask];  // Very dense
      return [0.04, 0.45, 0.04, sample.dataMask];                   // Extremely dense
    }
  `;

  const requestBody = {
    input: {
      bounds: {
        bbox: bbox,
        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
      },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: {
            timeRange: {
              from: new Date(
                Date.now() - 30 * 24 * 60 * 60 * 1000
              ).toISOString(),
              to: new Date().toISOString(),
            },
            maxCloudCoverage: 30,
          },
          processing: { harmonizeValues: true },
        },
      ],
    },
    output: {
      width: width,
      height: height,
      responses: [{ identifier: "default", format: { type: "image/png" } }],
    },
    evalscript: evalscript,
  };

  const response = await fetch(`${SENTINEL_API_BASE}/api/v1/process`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "image/png",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Sentinel NDVI Error:", response.status, errorText);
    throw new Error(`Failed to get NDVI image: ${response.status}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

/**
 * Get True Color (RGB) image from Sentinel-2
 */
export const getSentinelTrueColor = async (
  coords,
  width = 512,
  height = 512
) => {
  const token = await getAccessToken();
  const bbox = coordsToBBox(coords);

  const evalscript = `
    //VERSION=3
    function setup() {
      return {
        input: ["B04", "B03", "B02", "dataMask"],
        output: { bands: 4 }
      };
    }

    function evaluatePixel(sample) {
      return [2.5 * sample.B04, 2.5 * sample.B03, 2.5 * sample.B02, sample.dataMask];
    }
  `;

  const requestBody = {
    input: {
      bounds: {
        bbox: bbox,
        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
      },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: {
            timeRange: {
              from: new Date(
                Date.now() - 30 * 24 * 60 * 60 * 1000
              ).toISOString(),
              to: new Date().toISOString(),
            },
            maxCloudCoverage: 30,
          },
        },
      ],
    },
    output: {
      width: width,
      height: height,
      responses: [{ identifier: "default", format: { type: "image/png" } }],
    },
    evalscript: evalscript,
  };

  const response = await fetch(`${SENTINEL_API_BASE}/api/v1/process`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "image/png",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Sentinel True Color Error:", response.status, errorText);
    throw new Error(`Failed to get true color image: ${response.status}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

/**
 * Get SAVI (Soil Adjusted Vegetation Index) - better for sparse vegetation
 */
export const getSentinelSAVI = async (coords, width = 512, height = 512) => {
  const token = await getAccessToken();
  const bbox = coordsToBBox(coords);

  const evalscript = `
    //VERSION=3
    function setup() {
      return {
        input: ["B04", "B08", "dataMask"],
        output: { bands: 4 }
      };
    }

    function evaluatePixel(sample) {
      // SAVI = ((NIR - RED) / (NIR + RED + L)) * (1 + L), where L = 0.5
      let L = 0.5;
      let savi = ((sample.B08 - sample.B04) / (sample.B08 + sample.B04 + L)) * (1 + L);
      
      // Color mapping
      if (savi < 0) return [0.5, 0.5, 0.5, sample.dataMask];
      if (savi < 0.1) return [0.86, 0.78, 0.55, sample.dataMask];
      if (savi < 0.2) return [0.78, 0.89, 0.55, sample.dataMask];
      if (savi < 0.3) return [0.55, 0.80, 0.38, sample.dataMask];
      if (savi < 0.4) return [0.30, 0.70, 0.24, sample.dataMask];
      return [0.04, 0.50, 0.04, sample.dataMask];
    }
  `;

  const requestBody = {
    input: {
      bounds: {
        bbox: bbox,
        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
      },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: {
            timeRange: {
              from: new Date(
                Date.now() - 30 * 24 * 60 * 60 * 1000
              ).toISOString(),
              to: new Date().toISOString(),
            },
            maxCloudCoverage: 30,
          },
        },
      ],
    },
    output: {
      width: width,
      height: height,
      responses: [{ identifier: "default", format: { type: "image/png" } }],
    },
    evalscript: evalscript,
  };

  const response = await fetch(`${SENTINEL_API_BASE}/api/v1/process`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "image/png",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Sentinel SAVI Error:", response.status, errorText);
    throw new Error(`Failed to get SAVI image: ${response.status}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

/**
 * Get Moisture Index (NDWI/NDMI) - for water stress detection
 */
export const getSentinelMoisture = async (
  coords,
  width = 512,
  height = 512
) => {
  const token = await getAccessToken();
  const bbox = coordsToBBox(coords);

  const evalscript = `
    //VERSION=3
    function setup() {
      return {
        input: ["B08", "B11", "dataMask"],
        output: { bands: 4 }
      };
    }

    function evaluatePixel(sample) {
      // NDMI = (NIR - SWIR) / (NIR + SWIR)
      let ndmi = (sample.B08 - sample.B11) / (sample.B08 + sample.B11);
      
      // Color mapping - blue for wet, red for dry
      if (ndmi < -0.4) return [0.8, 0.2, 0.1, sample.dataMask];  // Very dry
      if (ndmi < -0.2) return [0.9, 0.5, 0.2, sample.dataMask];  // Dry
      if (ndmi < 0) return [0.95, 0.8, 0.4, sample.dataMask];    // Moderate dry
      if (ndmi < 0.2) return [0.8, 0.9, 0.6, sample.dataMask];   // Moderate wet
      if (ndmi < 0.4) return [0.4, 0.7, 0.9, sample.dataMask];   // Wet
      return [0.1, 0.4, 0.8, sample.dataMask];                    // Very wet
    }
  `;

  const requestBody = {
    input: {
      bounds: {
        bbox: bbox,
        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
      },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: {
            timeRange: {
              from: new Date(
                Date.now() - 30 * 24 * 60 * 60 * 1000
              ).toISOString(),
              to: new Date().toISOString(),
            },
            maxCloudCoverage: 30,
          },
        },
      ],
    },
    output: {
      width: width,
      height: height,
      responses: [{ identifier: "default", format: { type: "image/png" } }],
    },
    evalscript: evalscript,
  };

  const response = await fetch(`${SENTINEL_API_BASE}/api/v1/process`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "image/png",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Sentinel Moisture Error:", response.status, errorText);
    throw new Error(`Failed to get moisture image: ${response.status}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

/**
 * Get LAI (Leaf Area Index) - crop growth indicator
 */
export const getSentinelLAI = async (coords, width = 512, height = 512) => {
  const token = await getAccessToken();
  const bbox = coordsToBBox(coords);

  const evalscript = `
    //VERSION=3
    function setup() {
      return {
        input: ["B03", "B04", "B05", "B06", "B07", "B8A", "B11", "B12", "dataMask"],
        output: { bands: 4 }
      };
    }

    function evaluatePixel(sample) {
      // Simplified LAI estimation using NDVI relationship
      let ndvi = (sample.B8A - sample.B04) / (sample.B8A + sample.B04);
      let lai = 0;
      
      if (ndvi > 0) {
        lai = -Math.log((0.69 - ndvi) / 0.59) / 2.13;
        if (lai < 0) lai = 0;
        if (lai > 6) lai = 6;
      }
      
      // Normalize LAI to 0-1 range and apply color
      let norm = lai / 6;
      return [1 - norm, norm, 0.2, sample.dataMask];
    }
  `;

  const requestBody = {
    input: {
      bounds: {
        bbox: bbox,
        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
      },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: {
            timeRange: {
              from: new Date(
                Date.now() - 30 * 24 * 60 * 60 * 1000
              ).toISOString(),
              to: new Date().toISOString(),
            },
            maxCloudCoverage: 30,
          },
        },
      ],
    },
    output: {
      width: width,
      height: height,
      responses: [{ identifier: "default", format: { type: "image/png" } }],
    },
    evalscript: evalscript,
  };

  const response = await fetch(`${SENTINEL_API_BASE}/api/v1/process`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "image/png",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Sentinel LAI Error:", response.status, errorText);
    throw new Error(`Failed to get LAI image: ${response.status}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

/**
 * Get statistical values for a polygon (NDVI mean, min, max, std)
 */
export const getSentinelStats = async (coords, days = 30) => {
  const token = await getAccessToken();
  const geometry = coordsToGeoJSON(coords);

  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const evalscript = `
    //VERSION=3
    function setup() {
      return {
        input: ["B04", "B08", "dataMask"],
        output: [
          { id: "ndvi", bands: 1 },
          { id: "dataMask", bands: 1 }
        ]
      };
    }

    function evaluatePixel(sample) {
      let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
      return {
        ndvi: [ndvi],
        dataMask: [sample.dataMask]
      };
    }
  `;

  const requestBody = {
    input: {
      bounds: {
        geometry: geometry,
        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
      },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: {
            timeRange: {
              from: `${startDate}T00:00:00Z`,
              to: `${endDate}T23:59:59Z`,
            },
            maxCloudCoverage: 30,
          },
        },
      ],
    },
    aggregation: {
      timeRange: {
        from: `${startDate}T00:00:00Z`,
        to: `${endDate}T23:59:59Z`,
      },
      aggregationInterval: { of: "P5D" }, // 5-day intervals
      evalscript: evalscript,
      resx: 10,
      resy: 10,
    },
    calculations: {
      default: {
        statistics: {
          default: {
            percentiles: { k: [25, 50, 75] },
          },
        },
      },
    },
  };

  const response = await fetch(`${SENTINEL_API_BASE}/api/v1/statistics`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Sentinel Stats Error:", response.status, errorText);
    throw new Error(`Failed to get statistics: ${response.status}`);
  }

  const data = await response.json();
  console.log("Sentinel Statistics:", data);
  return data;
};

/**
 * Get comprehensive vegetation statistics (NDVI, SAVI, Moisture, LAI) as numeric values
 * Returns mean, min, max, and standard deviation for each index
 */
export const getVegetationStats = async (coords, days = 30) => {
  const token = await getAccessToken();
  const geometry = coordsToGeoJSON(coords);

  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // Evalscript that calculates all vegetation indices
  const evalscript = `
    //VERSION=3
    function setup() {
      return {
        input: ["B02", "B03", "B04", "B08", "B8A", "B11", "dataMask"],
        output: [
          { id: "ndvi", bands: 1 },
          { id: "savi", bands: 1 },
          { id: "moisture", bands: 1 },
          { id: "lai", bands: 1 },
          { id: "dataMask", bands: 1 }
        ]
      };
    }

    function evaluatePixel(sample) {
      // NDVI = (NIR - Red) / (NIR + Red)
      let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04 + 0.0001);
      
      // SAVI = ((NIR - Red) / (NIR + Red + L)) * (1 + L), L = 0.5
      let L = 0.5;
      let savi = ((sample.B08 - sample.B04) / (sample.B08 + sample.B04 + L)) * (1 + L);
      
      // NDMI (Moisture) = (NIR - SWIR) / (NIR + SWIR)
      let moisture = (sample.B8A - sample.B11) / (sample.B8A + sample.B11 + 0.0001);
      
      // Simplified LAI estimation based on NDVI
      // LAI ≈ -ln((0.69 - NDVI) / 0.59) / 0.91 (capped at 0-8 range)
      let lai = 0;
      if (ndvi > 0.1) {
        lai = Math.max(0, Math.min(8, -Math.log((0.69 - ndvi) / 0.59) / 0.91));
      }
      
      return {
        ndvi: [ndvi],
        savi: [savi],
        moisture: [moisture],
        lai: [lai],
        dataMask: [sample.dataMask]
      };
    }
  `;

  const requestBody = {
    input: {
      bounds: {
        geometry: geometry,
        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
      },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: {
            timeRange: {
              from: `${startDate}T00:00:00Z`,
              to: `${endDate}T23:59:59Z`,
            },
            maxCloudCoverage: 30,
            mosaickingOrder: "leastCC",
          },
        },
      ],
    },
    aggregation: {
      timeRange: {
        from: `${startDate}T00:00:00Z`,
        to: `${endDate}T23:59:59Z`,
      },
      aggregationInterval: { of: "P30D" },
      evalscript: evalscript,
      resx: 10,
      resy: 10,
    },
    calculations: {
      default: {
        statistics: {
          default: {
            percentiles: { k: [25, 50, 75] },
          },
        },
      },
    },
  };

  const response = await fetch(`${SENTINEL_API_BASE}/api/v1/statistics`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      "Sentinel Vegetation Stats Error:",
      response.status,
      errorText
    );
    throw new Error(`Failed to get vegetation statistics: ${response.status}`);
  }

  const data = await response.json();
  console.log("Sentinel Vegetation Statistics Raw:", data);

  // Parse the statistics into a cleaner format
  const stats = {
    ndvi: null,
    savi: null,
    moisture: null,
    lai: null,
    acquisitionDate: null,
  };

  if (data.data && data.data.length > 0) {
    const latestData = data.data[data.data.length - 1];
    stats.acquisitionDate = latestData.interval?.from;

    if (latestData.outputs) {
      ["ndvi", "savi", "moisture", "lai"].forEach((index) => {
        if (latestData.outputs[index]?.bands?.B0?.stats) {
          const s = latestData.outputs[index].bands.B0.stats;
          stats[index] = {
            mean: s.mean,
            min: s.min,
            max: s.max,
            stDev: s.stDev,
            median: s.percentiles?.p50,
            p25: s.percentiles?.p25,
            p75: s.percentiles?.p75,
          };
        }
      });
    }
  }

  return stats;
};

/**
 * Fetch all Sentinel data for a farm
 */
export const getAllSentinelDataForFarm = async (coords) => {
  const results = await Promise.allSettled([
    getSentinelTrueColor(coords),
    getSentinelNDVI(coords),
    getSentinelSAVI(coords),
    getSentinelMoisture(coords),
    getSentinelLAI(coords),
    searchSentinelScenes(coords),
  ]);

  const dataNames = ["trueColor", "ndvi", "savi", "moisture", "lai", "scenes"];
  const data = {};
  const errors = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      data[dataNames[index]] = result.value;
    } else {
      errors.push({ api: dataNames[index], error: result.reason.message });
      data[dataNames[index]] = null;
    }
  });

  return { data, errors };
};

/**
 * Get historical vegetation index time series data for charts
 * Returns data points every 5 days for the last N days
 */
export const getVegetationHistory = async (coords, days = 60) => {
  const token = await getAccessToken();
  const geometry = coordsToGeoJSON(coords);

  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // Evalscript that calculates all vegetation indices
  const evalscript = `
    //VERSION=3
    function setup() {
      return {
        input: ["B02", "B03", "B04", "B08", "B8A", "B11", "dataMask"],
        output: [
          { id: "ndvi", bands: 1 },
          { id: "savi", bands: 1 },
          { id: "moisture", bands: 1 },
          { id: "lai", bands: 1 },
          { id: "dataMask", bands: 1 }
        ]
      };
    }

    function evaluatePixel(sample) {
      // NDVI = (NIR - Red) / (NIR + Red)
      let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04 + 0.0001);
      
      // SAVI = ((NIR - Red) / (NIR + Red + L)) * (1 + L), L = 0.5
      let L = 0.5;
      let savi = ((sample.B08 - sample.B04) / (sample.B08 + sample.B04 + L)) * (1 + L);
      
      // NDMI (Moisture) = (NIR - SWIR) / (NIR + SWIR)
      let moisture = (sample.B8A - sample.B11) / (sample.B8A + sample.B11 + 0.0001);
      
      // Simplified LAI estimation based on NDVI
      let lai = 0;
      if (ndvi > 0.1) {
        lai = Math.max(0, Math.min(8, -Math.log((0.69 - ndvi) / 0.59) / 0.91));
      }
      
      return {
        ndvi: [ndvi],
        savi: [savi],
        moisture: [moisture],
        lai: [lai],
        dataMask: [sample.dataMask]
      };
    }
  `;

  const requestBody = {
    input: {
      bounds: {
        geometry: geometry,
        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
      },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: {
            timeRange: {
              from: `${startDate}T00:00:00Z`,
              to: `${endDate}T23:59:59Z`,
            },
            maxCloudCoverage: 50,
            mosaickingOrder: "leastCC",
          },
        },
      ],
    },
    aggregation: {
      timeRange: {
        from: `${startDate}T00:00:00Z`,
        to: `${endDate}T23:59:59Z`,
      },
      aggregationInterval: { of: "P5D" }, // 5-day intervals for time series
      evalscript: evalscript,
      resx: 10,
      resy: 10,
    },
    calculations: {
      default: {
        statistics: {
          default: {
            percentiles: { k: [50] },
          },
        },
      },
    },
  };

  const response = await fetch(`${SENTINEL_API_BASE}/api/v1/statistics`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Sentinel History Error:", response.status, errorText);
    throw new Error(`Failed to get vegetation history: ${response.status}`);
  }

  const responseData = await response.json();
  console.log("Sentinel Vegetation History Raw:", responseData);

  // Parse into chart-friendly format
  const history = {
    ndvi: [],
    savi: [],
    moisture: [],
    lai: [],
  };

  if (responseData.data && responseData.data.length > 0) {
    responseData.data.forEach((interval) => {
      const date = interval.interval?.from;
      if (!date) return;

      // Parse date to timestamp
      const timestamp = new Date(date).getTime() / 1000; // Unix timestamp

      ["ndvi", "savi", "moisture", "lai"].forEach((index) => {
        if (interval.outputs?.[index]?.bands?.B0?.stats?.mean !== undefined) {
          history[index].push({
            dt: timestamp,
            date: date,
            data: {
              mean: interval.outputs[index].bands.B0.stats.mean,
              min: interval.outputs[index].bands.B0.stats.min,
              max: interval.outputs[index].bands.B0.stats.max,
              median: interval.outputs[index].bands.B0.stats.percentiles?.p50,
            },
          });
        }
      });
    });
  }

  console.log("Parsed Vegetation History:", history);
  return history;
};
