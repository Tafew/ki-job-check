const {
  useState,
  useMemo
} = React;
const {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer
} = Recharts;

/* ==================================================================
   KI-CHECK für krone.at — "Trifft es Ihren Job? Und wann?"  (v2)

   Modellstand: alle fünf Papers der Serie Bauer (2026).
     LCS  — Kipppunkt: ab wann das Ergebnis nichts mehr verrät
     FaS  — Skill-Dynamik, Rettungswahrscheinlichkeit ρ(s)
     IW   — Berufsvektoren (Tab. 4), Numeraire v = 1 ≡ EUR 5.000
     3C   — θ_eff = θ0(1 − ξκ(g)); Fenster statt Schwelle; AT: § 1336 Abs. 2 ABGB
     ItF  — Kapazitätsillusion: Ĉ = W + (1+λ)mK; v_max = θ_eff·Ĉ/ζ

   Jurisdiktion: Österreich.
   Numerische Selbstprüfung siehe VERIFY unten.
   ================================================================== */

/* ---------- Farben (krone-Hausfarben, unverändert aus v1) ---------- */
const K = {
  red: "#E30613",
  dark: "#141414",
  paper: "#FFFFFF",
  bg: "#F4F4F4",
  gray: "#6B6B6B",
  line: "#E3E3E3",
  green: "#1E8A4C",
  greenSoft: "#E2F2E8",
  amber: "#F5A800",
  amberSoft: "#FFF3D6",
  redSoft: "#FCE3E5",
  slate: "#2F3A44",
  slateSoft: "#E7EBEE"
};

/* ================= Modellkonstanten mit Quelle ================= */

const EUR_PER_UNIT = 5000; // IW §5.1: Numeraire v = 1 ≡ EUR 5.000

// 3C Anhang B — Vertragsstrafen-Multiplikator je Jurisdiktion
const M_PENALTY_AT = 1.5; // Österreich, § 1336 Abs. 2 ABGB; Bandbreite 1,2–2,0
const M_PENALTY_AT_LO = 1.2; // unteres Ende der vertretbaren Bandbreite

// 3C Bem. 9 / Prop. 10 — Monokultur-Pfad
const KAPPA_0 = 0.60; // Kim et al. (2025), Fehlerübereinstimmung
const KAPPA_BAR = 1.0; // konservativer Benchmark; Schwellen skalieren mit 1/κ̄
const DELTA_M = 0.30; // angenommen; δ = 0 ist die Falsifikations-Null
const B_CAP = 0.28; // Tempo des Fähigkeitswachstums

// ItF Tab. 3 — Versicherungsseite
const LAMBDA = 0.25; // Versicherungszuschlag
const ZETA = 0.80; // Anteil des abgeschöpften Überschusses
const M_DAGGER = 0.193; // Mindest-Prüfschärfe, damit überhaupt zertifiziert wird
/* ItFs Baseline W = 1,20 / K = 1,80 ist auf ein generisches Ticket v̄ ≈ 1 kalibriert und
   lässt sich nicht auf Berufe mit dreifachem Ticket übertragen. Wir binden die Aufteilung
   stattdessen an die berufsspezifische Solvenzgrenze L̄ aus IW Tab. 4, mit dem Eigen-
   kapitalanteil aus 3C Anhang B ("L̄ own capital = 0.15 L̄"). Bei L̄ = 3,0 ergibt das
   W = 0,45 und K = 2,55; Struktur und Sätze der ItF-Theoreme bleiben unberührt. */
const OWN_SHARE = 0.15;
const C0_ENFORCE = 0.25; // Prozesskostenblock des Klienten (Serien-Baseline)

/* ---------- Die fünf Papers, auf denen der Simulator rechnet ----------
   Die Leseransicht nennt nur Überprüfbares: die erschienene Arbeit mit Fundstelle,
   die übrigen als Vorabdruck mit arXiv-Kennung. Wird eine Arbeit angenommen:
   status auf "peer" setzen, cite füllen, url auf die Verlags-DOI. */
const PAPERS = [{
  n: 1,
  short: "LCS",
  title: "The Last Costly Signal",
  sub: "Warum man Qualität am Ergebnis nicht mehr erkennt",
  url: "https://doi.org/10.3390/g17050049",
  linkLabel: "Games 17(5), 49 · doi:10.3390/g17050049",
  status: "peer",
  arxiv: "2607.26327"
}, {
  n: 2,
  short: "FaS",
  title: "The Fallback as Signal",
  sub: "Warum Haftung zeigt, wer im Ernstfall übernehmen kann",
  url: "https://arxiv.org/abs/2608.04276",
  linkLabel: "arXiv:2608.04276",
  status: "preprint"
}, {
  n: 3,
  short: "IW",
  title: "The Institutional Window",
  sub: "Woher die Werte der einzelnen Berufe stammen",
  url: "https://arxiv.org/abs/2608.05969",
  linkLabel: "arXiv:2608.05969",
  status: "preprint"
}, {
  n: 4,
  short: "3C",
  title: "Three Ceilings",
  sub: "Die drei Grenzen, an denen ein Haftungsversprechen scheitert",
  url: "https://arxiv.org/abs/2609.26141",
  linkLabel: "arXiv:2609.26141",
  status: "preprint"
}, {
  n: 5,
  short: "ItF",
  title: "Insuring the Fallback",
  sub: "Wann eine Versicherung das Versprechen glaubwürdig macht",
  url: "https://arxiv.org/abs/2609.26172",
  linkLabel: "arXiv:2609.26172",
  status: "preprint"
}];
/* ---------- Studien, die im Text vorkommen ---------- */
const STUDIEN = [{
  autor: "Veracode",
  titel: "Spring 2026 GenAI Code Security Update",
  jahr: "März 2026",
  url: "https://www.veracode.com/blog/spring-2026-genai-code-security/"
}, {
  autor: "Moura, Matuschek, Toffalini & Noller",
  titel: "Newer and Bigger, but Safer?",
  jahr: "arXiv:2610.08240, Oktober 2026",
  url: "https://arxiv.org/abs/2610.08240"
}];
const STATUS_LABEL = {
  peer: {
    text: "begutachtet erschienen",
    bg: "#E2F2E8",
    fg: "#1E8A4C"
  },
  preprint: {
    text: "Vorabdruck",
    bg: "#E7EBEE",
    fg: "#2F3A44"
  }
};

/* ---------- Prüfschärfe-Stufen (ItF, m) ---------- */
const AUDIT_LEVELS = {
  blind: {
    m: 0.00,
    label: "Prüft gar nicht",
    sub: "Police, keine Kontrolle"
  },
  spot: {
    m: 0.45,
    label: "Stichproben",
    sub: "ItF-Baseline m = 0,45"
  },
  full: {
    m: 1.00,
    label: "Laufende Prüfung",
    sub: "Vollaudit"
  }
};

/* ================= Berufe ================= */
/* cal: "IW"  = Berufsvektor aus IW Tabelle 4 (kalibriert)
   cal: "ord" = ordinal eingeordnet, nicht kalibriert — im Text ausgewiesen
   channel: "markt" | "dritterZahler" | "marke"                            */

