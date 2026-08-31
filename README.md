# Smart Traffic Control & Decision Support System
## Junction-Level Congestion Monitoring, Multi-Horizon Prediction, and Intelligent Diversion

[![Python 3.11](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-cyan.svg)](https://reactjs.org/)
[![YOLO11](https://img.shields.io/badge/YOLO11-Ultralytics-orange.svg)](https://github.com/ultralytics/ultralytics)
[![ByteTrack](https://img.shields.io/badge/ByteTrack-Vehicle_Tracking-yellow.svg)](https://github.com/ifzhang/ByteTrack)
[![OSM](https://img.shields.io/badge/OpenStreetMap-Southern_Zone_PBF-brightgreen.svg)](https://www.openstreetmap.org/)

---

## 1. Project Overview & Identity

The **Smart Traffic Control and Decision Support System** is an authority-grade traffic management prototype developed for traffic control-room operators and field traffic police officers in Tamil Nadu. 

Unlike consumer navigation applications (e.g. Google Maps) which route individual travelers from point A to point B, this system observes multi-approach junctions simultaneously, analyzes real-time vehicle dynamics, forecasts congestion across multiple horizons (+5, +10, +15, +30 min), evaluates connected bypass corridors on the authoritative OpenStreetMap (OSM/PBF) road graph, and issues actionable diversion recommendations directly to police field officers with complete decision audit logging.

---

## 2. Multi-Approach Demonstration Camera Architecture

The prototype supports a **5-camera surveillance matrix** simulating a real-world multi-approach junction (e.g., Sankagiri Junction, Tamil Nadu) using available student hardware:

| Approach | Default Camera Name | Hardware Source Type | Default Source URI |
| :--- | :--- | :--- | :--- |
| **Approach A** | North: NH544 Salem Inflow | `video` / `ip_camera` | `datasets/videos/Traffic.mp4` / Mobile Phone IP URL |
| **Approach B** | South: Erode Toll Inflow | `video` / `ip_camera` | `datasets/videos/Traffic2.mp4` / Mobile Phone IP URL |
| **Approach C** | East: Namakkal Link | `webcam` | `0` (Laptop Camera 1) |
| **Approach D** | West: Karur Bypass | `webcam` | `1` (Laptop Camera 2) |
| **Approach E** | Transit: Outer Ring Connector | `video` | `datasets/videos/Traffic.mp4` (Demo Video Fallback) |

> **Honesty & Disclosure**: All feeds in the UI are transparently labeled as **`DEMO / SIMULATED CCTV`**, **`IP CAMERA`**, **`LOCAL WEBCAM`**, or **`DEMO VIDEO`**. The system does not claim unauthorized direct government CCTV access.

---

## 3. End-to-End Pipeline

```
[5 Camera Sources (Mobile IP / Webcams / Videos)]
       │
       ▼
[OpenCV Ingestion Engine (Async frame decoders)]
       │
       ▼
[YOLO11n Real-time Vehicle Detector] ── (car, truck, bus, motorcycle)
       │
       ▼
[ByteTrack Multi-Object Tracker] ── (Persistent Track IDs & Trajectories)
       │
       ▼
[Junction Traffic Analytics Engine] ── (Flow, Active Count, Density, Speed)
       │
       ├──► [Temporal Fusion Transformer (TFT)] ── (+5, +10, +15, +30 min multi-quantile forecast)
       │
       ▼
[OpenStreetMap OSM/PBF Road Graph + Congestion-Aware A*]
       │
       ▼
[LangGraph Agentic Decision Support & RAG SOP Knowledge Base]
       │  (Grounded in IRC:106, IRC:SP:41, and Tamil Nadu Traffic SOPs)
       │
       ├──► [KEMETRA Control Room Console] (Live Map, Metrics, Matrix, Dispatch)
       │
       └──► [Police Officer Mobile App / PWA] (Instant Alerts, Action Audit Trail)
```

---

## 4. Key Capabilities & Technical Specifications

1. **Computer Vision & Tracking**:
   - **YOLO11n** vehicle detection with automatic device selection (CUDA / Apple Silicon MPS / CPU).
   - **ByteTrack** persistent object tracking with `lapx` linear assignment.
   - Distinct classification between **Active Vehicle Count** (current on-screen bounding boxes) and **Flow Count** (vehicles crossing virtual trip lines).

2. **Multi-Horizon Congestion Forecasting (TFT)**:
   - Evaluates rolling time-series features (vehicle count, flow, speed, density).
   - Generates multi-horizon forecasts with uncertainty intervals ($p_{10}$, $p_{50}$, $p_{90}$).
   - Transparent fallback: Displays `"WAITING FOR DATA"` when insufficient temporal history exists.

3. **Congestion-Aware A* Routing on OSM/PBF**:
   - Parses `datasets/southern-zone-260708.osm.pbf` into a spatial road network graph.
   - Applies dynamic edge cost penalties based on real-time and predicted congestion levels:
     $$\text{Cost}(e) = \text{Length}(e) \times \left(1.0 + \alpha \times \text{Congestion}(e)\right)$$

4. **Traffic Authority Diversion Engine**:
   - Identifies candidate outgoing bypass roads connected to congested approaches (e.g. NH544 Salem Inflow $\rightarrow$ NH544 Bypass Road Western Loop).
   - Computes net travel time saved and queue discharge durations.

5. **Officer Mobile App & Decision Audit Trail**:
   - Real-time alert notifications with severity categorization (`CRITICAL`, `WARNING`, `ADVISORY`).
   - Officer actions: **Acknowledge**, **Accept Recommendation**, **Reject**, **Override**, **Mark Resolved**, and **Add Note**.
   - All decisions are recorded into `backend/audit_log.json` for governance.

---

## 5. Installation & Setup

### Prerequisites
- Python 3.11 with Conda / Miniconda
- Node.js 18+ and npm

### Backend Setup
```bash
# 1. Activate your Python 3.11 environment
conda activate traffic_env

# 2. Install backend dependencies
pip install fastapi uvicorn pydantic ultralytics torch opencv-python lapx tensorflow osmnx pyrosm geopandas networkx langchain langgraph flake8

# 3. Start the FastAPI backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

### Frontend Setup
```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Start Vite dev server
npm run dev
```

---

## 6. Accessing the System

| Interface | URL | Description |
| :--- | :--- | :--- |
| **Control Room Console** | [http://localhost:5173/](http://localhost:5173/) | Main operator dashboard with live map and analytics |
| **5-Camera Matrix** | [http://localhost:5173/live-camera](http://localhost:5173/live-camera) | 5-feed camera surveillance with stream configurators |
| **Police Officer Mobile App** | [http://localhost:5173/officer-mobile](http://localhost:5173/officer-mobile) | Field interface for receiving alerts and taking action |
| **FastAPI Swagger Docs** | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) | Interactive REST API documentation and tester |

---

## 7. How to Demonstrate with Student Devices

1. **Using a Mobile Phone as an IP Camera**:
   - Install **IP Webcam** (Android) or **Live-Reporter** (iOS).
   - Start the server on your phone (e.g. `http://192.168.1.50:8080/video`).
   - In the **Live Camera Network** page ([http://localhost:5173/live-camera](http://localhost:5173/live-camera)), click the ⚙️ **Configure** button on **Camera 1** or **Camera 2**.
   - Select **Mobile IP Camera**, paste your phone's stream URL, and click **Apply Stream URL**.
   - Click **Start AI Surveillance Feed**. Real YOLO11 detections and ByteTrack tracks will immediately process from your phone.

2. **Using a Laptop Webcam**:
   - Click ⚙️ **Configure** on **Camera 3** or **Camera 4**.
   - Select **Local Laptop Camera**, enter device index `0` (or `1` for USB external webcam), and click **Apply Stream URL**.

3. **Running the Full Pipeline Verification Test**:
   ```bash
   python test_full_pipeline.py
   ```

---

## 8. Technical Boundaries & Disclosures

- **Speed Estimation**: Displayed speeds represent relative pixel velocity. Absolute km/h values require camera perspective transformation calibration for each physical camera angle.
- **Vehicle Identity**: ByteTrack assigns persistent IDs per camera stream. Cross-camera re-identification (Re-ID) across separate cameras is outside the core scope.
- **Traffic Control**: The system generates decision recommendations for human traffic police officers and does not directly manipulate physical signal controllers.
