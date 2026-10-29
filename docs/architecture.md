# System Architecture — Astronaut Health Monitoring System

## 1. Overview

The Astronaut Health Monitoring & Early Warning System is a web-based application designed to help astronauts monitor health indicators, visualize health trends, identify potentially concerning measurements, and access relevant health guidance during space missions.

The system follows a client-server architecture consisting of a frontend application, a backend API, health data processing services, a risk assessment engine, and a data storage layer.

The architecture is designed to support modular development, clear separation of responsibilities, and future integration with health sensors and mission data sources.

**Project:** Astronaut Health Monitoring & Early Warning System

**Challenge:** 2026 NASA Space Apps Challenge

---

## 2. High-Level Architecture

The application follows this high-level workflow:

```text
                    ASTRONAUT / USER
                           |
                           v
                  +-------------------+
                  |   React Frontend  |
                  |                   |
                  |  Health Dashboard |
                  |  Health Monitoring|
                  |  Health History   |
                  |  Risk Alerts      |
                  |  3D Human Body    |
                  +-------------------+
                           |
                           | HTTP Requests
                           | JSON Responses
                           v
                  +-------------------+
                  |  Express.js API   |
                  |                   |
                  | Request Handling  |
                  | Input Validation  |
                  | API Responses     |
                  +-------------------+
                           |
                           v
                  +-------------------+
                  | Health Services   |
                  |                   |
                  | Health Processing |
                  | Data Management   |
                  | History Retrieval |
                  +-------------------+
                           |
                           v
                  +-------------------+
                  |   Risk Engine     |
                  |                   |
                  | Configured Rules  |
                  | Trend Evaluation  |
                  | Alert Generation |
                  +-------------------+
                           |
                           v
                  +-------------------+
                  |   Data Storage    |
                  |                   |
                  | Health Readings   |
                  | Health History    |
                  | Alerts            |
                  +-------------------+
                           |
                           v
                  +-------------------+
                  | Structured Results|
                  |                   |
                  | Status            |
                  | Trends            |
                  | Alerts            |
                  | Guidance          |
                  +-------------------+
                           |
                           v
                     React Frontend
```

*Note: This diagram represents the intended logical architecture. The actual implementation may differ depending on the services and storage mechanisms currently configured.*

---

## 3. Frontend Architecture

### Technology Stack

* React.js
* Vite
* JavaScript
* HTML5
* CSS3

The frontend provides the user interface through which astronauts can enter health information, view measurements, examine trends, and review health alerts.

### Main Components

#### 3.1 Dashboard

**File:** `frontend/src/pages/Dashboard.jsx`

Responsibilities:

* Display an overview of available health indicators.
* Show recent measurements.
* Present health trends and statistics.
* Display recent health alerts.
* Provide access to detailed monitoring features.

#### 3.2 Health Monitoring

**File:** `frontend/src/pages/HealthMonitoring.jsx`

Responsibilities:

* Display individual health indicators.
* Allow health measurements to be entered, where implemented.
* Show measurement details and historical trends.
* Present relevant measurement guidance.

#### 3.3 Health History

**File:** `frontend/src/pages/HealthHistory.jsx`

Responsibilities:

* Display previously recorded health measurements.
* Support historical trend analysis.
* Help users review changes over time.

#### 3.4 Risk Alerts

**File:** `frontend/src/pages/RiskAlerts.jsx`

Responsibilities:

* Display generated health alerts.
* Show alert severity and related indicators.
* Present the reason for an alert.
* Provide access to relevant recommendations.

#### 3.5 Settings

**File:** `frontend/src/pages/Setting.jsx`

Responsibilities:

* Provide application settings.
* Support configurable preferences where implemented.

#### 3.6 Interactive Human Body

**File:** `frontend/src/components/AnatomyPanel.jsx`

Responsibilities:

* Display the available 3D human body model.
* Support selection of relevant body regions.
* Connect selected regions to associated health information.
* Display relevant readings when available.

The visualization must distinguish actual measurements from unavailable information. Selecting a body region does not, by itself, establish a medical diagnosis.

#### 3.7 Alert Panel

**File:** `frontend/src/components/AlertPanel.jsx`

Responsibilities:

