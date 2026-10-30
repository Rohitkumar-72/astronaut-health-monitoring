const now = Date.now();

const minutesAgo = (minutes) =>
  new Date(now - minutes * 60 * 1000).toISOString();

export const demoHealthData = [
  {
    id: "ALT-1001",
    astronautId: "AST-001",
    astronautName: "Alex Morgan",
    parameter: "Heart Rate",
    value: 125,
    unit: "BPM",
    severity: "Critical",
    status: "New",
    message: "Heart rate is significantly above the configured threshold.",
    recommendation:
      "Verify sensor readings and follow the mission medical protocol.",
    timestamp: minutesAgo(3),
    history: [78, 82, 86, 95, 108, 125],
  },
  {
    id: "ALT-1002",
    astronautId: "AST-002",
    astronautName: "Sarah Chen",
    parameter: "Oxygen Saturation",
    value: 92,
    unit: "%",
    severity: "High",
    status: "New",
    message: "Oxygen saturation is below the configured threshold.",
    recommendation:
      "Check sensor placement and follow the mission medical protocol.",
    timestamp: minutesAgo(12),
    history: [98, 97, 96, 95, 94, 92],
  },
  {
    id: "ALT-1003",
    astronautId: "AST-003",
    astronautName: "James Wilson",
    parameter: "Sleep Duration",
    value: 4.5,
    unit: "hours",
    severity: "Medium",
    status: "Acknowledged",
    message: "Sleep duration is below the configured target.",
    recommendation:
      "Review recent sleep history and the astronaut's scheduled rest period.",
    timestamp: minutesAgo(35),
    history: [7.5, 7, 6.5, 6, 5, 4.5],
  },
  {
    id: "ALT-1004",
    astronautId: "AST-001",
    astronautName: "Alex Morgan",
    parameter: "Body Temperature",
    value: 38.1,
    unit: "°C",
    severity: "High",
    status: "Under Assessment",
    message: "Body temperature is above the configured reference range.",
    recommendation:
      "Verify the measurement and request assessment according to mission protocol.",
    timestamp: minutesAgo(48),
    history: [36.8, 36.9, 37.1, 37.4, 37.8, 38.1],
  },
  {
    id: "ALT-1005",
    astronautId: "AST-004",
    astronautName: "Emily Carter",
    parameter: "Physical Activity",
    value: 35,
    unit: "%",
    severity: "Low",
    status: "Resolved",
    message: "Physical activity was below the astronaut's personal baseline.",
    recommendation:
      "Continue monitoring activity against the astronaut's planned exercise schedule.",
    timestamp: minutesAgo(90),
    history: [75, 68, 55, 48, 40, 35],
  },
  {
    id: "ALT-1006",
    astronautId: "AST-002",
    astronautName: "Sarah Chen",
    parameter: "Stress Indicator",
    value: 78,
    unit: "%",
    severity: "Medium",
    status: "New",
    message: "Stress indicator is elevated compared with the configured baseline.",
    recommendation:
      "Review trends and consider the astronaut's self-reported wellbeing.",
    timestamp: minutesAgo(120),
    history: [35, 42, 50, 61, 70, 78],
  },
  {
    id: "ALT-1007",
    astronautId: "AST-003",
    astronautName: "James Wilson",
    parameter: "Heart Rate",
    value: 88,
    unit: "BPM",
    severity: "Low",
    status: "Resolved",
    message: "A previous heart-rate deviation has been reassessed.",
    recommendation:
      "Continue monitoring and compare future readings with the personal baseline.",
    timestamp: minutesAgo(180),
    history: [105, 98, 94, 91, 89, 88],
  },
  {
    id: "ALT-1008",
    astronautId: "AST-004",
    astronautName: "Emily Carter",
    parameter: "Oxygen Saturation",
    value: 97,
    unit: "%",
    severity: "Low",
    status: "Acknowledged",
    message: "An earlier oxygen saturation alert is being monitored.",
    recommendation:
      "Continue routine monitoring and verify subsequent readings.",
    timestamp: minutesAgo(240),
    history: [94, 95, 96, 96, 97, 97],
  },
];

export default demoHealthData;