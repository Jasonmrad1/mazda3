export type Unit = "mi" | "km";
export type Currency = "USD" | "LBP";
export type Tab = "home" | "care" | "fuel" | "garage" | "assistant";
export interface Vehicle {
  id: string;
  specs: Record<string, string>;
  unit: Unit;
  driving: "normal" | "severe";
  initialMeters: number | null;
  photo: string;
  photoIndex: number;
  vin: string;
  pressure: number;
  placardVerified: boolean;
}
export interface Reading {
  id: string;
  date: string;
  meters: number;
  original: number;
  unit: Unit;
  reason: string;
}
export interface History {
  id: string;
  vehicleId: string;
  title: string;
  category: string;
  date: string;
  meters: number | null;
  taskId: string;
  cost: number | null;
  currency: Currency;
  provider: string;
  notes: string;
  attachments: string[];
  recurring?: "none" | "monthly" | "annual";
}
export interface Fuel {
  id: string;
  vehicleId: string;
  date: string;
  meters: number;
  original: number;
  unit: Unit;
  liters: number;
  cost: number | null;
  currency: Currency;
  full: boolean;
  terrain: string;
  sport: boolean;
  station: string;
  notes: string;
}
export interface Tire {
  position: string;
  psi: number | null;
  checked: string | null;
  tread: number | null;
  manufactured: string;
  brand: string;
  model: string;
  size: string;
  condition: string;
  notes: string;
}
export interface Document {
  id: string;
  name: string;
  data: string;
  kind: string;
  pages: string[];
  added: string;
}
export interface Reminder {
  id: string;
  taskId: string;
  title: string;
  date: string;
  meters: number | null;
  status: "active" | "dismissed" | "completed";
  explanation: string;
}
export interface CareTask {
  id: string;
  name: string;
  category: string;
  miles?: number;
  months?: number;
  days?: number;
  official: boolean;
  reason: string;
  reference: string;
}
export interface GarageData {
  schema: 1;
  vehicle: Vehicle;
  readings: Reading[];
  history: History[];
  fuel: Fuel[];
  tires: Tire[];
  documents: Document[];
  reminders: Reminder[];
  customTasks: CareTask[];
  settings: {
    theme: "dark" | "light";
    onboardingDone: boolean;
    notifications: boolean;
    estimatedMonthlyKm: number | null;
    assistantEndpoint: string;
  };
}
export const id = () => crypto.randomUUID();
export const photos = [
  "/images/mazda_dusk.jpeg",
  "/images/mazda_day.jpeg",
  "/images/mazda_rear.jpeg",
  "/images/mazda_front.jpeg",
];
export function seed(): GarageData {
  return {
    schema: 1,
    vehicle: {
      id: "mazda3-2019",
      specs: {
        Manufacturer: "Mazda",
        Model: "Mazda3 Hatchback",
        Year: "2019",
        Generation: "BP",
        Trim: "Preferred · US specification",
        Engine: "2.5L SKYACTIV-G naturally aspirated gasoline",
        Power: "Approximately 186 hp",
        Transmission: "6-speed automatic",
        Drivetrain: "Front-wheel drive",
        Exterior: "Jet Black Mica",
        Interior: "Black",
        Wheels: "18 × 7J alloy",
        Tires: "215/45R18",
        Country: "Lebanon",
        Fuel: "Gasoline",
        Equipment:
          "Sunroof; Bose premium audio; Apple CarPlay / Android Auto; Blind Spot Monitoring; Rear Cross Traffic Alert; Lane Departure Warning; rain-sensing wipers; dual-zone climate; driver memory seat; rear-view camera",
        "Unverified equipment": "Remote start — confirm installed system",
      },
      unit: "mi",
      driving: "normal",
      initialMeters: 51499008,
      photo: "",
      photoIndex: 0,
      vin: "",
      pressure: 36,
      placardVerified: false,
    },
    readings: [],
    history: [],
    fuel: [],
    documents: [],
    reminders: [],
    customTasks: [],
    tires: ["Front left", "Front right", "Rear left", "Rear right"].map(
      (position) => ({
        position,
        psi: null,
        checked: null,
        tread: null,
        manufactured: "",
        brand: "",
        model: "",
        size: "215/45R18",
        condition: "Needs inspection",
        notes: "",
      }),
    ),
    settings: {
      theme: "dark",
      onboardingDone: false,
      notifications: false,
      estimatedMonthlyKm: null,
      assistantEndpoint: "",
    },
  };
}