* Present recent or active alerts.
* Display alert status and severity.
* Show alert explanations and relevant actions.

#### 3.8 Health Trend Card

**File:** `frontend/src/components/HealthTrendCard.jsx`

Responsibilities:

* Display an individual health indicator.
* Show its latest available measurement.
* Present trend information when sufficient historical data exists.

### Frontend API Service

**File:** `frontend/src/services/api.js`

This module acts as the communication layer between the frontend and backend.

Responsibilities:

* Send HTTP requests to backend endpoints.
* Retrieve health readings and historical records.
* Submit health measurements.
* Retrieve alerts and other supported health information.
* Handle API errors and unsuccessful responses.

The API service should use a configurable backend URL rather than relying on a hardcoded production address.

---

## 4. Backend Architecture

### Technology Stack

* Node.js
* Express.js
* JavaScript
* CORS
* dotenv
* CSV processing libraries, where required by the implementation

The backend handles API requests, validates submitted measurements, processes health data, evaluates configured risk rules, and returns structured responses to the frontend.

### 4.1 Server

**File:** `backend/server.js`

Responsibilities:

* Initialize the Express application.
* Configure middleware.
* Configure CORS.
* Register API routes.
* Start the backend server.
* Handle errors and invalid requests.

### 4.2 Health Data Services

Health services are responsible for processing and managing health measurements.

Potential responsibilities include:

* Reading health records.
* Validating data before processing.
* Retrieving historical measurements.
* Preparing health summaries.
* Providing data to the risk assessment engine.

The implementation should separate data access from risk evaluation so that the storage mechanism can be changed without rewriting the entire application.

### 4.3 Risk Engine

**File:** `backend/services/riskEngine.js`

The risk engine evaluates health measurements against configured assessment rules.

Its responsibilities may include:

* Checking whether a measurement is valid.
* Comparing measurements against applicable reference criteria.
* Evaluating relevant historical trends.
* Generating explainable assessment results.
* Creating alerts when configured rules are satisfied.

The risk engine must not treat every unusual measurement as a confirmed medical condition.

Assessment rules and escalation criteria should be based on appropriate medical references and applicable mission protocols.

### 4.4 Flight-Phase Services

The backend includes or plans separate services for different mission phases.

**Pre-flight:** `backend/services/preFlight.js`

Potential responsibilities:

* Organizing available baseline health information.
* Supporting pre-mission health assessments.

**During-flight:** `backend/services/duringFlight.js`

Potential responsibilities:

* Processing in-flight health measurements.
* Supporting ongoing health monitoring.
* Evaluating applicable alert rules.

**Post-flight:** `backend/services/postFlight.js`

Potential responsibilities:

* Organizing post-mission health records.
* Supporting recovery-related monitoring.

These services should share common validation and data-processing logic rather than duplicating the same functionality.

Their exact responsibilities depend on the implemented mission workflows.

---

## 5. Health Data Flow

The following workflow describes how a health measurement can move through the application.

### Step 1: Data Collection

The user enters a health measurement through the frontend.

Examples include:

* Heart rate.
* Blood pressure.
* Body temperature.
* Blood glucose, when available.
* Sleep duration.
* Mood or fatigue assessments.

The application should record the measurement time and unit where applicable.

### Step 2: Request Submission

The frontend sends the measurement to the backend through an HTTP request.

The request contains the relevant measurement information in JSON format.

### Step 3: Input Validation

The backend checks:

* Required fields.
* Supported indicator names.
* Data types.
* Measurement units.
* Applicable value constraints.
* Timestamp validity.

Invalid input should produce a clear error response.

### Step 4: Data Persistence

Valid measurements are saved using the configured storage mechanism.

The storage layer should preserve historical records so that the application can display trends over time.

### Step 5: Health Assessment

The risk engine evaluates the measurement against the applicable configured rules.

Where supported, the assessment may also consider historical measurements and relevant context.

### Step 6: Alert Generation

If a configured rule requires attention, the system generates an alert containing:

* The relevant health indicator.
* The measurement or condition that triggered the rule.
* The assessment result.
* The applicable next step.
* The measurement timestamp.

### Step 7: Response to the Frontend

The backend returns structured data to the frontend.

The frontend updates the relevant health cards, graphs, and alert panels.

