/**
 * Centralized Translation System (i18n)
 * Full Tamil / English localization across Tamil Nadu Traffic Control Dashboard.
 * Maintains standard technical terminology and precise geographic translations.
 */

export const TRANSLATIONS = {
  en: {
    // Navigation & Brand
    "nav.trafficControl": "TRAFFIC CONTROL",
    "nav.dashboard": "Dashboard",
    "nav.map": "Live Traffic Map",
    "nav.cctv": "Camera Monitoring",
    "nav.routing": "Route Planning",
    "nav.forecast": "Traffic Forecast",
    "nav.alerts": "Traffic Incidents",
    "nav.settings": "Settings",
    "nav.system": "System Status",
    "nav.mobile": "Mobile Camera",
    "nav.field": "Field Officer Mode",
    "nav.operations": "Operations",
    "nav.stateOperations": "State Operations",
    "sidebar.expand": "Expand sidebar",
    "sidebar.collapse": "Collapse sidebar",

    // Header & Global Controls
    "header.controlRoom": "Control Room",
    "header.fieldOfficer": "Field Officer",
    "header.demoMode": "DEMO",
    "header.liveMode": "LIVE",
    "header.searchPlaceholder": "Search junction, road, camera, or district...",
    "header.filterCategory": "Filter Category",
    "header.allCategories": "All Categories",
    "header.locations": "Locations",
    "header.junctions": "Junctions",
    "header.roads": "Roads",
    "header.cameras": "Cameras",
    "header.groupLocations": "LOCATIONS & DISTRICTS",
    "header.groupJunctions": "JUNCTIONS",
    "header.groupRoads": "ROADS & HIGHWAYS",
    "header.groupCameras": "CAMERAS",
    "header.noResults": "No matching results in {category}",
    "header.clearSearch": "Clear search",
    "header.switchTheme": "Switch theme",
    "header.lightMode": "Light Mode",
    "header.darkMode": "Dark Mode",
    "header.selectLanguage": "Select Language / மொழியைத் தேர்ந்தெடுக்கவும்",

    // Common Status & Messages
    "common.active": "ACTIVE",
    "common.online": "ONLINE",
    "common.offline": "OFFLINE",
    "common.standby": "STANDBY",
    "common.operational": "Operational",
    "common.dataUnavailable": "Data unavailable",
    "common.cameraUnavailable": "Camera unavailable",
    "common.currentLocation": "Current Location",
    "common.locationUnavailable": "Current location unavailable",
    "common.detectingLocation": "Detecting location...",
    "common.calculateRoute": "CALCULATE ROUTE",
    "common.calculatingRoute": "CALCULATING ROUTE...",
    "common.clear": "Clear",
    "common.recent": "Recent",
    "common.yes": "YES",
    "common.no": "NO",
    "common.updated": "UPDATED",
    "common.justNow": "Just now",
    "common.activeNow": "Active",
    "common.retry": "Retry",
    "common.connecting": "CONNECTING...",
    "common.loadingFeed": "Loading live feed...",
    "common.connectingToFeed": "CONNECTING TO LIVE FEED...",
    "common.connect": "Connect",
    "common.stop": "STOP",
    "common.close": "Close",
    "common.timeUnavailable": "Time unavailable",
    "common.ago": "ago",
    "common.minutes": "minutes",
    "common.min": "min",
    "common.on": "ON",
    "common.off": "OFF",
    "common.confirm": "Confirm",
    "common.cancel": "Cancel",

    // Dashboard Context Switcher Tabs
    "tabs.attention": "ATTENTION",
    "tabs.junction": "JUNCTION",
    "tabs.cctv": "CCTV",
    "tabs.live": "LIVE",
    "tabs.selectJunctionPrompt": "Select a junction from the map or table to view intelligence and control options.",
    "tabs.attentionTooltip": "View urgent traffic incidents and queued recommendations",
    "tabs.junctionTooltip": "View intelligence for {name}",
    "tabs.selectJunctionTooltip": "Select a junction to view details",
    "tabs.cctvTooltip": "Live CCTV camera stream and AI vehicle tracking",
    "toast.queueJunctionRoad": "Traffic queue extending toward Junction Road.",
    "toast.queueCorridor": "Traffic queue extending toward primary corridor approach.",
    "toast.queueApproach": "traffic queue detected on approach.",
    "toast.dismiss": "Dismiss notification",

    // Dashboard KPI & Measurement Cards
    "kpi.junctions": "Junctions",
    "kpi.camerasOnline": "Cameras Online",
    "kpi.attentionRequired": "Attention Required",
    "kpi.trafficRisk": "TRAFFIC RISK",
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
    "traffic.junction": "Junction",
    "traffic.status": "Status",
    "traffic.selectJunction": "Select Junction...",
    "traffic.searchPlaceholder": "Search junction, area, road, camera...",
    "traffic.noJunctionsMatch": "No junctions match the current filter.",
    "traffic.flowNormalized": "Traffic flow normalized",

    // Operational Status Levels
    "status.normal": "NORMAL",
    "status.moderate": "MODERATE",
    "status.high": "HIGH",
    "status.critical": "CRITICAL",
    "status.live": "LIVE",
    "status.offline": "OFFLINE",
    "status.ready": "READY",
    "status.connecting": "CONNECTING",
    "status.unavailable": "UNAVAILABLE",
    "status.clear": "CLEAR",
    "status.congested": "CONGESTED",
    "status.warning": "WARNING",
    "status.heavyCongestion": "HEAVY CONGESTION",
    "status.new": "NEW",
    "status.resolved": "RESOLVED",

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
    "actions.uploadMp4": "Upload MP4",
    "actions.uploading": "Uploading...",
    "actions.acknowledge": "ACKNOWLEDGE",
    "actions.manualControl": "MANUAL CONTROL",
    "actions.startAnalysis": "START ANALYSIS",
    "actions.startingAnalysis": "STARTING ANALYSIS...",
    "actions.inspectDetails": "Inspect Details",
    "actions.controlActive": "Control Active",
    "actions.clickToViewMap": "Click to view on map",
    "actions.clickToViewJunction": "Click to view junction",

    // Alerts & Attention Panel
    "alerts.title": "TRAFFIC INCIDENTS",
    "alerts.subtitle": "Active incidents, traffic alerts and officer actions",
    "alerts.active": "ACTIVE",
    "alerts.filterAll": "ALL",
    "alerts.filterCritical": "CRITICAL",
    "alerts.filterHigh": "HIGH",
    "alerts.filterModerate": "MODERATE",
    "alerts.filterWarning": "WARNING",
    "alerts.filterNormal": "NORMAL",
    "alerts.attentionRequired": "ATTENTION REQUIRED",
    "alerts.heavyInflow": "HEAVY INFLOW",
    "alerts.severeCongestion": "SEVERE CONGESTION",
    "alerts.criticalAlert": "CRITICAL ALERT",
    "alerts.noAttentionItems": "NO ATTENTION REQUIRED ITEMS",
    "alerts.allCorridorsNominal": "All Tamil Nadu highway corridors and junction approaches operating nominally.",
    "alerts.noIncidentsFound": "No incidents found for the selected filter.",
    "alerts.actionUpdate": "ACTION UPDATE",
    "alerts.standstill": "Standstill",
    "alerts.verySlow": "Very Slow",
    "alerts.diversionActiveDesc": "Diversion active · Alternate route deployed",
    "alerts.diversionRejectedDesc": "Diversion rejected · Standard signal timing retained",
    "alerts.trafficNormalizedDesc": "Traffic normalized · Corridors nominal",
    "alerts.dispatchFieldUnit": "Dispatch field unit",
    "alerts.monitorTrafficConditions": "Monitor traffic conditions",
    "alerts.monitorTrafficFlow": "Monitor traffic flow",
    "alerts.reviewDiversionRoute": "Review diversion route",
    "alerts.actionAccepted": "ACTION ACCEPTED",
    "alerts.actionRejected": "ACTION REJECTED",
    "alerts.manualControlActive": "MANUAL CONTROL ACTIVE",
    "alerts.resolved": "RESOLVED",
    "alerts.new": "NEW",
    "alerts.acknowledged": "ACKNOWLEDGED",
    "alerts.acknowledgedTitle": "Acknowledged",
    "alerts.manualControlRecorded": "Manual control recorded",
    "alerts.diversionNotActivated": "Diversion not activated",
    "alerts.trafficFlowNormalized": "Traffic flow normalized",
    "alerts.trafficQueueIncreasing": "Traffic queue increasing",
    "alerts.dataUnavailable": "Data unavailable",
    "alerts.adjustSignal": "Adjust signal",
    "alerts.dispatchFieldUnitAdjustSignal": "Dispatch field unit · Adjust signal",
    "alerts.vehiclesCountAndSpeed": "{vehicles} vehicles · Average speed {speed} km/h",
    "alerts.vehiclesCountAndOccupancy": "{vehicles} vehicles · Road occupancy {occupancy}%",
    "alerts.occupancyAndQueue": "Road occupancy {occupancy}% · Queue extending {queue}",
    "alerts.responseGuidance": "RESPONSE GUIDANCE",
    "alerts.guidanceCritical": "Immediate officer attention required. Review the recommended action and route conditions.",
    "alerts.guidanceHigh": "Monitor the location and review the recommended action.",
    "alerts.guidanceWarning": "Continue monitoring traffic conditions.",
    "alerts.guidanceDisclaimer": "Decision support guidance only. Officer remains responsible for the final operational decision.",

    // Standardized Incident Banner Labels
    "incident.trafficNormalized": "TRAFFIC NORMALIZED",
    "incident.diversionActive": "DIVERSION ACTIVE",
    "incident.diversionRejected": "DIVERSION REJECTED",
    "incident.cameraOffline": "CAMERA OFFLINE",
    "incident.trafficCheckRequired": "TRAFFIC CHECK REQUIRED",
    "incident.criticalCongestion": "CRITICAL CONGESTION",
    "incident.highCongestion": "HIGH CONGESTION",

    // CCTV & Video Monitoring
    "cctv.title": "Camera Monitoring",
    "cctv.incidents": "INCIDENTS",
    "cctv.active": "Active",
    "cctv.none": "None",
    "cctv.trafficIncident": "TRAFFIC INCIDENT",
    "cctv.isIncidentOccurred": "Is Incident Occurred",
    "cctv.isAmbulanceDetected": "Is Ambulance Detected",
    "cctv.isAccidentOccurred": "Is Accident Occurred",
    "cctv.accidentDetected": "ACCIDENT DETECTED",
    "cctv.bikeAccidentDetected": "BIKE ACCIDENT DETECTED",
    "cctv.vehicleCollisionDetected": "VEHICLE COLLISION DETECTED",
    "cctv.roadBlocked": "ROAD BLOCKED",
    "cctv.ambulanceDetected": "AMBULANCE DETECTED",
    "cctv.cameraDetails": "Camera details",
    "cctv.showDetails": "Show",
    "cctv.hideDetails": "Hide",
    "cctv.location": "Location",
    "cctv.status": "Status",
    "cctv.source": "Source",
    "cctv.updated": "Updated",
    "cctv.approach": "Approach",
    "cctv.approachCorridor": "Approach Corridor",
    "cctv.noCameras": "No cameras",
    "cctv.camerasCount": "{count} camera{plural} · {live} live",
    "cctv.searchCamera": "Search junction or camera",
    "cctv.connectingLiveFeed": "Connecting to live feed...",
    "cctv.initDetectionPipeline": "Initializing detection pipeline",
    "cctv.cameraUnavailable": "CAMERA UNAVAILABLE",
    "cctv.failedConnectFeed": "Failed to connect to video feed",
    "cctv.loadingLiveFeed": "Loading live feed...",
    "cctv.ipCameraStandby": "IP CAMERA STANDBY",
    "cctv.enterRtspPrompt": "Enter RTSP stream URL and click Connect to start feed",
    "cctv.connectingRtsp": "Connecting to RTSP stream...",

    // Route Planning & Comparison
    "routes.title": "Route Planning & Dynamic Diversion",
    "routes.from": "FROM",
    "routes.to": "TO",
    "routes.origin": "Origin",
    "routes.destination": "Destination",
    "routes.searchDestinationPlaceholder": "Search or select destination",
    "routes.searchOriginPlaceholder": "Search or select origin",
    "routes.swap": "Swap",
    "routes.recommended": "RECOMMENDED",
    "routes.alternative": "ALTERNATIVE",
    "routes.active": "ACTIVE",
    "routes.distance": "Distance",
    "routes.travelTime": "Travel Time",
    "routes.traffic": "Traffic",
    "routes.trafficIssues": "Traffic issues:",
    "routes.incidentsCount": "{count} incident{plural}",
    "routes.onRoute": "ON ROUTE",
    "routes.show": "Show",
    "routes.hide": "Hide",
    "routes.routeSummary": "ROUTE: {origin} → {destination}",
    "routes.recommendedSummary": "RECOMMENDED: {dist} km · {time} min",
    "routes.alternativeSummary": "ALTERNATIVE: {dist} km · {time} min",
    "routes.diversionPrefix": "DIVERSION: {name}",
    "routes.routeTitle": "ROUTE",
    "routes.useCurrentLocation": "Use Current Location",
    "routes.routeUnavailable": "Route not available · Check the starting point and destination.",
    "routes.moreAlongRoute": "more along route",
    "routes.altReasonAvoidCongestion": "Available to avoid congestion near {location}.",
    "routes.locationsCount": "{count} LOCATION{plural}",
    "traffic.freeFlow": "Free Flow",
    "traffic.moderateTraffic": "Moderate Traffic",
    "traffic.heavyDelay": "Heavy Delay",
    "category.junction": "Junction",
    "category.highway / road": "Highway / Road",
    "category.landmark": "Landmark",
    "category.district": "District",
    "category.town / city": "Town / City",
    "category.location": "Location",
    "diversion.recommendedTitle": "DIVERSION RECOMMENDED",
    "diversion.useAlternateRoute": "Use {route} to reduce congestion at {location}.",

    // Traffic Forecast & Predictions
    "forecast.title": "TRAFFIC FORECAST",
    "forecast.confidence": "CONFIDENCE",
    "forecast.updated": "UPDATED",
    "forecast.status": "TRAFFIC STATUS",
    "forecast.expected": "Expected",
    "forecast.congestionIncreasing": "Congestion increasing",
    "forecast.flowStable": "Traffic flow stable",
    "forecast.moderateInflow": "Moderate inflow persisting",
    "forecast.now": "NOW",
    "forecast.min5": "+5 MIN",
    "forecast.min15": "+15 MIN",
    "forecast.min30": "+30 MIN",
    "forecast.currentTraffic": "CURRENT TRAFFIC",
    "forecast.trafficWarning": "TRAFFIC WARNING",
    "forecast.emergency": "EMERGENCY",
    "forecast.incident": "INCIDENT",
    "forecast.accident": "ACCIDENT",
    "forecast.incidentAccident": "INCIDENT: ACCIDENT",
    "forecast.criticalCongestion": "Critical congestion expected within 15 minutes.",
    "forecast.highCongestion": "High congestion expected within 15 minutes.",
    "forecast.moderateCongestion": "Moderate congestion expected within 15 minutes.",
    "forecast.warningStatus": "WARNING: {status}",
    "forecast.statusTitle": "STATUS: {status}",
    "forecast.highCongestionExpected": "High congestion expected: {percentage}% at {minutes} min.",
    "forecast.criticalCongestionExpected": "Critical congestion expected: {percentage}% at {minutes} min.",
    "forecast.congestionExpectedAt": "Congestion expected within {minutes} minutes ({percentage}%).",
    "forecast.queueMayExtend": "Queue may extend toward {location}.",
    "forecast.freeFlow": "Free flow traffic conditions observed.",
    "forecast.capacityNominal": "All approaches operating within nominal capacity.",
    "forecast.ambulanceApproaching": "Ambulance approaching {location}.",
    "forecast.accidentReported": "Accident reported near {location}.",
    "forecast.priorityClearance": "Priority corridor clearance active on approach.",
    "forecast.trafficFlowDisrupted": "Traffic flow disrupted. Emergency response dispatched.",
    "forecast.trend": "CONGESTION TREND",
    "forecast.chart": "CHART",
    "forecast.table": "TABLE",
    "forecast.horizon": "HORIZON",
    "forecast.clockTime": "CLOCK TIME",
    "forecast.congestionLevel": "CONGESTION LEVEL",
    "forecast.estVehicles": "EST. VEHICLES",
    "forecast.estSpeed": "EST. SPEED",
    "forecast.tableStatus": "STATUS",
    "forecast.tooltipCongestion": "Congestion:",
    "forecast.tooltipEstLoad": "Est. Load:",
    "forecast.tooltipEstSpeed": "Est. Speed:",

    // Map Overlays, Layers & Legends
    "map.layers": "Map Layers",
    "map.layerJunctions": "Junctions",
    "map.layerCameras": "Cameras",
    "map.layerIncidents": "Incidents",
    "map.layerRoutes": "Routes",
    "map.junctionStatus": "Junction Status",
    "map.routesLegend": "Routes",
    "map.recommended": "Recommended",
    "map.alternative": "Alternative",
    "map.congested": "Congested",
    "map.fromPrefix": "FROM: {name}",
    "map.toPrefix": "TO: {name}",
    "map.originFrom": "Origin (From)",
    "map.destinationTo": "Destination (To)",
    "map.trafficOverview": "TRAFFIC OVERVIEW",

    // Settings Page
    "settings.title": "Settings",
    "settings.subtitle": "System preferences and traffic-control display settings",
    "settings.general": "General",
    "settings.display": "Display",
    "settings.traffic": "Traffic",
    "settings.map": "Map",
    "settings.alerts": "Alerts",
    "settings.workingMode": "Working mode",
    "settings.officerProfile": "Officer profile",
    "settings.reset": "Reset to defaults",

    "settings.language": "Language",
    "settings.speedUnit": "Speed unit",
    "settings.autoRefresh": "Auto refresh",
    "settings.theme": "Theme",
    "settings.density": "Density",
    "settings.defaultLocation": "Default location",
    "settings.vehicleCategories": "Vehicle categories",
    "settings.mapStyle": "Map style",
    "settings.mapLayers": "Map layers",
    "settings.junctionStatus": "Junction status",
    "settings.cctvCameras": "CCTV cameras",
    "settings.activeIncidents": "Active incidents",
    "settings.recommendedRoutes": "Recommended routes",
    "settings.notifications": "Notifications",
    "settings.criticalIncidents": "Critical incidents",
    "settings.highPriorityIncidents": "High-priority incidents",
    "settings.trafficCongestion": "Traffic congestion",
    "settings.cameraOffline": "Camera offline",
    "settings.cameraOfflineAlerts": "Camera offline alerts",
    "settings.diversionUpdates": "Diversion updates",
    "settings.routeChanges": "Route changes",
    "settings.mode": "Console mode",
    "settings.modeControl": "Control Room",
    "settings.modeField": "Field Officer",
    "settings.resetConfirm": "Reset all system preferences and display settings to defaults?",

    "settings.themeLight": "Light",
    "settings.themeDark": "Dark",
    "settings.themeSystem": "System",
    "settings.densityCompact": "Compact",
    "settings.densityComfortable": "Comfortable",
    "settings.viewCurrent": "Current location",
    "settings.viewSelected": "Selected location",
    "settings.viewTamilNadu": "Tamil Nadu",
    "settings.styleStandard": "Standard",
    "settings.styleSatellite": "Satellite",
    "settings.refreshOff": "Off",
    "settings.refresh15s": "15s",
    "settings.refresh30s": "30s",
    "settings.refresh60s": "60s",
    "settings.speedKmh": "km/h",
    "settings.speedMph": "mph",
  },

  ta: {
    // Navigation & Brand
    "nav.trafficControl": "போக்குவரத்து கட்டுப்பாடு",
    "nav.dashboard": "கட்டுப்பாட்டு பலகை",
    "nav.map": "நேரலை வரைபடம்",
    "nav.cctv": "கேமரா கண்காணிப்பு",
    "nav.routing": "வழித்தட திட்டமிடல்",
    "nav.forecast": "போக்குவரத்து கணிப்பு",
    "nav.alerts": "போக்குவரத்து சம்பவங்கள்",
    "nav.settings": "அமைப்புகள்",
    "nav.system": "கணினி நிலை",
    "nav.mobile": "கைபேசி கேமரா",
    "nav.field": "கள அதிகாரி முறை",
    "nav.operations": "செயல்பாடுகள்",
    "nav.stateOperations": "மாநில செயல்பாடுகள்",
    "sidebar.expand": "பக்கப்பட்டியை விரிவாக்கு",
    "sidebar.collapse": "பக்கப்பட்டியை சுருக்கு",

    // Header & Global Controls
    "header.controlRoom": "கட்டுப்பாட்டு அறை",
    "header.fieldOfficer": "கள அதிகாரி",
    "header.demoMode": "மாதிரி",
    "header.liveMode": "நேரலை",
    "header.searchPlaceholder": "சந்திப்பு, சாலை, கேமரா அல்லது மாவட்டம் தேடவும்...",
    "header.filterCategory": "வகை வடிகட்டி",
    "header.allCategories": "அனைத்து பிரிவுகளும்",
    "header.locations": "இடங்கள்",
    "header.junctions": "சந்திப்புகள்",
    "header.roads": "சாலைகள்",
    "header.cameras": "கேமராக்கள்",
    "header.groupLocations": "இடங்கள் & மாவட்டங்கள்",
    "header.groupJunctions": "சந்திப்புகள்",
    "header.groupRoads": "சாலைகள் & நெடுஞ்சாலைகள்",
    "header.groupCameras": "கேமராக்கள்",
    "header.noResults": "{category} பிரிவில் முடிவுகள் ஏதுமில்லை",
    "header.clearSearch": "தேடலை அழிக்கவும்",
    "header.switchTheme": "வண்ண முறை மாற்றவும்",
    "header.lightMode": "வெளிச்ச முறை",
    "header.darkMode": "இருள் முறை",
    "header.selectLanguage": "Select Language / மொழியைத் தேர்ந்தெடுக்கவும்",

    // Common Status & Messages
    "common.active": "செயலில்",
    "common.online": "இணைப்பில்",
    "common.offline": "இணைப்பு இல்லை",
    "common.standby": "தயார் நிலை",
    "common.operational": "செயல்பாட்டில்",
    "common.dataUnavailable": "தகவல் கிடைக்கவில்லை",
    "common.cameraUnavailable": "கேமரா கிடைக்கவில்லை",
    "common.currentLocation": "தற்போதைய இடம்",
    "common.locationUnavailable": "தற்போதைய இடம் கிடைக்கவில்லை",
    "common.detectingLocation": "இடம் கண்டறியப்படுகிறது...",
    "common.calculateRoute": "வழித்தடத்தைக் கணக்கிடவும்",
    "common.calculatingRoute": "பாதை கணக்கிடப்படுகிறது...",
    "common.clear": "அழிக்கவும்",
    "common.recent": "சமீபத்தியவை",
    "common.yes": "ஆம்",
    "common.no": "இல்லை",
    "common.updated": "புதுப்பிக்கப்பட்டது",
    "common.justNow": "சற்றுமுன்",
    "common.activeNow": "செயலில்",
    "common.retry": "மீண்டும் முயற்சி",
    "common.connecting": "இணைக்கப்படுகிறது...",
    "common.loadingFeed": "நேரலை ஒளிபரப்பு ஏற்றப்படுகிறது...",
    "common.connectingToFeed": "நேரலை இணைப்பு பெறப்படுகிறது...",
    "common.connect": "இணைக்கவும்",
    "common.stop": "நிறுத்தவும்",
    "common.close": "மூடவும்",
    "common.timeUnavailable": "நேரம் கிடைக்கவில்லை",
    "common.ago": "முன்பு",
    "common.minutes": "நிமிடங்கள்",
    "common.min": "நிமி",
    "common.on": "இயக்கம்",
    "common.off": "நிறுத்தம்",
    "common.confirm": "உறுதி செய்",
    "common.cancel": "ரத்து செய்",

    // Dashboard Context Switcher Tabs
    "tabs.attention": "கவனம்",
    "tabs.junction": "சந்திப்பு",
    "tabs.cctv": "சிசிடிவி",
    "tabs.live": "நேரலை",
    "tabs.selectJunctionPrompt": "நுண்ணறிவு மற்றும் கட்டுப்பாட்டு விவரங்களைப் பார்க்க வரைபடம் அல்லது அட்டவணையில் இருந்து ஒரு சந்திப்பைத் தேர்ந்தெடுக்கவும்.",
    "tabs.attentionTooltip": "அவசர சம்பவங்கள் மற்றும் பரிந்துரைகளைக் காண்க",
    "tabs.junctionTooltip": "{name} பற்றிய தகவல்களைக் காண்க",
    "tabs.selectJunctionTooltip": "விவரங்களைக் காண ஒரு சந்திப்பைத் தேர்ந்தெடுக்கவும்",
    "tabs.cctvTooltip": "நேரலை கண்காணிப்பு கேமரா மற்றும் AI வாகன கண்காணிப்பு",
    "toast.queueJunctionRoad": "சந்திப்பு சாலையை நோக்கி வாகன வரிசை நீள்கிறது.",
    "toast.queueCorridor": "முக்கிய வழித்தடத்தை நோக்கி வாகன வரிசை நீள்கிறது.",
    "toast.queueApproach": "சாலையில் வாகன வரிசை கண்டறியப்பட்டது.",
    "toast.dismiss": "அறிவிப்பை மூடு",

    // Dashboard KPI & Measurement Cards
    "kpi.junctions": "சந்திப்புகள்",
    "kpi.camerasOnline": "இணைக்கப்பட்ட கேமராக்கள்",
    "kpi.attentionRequired": "கவனம் தேவை",
    "kpi.trafficRisk": "போக்குவரத்து அபாய அளவு",
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
    "traffic.selectJunction": "சந்திப்பைத் தேர்ந்தெடுக்கவும்...",
    "traffic.searchPlaceholder": "சந்திப்பு, பகுதி, சாலை, கேமரா தேடவும்...",
    "traffic.noJunctionsMatch": "தேர்வுக்குரிய சந்திப்புகள் எதுவும் இல்லை.",
    "traffic.flowNormalized": "போக்குவரத்து சீரானது",

    // Operational Status Levels
    "status.normal": "இயல்பு",
    "status.moderate": "மிதமானது",
    "status.high": "அதிகம்",
    "status.critical": "மிக ஆபத்தானது",
    "status.live": "நேரலை",
    "status.offline": "இணைப்பு இல்லை",
    "status.ready": "தயார் நிலை",
    "status.connecting": "இணைக்கப்படுகிறது",
    "status.unavailable": "கிடைக்கவில்லை",
    "status.clear": "சீரானது",
    "status.congested": "நெரிசலானது",
    "status.warning": "எச்சரிக்கை",
    "status.heavyCongestion": "கடும் நெரிசல்",
    "status.new": "புதியது",
    "status.resolved": "தீர்க்கப்பட்டது",

    // Action Buttons
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
    "actions.uploadMp4": "MP4 பதிவேற்றுக",
    "actions.uploading": "பதிவேற்றப்படுகிறது...",
    "actions.acknowledge": "ஏற்றுக்கொள்",
    "actions.manualControl": "கையால் கட்டுப்படுத்து",
    "actions.startAnalysis": "பகுப்பாய்வைத் தொடங்கவும்",
    "actions.startingAnalysis": "பகுப்பாய்வு தொடங்குகிறது...",
    "actions.inspectDetails": "விவரங்களை ஆய்வு செய்",
    "actions.controlActive": "கட்டுப்பாடு செயலில்",
    "actions.clickToViewMap": "வரைபடத்தில் பார்க்க கிளிக் செய்யவும்",
    "actions.clickToViewJunction": "சந்திப்பைப் பார்க்க கிளிக் செய்யவும்",

    // Alerts & Attention Panel
    "alerts.title": "போக்குவரத்து சம்பவங்கள்",
    "alerts.subtitle": "செயலில் உள்ள சம்பவங்கள், எச்சரிக்கைகள் மற்றும் அதிகாரி நடவடிக்கைகள்",
    "alerts.active": "செயலில்",
    "alerts.filterAll": "அனைத்தும்",
    "alerts.filterCritical": "மிக ஆபத்தானது",
    "alerts.filterHigh": "அதிகம்",
    "alerts.filterModerate": "மிதமானது",
    "alerts.filterWarning": "எச்சரிக்கை",
    "alerts.filterNormal": "இயல்பு",
    "alerts.attentionRequired": "கவனம் தேவை",
    "alerts.heavyInflow": "அதிக வாகன வரத்து",
    "alerts.severeCongestion": "கடும் நெரிசல்",
    "alerts.criticalAlert": "முக்கிய அவசர எச்சரிக்கை",
    "alerts.noAttentionItems": "கவனம் தேவைப்படும் நிகழ்வுகள் ஏதுமில்லை",
    "alerts.allCorridorsNominal": "அனைத்து தமிழ்நாடு நெடுஞ்சாலைகளும் சந்திப்புகளும் சீராக இயங்குகின்றன.",
    "alerts.noIncidentsFound": "தேர்ந்தெடுக்கப்பட்ட வடிகட்டியில் சம்பவங்கள் எதுவும் இல்லை.",
    "alerts.actionUpdate": "நடவடிக்கை புதுப்பிப்பு",
    "alerts.standstill": "வாகன தேக்கம்",
    "alerts.verySlow": "மிக மெதுவாக",
    "alerts.diversionActiveDesc": "மாற்றுப்பாதை செயலில் உள்ளது · மாற்று வழித்தடம் பயன்பாட்டில் உள்ளது",
    "alerts.diversionRejectedDesc": "மாற்றுப்பாதை நிராகரிக்கப்பட்டது · வழக்கமான சிக்னல் நேரம் தொடர்கிறது",
    "alerts.trafficNormalizedDesc": "போக்குவரத்து சீரானது · வழிகள் இயல்பு நிலைக்குத் திரும்பின",
    "alerts.dispatchFieldUnit": "களப் பிரிவை அனுப்பவும்",
    "alerts.monitorTrafficConditions": "போக்குவரத்து நிலையை கண்காணிக்கவும்",
    "alerts.monitorTrafficFlow": "போக்குவரத்து ஓட்டத்தை கண்காணிக்கவும்",
    "alerts.reviewDiversionRoute": "மாற்றுப்பாதையை மதிப்பாய்வு செய்யவும்",
    "alerts.actionAccepted": "நடவடிக்கை ஏற்கப்பட்டது",
    "alerts.actionRejected": "நடவடிக்கை நிராகரிக்கப்பட்டது",
    "alerts.manualControlActive": "கையால் கட்டுப்படுத்தும் முறை செயலில்",
    "alerts.resolved": "தீர்க்கப்பட்டது",
    "alerts.new": "புதியது",
    "alerts.acknowledged": "ஏற்றுக்கொள்ளப்பட்டது",
    "alerts.acknowledgedTitle": "ஏற்றுக்கொள்ளப்பட்டது",
    "alerts.manualControlRecorded": "கையால் கட்டுப்படுத்துதல் பதிவு செய்யப்பட்டது",
    "alerts.diversionNotActivated": "மாற்றுப்பாதை செயல்படுத்தப்படவில்லை",
    "alerts.trafficFlowNormalized": "போக்குவரத்து ஓட்டம் சீரானது",
    "alerts.trafficQueueIncreasing": "வாகன வரிசை அதிகரிக்கிறது",
    "alerts.dataUnavailable": "தரவு கிடைக்கவில்லை",
    "alerts.adjustSignal": "சிக்னலை சரிசெய்க",
    "alerts.dispatchFieldUnitAdjustSignal": "களப் பிரிவை அனுப்பவும் · சிக்னலை சரிசெய்க",
    "alerts.vehiclesCountAndSpeed": "{vehicles} வாகனங்கள் · சராசரி வேகம் {speed} கிமீ/மணி",
    "alerts.vehiclesCountAndOccupancy": "{vehicles} வாகனங்கள் · சாலை பயன்பாட்டு அளவு {occupancy}%",
    "alerts.occupancyAndQueue": "சாலை பயன்பாட்டு அளவு {occupancy}% · வாகன வரிசை நீட்சி {queue}",
    "alerts.responseGuidance": "பதிலளிப்பு வழிகாட்டுதல்",
    "alerts.guidanceCritical": "உடனடி அதிகாரி கவனம் தேவை. பரிந்துரைக்கப்பட்ட நடவடிக்கை மற்றும் பாதை நிலைமைகளை மதிப்பாய்வு செய்யவும்.",
    "alerts.guidanceHigh": "இருப்பிடத்தைக் கண்காணித்து, பரிந்துரைக்கப்பட்ட நடவடிக்கையை மதிப்பாய்வு செய்யவும்.",
    "alerts.guidanceWarning": "போக்குவரத்து நிலைமைகளைத் தொடர்ந்து கண்காணிக்கவும்.",
    "alerts.guidanceDisclaimer": "முடிவெடுக்கும் ஆதரவு வழிகாட்டுதல் மட்டுமே. இறுதி செயல்பாட்டு முடிவிற்கு அதிகாரியே பொறுப்பாவார்.",

    // Standardized Incident Banner Labels
    "incident.trafficNormalized": "போக்குவரத்து சீரானது",
    "incident.diversionActive": "மாற்றுப்பாதை செயலில் உள்ளது",
    "incident.diversionRejected": "மாற்றுப்பாதை நிராகரிக்கப்பட்டது",
    "incident.cameraOffline": "கேமரா இணைப்பு துண்டிக்கப்பட்டது",
    "incident.trafficCheckRequired": "போக்குவரத்து ஆய்வு தேவை",
    "incident.criticalCongestion": "மிக ஆபத்தான நெரிசல்",
    "incident.highCongestion": "அதிக நெரிசல்",

    // CCTV & Video Monitoring
    "cctv.title": "கேமரா கண்காணிப்பு",
    "cctv.incidents": "சம்பவங்கள்",
    "cctv.active": "செயலில்",
    "cctv.none": "இல்லை",
    "cctv.trafficIncident": "போக்குவரத்து சம்பவம்",
    "cctv.isIncidentOccurred": "சம்பவம் நடந்துள்ளதா",
    "cctv.isAmbulanceDetected": "ஆம்புலன்ஸ் கண்டறியப்பட்டதா",
    "cctv.isAccidentOccurred": "விபத்து ஏற்பட்டுள்ளதா",
    "cctv.accidentDetected": "விபத்து கண்டறியப்பட்டது",
    "cctv.bikeAccidentDetected": "இருசக்கர வாகன விபத்து கண்டறியப்பட்டது",
    "cctv.vehicleCollisionDetected": "வாகன மோதல் கண்டறியப்பட்டது",
    "cctv.roadBlocked": "சாலை மறிக்கப்பட்டுள்ளது",
    "cctv.ambulanceDetected": "ஆம்புலன்ஸ் கண்டறியப்பட்டது",
    "cctv.cameraDetails": "கேமரா விவரங்கள்",
    "cctv.showDetails": "காட்டு",
    "cctv.hideDetails": "மறை",
    "cctv.location": "இடம்",
    "cctv.status": "நிலை",
    "cctv.source": "மூலம்",
    "cctv.updated": "புதுப்பிக்கப்பட்டது",
    "cctv.approach": "அணுகுமுறை",
    "cctv.approachCorridor": "பாதை அணுகுமுறை",
    "cctv.noCameras": "கேமராக்கள் இல்லை",
    "cctv.camerasCount": "{count} கேமராக்கள் · {live} நேரலை",
    "cctv.searchCamera": "சந்திப்பு அல்லது கேமராவைத் தேடுக",
    "cctv.connectingLiveFeed": "நேரலை காட்சிக்கு இணைக்கப்படுகிறது...",
    "cctv.initDetectionPipeline": "கண்டறிதல் முறைமை தொடங்கப்படுகிறது",
    "cctv.cameraUnavailable": "கேமரா கிடைக்கவில்லை",
    "cctv.failedConnectFeed": "வீடியோ இணைப்பைத் தொடங்குவதில் தோல்வி",
    "cctv.loadingLiveFeed": "நேரலை காட்சி ஏற்றப்படுகிறது...",
    "cctv.ipCameraStandby": "ஐபி கேமரா தயார் நிலை",
    "cctv.enterRtspPrompt": "RTSP நேரலை இணைப்பை உள்ளிட்டு இணைக்கவும்",
    "cctv.connectingRtsp": "RTSP நேரலை ஸ்ட்ரீமுடன் இணைக்கிறது...",

    // Route Planning & Comparison
    "routes.title": "வழித்தட திட்டமிடல் மற்றும் மாற்றுப்பாதை",
    "routes.from": "இருந்து",
    "routes.to": "நோக்கி",
    "routes.origin": "தொடக்க இடம்",
    "routes.destination": "சேருமிடம்",
    "routes.searchDestinationPlaceholder": "சேருமிடத்தைத் தேடவும் அல்லது தேர்ந்தெடுக்கவும்",
    "routes.searchOriginPlaceholder": "தொடக்க இடத்தைத் தேடவும் அல்லது தேர்ந்தெடுக்கவும்",
    "routes.swap": "மாற்றவும்",
    "routes.recommended": "பரிந்துரைக்கப்பட்டது",
    "routes.alternative": "மாற்று வழி",
    "routes.active": "செயலில்",
    "routes.distance": "தூரம்",
    "routes.travelTime": "பயண நேரம்",
    "routes.traffic": "போக்குவரத்து",
    "routes.trafficIssues": "போக்குவரத்து சிக்கல்கள்:",
    "routes.incidentsCount": "{count} சம்பவங்கள்",
    "routes.onRoute": "வழியில்",
    "routes.show": "காட்டு",
    "routes.hide": "மறை",
    "routes.routeSummary": "பாதை: {origin} → {destination}",
    "routes.recommendedSummary": "பரிந்துரைக்கப்பட்டது: {dist} கி.மீ · {time} நிமி",
    "routes.alternativeSummary": "மாற்று வழி: {dist} கி.மீ · {time} நிமி",
    "routes.diversionPrefix": "மாற்றுப்பாதை: {name}",
    "routes.routeTitle": "வழித்தடம்",
    "routes.useCurrentLocation": "தற்போதைய இருப்பிடத்தைப் பயன்படுத்துக",
    "routes.routeUnavailable": "வழித்தடம் கிடைக்கவில்லை · தொடக்க இடம் மற்றும் சேருமிடத்தைச் சரிபார்க்கவும்.",
    "routes.moreAlongRoute": "மேலும் வழியில் உள்ளது",
    "routes.altReasonAvoidCongestion": "{location} அருகே நெரிசலைத் தவிர்க்க கிடைக்கிறது.",
    "routes.locationsCount": "{count} இடங்கள்",
    "traffic.freeFlow": "சீரான ஓட்டம்",
    "traffic.moderateTraffic": "மிதமான போக்குவரத்து",
    "traffic.heavyDelay": "அதிக தாமதம்",
    "category.junction": "சந்திப்பு",
    "category.highway / road": "நெடுஞ்சாலை / சாலை",
    "category.landmark": "முக்கிய இடம்",
    "category.district": "மாவட்டம்",
    "category.town / city": "நகரம் / ஊர்",
    "category.location": "இடம்",
    "diversion.recommendedTitle": "மாற்றுப்பாதை பரிந்துரைக்கப்படுகிறது",
    "diversion.useAlternateRoute": "{location} பகுதியில் நெரிசலைக் குறைக்க {route} ஐப் பயன்படுத்தவும்.",

    // Traffic Forecast & Predictions
    "forecast.title": "போக்குவரத்து முன்னறிவிப்பு",
    "forecast.confidence": "நம்பகத்தன்மை",
    "forecast.updated": "புதுப்பிக்கப்பட்டது",
    "forecast.status": "போக்குவரத்து நிலை",
    "forecast.expected": "எதிர்பார்க்கப்படுவது",
    "forecast.congestionIncreasing": "நெரிசல் அதிகரிக்கிறது",
    "forecast.flowStable": "போக்குவரத்து சீராக உள்ளது",
    "forecast.moderateInflow": "மிதமான வாகன வரத்து தொடர்கிறது",
    "forecast.now": "தற்போது",
    "forecast.min5": "+5 நிமி",
    "forecast.min15": "+15 நிமி",
    "forecast.min30": "+30 நிமி",
    "forecast.currentTraffic": "தற்போதைய போக்குவரத்து",
    "forecast.trafficWarning": "போக்குவரத்து எச்சரிக்கை",
    "forecast.emergency": "அவசர நிலை",
    "forecast.incident": "சம்பவம்",
    "forecast.accident": "விபத்து",
    "forecast.incidentAccident": "சம்பவம்: விபத்து",
    "forecast.criticalCongestion": "15 நிமிடங்களுக்குள் கடும் நெரிசல் ஏற்படக்கூடும்.",
    "forecast.highCongestion": "15 நிமிடங்களுக்குள் அதிக நெரிசல் ஏற்படக்கூடும்.",
    "forecast.moderateCongestion": "15 நிமிடங்களுக்குள் மிதமான நெரிசல் ஏற்படக்கூடும்.",
    "forecast.warningStatus": "எச்சரிக்கை: {status}",
    "forecast.statusTitle": "நிலை: {status}",
    "forecast.highCongestionExpected": "அதிக நெரிசல் எதிர்பார்க்கப்படுகிறது: {minutes} நிமிடத்தில் {percentage}%.",
    "forecast.criticalCongestionExpected": "கடும் நெரிசல் எதிர்பார்க்கப்படுகிறது: {minutes} நிமிடத்தில் {percentage}%.",
    "forecast.congestionExpectedAt": "{minutes} நிமிடங்களுக்குள் நெரிசல் ஏற்படக்கூடும் ({percentage}%).",
    "forecast.queueMayExtend": "{location} நோக்கி வாகன வரிசை நீளக்கூடும்.",
    "forecast.freeFlow": "தடையற்ற சீரான போக்குவரத்து காணப்படுகிறது.",
    "forecast.capacityNominal": "அனைத்து வழிகளும் இயல்பான கொள்ளளவிற்குள் இயங்குகின்றன.",
    "forecast.ambulanceApproaching": "{location} நோக்கி ஆம்புலன்ஸ் வந்துகொண்டிருக்கிறது.",
    "forecast.accidentReported": "{location} அருகே விபத்து பதிவாகியுள்ளது.",
    "forecast.priorityClearance": "முன்னுரிமை அடிப்படையில் பாதை சீரமைக்கப்பட்டு வருகிறது.",
    "forecast.trafficFlowDisrupted": "போக்குவரத்து பாதிக்கப்பட்டுள்ளது. அவசர உதவிப் பிரிவு அனுப்பப்பட்டுள்ளது.",
    "forecast.trend": "நெரிசல் போக்கு",
    "forecast.chart": "விளக்கப்படம்",
    "forecast.table": "அட்டவணை",
    "forecast.horizon": "கால அளவு",
    "forecast.clockTime": "கடிகார நேரம்",
    "forecast.congestionLevel": "நெரிசல் அளவு",
    "forecast.estVehicles": "மதிப்பிடப்பட்ட வாகனங்கள்",
    "forecast.estSpeed": "மதிப்பிடப்பட்ட வேகம்",
    "forecast.tableStatus": "நிலை",
    "forecast.tooltipCongestion": "நெரிசல்:",
    "forecast.tooltipEstLoad": "வாகன சுமை:",
    "forecast.tooltipEstSpeed": "வேகம்:",

    // Map Overlays, Layers & Legends
    "map.layers": "வரைபட அடுக்குகள்",
    "map.layerJunctions": "சந்திப்புகள்",
    "map.layerCameras": "கேமராக்கள்",
    "map.layerIncidents": "சம்பவங்கள்",
    "map.layerRoutes": "வழிகள்",
    "map.junctionStatus": "சந்திப்பு நிலை",
    "map.routesLegend": "வழிகள்",
    "map.recommended": "பரிந்துரைக்கப்பட்டது",
    "map.alternative": "மாற்று வழி",
    "map.congested": "நெரிசலானது",
    "map.fromPrefix": "இருந்து: {name}",
    "map.toPrefix": "நோக்கி: {name}",
    "map.originFrom": "தொடக்க இடம் (இருந்து)",
    "map.destinationTo": "சேருமிடம் (நோக்கி)",
    "map.trafficOverview": "போக்குவரத்து மேலோட்டம்",

    // Settings Page
    "settings.title": "அமைப்புகள்",
    "settings.subtitle": "கணினி விருப்பத்தேர்வுகள் மற்றும் காட்சி அமைப்புகள்",
    "settings.general": "பொது",
    "settings.display": "காட்சி",
    "settings.traffic": "போக்குவரத்து",
    "settings.map": "வரைபடம்",
    "settings.alerts": "எச்சரிக்கைகள்",
    "settings.workingMode": "செயல்பாட்டு முறை",
    "settings.officerProfile": "அதிகாரி விவரம்",
    "settings.reset": "இயல்புநிலைக்கு மீட்டமை",

    "settings.language": "மொழி",
    "settings.speedUnit": "வேக அலகு",
    "settings.autoRefresh": "தானியங்கி புதுப்பிப்பு",
    "settings.theme": "வண்ண முறை",
    "settings.density": "காட்சி அடர்த்தி",
    "settings.defaultLocation": "இயல்புநிலை இடம்",
    "settings.vehicleCategories": "வாகன வகைகள்",
    "settings.mapStyle": "வரைபட பாணி",
    "settings.mapLayers": "வரைபட அடுக்குகள்",
    "settings.junctionStatus": "சந்திப்பு நிலை",
    "settings.cctvCameras": "சிசிடிவி கேமராக்கள்",
    "settings.activeIncidents": "செயலில் உள்ள சம்பவங்கள்",
    "settings.recommendedRoutes": "பரிந்துரைக்கப்பட்ட வழிகள்",
    "settings.notifications": "அறிவிப்புகள்",
    "settings.criticalIncidents": "முக்கிய அவசர சம்பவங்கள்",
    "settings.highPriorityIncidents": "உயர் முன்னுரிமை சம்பவங்கள்",
    "settings.trafficCongestion": "போக்குவரத்து நெரிசல்",
    "settings.cameraOffline": "கேமரா இணைப்பு இல்லை",
    "settings.cameraOfflineAlerts": "கேமரா இணைப்பு துண்டிப்பு எச்சரிக்கைகள்",
    "settings.diversionUpdates": "வழிமாற்று புதுப்பிப்புகள்",
    "settings.routeChanges": "பாதை மாற்றங்கள்",
    "settings.mode": "கட்டுப்பாட்டு முறை",
    "settings.modeControl": "கட்டுப்பாட்டு அறை",
    "settings.modeField": "கள அதிகாரி",
    "settings.resetConfirm": "அனைத்து அமைப்புகளையும் இயல்புநிலைக்கு மீட்டமைக்க விரும்புகிறீர்களா?",

    "settings.themeLight": "வெளிச்சம்",
    "settings.themeDark": "இருள்",
    "settings.themeSystem": "கணினி முறை",
    "settings.densityCompact": "சுருக்கமான முறை",
    "settings.densityComfortable": "இயல்பான முறை",
    "settings.viewCurrent": "தற்போதைய இடம்",
    "settings.viewSelected": "தேர்ந்தெடுக்கப்பட்ட இடம்",
    "settings.viewTamilNadu": "தமிழ்நாடு",
    "settings.styleStandard": "நிலையானது",
    "settings.styleSatellite": "செயற்கைக்கோள்",
    "settings.refreshOff": "முடக்கு",
    "settings.refresh15s": "15 விநாடிகள்",
    "settings.refresh30s": "30 விநாடிகள்",
    "settings.refresh60s": "60 விநாடிகள்",
    "settings.speedKmh": "கி.மீ/மணி",
    "settings.speedMph": "மைல்/மணி",
  },
};

