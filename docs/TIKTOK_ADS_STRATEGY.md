# TikTok Ads – Kampagnenstrategie für Temu Affiliate Funnel

> **Landingpage:** deals.dropcharge.io
> **Pixel:** TikTok Pixel aktiv
> **Custom Event:** `ClickTemu`
> **Zielgruppe:** 18–35, Budget Shopper / Gamer / Deal Hunter
> **Startbudget:** 60 € / Tag

---

## 1. Kampagnenstruktur

```
Kampagne: [CBO] Temu Deals – Prospecting
├── Ad Group 1: Interest – Budget Shopper (DE/AT)
│   ├── Ad A – UGC Hook „Ich hab für 3 € …"
│   ├── Ad B – POV Shopping Haul
│   └── Ad C – Slideshow Deal Carousel
├── Ad Group 2: Interest – Gaming & Tech
│   ├── Ad A – Gamer Gadget Unboxing
│   ├── Ad B – „Bestes Gaming-Setup unter 20 €"
│   └── Ad C – Green Screen Reaction
└── Ad Group 3: Broad (kein Interest-Targeting)
    ├── Ad A – Trending Sound + Text Overlay
    ├── Ad B – „Duet-Style" Vergleich
    └── Ad C – Quick Cuts Top-5 Produkte
```

### Kampagnen-Einstellungen

| Einstellung | Wert |
|---|---|
| Kampagnentyp | Website-Conversions |
| Budgetebene | Kampagne (CBO) |
| Tagesbudget | 60 € |
| Gebotsstrategie | Lowest Cost (kein Bid Cap am Anfang) |
| Placement | TikTok only (kein Pangle) |
| Pixel | DropCharge TikTok Pixel |

### Ad-Group-Einstellungen

| Einstellung | Wert |
|---|---|
| Optimierungsevent Phase 1 | Landing Page View |
| Optimierungsevent Phase 2 | ClickTemu (Custom Event) |
| Standorte | Deutschland, Österreich |
| Alter | 18–35 |
| Sprache | Deutsch |
| Geräte | Alle (Mobile bevorzugt) |
| Tageszeit | Keine Einschränkung (Pixel lernt) |

---

## 2. Optimierungsstrategie: Landing Page View → ClickTemu

### Phase 1 – Learning (Tag 1–5): Landing Page View

- **Warum:** TikTok braucht ~50 Conversions pro Woche pro Ad Group, um die Lernphase zu verlassen. `Landing Page View` hat ein niedrigeres Conversion-Threshold → schnellere Datenbasis.
- **Ziel:** Pixel-Daten sammeln, Creative-Gewinner identifizieren, Audience aufbauen.
- **Optimierungsevent:** `Landing Page View`
- **Erwartete Kosten:** CPM 3–6 €, CPC 0,10–0,30 €

### Phase 2 – Conversion-Optimierung (ab Tag 6): ClickTemu

- **Voraussetzung:** Mindestens 50 `ClickTemu`-Events in 7 Tagen aufgelaufen.
- **Warum:** TikTok kann jetzt auf User optimieren, die tatsächlich auf die Temu-Links klicken (= wertvolles Signal).
- **Optimierungsevent:** `ClickTemu` (Custom Event)
- **Erwartete Kosten:** CPM steigt leicht (5–9 €), dafür bessere ClickTemu Rate

---

## 3. Budgetverteilung

### Phase 1 – Testing (Tag 1–7): 60 €/Tag

| Ad Group | Anteil | Budget/Tag |
|---|---|---|
| Interest – Budget Shopper | 40 % | 24 € |
| Interest – Gaming & Tech | 35 % | 21 € |
| Broad (kein Targeting) | 25 % | 15 € |

> **Hinweis:** CBO verteilt automatisch, aber diese Anteile als Mindestbudget pro Ad Group einstellen.

### Phase 2 – Optimiert (Tag 8–21): 60 €/Tag

- Killer-Ad-Groups pausieren (siehe Kill-Regeln unten).
- Budget fließt in Top 1–2 Ad Groups.
- Gewinner-Creatives in neue Ad Group duplizieren.

### Phase 3 – Skalierung (ab Tag 22): 90–150 €/Tag

- Budget schrittweise um **max. 20 % alle 2–3 Tage** erhöhen.
- Nicht sprunghaft skalieren → destabilisiert die Lernphase.

---

## 4. Wann auf ClickTemu umstellen?

Folgende Kriterien müssen **alle** erfüllt sein:

| Kriterium | Schwellenwert |
|---|---|
| Laufzeit | ≥ 5 Tage |
| ClickTemu-Events gesamt | ≥ 50 in den letzten 7 Tagen |
| Landing Page View-Rate | ≥ 70 % der Klicks |
| Keine Learning-Phase-Warnung | Pixel zeigt stabile Daten |

### Umstellungsprozess