### Step 8: Historical Monitoring

Saved measurements are used to display health trends and historical records.

This allows users to review changes in their health indicators over time.

---

## 6. Data Model

The following structures describe the recommended logical data model. They are examples of the intended data organization and do not imply that every field is already implemented.

### 6.1 Health Measurement

A health measurement may contain:

| Field         | Description                                                           |
| ------------- | --------------------------------------------------------------------- |
| id            | Unique measurement identifier                                         |
| astronautId   | Identifier of the relevant astronaut or demo profile                  |
| indicator     | Health indicator name                                                 |
| value         | Recorded measurement value                                            |
| unit          | Measurement unit                                                      |
| measuredAt    | Time the measurement was taken                                        |
| source        | Origin of the measurement, such as manual entry or a supported device |
| qualityStatus | Available information about measurement quality                       |
| isDemo        | Indicates whether the record is simulated                             |

Example:

```json
{
  "id": "measurement-001",
  "astronautId": "DEMO-001",
  "indicator": "heart_rate",
  "value": 78,
  "unit": "bpm",
  "measuredAt": "2026-10-29T10:30:00Z",
  "source": "manual",
  "isDemo": true
}
```

This is an illustrative example, not an actual astronaut health record.

### 6.2 Health Alert

A health alert may contain:

| Field             | Description                                     |
| ----------------- | ----------------------------------------------- |
| id                | Unique alert identifier                         |
| astronautId       | Relevant astronaut or demo profile              |
| indicator         | Related health indicator                        |
| severity          | Configured alert severity                       |
| message           | Human-readable alert explanation                |
| ruleId            | Identifier of the rule that triggered the alert |
| createdAt         | Alert creation time                             |
| status            | Current alert workflow status                   |
| recommendedAction | Relevant next step                              |

Alert status and assessment severity should be separate fields. Acknowledging an alert does not mean the underlying health concern has been resolved.

### 6.3 Wellness Check-in

A wellness record may contain:

* Record identifier.
* Astronaut or demo profile identifier.
* Check-in timestamp.
* Sleep duration.
* Mood assessment.
* Fatigue assessment.
* Reported symptoms.

Only fields actually collected by the application should be stored.

---

## 7. API Architecture

The frontend communicates with the backend through REST-style HTTP endpoints.

The following endpoints are proposed API contracts. Their actual availability must be verified against the backend route implementation.

| Method | Endpoint                      | Purpose                                |
| ------ | ----------------------------- | -------------------------------------- |
| GET    | `/api/health/overview`        | Retrieve dashboard information         |
| GET    | `/api/health/readings`        | Retrieve health measurements           |
| POST   | `/api/health/readings`        | Submit a new health measurement        |
| GET    | `/api/health/history`         | Retrieve historical health information |
| GET    | `/api/health/alerts`          | Retrieve health alerts                 |
| PATCH  | `/api/health/alerts/:id`      | Update an alert's workflow status      |
| POST   | `/api/health/checkins`        | Submit a wellness check-in             |
| GET    | `/api/health/recommendations` | Retrieve relevant health guidance      |

### API Design Principles

* Use appropriate HTTP methods.
* Validate request bodies.
* Return consistent JSON responses.
* Use suitable HTTP status codes.
* Handle missing records and invalid input.
* Avoid exposing sensitive health information unnecessarily.
* Keep assessment rules in backend services rather than duplicating them in the frontend.

---

## 8. Risk Assessment Architecture

The risk assessment process should be explainable and based on configured rules.

```text
Health Measurement
        |
        v
Input Validation
        |
        v
Measurement Quality Check
        |
        v
Reference Criteria Evaluation
        |
        v
Relevant Context and Trend
        |
        v
Risk Rule Evaluation
        |
        v
Assessment Result
        |
        +-------------------+
        |         |         |
        v         v         v
    Acceptable  Attention  Escalation
        |         |         |
        +---------+---------+
                  |
                  v
          Explainable Result
                  |
                  v
             Frontend UI
```

Possible assessment outcomes include:

* **Acceptable:** The available measurement meets the configured criteria.
* **Attention:** Further assessment or repeat measurement may be appropriate.
* **Warning:** The applicable rules indicate that medical review may be needed.
* **Urgent:** An urgent escalation criterion has been met.
* **Unknown:** Available data is insufficient or invalid for reliable assessment.

