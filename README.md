#  ASTRA – Astronaut Health Monitoring System

### NASA Space Apps Challenge 2026

ASTRA is a web-based astronaut health monitoring system designed to help monitor crew health during long-duration space missions. It brings health indicators, medical alerts, risk assessments, and health trends together in a centralized dashboard.

The goal is to help astronauts and mission teams identify potential health concerns early and make informed health-related decisions.

---

##  Project Overview

Long-duration space missions expose astronauts to several health risks, including:

* Space radiation exposure
* Isolation and confinement
* Altered gravity
* Cardiovascular changes
* Bone and muscle loss
* Sleep disturbances and stress
* Immune system changes

ASTRA provides a centralized platform to monitor astronaut health indicators, visualize health trends, and identify potential risks.

---

## Key Features

### 1. Dashboard

* Centralized astronaut health overview.
* Health statistics and monitoring cards.
* Health trends and visualizations.
* Medical alerts and risk indicators.

### 2. Crew Overview

* Overview of astronaut crew members.
* Individual crew health status.
* Health scores and monitoring indicators.
* Crew-level health statistics.

### 3. Health Monitoring

* Monitoring of important health indicators.
* Heart rate and blood oxygen levels.
* Blood pressure and body temperature.
* Health data visualization.

### 4. Risk Alerts

* Identification of potentially abnormal health readings.
* Risk severity indicators.
* Medical alert overview.
* Early warning support.

### 5. Health History

* Historical health data.
* Health trend visualization.
* Comparison of health indicators over time.

### 6. Interactive Anatomy

* Interactive 3D human body visualization.
* Selection of body regions.
* Related health information and indicators.

---

##  Technology Stack

### Frontend

* React.js
* Vite
* JavaScript
* CSS
* Data visualization libraries

### Backend

* Node.js
* Express.js
* REST APIs
* CORS

### Development Tools

* Git and GitHub
* VS Code
* npm

---

##  Project Structure

```text
astronaut-health-monitoring/
│
├── backend/
│   ├── routes/
│   ├── services/
│   ├── server.js
│   └── package.json
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── data/
│   │   ├── hooks/
│   │   ├── pages/
│   │   └── services/
│   └── package.json
│
├── shared/
│   ├── crewOverviewDemoData.mjs
│   └── demoHealthData.mjs
│
├── docs/
│   ├── ai-model.md
│   ├── architecture.md
│   ├── references.md
│   └── research.md
│
└── README.md
```

---

##  Installation and Setup

### Prerequisites

Make sure you have installed:

* Node.js
* npm
* Git

### 1. Clone the Repository

```bash
git clone https://github.com/Rohitkumar-72/astronaut-health-monitoring.git
```

```bash
cd astronaut-health-monitoring
```

### 2. Setup Backend

Open a terminal:

```bash
cd backend
npm install
```

Configure your environment variables using the provided `.env.example` file.

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Start the backend:

```bash
npm run dev
```

### 3. Setup Frontend

Open another terminal from the project root:

```bash
cd frontend
npm install
```

Configure the frontend environment variables using `.env.example`.

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Start the frontend:

```bash
npm run dev
```

Open the local URL displayed in your terminal.

---

##  Application Architecture

ASTRA follows a frontend-backend architecture.

* **Frontend:** Displays dashboards, health indicators, charts, and alerts.
* **Backend:** Handles API requests, health data processing, and risk assessment.
* **Shared:** Contains reusable data modules.
* **Documentation:** Contains project research, architecture, references, and AI model information.

---

##  Project Goal

To support astronaut health monitoring during long-duration space missions through centralized health data visualization, risk identification, and early warning support.

---

##  Disclaimer

This project is developed as a NASA Space Apps Challenge prototype. Demonstration data and risk indicators are not a substitute for professional medical diagnosis or clinical decision-making.

---

##  Challenge

**NASA Space Apps Challenge 2026**

**Challenge Area:** Human Exploration | Software | Space Exploration

---

##  Repository

GitHub: https://github.com/Rohitkumar-72/astronaut-health-monitoring

**Built for the NASA Space Apps Challenge 2026.** 
