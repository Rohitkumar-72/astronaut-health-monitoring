# References and Resources

## Project: Astronaut Health Monitoring System

This document lists the scientific resources, official NASA websites, datasets, and software documentation relevant to the development of the Astronaut Health Monitoring System.

These references support research into astronaut health risks, spaceflight conditions, health monitoring, data visualization, and the technologies used to build the application.

**Note:** The resources listed below are starting points for research. A source should only be cited as evidence for a specific claim after the relevant information has been verified. A listed resource does not necessarily mean its data or software has been integrated into this project.

---

## 1. NASA Space Apps Challenge

### NASA Space Apps Challenge — Official Website

**URL:** https://www.spaceappschallenge.org/

**Purpose:**

* Understand the NASA Space Apps Challenge.
* Review challenge information and participation requirements.
* Understand the role of software and scientific data in solving space-related problems.

**Project relevance:**
The project is designed to address the challenge of monitoring astronaut health during long-duration space missions.

---

## 2. NASA Human Research Program

### NASA Human Research Program (HRP)

**URL:** https://www.nasa.gov/hrp/

**Purpose:**

* Research human health risks associated with spaceflight.
* Understand the challenges astronauts face during long-duration missions.
* Explore NASA's work on protecting astronaut health and performance.

**Project relevance:**
This resource provides background information for identifying health risks and designing health-monitoring features.

---

## 3. NASA Human Research Roadmap

### NASA Human Research Roadmap

**URL:** https://humanresearchroadmap.nasa.gov/

**Purpose:**

* Explore research on human health and performance in space.
* Review documented risks associated with spaceflight.
* Investigate research gaps and strategies for reducing astronaut health risks.

**Project relevance:**
This resource can help inform the project's selection of health indicators, risk categories, and future improvements.

---

## 4. NASA Open Science Data Repository

### NASA Open Science Data Repository (OSDR)

**URL:** https://osdr.nasa.gov/

**Purpose:**

* Explore scientific datasets related to spaceflight and life sciences.
* Investigate available astronaut and space biology research data.
* Identify datasets that may be useful for future analysis or testing.

**Project relevance:**
Suitable datasets may support future research, testing, or data analysis.

**Important:**
A dataset should only be described as used by this project after it has actually been downloaded, reviewed, and integrated. Dataset identifiers and publication details should be recorded when a specific dataset is selected.

---

## 5. NASA Research on Spaceflight Health Risks

### NASA Human Research — Spaceflight Health Research

**Starting resource:** https://www.nasa.gov/hrp/

**Research topics:**

* Radiation exposure.
* Microgravity and its effects on the human body.
* Bone and muscle changes.
* Cardiovascular adaptation.
* Sleep and behavioral health.
* Isolation and confinement.
* Health risks during long-duration missions.

**Project relevance:**
These topics provide a scientific starting point for identifying the types of health information the application may monitor.

**Citation note:**
For individual scientific claims, identify and cite the specific NASA page, research publication, or technical report that supports the claim.

---

## 6. Frontend Technologies

### React

**Official documentation:** https://react.dev/

**Purpose:**
React is used to build component-based user interfaces.

**Project relevance:**
It can support the dashboard, health information cards, navigation, alerts, and other interactive interface components.

### Vite

**Official documentation:** https://vite.dev/

**Purpose:**
Vite provides frontend development tools and production build functionality.

**Project relevance:**
It supports the development and build process for the React application.

### MDN Web Docs — JavaScript

**Official documentation:** https://developer.mozilla.org/en-US/docs/Web/JavaScript

**Purpose:**
Provides documentation for JavaScript language features and browser APIs.

**Project relevance:**
Useful for understanding application logic, event handling, data processing, and interactive features.

### MDN Web Docs — CSS

**Official documentation:** https://developer.mozilla.org/en-US/docs/Web/CSS

**Purpose:**
Provides documentation for styling web interfaces.

**Project relevance:**
Useful for responsive layouts, dashboard styling, visual components, and interface accessibility.

---

## 7. Backend Technologies

### Node.js

**Official documentation:** https://nodejs.org/docs/

**Purpose:**
Node.js provides a JavaScript runtime for backend development.

**Project relevance:**
It can run the application's backend services and data-processing logic.

### Express.js

**Official documentation:** https://expressjs.com/

**Purpose:**
Express is a web framework for building Node.js applications and HTTP APIs.

**Project relevance:**
It can provide API endpoints for health measurements, alert information, and other application data.

### npm

**Official documentation:** https://docs.npmjs.com/

**Purpose:**
npm manages JavaScript packages and project dependencies.