These labels are conceptual. Their exact meanings and thresholds must be defined using appropriate medical references and mission-specific protocols.

Missing data must not automatically be classified as acceptable.

---

## 9. Visualization Architecture

The frontend presents processed health information using visual components.

### Dashboard Cards

Display selected health measurements, timestamps, and assessment results.

### Historical Charts

Display measurements over time and help users understand trends.

Charts should handle missing data and distinguish measured values from simulated values.

### Interactive Human Body

Allows users to select anatomical regions and view associated health indicators.

Body-region selection should retrieve or display relevant available data without implying that the visualization can independently diagnose an organ's condition.

### Alert Visualization

Displays alert severity, explanations, timestamps, and applicable next steps.

Colors should be accompanied by readable labels or icons to support accessibility.

---

## 10. Data Storage Strategy

The storage layer is responsible for preserving health measurements, historical records, and alert information.

The initial implementation may use CSV files for supported data-processing workflows.

However, CSV files alone are not necessarily suitable for reliable concurrent updates, secure user-specific access, or production health-record management.

For persistent application data, a database such as SQLite or PostgreSQL can be considered.

The selected storage solution should support:

* Reliable record creation.
* Historical queries.
* Data validation.
* Appropriate access controls.
* Consistent timestamps.
* Safe handling of concurrent requests.

The actual storage technology should be documented once confirmed in the implementation.

---

## 11. Error Handling and Reliability

The application should handle common failure scenarios gracefully.

Examples include:

* Invalid health measurements.
* Missing required fields.
* Unsupported units.
* Unavailable historical records.
* Backend connection failures.
* Data-storage errors.
* Missing 3D model assets.
* Insufficient information for risk assessment.

The backend should return appropriate error responses, and the frontend should display understandable messages.

The system should never interpret an unavailable measurement as proof of good health.

---

## 12. Security and Privacy

Health information is sensitive and requires appropriate protection.

For deployments involving real health records, the architecture should support:

* Authentication and authorization.
* Secure communication over HTTPS.
* Access controls for individual records.
* Protected storage.
* Input validation.
* Secure environment-variable management.
* Appropriate logging without unnecessary exposure of health information.

Public demonstrations should use clearly identified synthetic data.

Real astronaut health information should not be committed to a public GitHub repository.

---

## 13. External Integrations

The architecture may be extended to support external data sources.

Potential integrations include:

* Supported wearable health sensors.
* Approved mission health data sources.
* Validated health reference resources.
* Relevant NASA research datasets.

These integrations are future possibilities unless explicitly implemented and tested.

The application must not claim to receive live NASA telemetry or real-time sensor data unless a working integration exists.

---

## 14. Deployment Architecture

A possible production deployment consists of:

```text
                User's Browser
                      |
                      v
              Hosted Frontend
                      |
                      | HTTPS API Requests
                      v
              Hosted Backend
                      |
                      v
              Data Storage Layer
```

The frontend and backend may be deployed separately.

The frontend requires the correct backend API URL, while the backend must be configured with the appropriate CORS policy, environment variables, and storage connection.

A production deployment should also provide persistent storage and suitable security controls.

---

## 15. Future Architectural Improvements

Potential future enhancements include:

* Offline data collection and synchronization.
* Sensor integration.
* Mission-specific health monitoring schedules.
* Improved trend analysis.
* Additional health indicators.
* More detailed mission-phase workflows.
* Secure user authentication.
* Exportable health reports.
* Expanded 3D anatomical visualization.
* Integration with verified external datasets.

These enhancements should be implemented and tested before being described as existing functionality.

---

## 16. Summary

The Astronaut Health Monitoring & Early Warning System uses a modular web application architecture to organize health data collection, processing, visualization, and rule-based assessment.

The React frontend provides the interactive user interface, while the Node.js and Express backend handles API requests and health-related processing.

Supporting services manage health data, evaluate configured assessment rules, and provide structured results to the frontend.

The architecture is intended to support clear health information presentation, historical monitoring, explainable alerts, and future integration with spaceflight-related health data sources.

The system supports health awareness and decision-making. It does not replace professional medical assessment or approved mission medical protocols.
