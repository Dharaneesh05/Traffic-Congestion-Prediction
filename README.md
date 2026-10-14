
# Smart Traffic Control & Decision Support System

A junction-level traffic monitoring and route optimization prototype using computer vision, congestion forecasting, and AI-assisted decision support.

![Python](https://img.shields.io/badge/Python-3.11-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-green)
![React](https://img.shields.io/badge/React-Frontend-cyan)
![YOLO11](https://img.shields.io/badge/YOLO11-Vehicle%20Detection-orange)
![ByteTrack](https://img.shields.io/badge/ByteTrack-Vehicle%20Tracking-yellow)

## Overview

The system monitors traffic across multiple camera feeds, analyses vehicle movement, estimates congestion, and supports route-diversion decisions. It is designed for a traffic control-room dashboard and a mobile interface for field officers.

## Key Features

- **Vehicle Detection:** YOLO11 identifies vehicles in video frames.
- **Vehicle Tracking:** ByteTrack maintains vehicle identities across successive frames.
- **Traffic Analytics:** Calculates vehicle count, flow, density, and movement indicators.
- **Congestion Forecasting:** Uses Temporal Fusion Transformer (TFT) forecasting when sufficient historical data is available.
- **Route Optimization:** Uses OpenStreetMap road-network data and a congestion-aware A* algorithm to evaluate routes.
- **AI-Assisted Recommendations:** Combines traffic information to support diversion decisions.
- **Decision Logging:** Records officer actions for review and traceability.
- **Multi-Camera Input:** Supports demonstration videos, local webcams, and compatible mobile IP-camera streams.

## Technology Stack

| Component | Technologies |
|---|---|
| Frontend | React, Vite |
| Backend | Python, FastAPI |
| Vehicle Detection | YOLO11, OpenCV |
| Vehicle Tracking | ByteTrack |
| Traffic Forecasting | Temporal Fusion Transformer (TFT) |
| Route Optimization | OpenStreetMap, A* |
| Data and Caching | PostgreSQL, Redis |
| AI Decision Support | LangGraph, RAG |

## Project Structure

```text
Traffic-Congestion-Prediction/
├── backend/       # APIs and traffic processing
├── frontend/      # Web dashboard and officer interface
├── models/        # Model-related files
├── datasets/      # Traffic videos and road-network data
├── training/      # Training and evaluation resources
├── tests/         # Pipeline and module tests
├── config/        # Development tool configuration
├── README.md
├── requirements.txt
└── .gitignore
```

*The structure above is the intended organization; retain any files in their current locations until their paths and imports have been checked.*

## Getting Started

### Prerequisites

- Python 3.11
- Node.js 18 or later
- npm

### 1. Clone the Repository

```bash
git clone https://github.com/Dharaneesh05/Traffic-Congestion-Prediction.git
cd Traffic-Congestion-Prediction
```

### 2. Set Up the Backend

Create and activate a Python virtual environment, then install the project's dependencies:

```bash
python -m venv .venv
```

Windows:

```powershell
.venv\Scripts\Activate.ps1
```

Linux:

```bash
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the backend from the directory containing the FastAPI entry point. For example, if `main.py` is inside `backend/`:

```bash
cd backend
python -m uvicorn main:app --reload
```

### 3. Set Up the Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Use the local frontend URL displayed by Vite. If the backend uses a different port or configuration, update the frontend environment settings accordingly.

## Demonstration and Limitations

- Video sources may include demonstration footage, local webcams, or compatible IP-camera streams.
- Forecast quality depends on the availability and quality of historical traffic data.
- Absolute vehicle speed estimation requires suitable camera calibration.
- Route recommendations support human decision-making; the system does not directly control physical traffic signals.
- Real-world deployment requires suitable data, infrastructure, testing, and operational authorization.

## Future Enhancements

- Improve forecasting with additional traffic observations.
- Evaluate route recommendations using real traffic scenarios.
- Extend camera coverage and field-officer notifications.
- Improve monitoring, testing, and deployment reliability.

## Author

**Dharaneesh C.**  
B.Tech – Artificial Intelligence and Data Science

GitHub: [Dharaneesh05](https://github.com/Dharaneesh05)

---

*This project is intended for academic development, demonstration, and traffic-management decision support.*
