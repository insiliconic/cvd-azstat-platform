# Data sources

Publisher: State Statistical Committee of the Republic of Azerbaijan (SSC).
Landing page: <https://www.stat.gov.az/source/healthcare/?lang=en>
Language of tables: English. Format: Excel 97–2003 (`.xls`).
Accessed / downloaded: **2026-09-23**. Files stored unmodified in `raw_data/`.

| File | SSC table | Indicator | Coverage | Bytes | SHA-256 |
|---|---|---|---|---|---|
| [001_3en.xls](https://www.stat.gov.az/source/healthcare/en/001_3en.xls) | — | Main causes of deaths among population | 2000, 2005–2024 | 40448 | `C7A486523B1A297C7849FBB2470310C352B658FA4AA6FAA5110873DD3C8B4D16` |
| [001_2_1en.xls](https://www.stat.gov.az/source/healthcare/en/001_2_1en.xls) | 1.2.1 | Population morbidity by diseases groups | 1990–2024 | 55808 | `50D08184FF7DCB13439E2247AF61DEC7211ED4AC31314372D085C1ACA20EC220` |
| [001_2_2en.xls](https://www.stat.gov.az/source/healthcare/en/001_2_2en.xls) | 1.2.2 | Morbidity of children aged under 18 by groups of diseases | 2005, 2007–2024 | 44032 | `B76210FCCF92408272113CAC9F39424F1E5CCD97C6DB83888392E655F3A7E026` |
| [001_2_3en.xls](https://www.stat.gov.az/source/healthcare/en/001_2_3en.xls) | 1.2.3 | Morbidity of children aged 0–13 by main groups of diseases | 2007–2024 | 41472 | `18023B58FA9328B05C354CCD56ADB875892611735CBF6572A408C424570DB327` |
| [001_2_4en.xls](https://www.stat.gov.az/source/healthcare/en/001_2_4en.xls) | 1.2.4 | Morbidity of youths aged 14–29 by main groups of diseases | 2007–2024 | 44544 | `51721A3851BF14755778B2471675372C9D572B6210C546F8D0988061763A3C34` |
| [001_2_5en.xls](https://www.stat.gov.az/source/healthcare/en/001_2_5en.xls) | 1.2.5 | Morbidity of population aged 30 and over by main groups of diseases | 2007–2024 | 41984 | `19C14EC90CCC88EED2CF4BD7EFB08156F5B299615112B1CC57CC09FF3F774481` |
| [001_5_2-3en.xls](https://www.stat.gov.az/source/healthcare/en/001_5_2-3en.xls) | 1.5.2 / 1.5.3 / 1.5.4 | Distribution of population by main disease groups by economic regions and administrative-territorial units | 2015–2024 (sheet per year) | 418816 | `B5D18F294D10170ED8DE336BDC7AB467714E351440037F7D6E7D584C78C6C89F` |

## Azerbaijani-language label source

[001_5_2-3az.xls](https://www.stat.gov.az/source/healthcare/az/001_5_2-3.xls)
— the same table as `001_5_2-3en.xls` above (same values, same row order),
published in Azerbaijani. Downloaded **2026-09-25**
(437248 bytes, SHA-256 `CDDBAC7C2C315BF4199815BA3EFA97FC58A123A3F4769344128FEDF4C1C68631`).
Used only to attach each region/district's original Azerbaijani name
(`name_az` in `data/circulatory_data.json`) — every value still comes from
the English file. Row-position alignment between the two files was verified
against the circulatory-system column across all 10 years before relying on
it; see `docs/methodology_log.md`.

## Additional context source (not parsed)

Stored in `raw_data/`, excluded from `TARGET_LINKS` in `parser.py`: the table
has no disease-group rows. It is a candidate covariate source
(health-system capacity by region) for later analysis.

| File | SSC table | Indicator | Coverage | Bytes | SHA-256 |
|---|---|---|---|---|---|
| [001_5_1en.xls](https://www.stat.gov.az/source/healthcare/en/001_5_1en.xls) | 1.5.1 (2021–2024) / 1.5.2 (2012–2020) | Main indicators of health by economic regions and administrative-territorial units: physicians, paramedical staff, hospitals, hospital beds, outpatient clinic capacity (absolute and per 10 000 population) | 2012–2024 (sheet per year) | 506880 | `AC62A91B944A51306A1A8B32439787838A60F5080D9482C5EAC021F65A15C5CF` |

Notes:
- SSC updates these files in place under the same URL. Checksums identify the
  exact version used; re-download and compare before re-running the analysis.
- Morbidity tables count patients registered with a first-time diagnosis.
- Mortality rates are per 100 000 population; morbidity rates are per 10 000
  (age-specific denominators in 1.2.2–1.2.5).
