/**
 * Comprehensive Tamil Nadu Location Catalog & Geocoding Service
 * Covers major cities, districts, bus terminals, toll plazas, and arterial junctions across Tamil Nadu.
 */

export const TAMIL_NADU_LOCATIONS = [
  // 1. Major Traffic Junctions
  { name: "Sankagiri Junction", lat: 11.4800, lon: 77.8700, district: "Salem", type: "NH544 Primary Inflow Junction", category: "Junction" },
  { name: "Five Roads Junction", lat: 11.6660, lon: 78.1360, district: "Salem", type: "Major Arterial Junction", category: "Junction" },
  { name: "New Bus Stand Junction", lat: 11.6630, lon: 78.1480, district: "Salem", type: "City Arterial Junction", category: "Junction" },
  { name: "AVR Roundana Junction", lat: 11.6600, lon: 78.1300, district: "Salem", type: "Rotary Highway Junction", category: "Junction" },
  { name: "Goripalayam Junction", lat: 9.9320, lon: 78.1300, district: "Madurai", type: "River Arterial Junction", category: "Junction" },
  { name: "Kalavasal Junction", lat: 9.9360, lon: 78.0980, district: "Madurai", type: "Western Inflow Junction", category: "Junction" },
  { name: "Mattuthavani Junction", lat: 9.9340, lon: 78.1560, district: "Madurai", type: "Transit Arterial Junction", category: "Junction" },
  { name: "Gandhipuram Signal", lat: 11.0168, lon: 76.9674, district: "Coimbatore", type: "Commercial Core Junction", category: "Junction" },
  { name: "Lakshmi Mills Junction", lat: 11.0120, lon: 76.9830, district: "Coimbatore", type: "Avinashi Road Junction", category: "Junction" },
  { name: "Ukkadam Junction", lat: 10.9900, lon: 76.9600, district: "Coimbatore", type: "South Highway Junction", category: "Junction" },
  { name: "Hope College Junction", lat: 11.0280, lon: 77.0140, district: "Coimbatore", type: "Avinashi Road Junction", category: "Junction" },
  { name: "Perundurai Junction", lat: 11.2758, lon: 77.5828, district: "Erode", type: "NH544 Arterial Junction", category: "Junction" },
  { name: "Thillai Nagar Junction", lat: 10.8220, lon: 78.6880, district: "Tiruchirappalli", type: "Central City Junction", category: "Junction" },
  { name: "TVS Tollgate Junction", lat: 10.8030, lon: 78.6970, district: "Tiruchirappalli", type: "Highway Inflow Junction", category: "Junction" },
  { name: "Kathipara Junction", lat: 13.0067, lon: 80.2030, district: "Chennai", type: "Major Cloverleaf Flyover Junction", category: "Junction" },
  { name: "Koyambedu Roundabout", lat: 13.0694, lon: 80.2057, district: "Chennai", type: "Metropolitan Transit Junction", category: "Junction" },
  { name: "Madhya Kailash Junction", lat: 13.0070, lon: 80.2520, district: "Chennai", type: "OMR / IT Corridor Gateway", category: "Junction" },
  { name: "Guindy Junction", lat: 13.0090, lon: 80.2130, district: "Chennai", type: "GST Road Hub Junction", category: "Junction" },
  { name: "Vannarpettai Junction", lat: 8.7300, lon: 77.7290, district: "Tirunelveli", type: "Arterial Flyover Junction", category: "Junction" },
  { name: "Tiruchengode Junction", lat: 11.3850, lon: 77.8950, district: "Namakkal", type: "SH86 Arterial Junction", category: "Junction" },
  { name: "Rasipuram Junction", lat: 11.4580, lon: 78.1670, district: "Namakkal", type: "NH44 Arterial Junction", category: "Junction" },

  // 2. Major National & State Highways / Corridors
  { name: "NH544", lat: 11.4800, lon: 77.8700, district: "Salem / Erode / Coimbatore", type: "Salem - Coimbatore - Kochi Expressway", category: "Highway / Road" },
  { name: "NH44", lat: 11.6643, lon: 78.1460, district: "Krishnagiri / Dharmapuri / Salem / Madurai", type: "North-South National Highway Corridor", category: "Highway / Road" },
  { name: "GST Road", lat: 12.8342, lon: 79.7036, district: "Chennai / Chengalpattu", type: "Grand Southern Trunk Road (NH45)", category: "Highway / Road" },
  { name: "OMR", lat: 12.9100, lon: 80.2280, district: "Chennai", type: "Old Mahabalipuram Road IT Expressway", category: "Highway / Road" },
  { name: "ECR", lat: 12.8000, lon: 80.2400, district: "Chennai / Cuddalore", type: "East Coast Road Scenic Corridor", category: "Highway / Road" },
  { name: "Avinashi Road", lat: 11.0200, lon: 77.0000, district: "Coimbatore", type: "Arterial City Expressway", category: "Highway / Road" },
  { name: "Trichy Road", lat: 11.0000, lon: 77.0200, district: "Coimbatore", type: "NH81 Inflow Corridor", category: "Highway / Road" },
  { name: "Salem Bypass Road", lat: 11.6700, lon: 78.1200, district: "Salem", type: "Western Highway Bypass", category: "Highway / Road" },
  { name: "Madurai Ring Road", lat: 9.9000, lon: 78.1600, district: "Madurai", type: "Southern Arterial Bypass", category: "Highway / Road" },

  // 3. District Centers & Major Municipal Corporations
  { name: "Chennai", lat: 13.0827, lon: 80.2707, district: "Chennai", type: "State Capital / Metropolitan Hub", category: "District" },
  { name: "Coimbatore", lat: 11.0168, lon: 76.9558, district: "Coimbatore", type: "Major Commercial Hub", category: "District" },
  { name: "Madurai", lat: 9.9252, lon: 78.1198, district: "Madurai", type: "South Zone Hub", category: "District" },
  { name: "Tiruchirappalli", lat: 10.7905, lon: 78.7047, district: "Tiruchirappalli", type: "Central Arterial Hub", category: "District" },
  { name: "Trichy", lat: 10.7905, lon: 78.7047, district: "Tiruchirappalli", type: "Central Arterial Hub", category: "District" },
  { name: "Salem", lat: 11.6643, lon: 78.1460, district: "Salem", type: "Western Inflow Hub", category: "District" },
  { name: "Erode", lat: 11.3410, lon: 77.7172, district: "Erode", type: "Industrial Corridor", category: "District" },
  { name: "Tiruppur", lat: 11.1085, lon: 77.3411, district: "Tiruppur", type: "Industrial Hub", category: "District" },
  { name: "Tirunelveli", lat: 8.7139, lon: 77.7567, district: "Tirunelveli", type: "Southern Arterial Hub", category: "District" },
  { name: "Kanyakumari", lat: 8.0883, lon: 77.5385, district: "Kanyakumari", type: "Southern Highway Terminal", category: "District" },
  { name: "Vellore", lat: 12.9165, lon: 79.1325, district: "Vellore", type: "Northern Corridor Hub", category: "District" },
  { name: "Thanjavur", lat: 10.7870, lon: 79.1378, district: "Thanjavur", type: "Delta Region Hub", category: "District" },
  { name: "Dindigul", lat: 10.3673, lon: 77.9803, district: "Dindigul", type: "Central Highway Junction", category: "District" },
  { name: "Namakkal", lat: 11.2189, lon: 78.1668, district: "Namakkal", type: "Transport Hub", category: "District" },
  { name: "Karur", lat: 10.9601, lon: 78.0766, district: "Karur", type: "Textile Corridor Hub", category: "District" },
  { name: "Dharmapuri", lat: 12.1277, lon: 78.1584, district: "Dharmapuri", type: "Northern Arterial Hub", category: "District" },
  { name: "Krishnagiri", lat: 12.5186, lon: 78.2137, district: "Krishnagiri", type: "NH44 Inflow District", category: "District" },
  { name: "Cuddalore", lat: 11.7480, lon: 79.7714, district: "Cuddalore", type: "Coastal District Hub", category: "District" },
  { name: "Villupuram", lat: 11.9401, lon: 79.4861, district: "Villupuram", type: "Grand Southern Trunk Link", category: "District" },
  { name: "Kanchipuram", lat: 12.8342, lon: 79.7036, district: "Kanchipuram", type: "Northern Industrial Hub", category: "District" },
  { name: "Tiruvannamalai", lat: 12.2253, lon: 79.0747, district: "Tiruvannamalai", type: "State Highway Corridor Hub", category: "District" },
  { name: "Thoothukudi", lat: 8.7642, lon: 78.1348, district: "Thoothukudi", type: "Port City Corridor Hub", category: "District" },
  { name: "Ramanathapuram", lat: 9.3639, lon: 78.8395, district: "Ramanathapuram", type: "Eastern Coastal Highway", category: "District" },
  { name: "Virudhunagar", lat: 9.5872, lon: 77.9514, district: "Virudhunagar", type: "NH44 South Hub", category: "District" },
  { name: "Nagapattinam", lat: 10.7672, lon: 79.8449, district: "Nagapattinam", type: "Coastal Terminal", category: "District" },
  { name: "Puducherry", lat: 11.9416, lon: 79.8083, district: "Puducherry", type: "East Coast Arterial", category: "District" },
  { name: "Nilgiris", lat: 11.4102, lon: 76.6950, district: "Nilgiris", type: "Hill District", category: "District" },

  // 4. Key Towns & Municipalities
  { name: "Sankagiri", lat: 11.4800, lon: 77.8700, district: "Salem", type: "Highway Inflow Town", category: "Town / City" },
  { name: "Perundurai", lat: 11.2758, lon: 77.5828, district: "Erode", type: "Industrial Corridor Town", category: "Town / City" },
  { name: "Hosur", lat: 12.7409, lon: 77.8253, district: "Krishnagiri", type: "Interstate Border Industrial Town", category: "Town / City" },
  { name: "Nagercoil", lat: 8.1833, lon: 77.4119, district: "Kanyakumari", type: "Southern Urban Center", category: "Town / City" },
  { name: "Sivakasi", lat: 9.4533, lon: 77.7979, district: "Virudhunagar", type: "Industrial Center", category: "Town / City" },
  { name: "Pollachi", lat: 10.6609, lon: 77.0048, district: "Coimbatore", type: "Western Agricultural Hub", category: "Town / City" },
  { name: "Ooty", lat: 11.4102, lon: 76.6950, district: "Nilgiris", type: "Hill Station Corridor", category: "Town / City" },
  { name: "Mettur", lat: 11.7872, lon: 77.8010, district: "Salem", type: "Cauvery Industrial Town", category: "Town / City" },
  { name: "Vedaranyam", lat: 10.3756, lon: 79.8512, district: "Nagapattinam", type: "Coastal Town", category: "Town / City" },
  { name: "Velankanni", lat: 10.6800, lon: 79.8400, district: "Nagapattinam", type: "Pilgrim & Coastal Town", category: "Town / City" },

  // 5. Major Landmarks, Terminals & Toll Plazas
  { name: "Salem Bus Stand", lat: 11.6643, lon: 78.1460, district: "Salem", type: "Central Bus Terminal", category: "Landmark" },
  { name: "Erode Bus Stand", lat: 11.3410, lon: 77.7172, district: "Erode", type: "Central Bus Terminal", category: "Landmark" },
  { name: "Namakkal Bus Stand", lat: 11.2189, lon: 78.1668, district: "Namakkal", type: "Central Bus Terminal", category: "Landmark" },
  { name: "Karur Bus Stand", lat: 10.9601, lon: 78.0766, district: "Karur", type: "Central Bus Terminal", category: "Landmark" },
  { name: "Coimbatore Bus Stand", lat: 11.0168, lon: 76.9558, district: "Coimbatore", type: "Gandhipuram Bus Terminal", category: "Landmark" },
  { name: "Tiruppur Bus Stand", lat: 11.1085, lon: 77.3411, district: "Tiruppur", type: "Central Bus Terminal", category: "Landmark" },
  { name: "Trichy Bus Stand", lat: 10.7905, lon: 78.7047, district: "Tiruchirappalli", type: "Central Bus Terminal", category: "Landmark" },
  { name: "Madurai Bus Stand", lat: 9.9312, lon: 78.1250, district: "Madurai", type: "Mattuthavani Bus Terminal", category: "Landmark" },
  { name: "Chennai CMBT", lat: 13.0694, lon: 80.2057, district: "Chennai", type: "Koyambedu Bus Terminal", category: "Landmark" },
  { name: "Salem Junction Railway Station", lat: 11.6686, lon: 78.1440, district: "Salem", type: "Railway Terminal", category: "Landmark" },
  { name: "Sankagiri Toll Plaza", lat: 11.4850, lon: 77.8720, district: "Salem", type: "NH544 Toll Station", category: "Landmark" },
  { name: "Erode Toll Plaza", lat: 11.3400, lon: 77.7100, district: "Erode", type: "NH544 Toll Station", category: "Landmark" },
  { name: "Omalur Toll Plaza", lat: 11.7400, lon: 78.0400, district: "Salem", type: "NH44 Toll Plaza", category: "Landmark" },
  { name: "Vijayamangalam Toll Plaza", lat: 11.2300, lon: 77.5000, district: "Erode", type: "NH544 Toll Plaza", category: "Landmark" },
  { name: "Samayapuram Toll Plaza", lat: 10.9200, lon: 78.7400, district: "Tiruchirappalli", type: "NH45 Toll Plaza", category: "Landmark" },
];

