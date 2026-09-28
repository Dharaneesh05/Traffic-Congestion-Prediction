/**
 * Centralized Translation System (i18n)
 * Supports English (en) and Tamil (ta) for Tamil Nadu Traffic Control Rooms.
 * Proper names (e.g., Sankagiri Junction, NH544, CCTV-SKG-01) remain untranslated.
 */

export const TRANSLATIONS = {
  en: {
    // Navigation
    "nav.dashboard": "Dashboard",
    "nav.map": "Live Traffic Map",
    "nav.cctv": "Camera Monitoring",
    "nav.routing": "Route Planning",
    "nav.forecast": "Traffic Forecast",
    "nav.settings": "Settings",

    // Header & Modes
    "header.controlRoom": "Control Room",
    "header.fieldOfficer": "Field Officer",
    "header.demoMode": "DEMO",
    "header.liveMode": "LIVE",
    "header.searchPlaceholder": "Search junction, road, camera, or district...",

    // Settings Page
    "settings.title": "SETTINGS",
    "settings.subtitle": "System preferences and traffic-control display settings",

    // Section 1: Display
    "settings.display": "DISPLAY",
    "settings.theme": "Theme",
    "settings.themeDesc": "Visual appearance for control room displays",
    "settings.themeLight": "Light",
    "settings.themeDark": "Dark",
    "settings.themeSystem": "System",
    "settings.density": "Display Density",
    "settings.densityDesc": "Adjust row height and spacing across all workspaces",
    "settings.densityCompact": "Compact",
    "settings.densityComfortable": "Comfortable",

    // Section 2: Language
    "settings.language": "LANGUAGE",
    "settings.langDesc": "Primary interface language for officer controls",
    "settings.langEn": "English",
    "settings.langTa": "தமிழ்",

    // Section 3: Traffic Operations
    "settings.trafficOps": "TRAFFIC OPERATIONS",
    "settings.defaultMapView": "Default Map View",
    "settings.defaultMapViewDesc": "Initial focus when opening map-related workspaces",
    "settings.viewSelected": "Selected Location",
    "settings.viewCurrent": "Current Location",
    "settings.viewTamilNadu": "Tamil Nadu",
    "settings.speedUnit": "Speed Unit",
    "settings.speedUnitDesc": "Measurement unit for vehicle velocity",
    "settings.autoRefresh": "Auto Refresh",
    "settings.autoRefreshDesc": "Background telemetry and alert update frequency",
    "settings.refreshOff": "Off",
    "settings.refresh15s": "15 seconds",
    "settings.refresh30s": "30 seconds",
    "settings.refresh60s": "60 seconds",

    // Section 4: Map
    "settings.map": "MAP",
    "settings.mapStyle": "Map Style",
    "settings.mapStyleDesc": "Cartographic raster tile style for all application maps",
    "settings.styleStandard": "Standard",
    "settings.styleLight": "Light",
    "settings.styleDark": "Dark",
    "settings.styleSatellite": "Satellite",
    "settings.mapLayers": "Map Layers",
    "settings.mapLayersDesc": "Control visibility of overlays on map workspaces",
    "settings.layerJunctions": "Show Junction Status",
    "settings.layerCameras": "Show CCTV Cameras",
    "settings.layerIncidents": "Show Active Incidents",
    "settings.layerRoutes": "Show Recommended Routes",

    // Section 5: Notifications
    "settings.notifications": "NOTIFICATIONS",
    "settings.notifCritical": "Critical incidents",
    "settings.notifCriticalDesc": "Urgent bottleneck and standstill alert banners",
    "settings.notifHigh": "High-priority incidents",
    "settings.notifHighDesc": "Congestion surge and queue build-up notifications",
    "settings.notifCamera": "Camera offline alerts",
    "settings.notifCameraDesc": "Alert banner when video feed connection drops",
    "settings.notifDiversion": "Diversion/action updates",
    "settings.notifDiversionDesc": "Officer decision logs and route activation notices",

    // Section 6: Working Mode
    "settings.workingMode": "WORKING MODE",
    "settings.workingModeDesc": "Console interface optimized for officer duty station",
    "settings.modeControl": "Control Room",
    "settings.modeField": "Field Officer",

    // Section 7: Officer Profile
    "settings.officerProfile": "OFFICER PROFILE",
    "settings.officerProfileDesc": "Session identity and station authorization",
    "settings.profileStatus": "Active Duty Session: Tamil Nadu Traffic Police (Control Console)",
    "settings.profileNote": "Officer directory authentication managed by state police gateway",

    // Section 8: Reset
    "settings.reset": "RESET TO DEFAULTS",
    "settings.resetConfirm": "Reset all system preferences and display settings to defaults?",

    // Actions & Buttons
    "actions.viewMap": "VIEW MAP",
    "actions.acknowledge": "ACKNOWLEDGE",
    "actions.approve": "APPROVE",
    "actions.reject": "REJECT",
    "actions.override": "MANUAL CONTROL",
    "actions.resolve": "RESOLVE",
    "actions.confirm": "Confirm",
    "actions.cancel": "Cancel",

    // Operational Statuses
    "status.new": "NEW",
    "status.acknowledged": "ACKNOWLEDGED",
    "status.accepted": "ACTION ACCEPTED",
    "status.rejected": "ACTION REJECTED",
    "status.overridden": "ACTION OVERRIDDEN",
    "status.resolved": "RESOLVED",

    "common.active": "ACTIVE",
    "common.online": "ONLINE",
    "common.offline": "OFFLINE",
    "common.operational": "Operational",
    "common.dataUnavailable": "Data unavailable",
    "common.cameraUnavailable": "Camera unavailable",
    "common.currentLocation": "Current Location",
    "common.locationUnavailable": "Current location unavailable",
    "common.detectingLocation": "Detecting location...",
    "common.calculateRoute": "CALCULATE ROUTE",
    "common.calculatingRoute": "CALCULATING ROUTE...",
    "common.clear": "Clear",
    "common.recent": "Recent:",
  },

  ta: {
    // Navigation
    "nav.dashboard": "கட்டுப்பாட்டு அறை",
    "nav.map": "நேரலை வரைபடம்",
    "nav.cctv": "கேமரா கண்காணிப்பு",
    "nav.routing": "வழித்தட திட்டமிடல்",
    "nav.forecast": "போக்குவரத்து கணிப்பு",
    "nav.settings": "அமைப்புகள்",

    // Header & Modes
    "header.controlRoom": "கட்டுப்பாட்டு அறை",
    "header.fieldOfficer": "கள அதிகாரி",
    "header.demoMode": "மாதிரி",
    "header.liveMode": "நேரலை",
    "header.searchPlaceholder": "சந்திப்பு, சாலை, கேமரா அல்லது மாவட்டம் தேடவும்...",

    // Settings Page
    "settings.title": "அமைப்புகள்",
    "settings.subtitle": "கணினி விருப்பத்தேர்வுகள் மற்றும் போக்குவரத்து காட்சி அமைப்புகள்",

    // Section 1: Display
    "settings.display": "காட்சி வடிவம்",
    "settings.theme": "வண்ண முறை",
    "settings.themeDesc": "கட்டுப்பாட்டு அறை திரை வண்ண அமைப்பு",
    "settings.themeLight": "வெளிச்சம்",
    "settings.themeDark": "இருள்",
    "settings.themeSystem": "கணினி முறை",
    "settings.density": "காட்சி அடர்த்தி",
    "settings.densityDesc": "திரை இடைவெளி மற்றும் வரிசை உயரத்தை மாற்றவும்",
    "settings.densityCompact": "சுருக்கமான முறை",
    "settings.densityComfortable": "இயல்பான முறை",

    // Section 2: Language
    "settings.language": "மொழி",
    "settings.langDesc": "அதிகாரி செயல்பாட்டுக்கான முதன்மை மொழி",
    "settings.langEn": "English",
    "settings.langTa": "தமிழ்",

    // Section 3: Traffic Operations
    "settings.trafficOps": "போக்குவரத்து செயல்பாடுகள்",
    "settings.defaultMapView": "இயல்புநிலை வரைபட காட்சி",
    "settings.defaultMapViewDesc": "வரைபடத்தை திறக்கும்போது தொடக்க காட்சி இடம்",
    "settings.viewSelected": "தேர்ந்தெடுக்கப்பட்ட இடம்",
    "settings.viewCurrent": "தற்போதைய இடம்",
    "settings.viewTamilNadu": "தமிழ்நாடு முழுமை",
    "settings.speedUnit": "வேக அலகு",
    "settings.speedUnitDesc": "வாகன வேக அளவீட்டு முறை",
    "settings.autoRefresh": "தானியங்கி புதுப்பிப்பு",
    "settings.autoRefreshDesc": "நேரலை தகவல்கள் மற்றும் எச்சரிக்கைகள் புதுப்பிக்கும் கால அளவு",
    "settings.refreshOff": "முடக்கு",
    "settings.refresh15s": "15 விநாடிகள்",
    "settings.refresh30s": "30 விநாடிகள்",
    "settings.refresh60s": "60 விநாடிகள்",

    // Section 4: Map
    "settings.map": "வரைபடம்",
    "settings.mapStyle": "வரைபட பாணி",
    "settings.mapStyleDesc": "அனைத்து வரைபடங்களுக்குமான பின்னணி அடுக்கு பாணி",
    "settings.styleStandard": "நிலையானது",
    "settings.styleLight": "வெளிச்சம்",
    "settings.styleDark": "இருள்",
    "settings.styleSatellite": "செயற்கைக்கோள்",
    "settings.mapLayers": "வரைபட அடுக்குகள்",
    "settings.mapLayersDesc": "வரைபடத்தில் தோன்றும் தகவல்களை கட்டுப்படுத்தவும்",
    "settings.layerJunctions": "சந்திப்பு நிலையை காட்டு",
    "settings.layerCameras": "சிசிடிவி கேமராக்களை காட்டு",
    "settings.layerIncidents": "செயலில் உள்ள சம்பவங்களை காட்டு",
    "settings.layerRoutes": "பரிந்துரைக்கப்பட்ட வழிகளை காட்டு",

    // Section 5: Notifications
    "settings.notifications": "அறிவிப்புகள்",
    "settings.notifCritical": "முக்கிய அவசர சம்பவங்கள்",
    "settings.notifCriticalDesc": "கடும் நெரிசல் மற்றும் வாகன தேக்க எச்சரிக்கைகள்",
    "settings.notifHigh": "உயர் முன்னுரிமை சம்பவங்கள்",
    "settings.notifHighDesc": "வாகன அதிகரிப்பு மற்றும் வரிசை வளர்ச்சி அறிவிப்புகள்",
    "settings.notifCamera": "கேமரா செயலிழப்பு எச்சரிக்கைகள்",
    "settings.notifCameraDesc": "கேமரா இணைப்பு தடைபடும்போது அறிவிப்பு",
    "settings.notifDiversion": "வழிமாற்று மற்றும் நடவடிக்கை புதுப்பிப்புகள்",
    "settings.notifDiversionDesc": "அதிகாரி முடிவுகள் மற்றும் மாற்று வழித்தட பதிவுகள்",

    // Section 6: Working Mode
    "settings.workingMode": "செயல்பாட்டு முறை",
    "settings.workingModeDesc": "பணி நிலைக்கு ஏற்ற கட்டுப்பாட்டு திரை வடிவம்",
    "settings.modeControl": "கட்டுப்பாட்டு அறை",
    "settings.modeField": "கள அதிகாரி",

    // Section 7: Officer Profile
    "settings.officerProfile": "அதிகாரி விவரம்",
    "settings.officerProfileDesc": "பணி அமர்வு அடையாளம் மற்றும் நிலைய அங்கீகாரம்",
    "settings.profileStatus": "செயலில் உள்ள பணி: தமிழ்நாடு போக்குவரத்து காவல்துறை (கட்டுப்பாட்டு திரை)",
    "settings.profileNote": "அதிகாரி அங்கீகாரம் மாநில காவல் துறை வாயில் வழியாக நிர்வகிக்கப்படுகிறது",

    // Section 8: Reset
    "settings.reset": "இயல்புநிலைக்கு மீட்டமை",
    "settings.resetConfirm": "அனைத்து அமைப்புகளையும் இயல்புநிலைக்கு மீட்டமைக்க விரும்புகிறீர்களா?",

    // Actions & Buttons
    // Additional Dashboard KPIs & Metrics
    "kpi.junctions": "Junctions",
    "kpi.camerasOnline": "Cameras Online",
    "kpi.attentionRequired": "Attention Required",
    "traffic.vehicles": "Vehicles",
    "traffic.cars": "Cars",
    "traffic.trucks": "Trucks",
    "traffic.buses": "Buses",
    "traffic.bikes": "Bikes",
    "traffic.averageSpeed": "Average Speed",
    "traffic.density": "Traffic Density",
    "traffic.occupancy": "Road Occupancy",
    "traffic.flow": "Traffic Flow",
    "traffic.monitoredJunctions": "MONITORED JUNCTIONS",
    "traffic.junction": "JUNCTION",
    "traffic.status": "STATUS",
    "traffic.searchPlaceholder": "Search junction, area, road, camera...",

    // Traffic Status States
    "status.normal": "NORMAL",
    "status.moderate": "MODERATE",
    "status.high": "HIGH",
    "status.critical": "CRITICAL",
    "status.live": "LIVE",
    "status.offline": "OFFLINE",
    "status.ready": "READY",
    "status.connecting": "CONNECTING",
    "status.unavailable": "UNAVAILABLE",

    // Action Buttons
    "actions.approve": "APPROVE",
    "actions.reject": "REJECT",
    "actions.resolve": "RESOLVE",
    "actions.reviewDiversion": "REVIEW DIVERSION",
    "actions.viewMap": "VIEW MAP",
    "actions.viewCCTV": "VIEW CCTV",
    "actions.viewLocation": "VIEW LOCATION",
    "actions.calculateRoute": "CALCULATE ROUTE",
    "actions.calculatingRoute": "CALCULATING ROUTE...",
    "actions.clear": "Clear",
    "actions.swap": "Swap",
    "actions.uploadVideo": "Upload Video",
    "actions.ipCamera": "IP Camera",
    "actions.uploadFile": "Upload File",

    // CCTV & Video
    "cctv.incidents": "INCIDENTS",
    "cctv.active": "Active",
    "cctv.none": "None",
    "cctv.trafficIncident": "TRAFFIC INCIDENT",
    "cctv.accidentDetected": "ACCIDENT DETECTED",
    "cctv.bikeAccidentDetected": "BIKE ACCIDENT DETECTED",
    "cctv.ambulanceDetected": "AMBULANCE DETECTED",
    "cctv.vehicleOccupancy": "{vehicles} vehicles detected · Road occupancy {occupancy}%.",
    "cctv.movementAffected": "Traffic movement affected.",
    "cctv.timeUnavailable": "Time unavailable",

    // Forecast
    "forecast.title": "TRAFFIC FORECAST (TFT MODEL)",
    "forecast.confidence": "MODEL CONFIDENCE",
    "forecast.updated": "UPDATED",
    "forecast.status": "TRAFFIC STATUS",
    "forecast.now": "NOW",
    "forecast.min5": "+5 MIN",
    "forecast.min15": "+15 MIN",
    "forecast.min30": "+30 MIN",
    "forecast.currentTraffic": "CURRENT TRAFFIC",
    "forecast.trafficWarning": "TRAFFIC WARNING",
    "forecast.highCongestionExpected": "High congestion expected within {minutes} minutes.",
    "forecast.queueMayExtend": "Queue may extend toward {location}.",
    "forecast.freeFlow": "Free flow traffic conditions observed.",
    "forecast.capacityNominal": "All approaches operating within nominal capacity.",
    "forecast.trend": "CONGESTION TREND",
    "forecast.chart": "CHART",
    "forecast.table": "TABLE",

    // Routes
    "routes.title": "Route Planning & Dynamic Diversion",
    "routes.origin": "Origin",
    "routes.destination": "Destination",
    "routes.recommended": "Recommended Route",
    "routes.alternative": "Alternative Route",
    "routes.avoidCongestion": "Avoid Congested Junctions",
    "routes.distance": "Distance",
    "routes.duration": "Est. Duration",

    // Alerts & Notifications
    "alerts.title": "ATTENTION & INCIDENT MONITORING",
    "alerts.active": "ACTIVE",
    "alerts.filterAll": "ALL",
    "alerts.filterCritical": "CRITICAL",
    "alerts.filterModerate": "MODERATE",
    "alerts.filterNormal": "NORMAL",
    "alerts.attentionRequired": "ATTENTION REQUIRED",
    "alerts.congested": "Congested",
  },

  ta: {
    // Navigation
    "nav.trafficControl": "போக்குவரத்து கட்டுப்பாடு",
    "nav.dashboard": "கட்டுப்பாட்டு பலகை",
    "nav.map": "வரைபடம்",
    "nav.cctv": "சிசிடிவி",
    "nav.routing": "வழித்தடங்கள்",
    "nav.forecast": "முன்னறிவிப்பு",
    "nav.alerts": "எச்சரிக்கைகள்",
    "nav.settings": "அமைப்புகள்",

    // Header & Modes
    "header.controlRoom": "கட்டுப்பாட்டு அறை",
    "header.fieldOfficer": "கள அதிகாரி",
    "header.demoMode": "மாதிரி",
    "header.liveMode": "நேரலை",
    "header.searchPlaceholder": "சந்திப்பு, சாலை, கேமரா அல்லது மாவட்டம் தேடவும்...",

    // Settings Page
    "settings.title": "அமைப்புகள்",
    "settings.subtitle": "கணினி விருப்பத்தேர்வுகள் மற்றும் காட்சி அமைப்புகள்",
    "settings.general": "பொது",
    "settings.display": "காட்சி",
    "settings.traffic": "போக்குவரத்து",
    "settings.map": "வரைபடம்",
    "settings.alerts": "எச்சரிக்கைகள்",
    "settings.workingMode": "செயல்பாட்டு முறை",
    "settings.language": "மொழி",
    "settings.speedUnit": "வேக அலகு",
    "settings.autoRefresh": "தானியங்கி புதுப்பிப்பு",
    "settings.theme": "வண்ண முறை",
    "settings.density": "காட்சி அடர்த்தி",
    "settings.defaultLocation": "இயல்புநிலை இடம்",
    "settings.vehicleCategories": "வாகன வகைகள்",
    "settings.mapStyle": "வரைபட பாணி",
    "settings.junctionStatus": "சந்திப்பு நிலை",
    "settings.cctvCameras": "சிசிடிவி கேமராக்கள்",
    "settings.activeIncidents": "செயலில் உள்ள சம்பவங்கள்",
    "settings.recommendedRoutes": "பரிந்துரைக்கப்பட்ட வழிகள்",
    "settings.criticalIncidents": "முக்கிய அவசர சம்பவங்கள்",
    "settings.trafficCongestion": "போக்குவரத்து நெரிசல்",
    "settings.cameraOffline": "கேமரா இணைப்பு துண்டிப்பு",
    "settings.routeChanges": "வழித்தட மாற்றங்கள்",
    "settings.mode": "பணி முறை",
    "settings.reset": "இயல்புநிலைக்கு மீட்டமை",

    // KPIs & Metrics
    "kpi.junctions": "சந்திப்புகள்",
    "kpi.camerasOnline": "இணைக்கப்பட்ட கேமராக்கள்",
    "kpi.attentionRequired": "கவனம் தேவை",
    "traffic.vehicles": "வாகனங்கள்",
    "traffic.cars": "கார்கள்",
    "traffic.trucks": "லாரிகள்",
    "traffic.buses": "பேருந்துகள்",
    "traffic.bikes": "இருசக்கரங்கள்",
    "traffic.averageSpeed": "சராசரி வேகம்",
    "traffic.density": "போக்குவரத்து அடர்த்தி",
    "traffic.occupancy": "சாலை பயன்பாட்டு அளவு",
    "traffic.flow": "போக்குவரத்து ஓட்டம்",
    "traffic.monitoredJunctions": "கண்காணிக்கப்படும் சந்திப்புகள்",
    "traffic.junction": "சந்திப்பு",
    "traffic.status": "நிலை",
    "traffic.searchPlaceholder": "சந்திப்பு, பகுதி, சாலை, கேமரா தேடவும்...",

    // Traffic Status States
    "status.normal": "இயல்பு",
    "status.moderate": "மிதமானது",
    "status.high": "அதிகம்",
    "status.critical": "மிக ஆபத்தானது",
    "status.live": "நேரலை",
    "status.offline": "இணைப்பு இல்லை",
    "status.ready": "தயார் நிலை",
    "status.connecting": "இணைக்கப்படுகிறது",
    "status.unavailable": "கிடைக்கவில்லை",

    // Actions & Buttons
    "actions.approve": "ஏற்கவும்",
    "actions.reject": "நிராகரிக்கவும்",
    "actions.resolve": "தீர்க்கவும்",
    "actions.reviewDiversion": "மாற்றுப்பாதையை மதிப்பாய்வு செய்யவும்",
    "actions.viewMap": "வரைபடத்தைப் பார்க்கவும்",
    "actions.viewCCTV": "சிசிடிவியைப் பார்க்கவும்",
    "actions.viewLocation": "இருப்பிடத்தைப் பார்க்கவும்",
    "actions.calculateRoute": "வழித்தடத்தைக் கணக்கிடவும்",
    "actions.calculatingRoute": "பாதை கணக்கிடப்படுகிறது...",
    "actions.clear": "அழிக்கவும்",
    "actions.swap": "மாற்றவும்",
    "actions.uploadVideo": "காணொளியை பதிவேற்றுக",
    "actions.ipCamera": "ஐபி கேமரா",
    "actions.uploadFile": "கோப்பைப் பதிவேற்றுக",
    "actions.acknowledge": "ஏற்றுக்கொள்",
    "actions.confirm": "உறுதிப்படுத்து",
    "actions.cancel": "ரத்துசெய்",

    // CCTV & Video
    "cctv.incidents": "சம்பவங்கள்",
    "cctv.active": "செயலில்",
    "cctv.none": "இல்லை",
    "cctv.trafficIncident": "போக்குவரத்து சம்பவம்",
    "cctv.accidentDetected": "விபத்து கண்டறியப்பட்டது",
    "cctv.bikeAccidentDetected": "இருசக்கர வாகன விபத்து கண்டறியப்பட்டது",
    "cctv.ambulanceDetected": "ஆம்புலன்ஸ் கண்டறியப்பட்டது",
    "cctv.vehicleOccupancy": "{vehicles} வாகனங்கள் கண்டறியப்பட்டன · சாலை பயன்பாடு {occupancy}%.",
    "cctv.movementAffected": "போக்குவரத்து இயக்கம் பாதிக்கப்பட்டுள்ளது.",
    "cctv.timeUnavailable": "நேரம் கிடைக்கவில்லை",

    // Forecast
    "forecast.title": "போக்குவரத்து முன்னறிவிப்பு (TFT மாதிரி)",
    "forecast.confidence": "மாதிரி நம்பிக்கை நிலை",
    "forecast.updated": "புதுப்பிக்கப்பட்டது",
    "forecast.status": "போக்குவரத்து நிலை",
    "forecast.now": "தற்போது",
    "forecast.min5": "+5 நிமி",
    "forecast.min15": "+15 நிமி",
    "forecast.min30": "+30 நிமி",
    "forecast.currentTraffic": "தற்போதைய போக்குவரத்து",
    "forecast.trafficWarning": "போக்குவரத்து எச்சரிக்கை",
    "forecast.highCongestionExpected": "{minutes} நிமிடங்களுக்குள் அதிக போக்குவரத்து நெரிசல் ஏற்படக்கூடும்.",
    "forecast.queueMayExtend": "{location} நோக்கி வாகன வரிசை நீளக்கூடும்.",
    "forecast.freeFlow": "தடையற்ற சீரான போக்குவரத்து காணப்படுகிறது.",
    "forecast.capacityNominal": "அனைத்து வழிகளும் இயல்பான கொள்ளளவிற்குள் இயங்குகின்றன.",
    "forecast.trend": "நெரிசல் போக்கு",
    "forecast.chart": "விளக்கப்படம்",
    "forecast.table": "அட்டவணை",

    // Routes
    "routes.title": "வழித்தட திட்டமிடல் மற்றும் மாற்றுப்பாதை",
    "routes.origin": "தொடக்க இடம்",
    "routes.destination": "சேருமிடம்",
    "routes.recommended": "பரிந்துரைக்கப்பட்ட வழி",
    "routes.alternative": "மாற்று வழி",
    "routes.avoidCongestion": "நெரிசலான சந்திப்புகளைத் தவிர்க்கவும்",
    "routes.distance": "தூரம்",
    "routes.duration": "மதிப்பிடப்பட்ட நேரம்",

    // Alerts & Notifications
    "alerts.title": "கவனம் மற்றும் சம்பவ கண்காணிப்பு",
    "alerts.active": "செயலில்",
    "alerts.filterAll": "அனைத்தும்",
    "alerts.filterCritical": "மிக ஆபத்தானது",
    "alerts.filterModerate": "மிதமானது",
    "alerts.filterNormal": "இயல்பு",
    "alerts.attentionRequired": "கவனம் தேவை",
    "alerts.congested": "நெரிசலானது",

    // Common Messages
    "common.active": "செயலில்",
    "common.online": "இணைப்பில்",
    "common.offline": "செயலிழப்பு",
    "common.operational": "செயல்பாட்டில்",
    "common.dataUnavailable": "தகவல் கிடைக்கவில்லை",
    "common.cameraUnavailable": "கேமரா கிடைக்கவில்லை",
    "common.currentLocation": "தற்போதைய இடம்",
    "common.locationUnavailable": "தற்போதைய இடம் கிடைக்கவில்லை",
    "common.detectingLocation": "இடம் கண்டறியப்படுகிறது...",
  },
};

