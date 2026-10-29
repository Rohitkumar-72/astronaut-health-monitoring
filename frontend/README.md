# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.























# 🚀 Astronaut Health Monitoring & Early Warning System

An interactive health monitoring platform designed to help astronauts track their health indicators, understand health trends, identify potential risks, and access relevant health guidance during space missions.

Developed for the **2026 NASA Space Apps Challenge**.

---

## 📌 About the Project

Long-duration space missions expose astronauts to several health risks, including space radiation, microgravity, isolation, confinement, sleep disruption, cardiovascular changes, and bone density loss.

During space missions, astronauts need tools that help them monitor their health, understand changes in their physical and mental well-being, and recognize when a health concern requires attention.

The **Astronaut Health Monitoring & Early Warning System** aims to address this challenge through an interactive web application that presents health information in a clear, accessible, and visual format.

The platform brings together health indicators, historical trends, risk alerts, and health guidance to support astronaut self-monitoring and informed decision-making.

### 🎯 Project Objectives

* Monitor important health indicators through user-entered or available health data.
* Visualize health measurements using interactive dashboards and charts.
* Track changes in health indicators over time.
* Identify potentially concerning readings using configurable, rule-based health assessment.
* Provide understandable alerts and relevant health guidance.
* Present health information through an interactive 3D human body visualization.
* Support wellness tracking, including sleep, fatigue, mood, and reported symptoms.
* Help astronauts understand when further assessment or medical consultation may be appropriate.

---

## ✨ Key Features

### 1. Health Dashboard

Provides an overview of available health indicators, recent measurements, health trends, and active alerts.

### 2. Health Monitoring

Allows users to record health measurements and view relevant information about individual health indicators.

### 3. Interactive 3D Human Body

Provides an interactive human body visualization through which users can select body regions and explore related health information.

### 4. Health Trend Visualization

Uses charts to help users understand how recorded health indicators change over time.

### 5. Risk Alerts

Displays alerts when health measurements meet configured assessment criteria. Alerts can include the related indicator, the reason for the alert, and suggested next steps.

### 6. Health History

Helps users review previously recorded health measurements and examine historical trends.

### 7. Wellness Monitoring

Supports tracking relevant wellness indicators, such as sleep duration, mood, fatigue, and reported symptoms, when these features are enabled.

### 8. Spaceflight Health Guidance

Provides educational information about spaceflight-related health risks and relevant monitoring practices.

> **Note:** Available functionality depends on the current implementation and connected data sources. The application is intended for health monitoring and decision support, not as a replacement for professional medical assessment.

---

## ⚙️ How It Works

The application follows a frontend-backend architecture.

### Step 1: Health Data Collection

Health information can be entered through the application's forms. Depending on the implemented functionality, data may also come from configured files or external data sources.

Examples include:

* Heart rate
* Blood pressure
* Body temperature
* Blood glucose, when available
* Sleep duration
* Mood and fatigue assessments
* Reported symptoms

### Step 2: Data Validation

The backend receives submitted measurements and validates the input, including required fields, measurement units, and applicable data constraints.

### Step 3: Health Data Processing

The backend processes valid measurements and makes them available to the application's health monitoring features.

### Step 4: Risk Assessment

A rule-based assessment system evaluates measurements against configured criteria.

When applicable, the system can identify readings that require attention and generate corresponding alerts.

The assessment depends on the available data, configured rules, and relevant reference criteria.

### Step 5: Data Visualization

The frontend presents available health information through:

* Health overview cards
* Historical charts
* Health status indicators
* Interactive 3D body visualization
* Health alerts and recommendations

### Step 6: Health History

Previously recorded measurements can be used to display historical trends and help users understand changes over time.

### Application Workflow

```text
       Astronaut / User
              |
              v
      Health Data Input
              |
              v
       React Frontend
              |
              v
       Express Backend
              |
              v
      Input Validation
              |
              v
       Health Processing
              |
              v
        Risk Assessment
              |
              v
       Health Dashboard
              |
       +------+------+
       |      |      |
       v      v      v
     Graphs Alerts Guidance
       |
       v
   Health History
```

---

## 🛠️ Technologies Used

The project uses the following technologies and tools.

### Frontend

| Technology                   | Purpose                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------- |
| React.js                     | Building reusable UI components and interactive pages                         |
| Vite                         | Frontend development server and production build tool                         |
| JavaScript                   | Application logic and user interactions                                       |
| HTML5                        | Web page structure                                                            |
| CSS3                         | Styling, responsive layouts, and visual effects                               |
| React-based components       | Organizing dashboard features and reusable interface elements                 |
| Charting library             | Health trend visualization, depending on the installed project dependencies   |
| 3D model and rendering tools | Interactive human body visualization, depending on the current implementation |

### Backend

| Technology     | Purpose                                                            |
| -------------- | ------------------------------------------------------------------ |
| Node.js        | JavaScript runtime for backend execution                           |
| Express.js     | Creating backend APIs                                              |
| JavaScript     | Health data processing and application logic                       |
| CSV processing | Reading and processing CSV data, where configured                  |
| Nodemon        | Automatically restarting the backend during development            |
| CORS           | Configuring cross-origin requests between the frontend and backend |
| dotenv         | Loading environment variables                                      |

### Development Tools

| Tool               | Purpose                                    |
| ------------------ | ------------------------------------------ |
| Visual Studio Code | Code editing and development               |
| Git                | Version control                            |
| GitHub             | Source code hosting and team collaboration |
| npm                | Managing JavaScript packages               |
| Vite               | Running and building the frontend          |

### Additional Assets

The project includes a human body model for anatomical visualization.