/**
 * Proper Geographic Names Map (Tamil Nadu Traffic Police Network)
 * Covers all 38 districts, arterial junctions, national/state highways, and approaches.
 */
export const JUNCTION_NAMES = {
  // 1. Districts of Tamil Nadu
  "Chennai": "சென்னை",
  "Coimbatore": "கோயம்புத்தூர்",
  "Madurai": "மதுரை",
  "Tiruchirappalli": "திருச்சிராப்பள்ளி",
  "Trichy": "திருச்சி",
  "Salem": "சேலம்",
  "Tiruppur": "திருப்பூர்",
  "Tirupur": "திருப்பூர்",
  "Erode": "ஈரோடு",
  "Tirunelveli": "திருநெல்வேலி",
  "Vellore": "வேலூர்",
  "Thanjavur": "தஞ்சாவூர்",
  "Dindigul": "திண்டுக்கல்",
  "Namakkal": "நாமக்கல்",
  "Karur": "கரூர்",
  "Dharmapuri": "தர்மபுரி",
  "Krishnagiri": "கிருஷ்ணகிரி",
  "Cuddalore": "கடலூர்",
  "Villupuram": "விழுப்புரம்",
  "Kanchipuram": "காஞ்சிபுரம்",
  "Tiruvannamalai": "திருவண்ணாமலை",
  "Thoothukudi": "தூத்துக்குடி",
  "Ramanathapuram": "ராமநாதபுரம்",
  "Virudhunagar": "விருதுநகர்",
  "Nagapattinam": "நாகப்பட்டினம்",
  "Puducherry": "புதுச்சேரி",
  "Nilgiris": "நீலகிரி",
  "Kanyakumari": "கன்னியாகுமரி",
  "Chengalpattu": "செங்கல்பட்டு",
  "Kallakurichi": "கள்ளக்குறிச்சி",
  "Ranipet": "ராணிப்பேட்டை",
  "Tenkasi": "தென்காசி",
  "Tirupathur": "திருப்பத்தூர்",
  "Mayiladuthurai": "மயிலாடுதுறை",
  "Sivaganga": "சிவகங்கை",
  "Theni": "தேனி",
  "Ariyalur": "அரியலூர்",
  "Perambalur": "பெரம்பலூர்",
  "Pudukkottai": "புதுக்கோட்டை",
  "Tiruvarur": "திருவாரூர்",
  "Tamil Nadu": "தமிழ்நாடு",

  // 2. Arterial Junctions & Intersections
  "Sankagiri Junction": "சங்ககிரி சந்திப்பு",
  "Sankagiri": "சங்ககிரி",
  "Five Roads Junction": "ஐந்து ரோடு சந்திப்பு",
  "Five Roads": "ஐந்து ரோடு",
  "New Bus Stand Junction": "புதிய பேருந்து நிலைய சந்திப்பு",
  "AVR Roundana Junction": "ஏவிஆர் ரவுண்டானா சந்திப்பு",
  "Goripalayam Junction": "கோரிப்பாளையம் சந்திப்பு",
  "Kalavasal Junction": "காளவாசல் சந்திப்பு",
  "Mattuthavani Junction": "மாட்டுத்தாவணி சந்திப்பு",
  "Gandhipuram Signal": "காந்திபுரம் சிக்னல்",
  "Gandhipuram": "காந்திபுரம்",
  "Gandhipuram Signal Approach": "காந்திபுரம் சிக்னல் அணுகுமுறை",
  "Lakshmi Mills Junction": "லட்சுமி மில்ஸ் சந்திப்பு",
  "Lakshmi Mills": "லட்சுமி மில்ஸ்",
  "Ukkadam Junction": "உக்கடம் சந்திப்பு",
  "Ukkadam": "உக்கடம்",
  "Hope College Junction": "ஹோப் காலேஜ் சந்திப்பு",
  "Hope College": "ஹோப் காலேஜ்",
  "Perundurai Junction": "பெருந்துறை சந்திப்பு",
  "Perundurai": "பெருந்துறை",
  "Thillai Nagar Junction": "தில்லை நகர் சந்திப்பு",
  "TVS Tollgate Junction": "டிவிஎஸ் டோல்கேட் சந்திப்பு",
  "Kathipara Junction": "கத்திப்பாரா சந்திப்பு",
  "Koyambedu Roundabout": "கோயம்பேடு ரவுண்டானா",
  "Madhya Kailash Junction": "மத்திய கைலாஷ் சந்திப்பு",
  "Guindy Junction": "கிண்டி சந்திப்பு",
  "Vannarpettai Junction": "வண்ணார்பேட்டை சந்திப்பு",
  "Vannarpettai": "வண்ணார்பேட்டை",
  "Tiruchengode Junction": "திருச்செங்கோடு சந்திப்பு",
  "Tiruchengode": "திருச்செங்கோடு",
  "Rasipuram Junction": "ராசிபுரம் சந்திப்பு",
  "Pushpa Theatre Junction": "புஷ்பா தியேட்டர் சந்திப்பு",
  "Commercial Core Junction": "வணிக மைய சந்திப்பு",
  "North Gateway": "வடக்கு நுழைவு வாயில்",

  // 3. Roads, Expressways & Highways
  "NH544": "என்.எச் 544",
  "NH44": "என்.எச் 44",
  "NH45": "என்.எச் 45",
  "NH81": "என்.எச் 81",
  "GST Road": "ஜி.எஸ்.டி சாலை",
  "OMR": "ஓ.எம்.ஆர்",
  "ECR": "இ.சி.ஆர்",
  "Avinashi Road": "அவிநாசி சாலை",
  "Avinashi Road Junction": "அவிநாசி சாலை சந்திப்பு",
  "Trichy Road": "திருச்சி சாலை",
  "Salem Bypass Road": "சேலம் பைபாஸ் சாலை",
  "Madurai Ring Road": "மதுரை சுற்றுச் சாலை",
  "Salem Road": "சேலம் சாலை",
  "Kumaran Road": "குமரன் சாலை",
  "Palladam Road": "பல்லடம் சாலை",
  "Dharapuram Road": "தாராபுரம் சாலை",
  "Junction Road": "சந்திப்பு சாலை",

  // 4. Bus Stands, Toll Plazas & Terminals
  "Salem Bus Stand": "சேலம் பேருந்து நிலையம்",
  "Erode Bus Stand": "ஈரோடு பேருந்து நிலையம்",
  "Erode Central Bus Stand": "ஈரோடு மத்திய பேருந்து நிலையம்",
  "Namakkal Bus Stand": "நாமக்கல் பேருந்து நிலையம்",
  "Karur Bus Stand": "கரூர் பேருந்து நிலையம்",
  "Coimbatore Bus Stand": "கோயம்புத்தூர் பேருந்து நிலையம்",
  "Tiruppur Bus Stand": "திருப்பூர் பேருந்து நிலையம்",
  "Tiruppur Old Bus Stand Junction": "திருப்பூர் பழைய பேருந்து நிலைய சந்திப்பு",
  "Trichy Bus Stand": "திருச்சி பேருந்து நிலையம்",
  "Madurai Bus Stand": "மதுரை பேருந்து நிலையம்",
  "Chennai CMBT": "சென்னை சி.எம்.பி.டி",
  "Salem Junction Railway Station": "சேலம் சந்திப்பு ரயில் நிலையம்",
  "Sankagiri Toll Plaza": "சங்ககிரி சுங்கச்சாவடி",
  "Erode Toll Plaza": "ஈரோடு சுங்கச்சாவடி",
  "Omalur Toll Plaza": "ஓமலூர் சுங்கச்சாவடி",
  "Vijayamangalam Toll Plaza": "விஜயமங்கலம் சுங்கச்சாவடி",
  "Samayapuram Toll Plaza": "சமயபுரம் சுங்கச்சாவடி",

  // 5. Towns & Key Localities
  "Hosur": "ஓசூர்",
  "Nagercoil": "நாகர்கோவில்",
  "Sivakasi": "சிவகாசி",
  "Pollachi": "பொள்ளாச்சி",
  "Ooty": "ஊட்டி",
  "Mettur": "மேட்டூர்",
  "Vedaranyam": "வேதாரண்யம்",
  "Velankanni": "வேளாங்கண்ணி",
  "Kumarapalayam": "குமாரபாளையம்",

  // 6. Camera Approach Directions & Labels
  "Sankagiri Junction Main Approach": "சங்ககிரி சந்திப்பு முதன்மை அணுகுமுறை",
  "South Outflow (Erode)": "தெற்கு வெளிவழி (ஈரோடு)",
  "East Toll Plaza": "கிழக்கு சுங்கச்சாவடி",
  "West Bypass": "மேற்கு பைபாஸ்",
  "Kumaran Road (North Inflow)": "குமரன் சாலை (வடக்கு உள்வழி)",
  "Palladam Road (South Outflow)": "பல்லடம் சாலை (தெற்கு வெளிவழி)",
  "Railway Station Connector": "ரயில் நிலைய இணைப்பு",
  "Dharapuram Road Approach": "தாராபுரம் சாலை அணுகுமுறை",
  "Corridor Approach": "பாதை அணுகுமுறை",
  "Approach Corridor": "அணுகுமுறைப் பாதை",
  "Flyover Route": "மேம்பால வழி",
  "Flyover Bypass": "மேம்பால மாற்றுவழி",
  "Primary Inflow Junction": "முதன்மை உள்வழி சந்திப்பு",
  "Main Approach": "முதன்மை அணுகுமுறை",
  "North Inflow": "வடக்கு உள்வழி",
  "South Outflow": "தெற்கு வெளிவழி",
  "Monitored Highway Corridor": "கண்காணிக்கப்படும் நெடுஞ்சாலை",
};

