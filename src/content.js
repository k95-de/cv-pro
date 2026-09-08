/* ============================================================================
   THE FLOW — content
   Every word on the site, English + German. Khaled: edit here, reload.

   Per station:
     kind : "edu" | "job" | "venture" | "training" | "upcoming"
     gate : "start" (red) | "done" (green)  — degree gates; they also tint the pipe
     s    : where the CARD sits along the scroll      (0..1)
     t    : where the JUNCTION sits along the 3D pipe (0..1)
     mode : background scene + card illustration      (src/scenes.js, src/viz.js)

   OPEN VERSION — the pipe ends after Study & Growth (no Habmann / BVS).
   Dates follow APPLY/KA.pdf.
   ========================================================================== */
window.CV = {

  meta: {
    name: "Khaled Abdelhadi",
    tagline: {
      en: "Mechanical Engineer — 3 Languages, 2 Degrees, 1 Long Curiosity",
      de: "Maschinenbauingenieur — 3 Sprachen, 2 Abschlüsse, 1 lange Neugier"
    },
    intro: {
      en: "A career as one flow. Ride the coolant through the pipe — every junction is a step.",
      de: "Ein Werdegang als eine Strömung. Fließe mit dem Kühlmittel durch das Rohr — jede Verzweigung ist ein Schritt."
    }
  },

  ui: {
    scroll:    { en: "Scroll",           de: "Scrollen" },
    loading:   { en: "Priming the flow", de: "Strömung wird vorbereitet" },
    soundOn:   { en: "Sound on",         de: "Ton an" },
    soundOff:  { en: "Sound off",        de: "Ton aus" },
    downloadCV:{ en: "Download CV",      de: "Lebenslauf (PDF)" },
    replay:    { en: "Back to start",    de: "Zum Anfang" },
    upcoming:  { en: "To be started",    de: "Demnächst" },
    positions: { en: "The route",        de: "Die Route" },
    gateStart: { en: "Gate opens",       de: "Tor öffnet" },
    gateDone:  { en: "Gate passed",      de: "Tor durchquert" },
    hudStart:  { en: "The Flow",         de: "The Flow" },
    hudEnd:    { en: "Flow continues",   de: "Strömung geht weiter" },
    prev:      { en: "Previous station", de: "Vorherige Station" },
    next:      { en: "Next station",     de: "Nächste Station" },
    keys:      { en: "↑ ↓ to travel · M for sound", de: "↑ ↓ zum Reisen · M für Ton" },
    copyLink:  { en: "Copy link",        de: "Link kopieren" },
    copied:    { en: "Copied ✓",         de: "Kopiert ✓" },
    statJobs:  { en: "positions",        de: "Stationen" },
    statDegrees:{ en: "degrees",         de: "Abschlüsse" },
    statSpan:  { en: "the journey",      de: "die Reise" }
  },

  stations: [
    {
      kind: "edu", gate: "start", mode: "iso", s: 0.105, t: 0.030,
      years: "2013–15", dur: { en: "2013 – Summer 2015 · 4 semesters", de: "2013 – Sommer 2015 · 4 Semester" },
      org: { en: "Bachelor's begins", de: "Bachelor beginnt" },
      place: { en: "Middle East Technical University · Northern Cyprus Campus",
               de: "Middle East Technical University · Northern-Cyprus-Campus" },
      role: { en: "Mechanical Engineering · 4 semesters", de: "Maschinenbau · 4 Semester" }
    },
    {
      kind: "edu", mode: "iso", s: 0.158, t: 0.090,
      years: "2015–18", dur: { en: "2015 – 2018 · 3 yrs", de: "2015 – 2018 · 3 Jahre" },
      org: { en: "Transfer to Alfaisal", de: "Wechsel zur Alfaisal" },
      place: { en: "Alfaisal University · Riyadh", de: "Alfaisal University · Riad" },
      role: { en: "Mechanical Engineering continues", de: "Maschinenbau geht weiter" }
    },
    {
      kind: "job", mode: "aero", img: "assets/jobs/aero.webp", tools: ["PTC Creo","CNC","CFRP layup","Tensile testing"], s: 0.211, t: 0.150,
      years: "2016–18", dur: { en: "Jun 2016 – Jun 2018 · 2 yrs", de: "Juni 2016 – Juni 2018 · 2 Jahre" },
      org: "Shell Eco Marathon Asia",
      place: { en: "Singapore", de: "Singapur" },
      role: { en: "CFRP Design & Manufacturing Student",
              de: "Werkstudent — CFK-Konstruktion & Fertigung" },
      bullets: {
        en: ["Designed the vehicle body in Creo and built carbon-fibre moulds from CNC-machined foam.",
             "Led the composite lay-up and curing of a monocoque shell, proven by tensile testing."],
        de: ["Fahrzeugkarosserie in Creo konstruiert und CFK-Formen aus CNC-gefrästem Schaum gebaut.",
             "Composite-Lay-up und Aushärtung eines Monocoques geleitet, durch Zugversuche nachgewiesen."]
      }
    },
    {
      kind: "job", mode: "mold", img: "assets/jobs/mold.webp", tools: ["PTC Creo","CNC","Plastic-flow simulation","Steel moulds"], s: 0.264, t: 0.210,
      years: "2017–18", dur: { en: "Jul 2017 – Jan 2018 · 7 mos", de: "Juli 2017 – Jan. 2018 · 7 Monate" },
      org: "Alfanar Electric",
      place: { en: "Riyadh, Saudi Arabia", de: "Riad, Saudi-Arabien" },
      role: { en: "Plastic Mould Design & Manufacturing Student",
              de: "Werkstudent — Kunststoff-Werkzeugbau & Fertigung" },
      bullets: {
        en: ["Designed and machined steel injection moulds in PTC Creo and programmed the CNC.",
             "Ran plastic-flow simulations to find and remove common moulding defects."],
        de: ["Stahl-Spritzgusswerkzeuge in PTC Creo konstruiert und gefertigt, CNC programmiert.",
             "Kunststoff-Fließsimulationen durchgeführt, um typische Gussfehler zu finden und zu beheben."]
      }
    },
    {
      kind: "edu", gate: "done", mode: "iso", s: 0.317, t: 0.270,
      years: "2018",
      org: { en: "B.Sc. Mechanical Engineering", de: "B.Sc. Maschinenbau" },
      place: { en: "Alfaisal University · Riyadh", de: "Alfaisal University · Riad" },
      role: { en: "Bachelor's completed", de: "Bachelor abgeschlossen" }
    },
    {
      kind: "edu", gate: "start", mode: "iso", s: 0.370, t: 0.330,
      years: "2019",
      org: { en: "Master's begins", de: "Master beginnt" },
      place: { en: "Esslingen University · Germany", de: "Hochschule Esslingen · Deutschland" },
      role: { en: "Design & Development — Mechanical & Automotive Engineering",
              de: "Design & Development — Mechanical & Automotive Engineering" }
    },
    {
      kind: "job", mode: "battery", img: "assets/jobs/battery.webp", tools: ["JIRA","ASPICE / V-cycle","BMS","Project KPIs"], s: 0.423, t: 0.390,
      years: "2020", dur: { en: "Jan 2020 – Aug 2020 · 8 mos", de: "Jan. 2020 – Aug. 2020 · 8 Monate" },
      org: "A123 Systems",
      place: { en: "Stuttgart, Germany", de: "Stuttgart, Deutschland" },
      role: { en: "Engineering Development & Management Student",
              de: "Werkstudent — Entwicklung & Projektmanagement" },
      bullets: {
        en: ["Built project KPIs from JIRA tickets across the V-cycle (ASPICE) phases for milestone forecasting.",
             "Analysed the battery-management hardware/software architecture and the mechanical pack design."],
        de: ["Projekt-KPIs aus JIRA-Tickets über die V-Modell-Phasen (ASPICE) für die Meilenstein-Prognose aufgebaut.",
             "Hardware-/Software-Architektur des Batteriemanagements und das mechanische Pack-Design analysiert."]
      }
    },
    {
      kind: "job", mode: "stress", img: "assets/jobs/stress.webp", tools: ["Altair HyperWorks","FEA","CFRP monocoque","BOM"], s: 0.476, t: 0.450,
      years: "2020", dur: { en: "Mar 2020 – Aug 2020 · 6 mos", de: "März 2020 – Aug. 2020 · 6 Monate" },
      org: "Esslingen Rennstall",
      place: { en: "Esslingen, Germany", de: "Esslingen, Deutschland" },
      role: { en: "CFRP Monocoque Structure — Simulation Member",
              de: "CFK-Monocoque-Struktur — Simulationsmitglied" },
      bullets: {
        en: ["Optimised the CFRP monocoque in Altair HyperWorks — less weight, more torsional stiffness.",
             "Delivered a production-ready BOM and 2D drawings for the next chassis generation."],
        de: ["CFK-Monocoque in Altair HyperWorks optimiert — weniger Gewicht, mehr Torsionssteifigkeit.",
             "Fertigungsreife Stückliste und 2D-Zeichnungen für die nächste Chassis-Generation geliefert."]
      }
    },
    {
      kind: "job", mode: "emotor", img: "assets/jobs/emotor.webp", tools: ["GT-SUITE","3D→1D","Oil circuit","Drive-cycle validation"], s: 0.529, t: 0.510,
      years: "2020–21", dur: { en: "Oct 2020 – Mar 2021 · 6 mos", de: "Okt. 2020 – März 2021 · 6 Monate" },
      org: "MAN Truck & Bus",
      place: { en: "Nuremberg, Germany", de: "Nürnberg, Deutschland" },
      role: { en: "1D Simulation Student — E-Motor Cooling",
              de: "Werkstudent 1D-Simulation — E-Motor-Kühlung" },
      bullets: {
        en: ["Built a bus e-motor 1D thermal model in GT-SUITE from scratch, including the oil circuit.",
             "Converted 3D geometry to 1D and validated transient results against drive-cycle test data."],
        de: ["1D-Thermomodell eines Bus-E-Motors in GT-SUITE von Grund auf aufgebaut, inkl. Ölkreislauf.",
             "3D-Geometrie nach 1D überführt und transiente Ergebnisse gegen Fahrzyklus-Messdaten validiert."]
      }
    },
    {
      kind: "edu", gate: "done", mode: "iso", s: 0.582, t: 0.570,
      years: "2021",
      org: { en: "M.Eng. Mechanical & Automotive Engineering", de: "M.Eng. Mechanical & Automotive Engineering" },
      place: { en: "Esslingen University · Germany", de: "Hochschule Esslingen · Deutschland" },
      role: { en: "Master's completed", de: "Master abgeschlossen" }
    },
    {
      kind: "job", mode: "flux", img: "assets/jobs/flux.webp", tools: ["ANSYS Maxwell","GT-SUITE","Loss maps","Hotspots"], s: 0.635, t: 0.630,
      years: "2021–22", dur: { en: "Dec 2021 – May 2022 · 6 mos", de: "Dez. 2021 – Mai 2022 · 6 Monate" },
      org: "MAN Truck & Bus",
      place: { en: "Nuremberg, Germany", de: "Nürnberg, Deutschland" },
      role: { en: "1D / 2D Simulation Engineer — E-Motor Cooling",
              de: "1D-/2D-Simulationsingenieur — E-Motor-Kühlung" },
      bullets: {
        en: ["Simulated e-motor electromagnetics in ANSYS Maxwell and calibrated GT thermal models with AUDI-Toolbox loss maps.",
             "Found critical hotspots, demagnetisation risk and previously uncovered system losses."],
        de: ["E-Motor-Elektromagnetik in ANSYS Maxwell simuliert und GT-Thermomodelle mit AUDI-Toolbox-Verlustkarten kalibriert.",
             "Kritische Hotspots, Entmagnetisierungsrisiko und bislang nicht erfasste Systemverluste identifiziert."]
      }
    },
    {
      kind: "job", mode: "network", img: "assets/jobs/bus.webp", tools: ["GT-SUITE","3D CFD validation","Pump sizing","Cooling circuits"], s: 0.688, t: 0.690,
      years: "2022–25", dur: { en: "May 2022 – Apr 2025 · 3 yrs", de: "Mai 2022 – Apr. 2025 · 3 Jahre" },
      org: "MAN Truck & Bus",
      place: { en: "Nuremberg, Germany", de: "Nürnberg, Deutschland" },
      role: { en: "1D Simulation Engineer — Vehicle Cooling Systems",
              de: "1D-Simulationsingenieur — Fahrzeug-Kühlsysteme" },
      bullets: {
        en: ["Led thermal simulations for electric and diesel truck cooling in GT, validated against 3D CFD and physical tests.",
             "Optimised pump sizing and operating points across interconnected circuits — battery, HV, cabin, refrigerant."],
        de: ["Thermische Simulationen für E- und Diesel-Lkw-Kühlung in GT geleitet, gegen 3D-CFD und Messungen validiert.",
             "Pumpenauslegung und Betriebspunkte über vernetzte Kreisläufe optimiert — Batterie, HV, Kabine, Kältemittel."]
      }
    },
    {
      kind: "job", mode: "network", img: "assets/jobs/network.webp", tools: ["GT-SUITE","Variant sub-models","Methodology","Team onboarding"], s: 0.741, t: 0.750,
      years: "2025–26", dur: { en: "Apr 2025 – Feb 2026 · 11 mos", de: "Apr. 2025 – Feb. 2026 · 11 Monate" },
      org: "TRATON R&D Germany",
      place: { en: "Nuremberg, Germany", de: "Nürnberg, Deutschland" },
      role: { en: "1D Simulation Expert — Vehicle Cooling Systems",
              de: "1D-Simulationsexperte — Fahrzeug-Kühlsysteme" },
      bullets: {
        en: ["Owned the interconnected cooling system end to end — battery, HV components, cabin, refrigerant.",
             "Documented the simulation methodology now used across the team; mentored new engineers."],
        de: ["Das vernetzte Kühlsystem ganzheitlich verantwortet — Batterie, HV-Komponenten, Kabine, Kältemittel.",
             "Die heute teamweit genutzte Simulationsmethodik dokumentiert; neue Ingenieure eingearbeitet."]
      }
    },
    {
      kind: "edu", mode: "training", img: "assets/jobs/ai.webp", tools: ["AI tools & automation","Project management","Sales operations"], s: 0.794, t: 0.810,
      years: "2026", dur: { en: "Mar 2026 – Aug 2026 · 6 mos", de: "März 2026 – Aug. 2026 · 6 Monate" },
      org: { en: "Study & Growth", de: "Studium & Weiterentwicklung" },
      place: { en: "Self-study & continuous improvement", de: "Selbststudium & kontinuierliche Verbesserung" },
      role: { en: "AI · Project Management · Sales Operations",
              de: "KI · Projektmanagement · Sales Operations" },
      bullets: {
        en: ["Deepened practical AI skills — modern tools, workflows and automation.",
             "Sharpened project-management and sales-operations fundamentals for the move into technology sales."],
        de: ["Praktische KI-Kompetenzen vertieft — moderne Tools, Workflows und Automatisierung.",
             "Grundlagen in Projektmanagement und Sales Operations für den Wechsel in den Technologievertrieb geschärft."]
      }
    },
    {
      kind: "training", gate: "train", mode: "training", s: 0.847, t: 0.870,
      years: "2026", dur: { en: "Sep 2026 – Dec 2026 · 4 mos", de: "Sep. 2026 – Dez. 2026 · 4 Monate" },
      org: "Habmann",
      place: { en: "Professional training", de: "Weiterbildung" },
      role: { en: "Tech sales & consulting", de: "Technischer Vertrieb & Beratung" }
    },
    {
      kind: "upcoming", mode: "bvs", img: "assets/jobs/bvs.webp", s: 0.900, t: 0.930,
      years: { en: "from 2027", de: "ab 2027" },
      org: "BVS",
      place: { en: "Egypt", de: "Ägypten" },
      role: { en: "Technology Sales Consultant", de: "Technology Sales Consultant" },
      bullets: {
        en: ["Bringing a simulation engineer's habit of proof to the customer side of technology.",
             "The flow keeps moving — this junction is being built right now."],
        de: ["Die Beweis-Denke eines Simulationsingenieurs auf die Kundenseite der Technologie bringen.",
             "Die Strömung bleibt in Bewegung — diese Verzweigung entsteht gerade."]
      }
    }
  ],
  outro: {
    kicker: { en: "The flow continues", de: "Die Strömung geht weiter" },
    line:   { en: "A flow never stops — it finds new paths. Still curious, still building, already tracing the next challenge.",
              de: "Eine Strömung hört nie auf — sie findet neue Wege. Immer neugierig, immer am Bauen, schon auf dem Weg zur nächsten Herausforderung." },
    location: { en: "German-Egyptian Citizen · Arabic / English / German",
                de: "Deutsch-ägyptische Staatsangehörigkeit · Arabisch / Englisch / Deutsch" },
    email: "kabdelhadi795@gmail.com",
    linkedin: "linkedin.com/in/khaled-de",
    linkedinUrl: "https://www.linkedin.com/in/khaled-de",
    phone: "+49 176 66955398"
  }
};