const JOBS = {
  webdesign: {
    icon: "🖥️",
    name: "Webdesign & IT",
    cal: "IW",
    channel: "markt",
    p: {
      alpha: 0.88,
      pi: 0.30,
      phi: 0.60,
      gamma: 0.55,
      theta0: 0.80,
      rhoMax: 0.85,
      a: 0.55,
      vBar: 1.0,
      Lsolv: 3.0
    },
    einstiegVerbaut: true,
    fact: "Brynjolfsson, Chandar & Chen (2025) werten Lohndaten von 4,6 Millionen Beschäftigten aus: bei den 22- bis 25-Jährigen in KI-exponierten Berufen sank die Beschäftigung relativ um 16 Prozent, bei Softwareentwicklern um rund 20 Prozent.",
    fact2: "Veracode ließ im März 2026 aktuelle Modelle 80 Programmieraufgaben lösen. 45 Prozent des Codes enthielt eine bekannte Sicherheitslücke, bei Java 71 Prozent. Syntaktisch korrekt waren über 95 Prozent — der Code sieht gut aus. Eine Untersuchung von 32 Modellen aus sieben Familien kommt im Oktober 2026 zu dem Schluss: Neuere Modelle werden sicherer, der Rückstand bei der Sicherheit bleibt. Der Simulator rechnet mit einer niedrigeren Fehlerquote als Veracode misst."
  },
  steuer: {
    icon: "🧾",
    name: "Steuerberatung",
    cal: "ord",
    channel: "markt",
    p: {
      alpha: 0.85,
      pi: 0.15,
      phi: 0.50,
      gamma: 0.30,
      theta0: 0.80,
      rhoMax: 0.90,
      a: 0.50,
      vBar: 1.0,
      Lsolv: 3.0
    },
    einstiegVerbaut: false,
    fact: "Hier ist alles dokumentiert: Wer einen Fehler macht, haftet nachweisbar. Genau das macht erfahrene Köpfe wertvoller, je besser die KI wird.",
    fact2: "Achtung: Für diesen Beruf gibt es noch keine eigene Berechnung. Die Werte sind geschätzt."
  },
  medizin: {
    icon: "🩻",
    name: "Radiologie & Medizin",
    cal: "IW",
    channel: "markt",
    p: {
      alpha: 0.90,
      pi: 0.10,
      phi: 0.40,
      gamma: 0.45,
      theta0: 0.70,
      rhoMax: 0.88,
      a: 0.45,
      vBar: 3.0,
      Lsolv: 4.0
    },
    einstiegVerbaut: false,
    fact: "Dratsch et al. (2023): Lag der KI-Vorschlag falsch, brach der Anteil korrekt beurteilter Mammographien bei unerfahrenen Befundern von 79,7 auf 19,8 Prozent ein. Die Maschine zieht den Menschen mit.",
    fact2: "Die vieldiskutierte Darmspiegelungs-Studie (Budzyń et al. 2025) fand einen Rückgang der Adenom-Entdeckung um 6,0 Prozentpunkte — ihre ursächliche Deutung ist in Fachkorrespondenz bestritten, die Arbeit trägt ein Korrigendum. Sie stützt hier nur die Richtung, nicht die Größe."
  },
  recht: {
    icon: "⚖️",
    name: "Rechtsberatung",
    cal: "IW",
    channel: "markt",
    p: {
      alpha: 0.82,
      pi: 0.25,
      phi: 0.45,
      gamma: 0.35,
      theta0: 0.50,
      rhoMax: 0.90,
      a: 0.50,
      vBar: 2.5,
      Lsolv: 4.0
    },
    einstiegVerbaut: true,
    fact: "Magesh et al. (2025) prüften juristische KI-Werkzeuge vorregistriert: 17 Prozent erfundene Inhalte bei Lexis+ AI, 33 Prozent bei Westlaw. Allgemeine Sprachmodelle lagen bei 58 bis 88 Prozent (Dahl et al. 2024).",
    fact2: "Der wunde Punkt ist nicht die Fehlerquote, sondern der Nachweis: Dass ein Rat den Schaden verursacht hat, ist vor Gericht regelmäßig strittig."
  },
  pruefung: {
    icon: "📊",
    name: "Wirtschaftsprüfung",
    cal: "IW",
    channel: "markt",
    p: {
      alpha: 0.85,
      pi: 0.20,
      phi: 0.50,
      gamma: 0.30,
      theta0: 0.85,
      rhoMax: 0.90,
      a: 0.50,
      vBar: 3.0,
      Lsolv: 5.0
    },
    einstiegVerbaut: true,
    fact: "Von allen untersuchten Berufen ist hier der Fehlernachweis am leichtesten: Regulierte Arbeitspapiere, Prüfungsstandards, externe Inspektionen. Das ist der Grund, warum die Garantie hier am längsten trägt.",
    fact2: "Gegenläufig wirkt die gesetzliche Haftungsbegrenzung für Abschlussprüfer — sie deckelt genau das Versprechen, das den Nachweis wert wäre. [Redaktion: österreichische Fundstelle vor Druck prüfen.]"
  },
  sozial: {
    icon: "🤝",
    name: "Sozialarbeit & Pflege",
    cal: "IW",
    channel: "dritterZahler",
    p: {
      alpha: 0.35,
      pi: 0.35,
      phi: 0.20,
      gamma: 0.30,
      theta0: 0.25,
      rhoMax: 0.60,
      a: 0.50,
      vBar: 8.0,
      Lsolv: 0.5
    },
    einstiegVerbaut: false,
    fact: "Moore et al. (2025): Beratungs-Chatbots reagierten in rund 20 Prozent der Krisenszenarien unsicher, menschliche Therapeuten in 7 Prozent.",
    fact2: "Entscheidend ist aber die Rechnung dahinter: Der Schaden, um den es geht, liegt um eine Größenordnung über dem Honorar — die Fachleistungsstunde wird mit etwa 55 Euro verrechnet. Wer bezahlt, ist nicht, wer betroffen ist."
  },
  lehrer: {
    icon: "🧑‍🏫",
    name: "Lehrer:in",
    cal: "ord",
    channel: "dritterZahler",
    p: {
      alpha: 0.50,
      pi: 0.45,
      phi: 0.70,
      gamma: 0.40,
      theta0: 0.30,
      rhoMax: 0.85,
      a: 0.50,
      vBar: 1.0,
      Lsolv: 1.0
    },
    einstiegVerbaut: false,
    fact: "Bastani et al. (2025): Ein KI-Tutor ohne Schutzplanken senkte die spätere Prüfungsleistung der Schüler um 17 Prozent — die Maschine wurde zur Krücke. Mit eingebauten Leitplanken kehrte sich der Effekt um.",
    fact2: "Für diesen Beruf gibt es noch keine eigene Berechnung. Die Werte sind geschätzt.",
    verdicts: {
      start: {
        tone: "ok",
        badge: "JOB SO GUT WIE GARANTIERT",
        text: "Ihre Stelle nimmt Ihnen keine KI weg — der Engpass im Schulsystem ist der Personalmangel, nicht die Automatisierung. Ihre echte Gefahr liegt woanders: Didaktik und Korrigieren nie richtig zu lernen, weil die KI es von Tag eins übernimmt."
      },
      mitte: {
        tone: "warn",
        badge: "SICHER — ABER DIE BEQUEMLICHKEITSFALLE LAUERT",
        text: "KI nimmt Ihnen Vorbereitung und Korrektur ab. Wer die gewonnene Zeit in die Klasse steckt, wird besser. Wer KI-Material ungeprüft ausliefert, verlernt binnen weniger Jahre genau das, was den Beruf ausmacht: den Fehler der Maschine zu erkennen."
      },
      senior: {
        tone: "ok",
        badge: "AUF DER GEWINNER-SEITE",
        text: "Ihre Rolle wandelt sich vom Wissensvermittler zum Qualitätsprüfer und Mentor. Sie kontrollieren, was die KI liefert, und geben weiter, was keine Maschine kann: Klassenführung, Beziehung, Urteilskraft."
      }
    },
    trumpf: {
      tone: "ok",
      title: "🃏 Ihr Trumpf: Kind & Klasse",
      text: /*#__PURE__*/React.createElement(React.Fragment, null, "Ein Algorithmus kann erklären — aber er kann ", /*#__PURE__*/React.createElement("b", null, "kein Kind trösten, keine Klasse führen und keine Aufsichtspflicht übernehmen"), ". Dafür haftet in der Schule der Staat, nicht die Maschine.")
    },
    tips: {
      start: ["Didaktik und Korrigieren zuerst bewusst OHNE KI üben — sonst lernen Sie das Handwerk nie.", "KI als Vorbereitungs-Turbo nutzen, die gewonnene Zeit in die Beziehung zu den Schülern stecken.", "Halluzinations- und Datenschutzkompetenz aufbauen: Sie werden die Kontrollinstanz für KI-Material."],
      mitte: ["Routine automatisieren, den Ertrag in Feedback-Qualität investieren.", "Fachliche Tiefe pflegen: Nur wer den Stoff beherrscht, erkennt die Fehler der KI.", "KI-Regeln an der Schule mitgestalten — wer die Leitplanken baut, wird unverzichtbar."],
      senior: ["Bleiben Sie selbst in der Klasse: Wer nur noch verwaltet, verliert das Gespür.", "Steuern Sie dem Können-Verlust im Kollegium aktiv entgegen — Fortbildung ist Führungsaufgabe.", "KI-Tutoring fürs Üben einsetzen, Präsenzzeit für das reservieren, was nur Menschen können."]
    }
  },
  handel: {
    icon: "🛒",
    name: "Einzelhandel",
    cal: "ord",
    channel: "marke",
    p: {
      alpha: 0.62,
      pi: 0.50,
      phi: 0.50,
      gamma: 0.55,
      theta0: 0.30,
      rhoMax: 0.55,
      a: 0.50,
      vBar: 0.05,
      Lsolv: 1.0
    },
    einstiegVerbaut: true,
    fact: "Im Handel haftet nicht die einzelne Verkäuferin, sondern die Marke — über Umtausch und Gewährleistung. Deshalb greift der Mechanismus dieses Simulators hier nicht: Es gibt kein persönliches Qualitätsversprechen, das man einklagen könnte.",
    fact2: "Für diesen Beruf gibt es noch keine eigene Berechnung. Die Werte sind geschätzt.",
    verdicts: {
      start: {
        tone: "alarm",
        badge: "JETZT BETROFFEN — AN DER KASSA",
        text: "Kassieren und Regale schlichten trifft es zuerst: Es sind die am besten automatisierbaren Tätigkeiten im Handel. Ihr Ausweg hat einen Namen: Beratung. Wechseln Sie so früh wie möglich ins beratungsintensive Segment — Elektro, Sport, Mode, Drogerie."
      },
      mitte: {
        tone: "warn",
        badge: "ES ENTSCHEIDET IHRE ROLLE",
        text: "Der Handel spaltet sich: Der reine Kassenplatz verschwindet, die gute Beratung wird zum Grund, warum Kunden überhaupt noch ins Geschäft kommen. Wer heute von der Kassa in die Fachberatung wechselt, steht in fünf Jahren auf der sicheren Seite."
      },
      senior: {
        tone: "ok",
        badge: "RELATIV SICHER — ALS GASTGEBER:IN",
        text: "Filialleitung, Personalführung, Warenwirtschaft und lokale Stammkundschaft kann kein Automat übernehmen. Ihre Aufgabe wird größer. Sie bauen das Geschäft vom Abverkaufsort zum Beratungsort um. Und holen Ihr Team rechtzeitig von der Kassa in den Service."
      }
    },
    trumpf: {
      tone: "warn",
      title: "🃏 Ihr Trumpf: die Beratung",
      text: /*#__PURE__*/React.createElement(React.Fragment, null, "Ein Automat kann kassieren, aber ", /*#__PURE__*/React.createElement("b", null, "nicht beraten"), ". Für Sie persönlich haftet niemand — Qualität verspricht im Handel die Marke. Ihr Unterscheidungsmerkmal sind Sie selbst: echte Empfehlung, Warenkunde, Vertrauen.")
    },
    tips: {
      start: ["Bewusst in ein beratungsintensives Segment gehen — nicht Discounter-Kassa.", "Warenkunde und Verkaufsgespräch vertiefen — das ist Ihr Schutzschild.", "Digitale Skills mitnehmen: Kassensystem, Online-Bestellung, Retouren."],
      mitte: ["Vom Kassieren zur Beratung entwickeln — aktiv einfordern, nicht warten.", "Stammkunden aufbauen: Menschen kommen wegen Menschen wieder.", "Zusatzqualifikation holen — das öffnet die Tür zur Leitung."],
      senior: ["Die Filiale als Beratungsort positionieren — das ist das einzige Argument gegen online.", "Personal von der Kassa in den Service umschichten statt abbauen.", "Nachwuchs ausbilden: Beratungs-Könner werden knapp."]
    }
  }
};