/**
 * Enhanced Compound Geographic Name Localizer
 * Resolves complex dynamic combinations such as:
 * - "Salem • Sankagiri Junction" -> "சேலம் • சங்ககிரி சந்திப்பு"
 * - "CCTV-SKG-01 · Sankagiri Junction" -> "CCTV-SKG-01 · சங்ககிரி சந்திப்பு"
 * - "FROM: New Bus Stand Junction" -> "இருந்து: புதிய பேருந்து நிலைய சந்திப்பு"
 * - "TO: Coimbatore" -> "நோக்கி: கோயம்புத்தூர்"
 * - "Kumaran Road (North Inflow)" -> "குமரன் சாலை (வடக்கு உள்வழி)"
 * - "Tirupur, Tamil Nadu" -> "திருப்பூர், தமிழ்நாடு"
 */
export function getLocalizedJunctionName(name, lang = "en") {
  if (!name || typeof name !== "string") return name || "";
  if (lang !== "ta") return name;

  const trimmed = name.trim();
  if (JUNCTION_NAMES[trimmed]) {
    return JUNCTION_NAMES[trimmed];
  }

  // 1. Handle "FROM: <Location>" and "TO: <Location>" prefixes
  const fromMatch = trimmed.match(/^FROM:\s*(.+)$/i);
  if (fromMatch) {
    return `இருந்து: ${getLocalizedJunctionName(fromMatch[1], "ta")}`;
  }
  const toMatch = trimmed.match(/^TO:\s*(.+)$/i);
  if (toMatch) {
    return `நோக்கி: ${getLocalizedJunctionName(toMatch[1], "ta")}`;
  }
  const routeMatch = trimmed.match(/^ROUTE:\s*(.+?)\s*(?:→|->)\s*(.+)$/i);
  if (routeMatch) {
    return `பாதை: ${getLocalizedJunctionName(routeMatch[1], "ta")} → ${getLocalizedJunctionName(routeMatch[2], "ta")}`;
  }
  const diversionMatch = trimmed.match(/^DIVERSION:\s*(.+)$/i);
  if (diversionMatch) {
    return `மாற்றுப்பாதை: ${getLocalizedJunctionName(diversionMatch[1], "ta")}`;
  }

  // 2. Handle camera ID prefix like "CCTV-PRD-01 · " or "CAM001 · "
  const camMatch = trimmed.match(/^((?:CCTV|CAM)[^·•\-]*)[·•\-]\s*(.+)$/i);
  if (camMatch) {
    return `${camMatch[1].trim()} · ${getLocalizedJunctionName(camMatch[2], "ta")}`;
  }

  // 3. Handle middle dot "•" or "·" or " - " compound strings
  if (trimmed.includes(" • ")) {
    return trimmed
      .split(" • ")
      .map((part) => getLocalizedJunctionName(part.trim(), "ta"))
      .join(" • ");
  }
  if (trimmed.includes(" · ")) {
    return trimmed
      .split(" · ")
      .map((part) => getLocalizedJunctionName(part.trim(), "ta"))
      .join(" · ");
  }

  // 4. Handle comma-separated geographic names (e.g., "Tirupur, Tamil Nadu")
  if (trimmed.includes(",")) {
    return trimmed
      .split(",")
      .map((part) => getLocalizedJunctionName(part.trim(), "ta"))
      .join(", ");
  }

  // 5. Handle parenthetical expressions: "Kumaran Road (North Inflow)"
  const parenMatch = trimmed.match(/^([^(]+)\s*\(([^)]+)\)$/);
  if (parenMatch) {
    const mainPart = parenMatch[1].trim();
    const innerPart = parenMatch[2].trim();
    return `${getLocalizedJunctionName(mainPart, "ta")} (${getLocalizedJunctionName(innerPart, "ta")})`;
  }

  // 6. Generic word replacement for common traffic junction suffixes
  let result = trimmed;
  if (result.endsWith(" Junction")) {
    const base = result.slice(0, -9).trim();
    const transBase = JUNCTION_NAMES[base] || base;
    return `${transBase} சந்திப்பு`;
  }
  if (result.endsWith(" Signal")) {
    const base = result.slice(0, -7).trim();
    const transBase = JUNCTION_NAMES[base] || base;
    return `${transBase} சிக்னல்`;
  }
  if (result.endsWith(" Road")) {
    const base = result.slice(0, -5).trim();
    const transBase = JUNCTION_NAMES[base] || base;
    return `${transBase} சாலை`;
  }
  if (result.endsWith(" Bus Stand")) {
    const base = result.slice(0, -10).trim();
    const transBase = JUNCTION_NAMES[base] || base;
    return `${transBase} பேருந்து நிலையம்`;
  }
  if (result.endsWith(" Toll Plaza")) {
    const base = result.slice(0, -11).trim();
    const transBase = JUNCTION_NAMES[base] || base;
    return `${transBase} சுங்கச்சாவடி`;
  }

  return JUNCTION_NAMES[trimmed] || trimmed;
}