**Project relevance:**
It supports installation and management of the frontend and backend dependencies.

---

## 8. Data Visualization

### Chart.js

**Official documentation:** https://www.chartjs.org/docs/latest/

**Purpose:**
Chart.js provides tools for creating charts and data visualizations.

**Potential project relevance:**
It may be used to visualize health trends, historical measurements, and statistics.

**Note:**
Confirm that Chart.js is included in the project's dependencies before describing it as an implemented technology. If another charting library is used, replace this entry with the correct library.

---

## 9. Three-Dimensional Human Body Visualization

### BodyParts3D — Database Center for Life Science (DBCLS)

**Resource information:**
The project contains a local model attributed to BodyParts3D / DBCLS.

**Model attribution details recorded in the project:**

* Source: BodyParts3D, The Database Center for Life Science (DBCLS).
* License: Creative Commons Attribution 4.0 International (CC BY 4.0).
* Model file/identifier recorded in the project: FJ2810.
* Representation identifier: BP9115.
* English name recorded in the attribution file: Skin.

**Project relevance:**
The model provides a human skin-surface representation for the project's 3D visualization.

**Important limitations:**

* The recorded asset represents the skin surface, not a complete collection of internal organs.
* Interactive body regions may be approximate interface zones rather than medically validated anatomical segmentation.
* The model itself does not measure health or diagnose medical conditions.

**Attribution:**
Retain the original asset attribution and license information with the model. Review the original license terms and ensure the required attribution is displayed wherever the model is redistributed.

**Source and license information:**
Use the original BodyParts3D / DBCLS source and the license URL recorded in `frontend/public/models/ATTRIBUTION.txt`.

---

## 10. Health Data and Risk Assessment

### General Approach

The project may use health measurements and configured rules to identify readings that require attention.

Relevant data-quality considerations include:

* Measurement units.
* Timestamps.
* Sensor accuracy.
* Missing or invalid values.
* Source reliability.
* Appropriate interpretation of health measurements.

### Medical Thresholds

Health thresholds should be based on appropriate authoritative medical guidance or validated mission-specific requirements.

Do not describe arbitrary demonstration thresholds as NASA-approved limits.

For each threshold used in the application, record:

1. The health indicator.
2. The threshold and unit.
3. The authoritative source.
4. The relevant publication or page.
5. The reason the threshold is appropriate for the intended use.

The software's risk labels should not be treated as medical diagnoses.

---

## 11. Data Privacy and Security

### OWASP Foundation

**Official website:** https://owasp.org/

**Purpose:**
OWASP provides resources on web application security and common security risks.

**Project relevance:**
These resources can help guide future improvements involving input validation, secure API design, access control, and protection of sensitive health information.

### MDN Web Security

**Official documentation:** https://developer.mozilla.org/en-US/docs/Web/Security

**Purpose:**
Provides information about web security concepts and browser security mechanisms.

**Project relevance:**
Useful when reviewing security practices for the web application.

---

## 12. How References Support the Project

| Project Area                      | Relevant Resource                                    |
| --------------------------------- | ---------------------------------------------------- |
| NASA Space Apps Challenge context | NASA Space Apps Challenge                            |
| Astronaut health risks            | NASA Human Research Program                          |
| Spaceflight health research       | NASA Human Research Roadmap                          |
| Scientific datasets               | NASA Open Science Data Repository                    |
| Frontend development              | React, Vite, MDN                                     |
| Backend development               | Node.js, Express.js                                  |
| Health trend charts               | Documentation for the charting library actually used |
| 3D human body model               | BodyParts3D / DBCLS attribution file                 |
| Web security                      | OWASP, MDN Web Security                              |

---

## 13. Citation and Verification Guidelines

To keep project documentation accurate:

1. Prefer official NASA, scientific, and technology documentation.
2. Verify each source before using it to support a specific claim.
3. Record the title, organization or author, publication date if available, and direct URL.
4. Record the date accessed when required by the event's documentation guidelines.
5. Include dataset identifiers when using a specific scientific dataset.
6. Keep the original license and attribution for third-party models.
7. Do not claim that a source, dataset, sensor, or technology is integrated unless it is actually used.
8. Distinguish sample data from real astronaut measurements.
9. Avoid presenting the application as a clinically validated medical device.

---

## 14. Conclusion

These resources provide a foundation for researching astronaut health risks, understanding spaceflight conditions, developing the web application, and planning future improvements.

NASA research resources support the scientific background, technology documentation supports implementation, and the model attribution file records the origin and license of the 3D asset.

The references should be updated as the project develops, particularly when specific datasets, medical guidelines, research publications, or additional software libraries are incorporated.
