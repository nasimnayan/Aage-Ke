# Data licences

All accessed on **4 October 2026** from public pages. No login used.

| Dataset | URL | Licence | Size | Status |
|---|---|---|---|---|
| Bangla Healthcare Severity Dataset (v1, DOI 10.17632/37z8kgx79m.1) | https://data.mendeley.com/datasets/37z8kgx79m/1 | CC BY 4.0 | 5,263 rows, 3 columns (Text, Categories, Action Needed) | Downloaded. Used for T3 only. |
| Vashantor (v2, DOI 10.17632/bj5jgk878b.2) | https://data.mendeley.com/datasets/bj5jgk878b/2 | CC BY 4.0 | 5 regions × 2,500 rows (train 1,875 / test 375 / validation 250); 32,500 sentences in all, as the page states. Barishal region file is the relevant one for Pirojpur. | Reuse allowed. **Not yet downloaded**: needs a manual download (link below). |
| Bengali Colloquial Dataset of Primary Medical Issues | https://data.mendeley.com/datasets/4tt953xwk2 | not checked | not checked | Optional. Not opened, because Nasim has not asked for it. |

## Bangla Healthcare Severity Dataset: notes

- **The CSV on Mendeley is broken.** Every Bangla character was saved as `?` (309,239 question marks, zero Bangla bytes). Do not use `Bangla-Healthcare_Dataset.csv` from the site.
- **Use the XLSX.** `Bangla-Healthcare_Dataset.xlsx` SHA-256 `92c03453e3ccbfe13b6af8c76a06ed69f206d4ea7841623037d3a8d324ce96ad` matches the hash Mendeley publishes for that file.
- `bangla_healthcare_severity.csv` in this folder is made from the XLSX: UTF-8, same 3 columns, 5,263 rows, nothing else changed. SHA-256 `dc5a27935977f47bf7397c721df4b74801782ded0be35bd2a4b83c8768033a00`. This counts as "changes made" under CC BY 4.0 (format conversion only), so say so in the README.
- Class counts match the authors' README: Urgent 1,461 · Emergency 1,353 · Routine 1,268 · General Query 1,181. 3 duplicate texts.
- Source: public Facebook and YouTube posts; the authors say personal information was removed.
- **For T3, a warning:** only **1** row mentions dengue (ডেঙ্গু). 215 mention fever (জ্বর); 29 mention fever plus vomiting, stomach, blood, weakness or urine. No row mentions platelets. T3 will mostly test general warning-sign wording, not dengue talk. Worth one line in the README.
- Attribution to use: Pulock Deb Roy, Mst. Chameli Begum, Dolour Husain Sagor, Badar Hossain. *Bangla Healthcare Severity Dataset.* Mendeley Data, V1, 2026. doi:10.17632/37z8kgx79m.1. Licence: https://creativecommons.org/licenses/by/4.0/

## Vashantor: notes

- Licence shown on the page: **CC BY 4.0**, so reuse is allowed with credit.
- Download (manual, my sandbox cannot reach Mendeley): `Vashantor_CSV_Format.zip`, 1.07 MB
  https://data.mendeley.com/public-files/datasets/bj5jgk878b/files/ff221f8b-b38d-4db1-b579-fe310fc92b4a/file_downloaded
  Published SHA-256: `5abb437220ad6fede5344b974f1abe48f4be8d5a9c250b807c0fea6fe4899919`. Save under `data/raw/vashantor/`.
- Columns per region file: `bangla_speech, banglish_speech, <region>_bangla_speech, <region>_banglish_speech, region_name, english_speech`. Note the trailing space in the header names.
- Content is everyday conversation, not health. Useful for regional spellings (Barishal) and Banglish patterns, not for labels.
- Attribution to use: Fatema Tuj Johora Faria, Mukaffi Bin Moin, Ahmed Al Wase, Md. Rabius Sani, Mehidi Ahmmed, Tashreef Muhammad. *Vashantor: A Large-scale Multilingual Benchmark Dataset for Automated Translation of Bangla Regional Dialects to Bangla Language.* Mendeley Data, V2, 2024. doi:10.17632/bj5jgk878b.2

## Facility and boundary data (CW2)

| Source | URL | Licence | Used for |
|---|---|---|---|
| OpenStreetMap (via Overpass API) | https://www.openstreetmap.org | ODbL 1.0. Credit: "© OpenStreetMap contributors" | Facility coordinates for F01 to F03, union boundaries and centroids |
| DGHS Facility Registry (MoHFW, Government of Bangladesh) | https://hrm.dghs.gov.bd/public/facility-registry/ | Public government register; no licence stated | Official names, phone numbers, community clinic locations |