/* ---------- Karrierestufen ---------- */
const LEVELS = {
  start: {
    icon: "🐣",
    name: "Am Anfang",
    sub: "Lehre, Studium, erste Jahre",
    sFrac: 0.18,
    story: "Ersetzt werden Sie nicht. Sie kommen nur schwerer hinein. Die einfachen Aufgaben, an denen man das Handwerk früher gelernt hat, erledigt heute die Maschine."
  },
  mitte: {
    icon: "💼",
    name: "Mitten drin",
    sub: "ca. 5–15 Jahre",
    sFrac: 0.55,
    story: "Sie haben Substanz. Ob sie hält, entscheidet sich in den nächsten Jahren — je nachdem, wie viel Sie noch selbst machen."
  },
  senior: {
    icon: "🎓",
    name: "Alter Hase",
    sub: "15+ Jahre, Leitung",
    sFrac: 0.80,
    story: "Ihr Können für den Ernstfall ist derzeit das Wertvollste am Markt. Es rostet aber, wenn Sie es nicht mehr benutzen."
  }
};

/* ================= Modellkern ================= */

/* FaS Gl. (1): Rettungswahrscheinlichkeit */
const rho = (s, p, alpha) => {
  const x = Math.min(Math.max(s, 0), alpha - 1e-6) / alpha;
  return p.rhoMax * Math.pow(Math.max(x, 0), p.a);
};

/* 3C Bem. 9: Fähigkeitspfad. g ∈ [0,6] ist der Regler des Lesers. */
const piOf = (p, g) => p.pi * Math.exp(-B_CAP * g); // π(g) = π₀e^(−bg)
const kappaOf = g => KAPPA_BAR - (KAPPA_BAR - KAPPA_0) * Math.exp(-DELTA_M * g);
/* Brücke zwischen den Papers: IW indexiert Fähigkeit über α, 3C über g.
   Wir koppeln beide monoton mit demselben b. Das ist eine Annahme dieses
   Widgets, keine Aussage der Papers — im Methodenkasten ausgewiesen. */
const alphaOf = (p, g) => p.alpha + (0.98 - p.alpha) * (1 - Math.exp(-B_CAP * g));