The model's attribution and licensing information should be maintained in the appropriate attribution file.

---

## 📁 Project Structure

```text
astronaut-health-monitoring/
│
├── frontend/
│   ├── public/
│   │   └── models/
│   │
│   ├── src/
│   │   ├── components/
│   │   │   ├── AlertPanel.jsx
│   │   │   ├── AnatomyPanel.jsx
│   │   │   └── HealthTrendCard.jsx
│   │   │
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── HealthMonitoring.jsx
│   │   │   ├── HealthHistory.jsx
│   │   │   ├── RiskAlerts.jsx
│   │   │   └── Setting.jsx
│   │   │
│   │   ├── services/
│   │   │   └── api.js
│   │   │
│   │   ├── data/
│   │   │   └── demoHealthData.js
│   │   │
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   │
│   └── package.json
│
├── backend/
│   ├── services/
│   │   ├── csvService.js
│   │   ├── riskEngine.js
│   │   ├── preFlight.js
│   │   ├── duringFlight.js
│   │   └── postFlight.js
│   │
│   ├── server.js
│   └── package.json
│
├── docs/
│   ├── research.md
│   ├── architecture.md
│   └── references.md
        ai-model.md
│
├── .gitignore
└── README.md
```

*Note: This structure illustrates the main project components. Keep the documentation synchronized with the actual files in the repository.*

---

## 💻 Installation and Setup

Follow these steps to run the project on your local machine.

### Prerequisites

Install the following:

* Node.js
* npm
* Git
* Visual Studio Code (recommended)

Check whether Node.js and npm are installed:

```bash
node -v
npm -v
```

### Step 1: Clone the Repository

```bash
git clone https://github.com/Rohitkumar-72/astronaut-health-monitoring.git
```

Navigate into the project directory:

```bash
cd astronaut-health-monitoring
```

### Step 2: Install Frontend Dependencies

Open a terminal in the project root and run:

```bash
cd frontend
npm install
```

### Step 3: Start the Frontend

Inside the `frontend` directory, run:

```bash
npm run dev
```

Vite will display the local development URL in the terminal.

Open that URL in your browser. The default Vite URL is usually:

```text
http://localhost:5173
```

Use the URL actually displayed by Vite if a different port is selected.

### Step 4: Install Backend Dependencies

Open a **second terminal** in Visual Studio Code.

Navigate to the backend directory from the project root:

```bash
cd backend
npm install
```

### Step 5: Start the Backend

For development:

```bash
npm run dev
```

Alternatively, use:

```bash
npm start
```

The backend will start on the port configured in the server code or environment variables.

Check `backend/server.js` to confirm the configured port and available API routes.

### Step 6: Connect Frontend and Backend

Verify that the frontend API service points to the correct backend URL.

Check:

```text
frontend/src/services/api.js
```

If the backend uses environment variables, configure them according to the project's implementation.

Ensure that the backend CORS configuration allows requests from the frontend development URL.

### Running the Application

Keep both terminals running:

**Terminal 1 — Frontend**


cd frontend
npm run dev


**Terminal 2 — Backend**


cd backend
npm run dev


Open the frontend URL in your browser to use the application.

---

## 📊 Health Data and Assessment

The application is designed to organize health measurements, display trends, and support rule-based assessment.

Health assessment rules should use appropriate medical references and mission-specific guidance wherever applicable.

The application should distinguish between:

* Measurements within configured criteria
* Measurements requiring further attention
* Measurements requiring urgent escalation under applicable protocols
* Missing, invalid, or insufficient data

A missing measurement must not automatically be interpreted as a healthy result.

Recommendations should communicate their limitations and direct users to appropriate medical support when necessary.

---

## 🪐 Relevance to Space Exploration

The project addresses health monitoring challenges associated with long-duration space missions.

Relevant areas include:

* Cardiovascular health monitoring
* Bone health and physical activity
* Sleep and recovery
* Behavioral health and well-being
* Spaceflight-related environmental hazards
* Health data visualization
* Early identification of potentially concerning changes

The platform aims to make health information easier to understand and help astronauts recognize when further assessment may be needed.

---

## 🔬 Future Improvements

Potential future enhancements include:

* Integration with supported wearable health sensors
* Improved offline data collection and synchronization
* More advanced historical trend analysis
* Mission-specific monitoring schedules
* Additional anatomical visualizations
* Personalized baselines where clinically appropriate
* Improved health reports and data export
* Secure crew health data management
* Integration with verified mission data sources
* Enhanced accessibility and multilingual support

These are potential enhancements and should not be considered implemented until they are available and tested.

---

## 🔒 Privacy and Medical Disclaimer

Health information is sensitive. Any deployment handling real astronaut or crew health data should implement appropriate authentication, authorization, secure transmission, protected storage, and access controls.

Demo data should be clearly identified as simulated.

This application is intended to support health monitoring, awareness, and decision-making. It does not replace professional medical diagnosis, treatment, or approved mission medical protocols.

Any medical escalation should follow the applicable mission procedures and instructions from qualified medical personnel.

---

## 👥 Team and Collaboration

This project is developed as part of the **2026 NASA Space Apps Challenge**.

GitHub Repository:

https://github.com/Rohitkumar-72/astronaut-health-monitoring

The repository supports version control, collaboration, issue tracking, and continued development.

---

## 🌌 Conclusion

The Astronaut Health Monitoring & Early Warning System aims to make astronaut health information more accessible, understandable, and actionable.

By combining health data collection, interactive visualization, historical trends, and explainable risk assessment, the project explores how software can support astronaut well-being during long-duration space missions.

**Built for the future of human space exploration. 🚀**
