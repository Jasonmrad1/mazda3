export interface Article {
  id: string;
  category: string;
  title: string;
  summary: string;
  body: string;
  source: string;
  reference: string;
  keywords: string;
}
const root = "https://www.mazdausa.com/static/manuals/2019/mazda3/contents/";
export const articles: Article[] = [
  {
    id: "tires",
    category: "My tires",
    title: "A little pressure. A lot of protection.",
    summary: "The most useful monthly habit for your 18-inch wheels.",
    body: "Measure all four tires when cold, and check the spare if fitted. Use the driver’s door placard, rather than the maximum pressure molded into the tire sidewall. Your supplied 36 PSI reference remains unverified until you confirm that label. Warm tires read higher; do not bleed them down to a cold-pressure target. This app stores manual checks and does not receive live TPMS readings.",
    source: root + "07031403.html",
    reference: "2019 Mazda3 Owner’s Manual · Tires / inflation pressure",
    keywords:
      "tire tyre pressure cold warm psi bar kpa inspect monthly pothole",
  },
  {
    id: "oil",
    category: "My engine",
    title: "The right oil-change rhythm",
    summary: "A verified schedule, shaped by your actual driving.",
    body: "For the US-specification 2019 Mazda3, normal scheduled maintenance is due within 10,000 miles or 12 months, or earlier if the vehicle status monitor indicates it. Qualifying severe use changes oil and filter replacement to 5,000 miles or 6 months. Prolonged low-speed driving, dust, extreme heat and continuous mountain driving are among Mazda’s listed conditions. Other listed service intervals are not automatically shortened. The correct fluid specification must be verified in the mechanical manual for your exact engine.",
    source: "/manuals/2019-mazda3-maintenance.pdf#page=1",
    reference: "2019 Mazda3 US Scheduled Maintenance · PDF pp. 1–3",
    keywords:
      "oil filter service engine skyactiv severe normal interval change",
  },
  {
    id: "potholes",
    category: "Driving care",
    title: "After the pothole",
    summary: "What to check before the next stretch of road.",
    body: "When safe, stop and visually inspect the tire sidewalls and wheel for damage. A new vibration, pulling, air loss or a bent rim needs professional inspection; internal damage may not be visible. A sidewall bulge or an obviously damaged tire calls for stopping use and arranging safe assistance. Low-profile tires have less sidewall cushioning, so avoid impacts where safe. Keep placard pressures; adding extra pressure is not a reliable rim-protection strategy.",
    source: "https://www.nhtsa.gov/vehicle-safety/tires",
    reference: "NHTSA · Tire safety; general driving-care guidance",
    keywords:
      "pothole bulge sidewall damage rim low profile tire alignment vibration",
  },
  {
    id: "fuel",
    category: "My engine",
    title: "Why a tank can tell a different story",
    summary: "Read measured consumption with the right context.",
    body: "Compare complete full-to-full fuel cycles. Short trips, traffic, steep climbs, load, climate-control use and acceleration patterns can affect fuel consumption. Sport mode may change transmission behavior; there is no fixed fuel penalty to assume. A dashboard instant-MPG number is not the same measurement as average tank consumption. If consumption changes persistently under comparable conditions, check your records and seek an inspection rather than inferring a diagnosis.",
    source: "https://www.fueleconomy.gov/feg/factors.shtml",
    reference: "US Department of Energy · Factors that affect fuel economy",
    keywords: "mpg fuel economy consumption sport mountain highway traffic ac",
  },
  {
    id: "transmission",
    category: "My transmission",
    title: "Six speeds. Smooth intentions.",
    summary: "Your profile lists a 6-speed automatic transmission.",
    body: "Your vehicle profile specifies a 6-speed automatic with manual selection and Sport mode. Confirm operation against the manual and your fitted controls. Do not select Park or Reverse while moving. On steep descents, use a suitable lower gear to help control speed while staying within safe engine speeds. No automatic-transmission-fluid replacement interval is invented here; use the verified mechanical manual and qualified service advice.",
    source: root + "05020201.html",
    reference:
      "2019 Mazda3 Owner’s Manual · Automatic transaxle; verify fitted controls",
    keywords: "automatic transmission gear manual sport mountain downhill",
  },
  {
    id: "safety",
    category: "My safety systems",
    title: "Assistance, with your attention",
    summary: "Know what is fitted—and what still needs you.",
    body: "Your supplied equipment includes Blind Spot Monitoring, Rear Cross Traffic Alert and Lane Departure Warning. These assist the driver and have limitations; do not use an alert’s absence as proof that the road is clear. ABS, traction control and stability-control functions should be understood using their individual manual sections. Additional i-ACTIVSENSE equipment, adaptive cruise control and remote-start functionality are not assumed to be installed.",
    source:
      "https://www.mazdausa.com/static/manuals/2019/mazda3/contents/05010100.html",
    reference:
      "2019 Mazda3 Owner’s Manual · When Driving; equipment from your profile",
    keywords:
      "blind spot bsm cross traffic rcta lane ldw abs dsc traction safety iactivsense remote start",
  },
  {
    id: "interior",
    category: "My interior",
    title: "A cabin made for the driver",
    summary: "Black interior. Your familiar controls, documented.",
    body: "Your profile records a sunroof, Bose audio, Mazda Connect with Apple CarPlay / Android Auto, dual-zone climate control, driver memory seating, rain-sensing wipers and a rear-view camera. Exact button sequences depend on the fitted equipment and Mazda Connect version. Upload the relevant handbook to retrieve an instruction with its page reference. No navigation PDF has been supplied yet; a navigation document will never be used as evidence for mechanical service specifications.",
    source: "https://www.mazdausa.com/owners/how-to-use-my-mazda",
    reference:
      "Vehicle profile · user-provided equipment; Mazda owner resources",
    keywords:
      "sunroof bose climate memory seat infotainment navigation carplay android interior black acc ignition on",
  },
  {
    id: "warnings",
    category: "My dashboard",
    title: "When a warning needs a safe stop",
    summary:
      "Oil pressure, overheating, brakes and damaged tires deserve prompt attention.",
    body: "If you suspect low oil pressure, overheating or a serious brake problem, stop in a safe place and follow the exact warning procedure in your owner’s manual. Arrange professional assistance if safe operation is uncertain. Do not open a hot cooling system. Text descriptions or warning-light photos alone cannot confirm the cause; the assistant must not claim a diagnosis.",
    source:
      "https://www.mazdausa.com/static/manuals/2019/mazda3/contents/08070300.html",
    reference:
      "2019 Mazda3 Owner’s Manual · Warning/indicator lights and warning sounds",
    keywords:
      "warning dashboard overheating oil pressure brake abs stop urgent coolant",
  },
  {
    id: "engine",
    category: "My engine",
    title: "Understanding your SKYACTIV-G",
    summary:
      "A naturally aspirated 2.5-liter gasoline engine, from your profile.",
    body: "SKYACTIV-G is Mazda’s gasoline engine family. Your supplied configuration is the naturally aspirated 2.5-liter version, approximately 186 hp. Allow gentle driving while the engine warms rather than demanding high load from cold. Follow the correct engine’s manual for fluid grades, capacities, warning indicators and maintenance. This app has no connected engine sensors and cannot report live temperature, oil condition or mechanical health.",
    source: "https://www.mazdausa.com/why-mazda/skyactiv",
    reference:
      "Mazda · SKYACTIV technology; engine specification supplied by owner",
    keywords:
      "skyactiv g engine power cold warm start naturally aspirated gasoline",
  },
  {
    id: "long-trip",
    category: "Driving care",
    title: "Before the road opens up",
    summary: "A calm, practical long-trip checklist.",
    body: "Check cold tire pressures and visible tire condition; inspect the spare or repair kit if fitted. Check oil and coolant levels using the owner’s manual’s safe procedure. Test lights, wipers and washer fluid. Bring suitable emergency equipment and relevant documents. After demanding mountain driving, pay attention to brake changes, smells or vibration and arrange inspection when needed. This checklist is preparation, not a certification that the vehicle is safe.",
    source: "https://www.nhtsa.gov/summer-driving-tips",
    reference: "NHTSA · Road-trip preparation; general advisory checklist",
    keywords:
      "long trip highway mountain steep road brakes wipers lights emergency checklist",
  },
];