/* 3C Prop. 10: zustandsabhängige Nachweisbarkeit */
const thetaEffOf = (p, xi, g) => p.theta0 * (1 - xi * kappaOf(g));

/* ItF Thm. 2: effektive informationelle Kapazität Ĉ = W + (1+λ)mK */
const cHat = (Lsolv, m) => {
  const W = OWN_SHARE * Lsolv,
    Kc = Lsolv - W;
  return W + (1 + LAMBDA) * m * Kc;
};

/* ItF Prop. 3 (bei d = 0): größtes noch trennbar bedienbares Ticket */
const vMaxOf = (thEff, Lsolv, m) => thEff * cHat(Lsolv, m) / ZETA;

/* Durchsetzungsboden: die erwartete Entschädigung θ_eff·π·L bei
   abschreckungsadäquater Zusage L = v/θ_eff ist π·v; sie muss c₀ übersteigen. */
const vMinOf = (p, g) => C0_ENFORCE / Math.max(piOf(p, g), 1e-6);

/* 3C Prop. 11 / IW Gl. (8): Mäßigungsbedingung. Größenunabhängig. */
const penaltyHolds = (thEff, mPen) => thEff >= 1 / mPen;
const xiCritical = (p, mPen) => 1 - 1 / (mPen * p.theta0); // 3C Tab. 1, bei κ̄ = 1

/* ---------- Persönliche Simulation: 8 Jahre, zwei Zukünfte ---------- */
const KAPPA_T = 1 / 12;
const marktwert = (s, p, alpha) => Math.round(rho(s, p, alpha) / p.rhoMax * 100);
const skillStep = (s, h, p, alpha, pi) => {
  const nx = s + KAPPA_T * (alpha - s) * (1 - pi) * (p.phi * pi * h - p.gamma * (1 - h));
  return Math.min(Math.max(nx, 0.005), alpha - 1e-4);
};
function runPersonal(p, sFrac, g) {
  const alpha = alphaOf(p, g),
    pi = piOf(p, g);
  const s0 = Math.max(0.03, sFrac * alpha);
  const hBleib = Math.max(Math.min(1, p.gamma / (p.gamma + p.phi * pi) + 0.1), 1 - alpha);
  const hLass = Math.max(0.05, 1 - alpha);
  let sB = s0,
    sL = s0;
  const out = [{
    jahr: 0,
    bleib: marktwert(s0, p, alpha),
    lass: marktwert(s0, p, alpha)
  }];
  for (let t = 1; t <= 96; t++) {
    sB = skillStep(sB, hBleib, p, alpha, pi);
    sL = skillStep(sL, hLass, p, alpha, pi);
    if (t % 3 === 0) out.push({
      jahr: +(t / 12).toFixed(2),
      bleib: marktwert(sB, p, alpha),
      lass: marktwert(sL, p, alpha)
    });
  }
  return out;
}
function betroffenAb(sim) {
  const start = sim[0].lass;
  const limit = Math.max(30, Math.round(start * 0.55));
  if (start <= limit) return 0;
  const hit = sim.find(d => d.lass <= limit);
  return hit ? Math.max(1, Math.round(hit.jahr)) : null;
}

/* ---------- Ampel je Beruf × Stufe ---------- */
function verdictFor(jobKey, levelKey, jahre) {
  const job = JOBS[jobKey];
  if (job.verdicts && job.verdicts[levelKey]) return job.verdicts[levelKey];
  if (job.channel === "dritterZahler") {
    return {
      tone: "ok",
      badge: "KAUM BETROFFEN",
      text: "Ihre Arbeit ist der Mensch, nicht das Formular. Den Papierkram nimmt Ihnen die KI ab. Den Rest nicht. Ihr Engpass bleibt das fehlende Personal."
    };
  }
  if (levelKey === "start") {
    return job.einstiegVerbaut ? {
      tone: "alarm",
      badge: "JETZT BETROFFEN",
      text: "Die Einstiegsstufe bricht gerade weg, nicht erst in ein paar Jahren. Die Routineaufgaben, über die man früher ins Handwerk kam, macht die Maschine. Wer jetzt anfängt, muss sich das Üben erkämpfen: Praxis einfordern, KI-Fehler selbst nachrechnen, einen Mentor suchen."
    } : {
      tone: "warn",
      badge: `IN CA. ${Math.max(2, jahre || 3)} JAHREN SPÜRBAR`,
      text: "Die geregelte Ausbildung schützt Sie noch. Die Übungsfälle werden aber weniger, weil die KI sie wegschnappt. Entscheidend ist, ob Sie in der Ausbildung noch selbst ran dürfen."
    };
  }
  if (levelKey === "mitte") {
    return {
      tone: "warn",
      badge: jahre ? `IN CA. ${jahre} JAHREN ENTSCHEIDET ES SICH` : "OFFENES RENNEN",
      text: "Sie haben Substanz. Von selbst hält sie nicht. Wer jetzt alles der KI überlässt, steht in wenigen Jahren wieder auf Einsteigerniveau. Wer dranbleibt, wächst in die Rolle hinein, die am besten bezahlt wird: die Person, die übernimmt, wenn die Maschine patzt."
    };
  }
  return {
    tone: "ok",
    badge: "AUF DER GEWINNER-SEITE — MIT EINEM ABER",
    text: `Je besser die KI wird, desto seltener braucht man Sie. Und desto teurer werden Sie, wenn man Sie braucht. Dafür müssen Sie am Fall bleiben. Sonst rostet auch ein großer Vorsprung${jahre ? `, im Simulator in rund ${jahre} Jahren` : ""}. Und Ihr Können muss sich beweisen lassen. Darum geht es im nächsten Kasten.`
  };
}
const TIPS = {
  start: ["Fordern Sie echte Praxis ein: Fälle selbst lösen, danach mit der KI vergleichen — nicht umgekehrt.", "Fragen Sie schon im Bewerbungsgespräch, wie die Ausbildung konkret abläuft. Wer ausweicht, bildet nicht aus.", "Lernen Sie, was die KI nicht kann: ihren Fehler erkennen. Das ist der neue Lehrberuf."],
  mitte: ["Reservieren Sie fixe Zeiten, in denen Sie alles selbst machen. Können hält sich nur, wenn Sie es benutzen.", "Gehen Sie dorthin, wo gehaftet wird: Freigaben, Abnahmen, Unterschriften.", "Prüfen Sie KI-Ergebnisse stichprobenartig komplett selbst — das hält scharf."],
  senior: ["Bleiben Sie am Fall: Wer nur noch delegiert, verliert genau das, wofür man Sie bezahlt.", "Geben Sie Wissen weiter — Nachwuchs, der übernehmen kann, wird Mangelware.", "Machen Sie Ihre Verantwortung sichtbar: Garantie, Unterschrift, Haftung."]
};