/**
 * Proper Geographic Names Map (Tamil Nadu Traffic Police Network)
 * Keeps IDs & technical tags intact while localizing display names
 */
export const JUNCTION_NAMES = {
  "Gandhipuram Signal": "காந்திபுரம் சிக்னல்",
  "Gandhipuram Signal Approach": "காந்திபுரம் சிக்னல் அணுகுமுறை",
  "Gandhipuram": "காந்திபுரம்",
  "Ukkadam Junction": "உக்கடம் சந்திப்பு",
  "Ukkadam": "உக்கடம்",
  "Lakshmi Mills Junction": "லட்சுமி மில்ஸ் சந்திப்பு",
  "Lakshmi Mills": "லட்சுமி மில்ஸ்",
  "Hope College Junction": "ஹோப் காலேஜ் சந்திப்பு",
  "Hope College": "ஹோப் காலேஜ்",
  "Sankagiri Junction": "சங்ககிரி சந்திப்பு",
  "Sankagiri": "சங்ககிரி",
  "Vannarpettai Junction": "வண்ணார்பேட்டை சந்திப்பு",
  "Vannarpettai": "வண்ணார்பேட்டை",
  "Avinashi Road Junction": "அவிநாசி சாலை சந்திப்பு",
  "Avinashi Road": "அவிநாசி சாலை",
  "Tiruppur Old Bus Stand Junction": "திருப்பூர் பழைய பேருந்து நிலைய சந்திப்பு",
  "Pushpa Theatre Junction": "புஷ்பா தியேட்டர் சந்திப்பு",
  "Commercial Core Junction": "வணிக மைய சந்திப்பு",
  "North Gateway": "வடக்கு நுழைவு வாயில்",
  "Salem Road": "சேலம் சாலை",
  "Coimbatore": "கோயம்புத்தூர்",
  "Coimbatore, Tamil Nadu": "கோயம்புத்தூர், தமிழ்நாடு",
  "Tamil Nadu": "தமிழ்நாடு",
  "Tiruppur": "திருப்பூர்",
  "Salem": "சேலம்",
  "Tirunelveli": "திருநெல்வேலி",
  "Erode": "ஈரோடு",
  "Trichy": "திருச்சி",
  "Madurai": "மதுரை",
  "Chennai": "சென்னை",
};

export function getLocalizedJunctionName(name, lang = "en") {
  if (!name) return "";
  if (lang === "ta") {
    return JUNCTION_NAMES[name] || name;
  }
  return name;
}

/**
 * Translation helper function with dynamic parameter interpolation
 */
export function translate(lang, key, paramsOrFallback = {}, fallback = "") {
  let params = {};
  let defaultText = fallback;

  if (typeof paramsOrFallback === "string") {
    defaultText = paramsOrFallback;
  } else if (typeof paramsOrFallback === "object" && paramsOrFallback !== null) {
    params = paramsOrFallback;
  }

  const dictionary = TRANSLATIONS[lang] || TRANSLATIONS.en;
  let text =
    dictionary && dictionary[key] !== undefined
      ? dictionary[key]
      : TRANSLATIONS.en && TRANSLATIONS.en[key] !== undefined
      ? TRANSLATIONS.en[key]
      : defaultText || key;

  if (typeof text === "string" && Object.keys(params).length > 0) {
    Object.keys(params).forEach((p) => {
      text = text.replace(new RegExp(`\\{${p}\\}`, "g"), params[p]);
    });
  }

  return text;
}
