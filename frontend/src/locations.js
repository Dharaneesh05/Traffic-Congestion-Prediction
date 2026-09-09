/**
 * Comprehensive Tamil Nadu Location Catalog & Geocoding Service
 * Covers major cities, districts, bus terminals, toll plazas, and arterial junctions across Tamil Nadu.
 */

export const TAMIL_NADU_LOCATIONS = [
  // Major Cities & District Centers
  { name: "Chennai", lat: 13.0827, lon: 80.2707, district: "Chennai", type: "State Capital / Metropolitan Hub" },
  { name: "Coimbatore", lat: 11.0168, lon: 76.9558, district: "Coimbatore", type: "Major Commercial Hub" },
  { name: "Madurai", lat: 9.9252, lon: 78.1198, district: "Madurai", type: "South Zone Hub" },
  { name: "Trichy", lat: 10.7905, lon: 78.7047, district: "Tiruchirappalli", type: "Central Arterial Hub" },
  { name: "Tiruchirappalli", lat: 10.7905, lon: 78.7047, district: "Tiruchirappalli", type: "Central Arterial Hub" },
  { name: "Salem", lat: 11.6643, lon: 78.1460, district: "Salem", type: "Western Inflow Hub" },
  { name: "Erode", lat: 11.3410, lon: 77.7172, district: "Erode", type: "Industrial Corridor" },
  { name: "Tiruppur", lat: 11.1085, lon: 77.3411, district: "Tiruppur", type: "Industrial Hub" },
  { name: "Tirunelveli", lat: 8.7139, lon: 77.7567, district: "Tirunelveli", type: "Southern Arterial Hub" },
  { name: "Kanyakumari", lat: 8.0883, lon: 77.5385, district: "Kanyakumari", type: "Southern Highway Terminal" },
  { name: "Nagercoil", lat: 8.1833, lon: 77.4119, district: "Kanyakumari", type: "District Capital" },
  { name: "Vellore", lat: 12.9165, lon: 79.1325, district: "Vellore", type: "Northern Corridor" },
  { name: "Thanjavur", lat: 10.7870, lon: 79.1378, district: "Thanjavur", type: "Delta Region Hub" },
  { name: "Hosur", lat: 12.7409, lon: 77.8253, district: "Krishnagiri", type: "Interstate Border Corridor" },
  { name: "Dindigul", lat: 10.3673, lon: 77.9803, district: "Dindigul", type: "Central Highway Junction" },
  { name: "Namakkal", lat: 11.2189, lon: 78.1668, district: "Namakkal", type: "Transport Hub" },
  { name: "Karur", lat: 10.9601, lon: 78.0766, district: "Karur", type: "Textile Corridor" },
  { name: "Dharmapuri", lat: 12.1277, lon: 78.1584, district: "Dharmapuri", type: "Northern Arterial" },
  { name: "Krishnagiri", lat: 12.5186, lon: 78.2137, district: "Krishnagiri", type: "NH44 Inflow Junction" },
  { name: "Cuddalore", lat: 11.7480, lon: 79.7714, district: "Cuddalore", type: "Coastal Highway" },
  { name: "Villupuram", lat: 11.9401, lon: 79.4861, district: "Villupuram", type: "Grand Southern Trunk Link" },
  { name: "Kanchipuram", lat: 12.8342, lon: 79.7036, district: "Kanchipuram", type: "Northern Industrial Link" },
  { name: "Tiruvannamalai", lat: 12.2253, lon: 79.0747, district: "Tiruvannamalai", type: "State Highway Corridor" },
  { name: "Thoothukudi", lat: 8.7642, lon: 78.1348, district: "Thoothukudi", type: "Port City Corridor" },
  { name: "Ramanathapuram", lat: 9.3639, lon: 78.8395, district: "Ramanathapuram", type: "Eastern Coastal Highway" },
  { name: "Sivakasi", lat: 9.4533, lon: 77.7979, district: "Virudhunagar", type: "Industrial Center" },
  { name: "Virudhunagar", lat: 9.5872, lon: 77.9514, district: "Virudhunagar", type: "NH44 South Hub" },
  { name: "Pollachi", lat: 10.6609, lon: 77.0048, district: "Coimbatore", type: "Western Ghats Link" },
  { name: "Nagapattinam", lat: 10.7672, lon: 79.8449, district: "Nagapattinam", type: "Coastal Terminal" },
  { name: "Puducherry", lat: 11.9416, lon: 79.8083, district: "Puducherry", type: "East Coast Arterial" },
  { name: "Ooty", lat: 11.4102, lon: 76.6950, district: "Nilgiris", type: "Hill Corridor Link" },
  { name: "Mettur", lat: 11.7872, lon: 77.8010, district: "Salem", type: "Cauvery Link" },
  { name: "Sankagiri", lat: 11.4800, lon: 77.8700, district: "Salem", type: "NH544 Primary Inflow Hub" },
  { name: "Vedaranyam", lat: 10.3756, lon: 79.8512, district: "Nagapattinam", type: "Coastal Town & Highway Node" },
  { name: "Gandhipuram", lat: 11.0168, lon: 76.9674, district: "Coimbatore", type: "Central Commercial & Bus Hub" },
  { name: "Koyambedu", lat: 13.0694, lon: 80.2057, district: "Chennai", type: "Metropolitan Transit Hub" },
  { name: "Goripalayam", lat: 9.9320, lon: 78.1300, district: "Madurai", type: "North Vaigai River Arterial Hub" },
  { name: "Velankanni", lat: 10.6800, lon: 79.8400, district: "Nagapattinam", type: "Pilgrim & Coastal Corridor" },
  // Key Bus Stands & Terminals
  { name: "Salem Bus Stand", lat: 11.6643, lon: 78.1460, district: "Salem", type: "Central Bus Terminal" },
  { name: "Erode Bus Stand", lat: 11.3410, lon: 77.7172, district: "Erode", type: "Central Bus Terminal" },
  { name: "Namakkal Bus Stand", lat: 11.2189, lon: 78.1668, district: "Namakkal", type: "Central Bus Terminal" },
  { name: "Karur Bus Stand", lat: 10.9601, lon: 78.0766, district: "Karur", type: "Central Bus Terminal" },
  { name: "Coimbatore Bus Stand", lat: 11.0168, lon: 76.9558, district: "Coimbatore", type: "Gandhipuram Bus Terminal" },
  { name: "Tiruppur Bus Stand", lat: 11.1085, lon: 77.3411, district: "Tiruppur", type: "Central Bus Terminal" },
  { name: "Trichy Bus Stand", lat: 10.7905, lon: 78.7047, district: "Tiruchirappalli", type: "Central Bus Terminal" },
  { name: "Madurai Bus Stand", lat: 9.9312, lon: 78.1250, district: "Madurai", type: "Mattuthavani Bus Terminal" },
  { name: "Chennai CMBT", lat: 13.0694, lon: 80.2057, district: "Chennai", type: "Koyambedu Bus Terminal" },

  // Key Highway Junctions & Tolls
  { name: "Salem Junction", lat: 11.6686, lon: 78.1440, district: "Salem", type: "Railway / Highway Junction" },
  { name: "Erode Toll", lat: 11.3400, lon: 77.7100, district: "Erode", type: "NH544 Toll Plaza" },
  { name: "Sankagiri Toll Plaza", lat: 11.4850, lon: 77.8720, district: "Salem", type: "NH544 Toll Station" },
  { name: "Tiruchengode Junction", lat: 11.3850, lon: 77.8950, district: "Namakkal", type: "SH86 Arterial Junction" },
  { name: "Rasipuram Junction", lat: 11.4580, lon: 78.1670, district: "Namakkal", type: "NH44 Arterial" },
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