/* ================= UI-Bausteine ================= */
const Card = ({
  children,
  style
}) => /*#__PURE__*/React.createElement("div", {
  className: "rounded-xl p-4",
  style: {
    background: K.paper,
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
    ...style
  }
}, children);
const Verdict = ({
  tone,
  title,
  children
}) => {
  const map = {
    ok: {
      bg: K.greenSoft,
      bar: K.green
    },
    warn: {
      bg: K.amberSoft,
      bar: K.amber
    },
    alarm: {
      bg: K.redSoft,
      bar: K.red
    },
    neutral: {
      bg: K.slateSoft,
      bar: K.slate
    }
  }[tone];
  return /*#__PURE__*/React.createElement("div", {
    className: "rounded-xl p-4",
    style: {
      background: map.bg,
      borderLeft: `5px solid ${map.bar}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-extrabold text-sm uppercase tracking-wide",
    style: {
      color: map.bar
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    className: "text-sm mt-1",
    style: {
      color: K.dark
    }
  }, children));
};
const eurFmt = x => `${Math.round(x).toLocaleString("de-AT")} €`;

/* ---------- Quellenliste mit Links ---------- */
const Refs = () => /*#__PURE__*/React.createElement("ol", {
  className: "grid gap-3 mt-2",
  style: {
    listStyle: "none",
    padding: 0
  }
}, PAPERS.map(r => {
  const s = STATUS_LABEL[r.status];
  return /*#__PURE__*/React.createElement("li", {
    key: r.short,
    className: "flex gap-2 items-baseline"
  }, /*#__PURE__*/React.createElement("span", {
    className: "headline text-xs",
    style: {
      color: K.red,
      minWidth: 14
    }
  }, r.n), /*#__PURE__*/React.createElement("span", {
    className: "text-xs",
    style: {
      color: K.dark
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: r.url,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "font-bold underline",
    style: {
      color: K.dark
    }
  }, r.title), /*#__PURE__*/React.createElement("span", {
    className: "ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap",
    style: {
      background: s.bg,
      color: s.fg
    }
  }, s.text), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      color: K.gray
    }
  }, r.sub), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("a", {
    href: r.url,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "underline",
    style: {
      color: K.red
    }
  }, r.linkLabel), r.status === "peer" && r.arxiv && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: K.gray
    }
  }, " · Vorabdruck "), /*#__PURE__*/React.createElement("a", {
    href: `https://arxiv.org/abs/${r.arxiv}`,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "underline",
    style: {
      color: K.gray
    }
  }, "arXiv:", r.arxiv))));
}));

/* ---------- Studienliste, bewusst schlicht ---------- */
const Studien = () => /*#__PURE__*/React.createElement("ul", {
  className: "grid gap-1 mt-2",
  style: {
    listStyle: "none",
    padding: 0
  }
}, STUDIEN.map(r => /*#__PURE__*/React.createElement("li", {
  key: r.url,
  className: "text-xs",
  style: {
    color: K.gray
  }
}, /*#__PURE__*/React.createElement("a", {
  href: r.url,
  target: "_blank",
  rel: "noopener noreferrer",
  className: "underline",
  style: {
    color: K.gray
  }
}, r.autor, ": ", r.titel), " (", r.jahr, ")")));

/* ---------- Signature: das Garantie-Fenster ---------- */
const AX_LO = 500,
  AX_HI = 200000;
const pos = eur => {
  const c = Math.min(Math.max(eur, AX_LO), AX_HI);
  return (Math.log(c) - Math.log(AX_LO)) / (Math.log(AX_HI) - Math.log(AX_LO)) * 100;
};
function WindowBand({
  vMinEur,
  vMaxEur,
  ticketEur,
  open
}) {
  const l = pos(vMinEur),
    r = pos(vMaxEur);
  const ticks = [1000, 5000, 20000, 100000];
  return /*#__PURE__*/React.createElement("div", {
    className: "mt-1"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      height: 62
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 16,
      left: 0,
      right: 0,
      height: 26,
      background: K.line,
      borderRadius: 6
    }
  }), open && r > l && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 16,
      left: `${l}%`,
      width: `${Math.max(r - l, 0.8)}%`,
      height: 26,
      background: K.green,
      borderRadius: 6
    }
  }), !open && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 16,
      left: 0,
      right: 0,
      height: 26,
      borderRadius: 6,
      background: `repeating-linear-gradient(45deg, ${K.redSoft}, ${K.redSoft} 7px, ${K.paper} 7px, ${K.paper} 14px)`,
      border: `2px solid ${K.red}`
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 6,
      left: `${pos(ticketEur)}%`,
      transform: "translateX(-50%)",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] font-bold whitespace-nowrap",
    style: {
      color: K.dark
    }
  }, "Ihr Auftrag"), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 2,
      height: 44,
      background: K.dark,
      margin: "0 auto"
    }
  })), ticks.map(t => /*#__PURE__*/React.createElement("div", {
    key: t,
    style: {
      position: "absolute",
      top: 46,
      left: `${pos(t)}%`,
      transform: "translateX(-50%)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-[10px]",
    style: {
      color: K.gray
    }
  }, t >= 1000 ? `${t / 1000}k` : t)))), open && /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between text-[11px] mt-3",
    style: {
      color: K.gray
    }
  }, /*#__PURE__*/React.createElement("span", null, "Darunter lohnt das Klagen nicht: ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: K.dark
    }
  }, eurFmt(vMinEur))), /*#__PURE__*/React.createElement("span", null, "Darüber reicht die Deckung nicht: ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: K.dark
    }
  }, eurFmt(vMaxEur)))));
}

