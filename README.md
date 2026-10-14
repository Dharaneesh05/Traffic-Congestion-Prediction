# Smart Traffic Control & Decision Support System

An AI-assisted traffic monitoring and decision-support system for junction-level congestion analysis, multi-horizon traffic prediction, and intelligent route diversion.

## Overview

The system combines multi-camera vehicle monitoring, traffic analytics, congestion forecasting, and congestion-aware route planning in a unified platform. It is designed to help control-room operators understand changing traffic conditions and provide route-diversion recommendations to field traffic officers.

The prototype supports recorded traffic videos, local webcams, mobile IP-camera streams, and compatible RTSP camera feeds. Demonstration feeds are clearly distinguished from actual live camera sources.

## Key Features

- **Vehicle Detection:** YOLO11n identifies vehicles in traffic video frames.
- **Multi-Object Tracking:** ByteTrack maintains vehicle track identities across successive frames.
- **Traffic Analytics:** Analyses vehicle count, flow, density, movement, and relative speed.
- **Congestion Forecasting:** Uses Temporal Fusion Transformer (TFT) for short-term predictions when sufficient historical data is available.
- **Route Optimization:** Uses OpenStreetMap road-network data in PBF format and a congestion-aware A* algorithm to evaluate routes.
- **Control Room Dashboard:** Presents camera feeds, traffic indicators, map information, alerts, and route recommendations.
- **Field Officer Mobile App:** Supports alert review, recommendation handling, and recording officer decisions.
- **AI-Assisted Decision Support:** Combines traffic information with a retrieval-augmented knowledge workflow to help prepare recommendations.
- **Decision Audit Trail:** Records relevant actions for traceability and review.

## Technology Stack

| Component | Technologies |
|---|---|
| Frontend | React, Vite |
| Backend API | Python, FastAPI |
| Vehicle Detection | YOLO11n, OpenCV |
| Vehicle Tracking | ByteTrack |
| Traffic Forecasting | Temporal Fusion Transformer (TFT) |
| Route Optimization | A*, OpenStreetMap, OSM/PBF |
| Database | PostgreSQL |
| Caching | Redis |
| AI Decision Support | LangGraph, RAG, Large Language Model |
| Camera Sources | RTSP/IP cameras, mobile IP-camera streams, webcams, recorded videos |

## System Workflow

```text
Camera Feeds and Traffic Videos
              |
              v
     Video Frame Processing
              |
              v
       YOLO11n Detection
              |
              v
       ByteTrack Tracking
              |
              v
       Traffic Analytics
              |
       +------+------+
       |             |
       v             v
TFT Congestion    OSM/PBF Road
  Forecasting       Network
       |             |
       +------+------+
              |
              v
 Congestion-Aware A* Routing
              |
              v
 AI-Assisted Recommendations
              |
       +------+------+
       |             |
       v             v
 Control Room    Field Officer
   Dashboard       Mobile App
```

## Camera and Map Data

The system supports multiple camera inputs to represent different approaches to a road junction. Depending on the configured source, video can come from recorded files, webcams, mobile IP-camera applications, or compatible RTSP streams.

OpenStreetMap PBF data provides the road-network information used by the routing module. The road graph and congestion-related costs are used to evaluate alternative routes and potential diversions.

## Project Structure

```text
Traffic-Congestion-Prediction/
├── backend/       # APIs and traffic-processing modules
├── frontend/      # Control room dashboard and mobile interface
├── models/        # Model-related files
├── datasets/      # Traffic videos and road-network data
├── training/      # Training and evaluation resources
├── tests/         # Detection, tracking and pipeline tests
├── config/        # Development tool configuration
├── README.md
├── requirements.txt
└── .gitignore
```

## Technical Scope

- Forecasting depends on the availability and quality of historical traffic observations.
- Vehicle speeds derived from video require camera calibration for reliable real-world speed estimates.
- ByteTrack maintains identities within individual camera streams; cross-camera vehicle re-identification is outside the core scope.
- Route suggestions are intended to support human decision-making. The system does not directly control physical traffic signals.
- Camera feeds and map coverage depend on the configured devices, available data, and local setup.

## Future Improvements

- Improve forecasting through additional traffic observations and evaluation.
- Extend camera coverage and traffic-event analysis.
- Evaluate route recommendations under different congestion scenarios.
- Strengthen mobile notifications, audit reporting, and deployment reliability.