1. Neue Ad Group erstellen (nicht bestehende ändern).
2. Gewinner-Creatives (Top 2–3 nach CTR) übernehmen.
3. Optimierungsevent auf `ClickTemu` setzen.
4. Alte Ad Groups pausieren, wenn neue stabil liefert (48 h).

---

## 5. Wann skalieren?

### Skalierungskriterien (alle müssen erfüllt sein)

| Metrik | Ziel |
|---|---|
| ROAS / ClickTemu-CPA | Unter Ziel-CPA (< 0,80 € pro ClickTemu) |
| CTR | ≥ 1,5 % über 3 Tage |
| ClickTemu Rate | ≥ 15 % der Landing Page Views |
| Lernphase | Abgeschlossen (kein „Learning" mehr) |
| Tage mit stabilem CPA | ≥ 3 aufeinanderfolgende Tage |

### Skalierungsmethoden

| Methode | Vorgehen |
|---|---|
| **Vertikale Skalierung** | Budget um 20 % alle 2–3 Tage erhöhen |
| **Horizontale Skalierung** | Gewinner-Creatives in neue Ad Groups / Audiences duplizieren |
| **Lookalike Audiences** | Custom Audience aus ClickTemu-Events → 1–3 % Lookalike erstellen |
| **Creative Refresh** | Alle 7–10 Tage neue Creatives einpflegen (Ad Fatigue vermeiden) |

---

## 6. KPI-Zielwerte

| KPI | Zielwert | Kill-Zone |
|---|---|---|
| **CPC** (Cost per Click) | 0,08–0,25 € | > 0,40 € |
| **CTR** (Click-Through Rate) | 1,5–3,0 % | < 0,8 % |
| **CPM** (Cost per Mille) | 3,00–7,00 € | > 12,00 € |
| **ClickTemu Rate** | 15–30 % der LP Views | < 8 % |
| **CPA ClickTemu** | 0,30–0,80 € | > 1,50 € |
| **LP View Rate** | ≥ 70 % der Klicks | < 50 % |

### Benchmark-Kontext

- CPM-Range für DE/AT TikTok (Budget-Nische): 4–8 €.
- CTR bei guten UGC-Ads: 1,5–4 %.
- ClickTemu Rate ist stark abhängig vom LP-Design und Deal-Qualität.

---

## 7. Kill-Regeln für Ads

### Einzelne Ads pausieren, wenn:

| Bedingung | Schwellenwert | Zeitraum |
|---|---|---|
| Spend > 5 € und CTR unter Ziel | CTR < 0,8 % | 24 h |
| Spend > 10 € und keine ClickTemu-Events | 0 ClickTemu | 48 h |
| CPC deutlich über Ziel | CPC > 0,40 € | 48 h |
| CPM explodiert | CPM > 12 € | 24 h |

### Ad Group pausieren, wenn:

| Bedingung | Schwellenwert | Zeitraum |
|---|---|---|
| Spend > 20 € und kein ClickTemu | 0 ClickTemu | 72 h |
| ClickTemu CPA dauerhaft zu hoch | CPA > 1,50 € | 5 Tage |
| Alle Ads in der Ad Group gekillt | N/A | Sofort |

### Kampagne pausieren / restructuren, wenn:

| Bedingung | Schwellenwert | Zeitraum |
|---|---|---|
| Gesamtbudget > 180 € ohne messbare ClickTemu-Events | 0 ClickTemu | 3 Tage |
| Durchschnittlicher CPM > 15 € | CPM > 15 € | 5 Tage |
| Kein Creative mit CTR > 1 % | Alle unter 1 % | 7 Tage |

---

## 8. Tägliche Routine

1. **09:00** – Daten vom Vortag prüfen (TikTok Ads Manager).
2. **Checks:** CPC, CTR, CPM, ClickTemu-Events, CPA pro Ad.
3. **Kill:** Ads unter Schwellenwerten pausieren.
4. **Shift:** Budget zu Gewinner-Ads verschieben (CBO macht das teilweise automatisch).
5. **Log:** Ergebnisse in Kampagnen-Log dokumentieren (DropCharge Admin Dashboard).

---

## Zusammenfassung: Zeitleiste

| Zeitraum | Aktion | Budget | Optimierung |
|---|---|---|---|
| Tag 1–5 | Testing: 3 Ad Groups × 3 Ads | 60 €/Tag | Landing Page View |
| Tag 6–7 | Auswertung: Killer pausieren, Gewinner identifizieren | 60 €/Tag | Landing Page View |
| Tag 8–14 | Umstellung auf ClickTemu, neue Ad Groups | 60 €/Tag | ClickTemu |
| Tag 15–21 | Optimierung, Lookalikes testen | 60 €/Tag | ClickTemu |
| Ab Tag 22 | Skalierung (20 % Budget-Erhöhung alle 2–3 Tage) | 90–150 €/Tag | ClickTemu |