/**
 * Search locations by query string
 */
export async function searchTamilNaduLocations(query) {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase();

  // 1. Match local catalog
  const localMatches = TAMIL_NADU_LOCATIONS.filter(
    (loc) =>
      loc.name.toLowerCase().includes(q) ||
      loc.district.toLowerCase().includes(q) ||
      (loc.type && loc.type.toLowerCase().includes(q))
  );

  if (localMatches.length > 0) {
    return localMatches.slice(0, 8);
  }

  // 2. OpenStreetMap Nominatim Geocoding Fallback for any specific Tamil Nadu location
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query + ", Tamil Nadu, India"
      )}&limit=5&countrycodes=in`
    );
    if (res.ok) {
      const data = await res.json();
      return data.map((item) => ({
        name: item.display_name.split(",")[0],
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        district: item.display_name.split(",")[1] || "Tamil Nadu",
        type: "Geocoded Location",
      }));
    }
  } catch (err) {
    console.warn("Nominatim geocoding error:", err);
  }

  return [];
}

/**
 * Calculate distance between two coordinates in kilometers (Haversine formula)
 */
export function getDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find closest location from local catalog
 */
export function findNearestLocation(lat, lon) {
  if (lat == null || lon == null) return null;
  let closest = null;
  let minDistance = Infinity;

  for (const loc of TAMIL_NADU_LOCATIONS) {
    const d = getDistanceKm(lat, lon, loc.lat, loc.lon);
    if (d < minDistance) {
      minDistance = d;
      closest = { ...loc, distanceKm: d };
    }
  }

  return closest;
}

/**
 * Reverse geocode coordinates to a clean place and district name
 */
export async function reverseGeocodeLocation(lat, lon) {
  if (lat == null || lon == null) {
    return { name: "Tamil Nadu", district: "Tamil Nadu", rawName: "Tamil Nadu" };
  }

  // 1. Try Nominatim reverse lookup with timeout
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1800);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const placeName = addr.suburb || addr.neighbourhood || addr.city || addr.town || addr.village || addr.county;
      const district = addr.state_district || addr.county || addr.city || "";
      if (placeName) {
        return {
          name: district && district.toLowerCase() !== placeName.toLowerCase() ? `${district} • ${placeName}` : placeName,
          district: district || placeName,
          rawName: placeName,
        };
      }
    }
  } catch (e) {
    // Network or timeout, fallback to catalog
  }

  // 2. Fallback to nearest local catalog entry
  const nearest = findNearestLocation(lat, lon);
  if (nearest) {
    return {
      name: nearest.district && nearest.district.toLowerCase() !== nearest.name.toLowerCase() ? `${nearest.district} • ${nearest.name}` : nearest.name,
      district: nearest.district,
      rawName: nearest.name,
    };
  }

  return { name: "Tamil Nadu", district: "Tamil Nadu", rawName: "Tamil Nadu" };
}
