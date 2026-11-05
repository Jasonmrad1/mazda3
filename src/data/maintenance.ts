import type { CareTask, GarageData } from "../lib/types";
export const sourceUrl =
  "https://www.mazdausa.com/siteassets/global-resources/vehicle-resources/owner-manuals/2019/m3s/2019-mazda3-hatchback-sedan-schedule-maintenance.pdf";
export const sourceTitle = "2019 Mazda3 US Scheduled Maintenance";
export function careTasks(d: GarageData): CareTask[] {
  const severe = d.vehicle.driving === "severe";
  const tasks: CareTask[] = [
    {
      id: "oil",
      name: "Engine oil & filter",
      category: "Engine",
      miles: severe ? 5000 : 10000,
      months: severe ? 6 : 12,
      official: true,
      reason: severe
        ? "Dusty conditions, extended idling, extreme heat or continuous mountain driving can qualify for the severe oil schedule. Other intervals are unchanged."
        : "Normal schedule maximum. Follow the vehicle status monitor earlier if indicated. Reset oil data after replacement.",
      reference: "US schedule · oil & filter, notes 1–2",
    },
    {
      id: "pressure",
      name: "Cold tire pressure",
      category: "Wheels & tires",
      months: 1,
      official: false,
      reason:
        "Monthly inspection and before a long trip. 36 PSI front/rear is your supplied reference until you confirm the driver’s door placard.",
      reference: "Owner inspection · advisory monthly reminder",
    },
    {
      id: "rotation",
      name: "Tire rotation",
      category: "Wheels & tires",
      miles: 10000,
      official: true,
      reason: "Mazda’s US schedule lists a 10,000-mile rotation interval.",
      reference: "US schedule · tire rotation",
    },
    {
      id: "cabin",
      name: "Cabin air filter",
      category: "Other",
      miles: 30000,
      months: 24,
      official: true,
      reason: "Use whichever arrives first: distance or elapsed time.",
      reference: "US schedule · cabin air filter",
    },
    {
      id: "plugs",
      name: "Spark plugs",
      category: "Engine",
      miles: 75000,
      official: true,
      reason: "A distance interval is specified. No time limit has been added.",
      reference: "US schedule · spark plug",
    },
    {
      id: "coolant",
      name: "Engine coolant",
      category: "Engine",
      miles: 60000,
      months: 60,
      official: true,
      reason:
        "First replacement: 120,000 miles or 120 months from the in-service date, currently unknown. After a verified replacement: 60,000 miles or 60 months. This reminder uses the subsequent interval only after you record that replacement.",
      reference: "US schedule · engine coolant, note 2",
    },
    {
      id: "air",
      name: "Engine air filter",
      category: "Engine",
      official: true,
      reason:
        "Replace at every third scheduled maintenance event. Confirm prior maintenance events; a fixed mileage interval is not inferred here.",
      reference: "US schedule · air filter",
    },
  ];
  const groups: Record<string, string[]> = {
    Engine: ["Drive belts", "Engine inspections", "Coolant level"],
    "Transmission & drivetrain": [
      "Automatic transmission fluid",
      "Transmission leak inspection",
      "Axles & CV boots",
      "Drivetrain inspection",
    ],
    Braking: [
      "Brake pads",
      "Brake discs",
      "Brake fluid",
      "Brake hoses",
      "Parking brake",
    ],
    "Wheels & tires": [
      "Wheel balancing",
      "Wheel alignment",
      "Tire tread depth",
      "Tire age",
      "Wheel/rim damage",
      "Spare tire condition",
    ],
    Electrical: [
      "12V battery",
      "Exterior lighting",
      "Windshield wipers",
      "Warning indicators",
    ],
    "Suspension & steering": [
      "Shock absorbers",
      "Struts",
      "Suspension bushings",
      "Ball joints",
      "Steering components",
    ],
    Other: [
      "Air conditioning",
      "Exhaust system",
      "Body corrosion",
      "General safety inspection",
    ],
  };
  for (const [category, names] of Object.entries(groups))
    for (const name of names)
      tasks.push({
        id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name,
        category,
        official: false,
        reason:
          "Tracking item. No fixed replacement interval is verified here. Confirm inspection and replacement requirements with the mechanical manual or a qualified technician. Add a personal schedule if appropriate.",
        reference: "Interval requires confirmation",
      });
  for (const custom of d.customTasks) {
    const i = tasks.findIndex((t) => t.id === custom.id);
    if (i < 0) tasks.push(custom);
    else tasks[i] = custom;
  }
  return tasks;
}
export function intervalLabel(t: CareTask, unit: "mi" | "km") {
  const parts = [];
  if (t.miles)
    parts.push(
      `${Math.round(t.miles * (unit === "mi" ? 1 : 1.609344)).toLocaleString()} ${unit}`,
    );
  if (t.months) parts.push(`${t.months} month${t.months === 1 ? "" : "s"}`);
  if (t.days) parts.push(`${t.days} days`);
  return parts.join(" / ") || "Confirm interval";
}