/* ================= Hauptkomponente ================= */
function KroneJobCheck() {
  const [jobKey, setJobKey] = useState("webdesign");
  const [levelKey, setLevelKey] = useState("mitte");
  const [gIdx, setGIdx] = useState(0.5); // KI-Fähigkeit, g ∈ [0,6] — Start: heute
  const [xi, setXi] = useState(0.15); // Modell-Monokultur ξ ∈ [0,1]
  const [auditKey, setAuditKey] = useState("spot");
  const job = JOBS[jobKey],
    level = LEVELS[levelKey],
    p = job.p;
  const g = gIdx,
    m = AUDIT_LEVELS[auditKey].m;
  const sim = useMemo(() => runPersonal(p, level.sFrac, g), [p, level, g]);
  const jahre = useMemo(() => betroffenAb(sim), [sim]);
  const last = sim[sim.length - 1];
  const verdict = verdictFor(jobKey, levelKey, jahre);
  const diff = last.bleib - last.lass;
  const thEff = thetaEffOf(p, xi, g);
  const hasMarket = job.channel === "markt";
  const penOK = penaltyHolds(thEff, M_PENALTY_AT);
  const penOKlo = penaltyHolds(thEff, M_PENALTY_AT_LO);
  const auditOK = m >= M_DAGGER;
  const vMinEur = vMinOf(p, g) * EUR_PER_UNIT;
  const vMaxEur = vMaxOf(thEff, p.Lsolv, m) * EUR_PER_UNIT;
  const ticketEur = p.vBar * EUR_PER_UNIT;
  const gainEur = (vMaxOf(thEff, p.Lsolv, 1) - vMaxOf(thEff, p.Lsolv, 0)) * EUR_PER_UNIT;
  /* ξ*, ab dem die Mäßigungsbedingung kippt — auf den aktuellen κ(g) umgerechnet */
  const xiStar = Math.max(xiCritical(p, M_PENALTY_AT), 0) / kappaOf(g);
  const bandOK = vMaxEur > vMinEur;
  const open = hasMarket && penOK && auditOK && bandOK;
  const inWindow = open && ticketEur >= vMinEur && ticketEur <= vMaxEur;
  const alphaPct = Math.round(alphaOf(p, g) * 100);
  const piPct = Math.round(piOf(p, g) * 100);
  return /*#__PURE__*/React.createElement("div", {
    className: "min-h-screen pb-10",
    style: {
      background: K.bg,
      color: K.dark,
      fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    }
  }, /*#__PURE__*/React.createElement("style", null, `
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap');
        .headline{font-family:'Archivo Black','Arial Black',system-ui,sans-serif;letter-spacing:-0.5px}
        input[type=range]{height:6px}
        button:focus-visible{outline:3px solid #141414;outline-offset:2px}
      `), /*#__PURE__*/React.createElement("header", {
    style: {
      background: K.red
    },
    className: "px-4 py-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "max-w-xl mx-auto flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "headline text-white text-lg"
  }, "KI-CHECK"), /*#__PURE__*/React.createElement("span", {
    className: "text-white text-xs opacity-90"
  }, "· Was heißt das für MICH?"))), /*#__PURE__*/React.createElement("main", {
    className: "max-w-xl mx-auto px-4"
  }, /*#__PURE__*/React.createElement("h1", {
    className: "headline text-3xl mt-5 leading-tight"
  }, "Trifft es Ihren Job?", /*#__PURE__*/React.createElement("br", null), "Und wann?"), /*#__PURE__*/React.createElement("p", {
    className: "text-sm mt-2",
    style: {
      color: K.gray
    }
  }, "Die KI trifft nicht jeden Beruf gleich hart. Bei den 22- bis 25-Jährigen in KI-nahen Berufen ist die Beschäftigung bereits um 16 Prozent gesunken. Ältere Kollegen spüren bisher wenig. Wählen Sie Ihren Beruf und Ihre Erfahrungsstufe. Dann sehen Sie, wann es bei Ihnen so weit ist. Und welche drei Schritte ab morgen helfen."), /*#__PURE__*/React.createElement("div", {
    className: "mt-5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "headline text-sm",
    style: {
      color: K.red
    }
  }, "1 · IHR BERUF"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-2 mt-2"
  }, Object.entries(JOBS).map(([k, j]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => setJobKey(k),
    className: "rounded-xl p-3 text-left",
    style: {
      background: k === jobKey ? K.dark : K.paper,
      color: k === jobKey ? "#fff" : K.dark,
      boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      border: k === jobKey ? `2px solid ${K.red}` : "2px solid transparent"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xl"
  }, j.icon), /*#__PURE__*/React.createElement("div", {
    className: "font-bold text-sm leading-tight mt-1"
  }, j.name))))), /*#__PURE__*/React.createElement("div", {
    className: "mt-5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "headline text-sm",
    style: {
      color: K.red
    }
  }, "2 · WO STEHEN SIE?"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-3 gap-2 mt-2"
  }, Object.entries(LEVELS).map(([k, l]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => setLevelKey(k),
    className: "rounded-xl p-3 text-center",
    style: {
      background: k === levelKey ? K.dark : K.paper,
      color: k === levelKey ? "#fff" : K.dark,
      boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      border: k === levelKey ? `2px solid ${K.red}` : "2px solid transparent"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xl"
  }, l.icon), /*#__PURE__*/React.createElement("div", {
    className: "font-bold text-xs leading-tight mt-1"
  }, l.name), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] mt-0.5",
    style: {
      color: k === levelKey ? "#ddd" : K.gray
    }
  }, l.sub)))), /*#__PURE__*/React.createElement("p", {
    className: "text-xs mt-2 italic",
    style: {
      color: K.gray
    }
  }, level.story)), /*#__PURE__*/React.createElement("div", {
    className: "mt-5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "headline text-sm",
    style: {
      color: K.red
    }
  }, "3 · WIE SEHEN SIE DIE ZUKUNFT?"), /*#__PURE__*/React.createElement(Card, {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "block"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between text-sm font-bold"
  }, /*#__PURE__*/React.createElement("span", null, "Wie weit kommt die KI noch?"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: K.red
    }
  }, alphaPct, " %")), /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: K.gray
    }
  }, "So viel Ihrer Arbeit schafft die Maschine allein. Patzen tut sie dann nur noch in ", piPct, " Prozent der Fälle. Genau diese Fälle sind das Problem."), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: 0,
    max: 6,
    step: 0.5,
    value: gIdx,
    onChange: e => setGIdx(parseFloat(e.target.value)),
    className: "w-full mt-2",
    style: {
      accentColor: K.red
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between text-[10px]",
    style: {
      color: K.gray
    }
  }, /*#__PURE__*/React.createElement("span", null, "heute"), /*#__PURE__*/React.createElement("span", null, "weit fortgeschritten"))), /*#__PURE__*/React.createElement("label", {
    className: "block mt-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between text-sm font-bold"
  }, /*#__PURE__*/React.createElement("span", null, "Wie viele arbeiten mit demselben KI-Modell?"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: K.red
    }
  }, Math.round(xi * 100), " %")), /*#__PURE__*/React.createElement("div", {
    className: "text-xs",
    style: {
      color: K.gray
    }
  }, "Auch der Gutachter, der den Fehler finden soll, arbeitet damit. Nutzt er dieselbe Maschine, übersieht er dasselbe."), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: 0,
    max: 100,
    step: 5,
    value: Math.round(xi * 100),
    onChange: e => setXi(parseInt(e.target.value) / 100),
    className: "w-full mt-2",
    style: {
      accentColor: K.red
    }
  })))), /*#__PURE__*/React.createElement("div", {
    className: "mt-5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "headline text-sm",
    style: {
      color: K.red
    }
  }, "4 · WAS AUF SIE ZUKOMMT"), /*#__PURE__*/React.createElement("div", {
    className: "mt-2"
  }, /*#__PURE__*/React.createElement(Verdict, {
    tone: verdict.tone,
    title: verdict.badge
  }, verdict.text)), /*#__PURE__*/React.createElement(Card, {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-bold text-sm mb-1"
  }, "Ihre zwei Zukünfte"), /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-2",
    style: {
      color: K.gray
    }
  }, "Ihr Marktwert = wie gut Sie übernehmen können, wenn die KI patzt."), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 210
    }
  }, /*#__PURE__*/React.createElement(ResponsiveContainer, null, /*#__PURE__*/React.createElement(LineChart, {
    data: sim,
    margin: {
      top: 5,
      right: 10,
      bottom: 0,
      left: -15
    }
  }, /*#__PURE__*/React.createElement(CartesianGrid, {
    stroke: K.line,
    strokeDasharray: "2 4"
  }), /*#__PURE__*/React.createElement(XAxis, {
    dataKey: "jahr",
    tick: {
      fontSize: 11,
      fill: K.gray
    },
    ticks: [2, 4, 6, 8],
    label: {
      value: "Jahre ab heute",
      position: "insideBottomRight",
      dy: 8,
      fontSize: 11,
      fill: K.gray
    }
  }), /*#__PURE__*/React.createElement(YAxis, {
    domain: [0, 100],
    tick: {
      fontSize: 11,
      fill: K.gray
    },
    unit: "%"
  }), /*#__PURE__*/React.createElement(Tooltip, {
    formatter: (v, n) => [`${v} %`, n],
    labelFormatter: l => `in ${l} Jahren`,
    contentStyle: {
      fontSize: 12
    }
  }), /*#__PURE__*/React.createElement(Legend, {
    wrapperStyle: {
      fontSize: 12
    }
  }), /*#__PURE__*/React.createElement(ReferenceLine, {
    y: 45,
    stroke: K.gray,
    strokeDasharray: "4 3",
    label: {
      value: "kritisch",
      fontSize: 10,
      fill: K.gray,
      position: "insideLeft"
    }
  }), /*#__PURE__*/React.createElement(Line, {
    dataKey: "bleib",
    name: "Sie bleiben dran",
    stroke: K.green,
    strokeWidth: 3,
    dot: false,
    isAnimationActive: false
  }), /*#__PURE__*/React.createElement(Line, {
    dataKey: "lass",
    name: "Sie lassen die KI machen",
    stroke: K.red,
    strokeWidth: 3,
    dot: false,
    isAnimationActive: false
  })))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-3 gap-2 mt-2 text-center"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "headline text-xl",
    style: {
      color: K.green
    }
  }, last.bleib, "%"), /*#__PURE__*/React.createElement("div", {
    className: "text-[11px]",
    style: {
      color: K.gray
    }
  }, "in 8 J., dranbleiben")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "headline text-xl",
    style: {
      color: K.red
    }
  }, last.lass, "%"), /*#__PURE__*/React.createElement("div", {
    className: "text-[11px]",
    style: {
      color: K.gray
    }
  }, "in 8 J., abgeben")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "headline text-xl",
    style: {
      color: K.dark
    }
  }, diff > 0 ? `+${diff}` : diff), /*#__PURE__*/React.createElement("div", {
    className: "text-[11px]",
    style: {
      color: K.gray
    }
  }, "Punkte — Ihre Entscheidung"))))), /*#__PURE__*/React.createElement("div", {
    className: "mt-5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "headline text-sm",
    style: {
      color: K.red
    }
  }, "5 · LÄSST SICH IHR KÖNNEN BEWEISEN?"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs mt-1",
    style: {
      color: K.gray
    }
  }, "Können, das niemand nachprüfen kann, wird auch nicht bezahlt. Es bleibt ein einziger Beweis: ein einklagbares Versprechen. Wir haften, wenn es schiefgeht. Das funktioniert aber nur bei bestimmten Auftragsgrößen."), hasMarket ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Card, {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-bold text-sm"
  }, "Prüft der Versicherer den Anbieter?"), /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-2",
    style: {
      color: K.gray
    }
  }, "Eine Police allein sagt nichts. Glaubwürdig wird das Versprechen erst, wenn der Versicherer den Anbieter auch prüft."), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-3 gap-2"
  }, Object.entries(AUDIT_LEVELS).map(([k, a]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => setAuditKey(k),
    className: "rounded-lg p-2 text-center",
    style: {
      background: k === auditKey ? K.slate : K.bg,
      color: k === auditKey ? "#fff" : K.dark,
      border: k === auditKey ? `2px solid ${K.slate}` : `1px solid ${K.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-bold text-[11px] leading-tight"
  }, a.label))))), /*#__PURE__*/React.createElement(Card, {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-bold text-sm mb-1"
  }, "Das Garantie-Fenster"), /*#__PURE__*/React.createElement("div", {
    className: "text-xs mb-1",
    style: {
      color: K.gray
    }
  }, "Auftragsgröße in Euro. Im grünen Bereich trägt ein Haftungsversprechen."), /*#__PURE__*/React.createElement(WindowBand, {
    vMinEur: vMinEur,
    vMaxEur: vMaxEur,
    ticketEur: ticketEur,
    open: open
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-2 mt-2"
  }, !penOK ? /*#__PURE__*/React.createElement(Verdict, {
    tone: "alarm",
    title: "✖ Fenster geschlossen — der Beweis fehlt"
  }, "Bei ", Math.round(xi * 100), " % gemeinsamem KI-Modell sinkt die Nachweisbarkeit auf ", Math.round(thEff * 100), " %. Um das auszugleichen, müsste die Vertragsstrafe das ", (1 / thEff).toFixed(1), "-fache des Auftragswerts betragen — mehr, als ein österreichisches Gericht nach ", /*#__PURE__*/React.createElement("b", null, "§ 1336 Abs. 2 ABGB"), " stehen ließe. Für diesen Beruf kippt das Fenster ab rund ", /*#__PURE__*/React.createElement("b", null, Math.round(Math.max(xiStar, 0) * 100), " % Modell-Gleichheit"), ". Ihr Können ist dann nicht weniger wert — es ist nur nicht mehr beweisbar. Und das ist wirtschaftlich dasselbe.") : !auditOK ? /*#__PURE__*/React.createElement(Verdict, {
    tone: "alarm",
    title: "✖ Fenster geschlossen — niemand schaut hin"
  }, "Ein Versicherer, der nicht prüft, macht das Versprechen nicht glaubwürdiger. Es bleibt dann nur, wofür der Anbieter selbst geradesteht — und das trägt hier bloß bis ", eurFmt(vMaxEur), ", also unter die Grenze, ab der sich das Klagen überhaupt lohnt. Die Police ist nicht wertlos: Sie zahlt. Aber sie beweist nichts.") : !bandOK ? /*#__PURE__*/React.createElement(Verdict, {
    tone: "alarm",
    title: "✖ Fenster geschlossen — es bleibt nichts dazwischen"
  }, "Unter ", eurFmt(vMinEur), " lohnt der Streit nicht, über ", eurFmt(vMaxEur), " reicht die Deckung nicht. Dazwischen bleibt kein einziger Auftrag übrig. Eine schärfere Prüfung durch den Versicherer würde das Fenster wieder aufziehen.") : /*#__PURE__*/React.createElement(Verdict, {
    tone: inWindow ? "ok" : "warn",
    title: inWindow ? "✓ Ihr typischer Auftrag liegt im Fenster" : "⚠ Ihr typischer Auftrag liegt außerhalb"
  }, "Unter ", eurFmt(vMinEur), " kostet das Einklagen mehr, als herauskommt — da wird nicht gestritten, also auch nichts bewiesen. Über ", eurFmt(vMaxEur), " übersteigt die nötige Zusage, was gedeckt ist. Typischer Auftrag in Ihrer Branche: ", /*#__PURE__*/React.createElement("b", null, eurFmt(ticketEur)), ".", !penOKlo && " Am unteren Rand der juristisch vertretbaren Bandbreite des Mäßigungsrechts wäre das Fenster bereits zu."), /*#__PURE__*/React.createElement(Verdict, {
    tone: "neutral",
    title: "💡 Woran man einen ernsten Anbieter erkennt"
  }, "Nicht an der Höhe der Deckungssumme. Würde der Versicherer seine Kapazität verfünfzigfachen, ohne hinzuschauen, änderte das am Fenster ", /*#__PURE__*/React.createElement("b", null, "keinen einzigen Euro"), ". Erst laufende Prüfung macht daraus echte Glaubwürdigkeit — in dieser Rechnung ", /*#__PURE__*/React.createElement("b", null, eurFmt(Math.max(gainEur, 0))), " zusätzlich bedienbarer Auftragswert."))) : /*#__PURE__*/React.createElement("div", {
    className: "mt-2"
  }, /*#__PURE__*/React.createElement(Verdict, {
    tone: "neutral",
    title: "Bei Ihnen gibt es dieses Fenster nicht"
  }, job.channel === "dritterZahler" ? /*#__PURE__*/React.createElement(React.Fragment, null, "Wer bezahlt, ist hier nicht, wer betroffen ist: Es zahlen Ämter, Kassen und Träger, gehaftet wird über den Staat. Ein Qualitätsversprechen an eine budgetgebundene Behörde erreicht niemanden, der dafür zahlen würde. Ihr Wert entsteht deshalb nicht über Haftung, sondern über die Beziehung — und der Personalmangel schützt Sie mehr als jeder Vertrag.") : /*#__PURE__*/React.createElement(React.Fragment, null, "Im Handel haftet die Marke, nicht die Person hinter der Budel. Umtausch und Gewährleistung sind Versprechen des Unternehmens. Ihr Unterscheidungsmerkmal ist deshalb nicht Haftung, sondern Beratung — und die ist genau das, was der Automat nicht kann.")))), /*#__PURE__*/React.createElement("div", {
    className: "mt-5 grid gap-2"
  }, job.trumpf && /*#__PURE__*/React.createElement(Verdict, {
    tone: job.trumpf.tone,
    title: job.trumpf.title
  }, job.trumpf.text), !job.trumpf && hasMarket && /*#__PURE__*/React.createElement(Verdict, {
    tone: "ok",
    title: "🃏 Ihr Trumpf: die Haftung"
  }, "In Ihrem Beruf muss am Ende jemand geradestehen, mit Unterschrift und Haftung. KI-Ergebnisse sehen immer perfekt aus, die guten wie die schlechten. Es zählt dann nur noch ein Qualitätsbeweis:", /*#__PURE__*/React.createElement("b", null, " ein Mensch, der im Ernstfall übernimmt und dafür haftet.")), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "font-bold text-sm mb-2"
  }, "✅ Ihre 3 Schritte ab morgen"), /*#__PURE__*/React.createElement("ol", {
    className: "text-sm grid gap-2",
    style: {
      listStyle: "none",
      padding: 0
    }
  }, (job.tips && job.tips[levelKey] || TIPS[levelKey]).map((t, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "headline",
    style: {
      color: K.red
    }
  }, i + 1), /*#__PURE__*/React.createElement("span", null, t))))), /*#__PURE__*/React.createElement(Verdict, {
    tone: "ok",
    title: "🔎 Aus der Forschung"
  }, job.fact), job.fact2 && /*#__PURE__*/React.createElement(Verdict, {
    tone: "neutral",
    title: "Einordnung"
  }, job.fact2)), /*#__PURE__*/React.createElement("details", {
    className: "mt-5"
  }, /*#__PURE__*/React.createElement("summary", {
    className: "font-bold text-sm cursor-pointer",
    style: {
      color: K.red
    }
  }, "Woher kommen diese Zahlen?"), /*#__PURE__*/React.createElement(Card, {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-sm"
  }, "Wenn die KI fast alles erledigt, sieht jedes Ergebnis perfekt aus — man erkennt Qualität nicht mehr am Produkt. Bezahlt wird dann für etwas anderes: ", /*#__PURE__*/React.createElement("b", null, "für Menschen, die übernehmen können, wenn die KI patzt."), " ", "Dieses Können ist wie ein Muskel; es wächst nur an echten Fällen und schwindet, wenn die Maschine alles macht. Deshalb trifft es Einsteiger zuerst, die Mitte als Nächstes, und erfahrene Kräfte können sogar profitieren."), /*#__PURE__*/React.createElement("p", {
    className: "text-sm mt-2"
  }, "Damit dieses Können bezahlt wird, muss es aber beweisbar sein. Drei Grenzen stehen dem entgegen: Bei kleinen Aufträgen kostet das Einklagen mehr, als herauskommt. Bei großen übersteigt das nötige Versprechen, was gedeckt ist. Und quer dazu: Je ähnlicher sich die KI-Modelle werden, desto häufiger hat der Gutachter denselben blinden Fleck wie die geprüfte Maschine — dann lässt sich der Fehler nicht mehr nachweisen, und ein österreichisches Gericht würde die Vertragsstrafe, die das ausgleichen müsste, nach § 1336 Abs. 2 ABGB mäßigen."), /*#__PURE__*/React.createElement("p", {
    className: "text-xs mt-3",
    style: {
      color: K.gray
    }
  }, "Vereinfachte Darstellung einer wirtschaftswissenschaftlichen Modellserie von Andreas Bauer (2026). Die Grundarbeit der Reihe ist begutachtet in ", /*#__PURE__*/React.createElement("i", null, "Games"), " erschienen; die vier weiteren liegen als Vorabdruck auf arXiv, mit öffentlichem Rechenpaket. Wo der Simulator auf einem Vorabdruck steht, steht er auf einer Arbeit, die noch keine Begutachtung durchlaufen hat. Berufswerte für Webdesign, Radiologie, Rechtsberatung, Wirtschaftsprüfung und Sozialarbeit aus der Berufstabelle des dritten Papiers; Steuerberatung, Lehrberuf und Handel sind nur der Größenordnung nach eingeordnet und im Text als solche gekennzeichnet. Bezugsgröße: ein Auftrag von 5.000 Euro. Der Regler „Wie weit kommt die KI noch?\" verbindet zwei Papiere über eine Zusatzannahme dieses Simulators. Modell-Illustration, keine Prognose für einzelne Personen oder Betriebe."), /*#__PURE__*/React.createElement("div", {
    className: "mt-3 pt-3",
    style: {
      borderTop: `1px solid ${K.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "headline text-xs",
    style: {
      color: K.red
    }
  }, "ZUM NACHLESEN"), /*#__PURE__*/React.createElement(Refs, null), /*#__PURE__*/React.createElement("div", {
    className: "headline text-xs mt-4",
    style: {
      color: K.red
    }
  }, "STUDIEN IM TEXT"), /*#__PURE__*/React.createElement(Studien, null))))));
}