/**
 * Dynamic Translation Helper with token interpolation and clean fallback handling
 * Robust against both signatures:
 *   translate(lang, key, params, fallback)
 *   translate(lang, key, fallback, params)
 */
export function translate(lang = "en", key, arg2 = {}, arg3 = "") {
  let params = {};
  let defaultText = "";

  if (typeof arg2 === "string") {
    defaultText = arg2;
    if (typeof arg3 === "object" && arg3 !== null) {
      params = arg3;
    } else if (typeof arg3 === "string" && !defaultText) {
      defaultText = arg3;
    }
  } else if (typeof arg2 === "object" && arg2 !== null) {
    params = arg2;
    if (typeof arg3 === "string") {
      defaultText = arg3;
    }
  } else if (typeof arg3 === "string") {
    defaultText = arg3;
  }

  const activeDict = TRANSLATIONS[lang] || TRANSLATIONS.en;
  const enDict = TRANSLATIONS.en || {};

  let text =
    activeDict[key] !== undefined
      ? activeDict[key]
      : enDict[key] !== undefined
      ? enDict[key]
      : defaultText || key;

  // Substitute {param} tokens
  if (typeof text === "string" && Object.keys(params).length > 0) {
    Object.keys(params).forEach((p) => {
      text = text.replace(new RegExp(`\\{${p}\\}`, "g"), params[p] !== undefined ? params[p] : "");
    });
  }

  // Fallback cleanup if token placeholders remain
  if (typeof text === "string" && text.includes("{")) {
    text = text
      .replace(/\{route\}/g, params.route || "the alternate bypass")
      .replace(/\{location\}/g, params.location || "this junction");
  }

  return text;
}
