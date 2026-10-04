# 04 · Cowork tasks

Personal-capacity entry. Use only public websites and files Nasim gives you. Do not open any employer system, drive or account.
Never invent a facility, a phone number, a coordinate or a URL. If you cannot find it, write `null` and a note.

## CW1 · Datasets and licences (by 12:45)

1. Download the **Bangla Healthcare Severity Dataset**: https://data.mendeley.com/datasets/37z8kgx79m/1 (CC BY 4.0). Save the CSV as `data/raw/bangla_healthcare_severity.csv`.
2. Open **Vashantor**: https://data.mendeley.com/datasets/bj5jgk878b/2. Record the licence shown on the page. If it allows reuse, download and save under `data/raw/vashantor/`. If it does not, write "not used, licence" and stop.
3. Optional, only if Nasim asks: **Bengali Colloquial Dataset of Primary Medical Issues** https://data.mendeley.com/datasets/4tt953xwk2 (record licence).
4. Write `data/LICENCES.md`: dataset, URL, licence, size (rows), date accessed.

## CW2 · Facility data for Nazirpur, Pirojpur (by 13:30)

Goal: `data/facilities_nazirpur.json` with 4 to 8 facilities and 3 to 4 union centroids.

Facilities to find:
- Nazirpur Upazila Health Complex
- 2 to 4 community clinics in Nazirpur (for the map only, never referral targets)
- Pirojpur district hospital (exact official name)
- Sher-e-Bangla Medical College Hospital, Barishal

Where to look, in order: healthsites.io (search Pirojpur) · OpenStreetMap (search or Overpass: `healthcare=*` or `amenity=hospital|clinic` in Nazirpur) · DGHS official pages for names and phone numbers.
Union centroids: Humanitarian Data Exchange, Bangladesh administrative boundaries (union level), or OSM.

If Nazirpur has fewer than 2 facilities with coordinates, switch to Kawkhali, then Bhandaria, and tell Nasim.

Schema:
```json
{
  "upazila": "Nazirpur",
  "district": "Pirojpur",
  "facilities": [
    {
      "id": "F01",
      "name": "",
      "type": "UHC | DH | MCH | CC",
      "lat": 0.0,
      "lon": 0.0,
      "phone": null,
      "admits_dengue": "assumed",
      "admits_source": "DGHS directive: separate dengue wards in all government hospitals (news report, see 02 §3 #10)",
      "coord_source": "healthsites.io | osm | other: <url>",
      "phone_source": null,
      "verified": false
    }
  ],
  "unions": [
    {"name": "", "lat": 0.0, "lon": 0.0, "source": ""}
  ]
}
```
Rules: community clinics get `"admits_dengue": false`. Phone only from an official source, with the URL in `phone_source`.

## CW3 · Original source URLs (by 15:00)

Fill the "Status" column of `02_data_and_sources.md §3`:
- Prothom Alo article, 17 Aug 2026, "৬৪ জেলায় ডেঙ্গু, কোথায় কোথায় বেশি" (author: Shishir Moral)
- BBC Bangla article, 20 Aug 2026, "ডেঙ্গু নিয়ে ঢাকার বাইরে যে পাঁচ জেলা সবচেয়ে বেশি ঝুঁকিতে" (author: Mariam Sultana)
- BBS ICT Access and Use Survey 2025-26 report on bbs.gov.bd
- WHO 2009 dengue guideline PDF; find the Group A "daily review" sentence and its page number
- Any DGHS primary source for the 2025 death review (done: none found)

## CW4 · Crowd messages (rolling, close at 15:15)

Nasim forwards WhatsApp replies. For each:
- Split into one row per scenario answer.
- Remove names, phone numbers, anything identifying. Keep district only.
- Contributor IDs C01, C02 in order of arrival.
- Write to `data/test_t2_crowd.csv` with `scenario_id` and an empty `labels` column. Nasim fills labels.
- Do not correct spelling. Do not translate.

## CW5 · Screenshots and final checklist (16:00 onwards)

- Screenshots: inbox with three tiers, label chips with bands, facility card, airplane-mode icon visible, model size printout, the four charts.
- Run the checklist in `05_video_and_submission.md §3` and report anything missing to Nasim by 18:00.