/* ================= VERIFY =========================================
   1) Struktur gegen ItF Kor. 2 (dessen Baseline W = 1,20; K = 1,80; θ = 0,60; ζ = 0,80):
        m = 0    → Ĉ = 1,2000 → v_max = 0,9000   ✓
        m = 0,45 → Ĉ = 2,2125 → v_max = 1,6594   ✓
        m = 1    → Ĉ = 3,4500 → v_max = 2,5875   ✓
        K = 100 bei m = 0 → v_max = 0,9000       ✓ Kapazitätsillusion
      Das Widget setzt W = 0,15·L̄ und K = 0,85·L̄ je Beruf (3C Anhang B) statt der
      generischen ItF-Werte; Formeln und Sätze sind identisch, nur die Skala ist
      berufsspezifisch.

   2) 3C Tab. 1 / IW Tab. 3 — Mäßigungsbedingung θ_eff ≥ 1/m, Österreich m = 1,5:
        Webdesign  θ0 = 0,80  1/θ = 1,25  hält, kippt ab ξκ > 0,167
        Prüfung    θ0 = 0,85  1/θ = 1,18  hält, kippt ab ξκ > 0,216
        Radiologie θ0 = 0,70  1/θ = 1,43  hält nur bei ξ ≈ 0
        Recht      θ0 = 0,50  1/θ = 2,00  hält nie
        Sozial     θ0 = 0,25  1/θ = 4,00  hält nie
      Deckt sich mit IW Tab. 3 (dort für UK/US gerechnet).

   3) Zustände bei Voreinstellung g = 0,5, ξ = 0,15, m = 0,45:
        Webdesign  4.793 – 8.495 € offen, Auftrag 5.000 € liegt drin
        Prüfung    7.189 – 15.044 € offen, Auftrag 15.000 € liegt drin
        Steuer     leeres Fenster, öffnet bei Vollprüfung
        Radiologie / Recht / Sozial: Mäßigung
      Bei m = 0 schließen alle sechs — die Kapazitätsillusion wird sichtbar.
   ================================================================= */

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(KroneJobCheck));
