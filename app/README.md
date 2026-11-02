# Cardiostatistics (mobil app)

Expo (React Native) app. Saytdakı ürək-damar xəstəlikləri statistikasını
telefonda göstərir. Datanı hər açılışda saytın istifadə etdiyi eyni ictimai
ünvandan oxuyur:
<https://cardiostatistics.com/data/circulatory_data.json>.
App-in içində heç bir rəqəm saxlanmır.

## Nə var

- **Milli göstəricilər**: Ölçü növü (Ölüm / Xəstələnmə), Yaş aralığı
  (Xəstələnmə üçün) və İl seçimləri var. Nəticə kartı nisbəti, ötən ilə
  görə dəyişimi (▲ qırmızı / ▼ yaşıl) və sayı göstərir. Altda trend
  qrafiki var, nöqtəyə toxunanda həmin il seçilir.
- **Regional göstəricilər**: real sərhədli Azərbaycan xəritəsi (saytın
  geoBoundaries mənbəli GeoJSON-u, bax aşağı), İqtisadi region → Rayon
  (kaskad) seçimi, Say / 10 000 nəfərə görə və İl. "İqtisadi region /
  Rayon" tab-ı xəritənin/bar chart-ın susmaya görə hansı səviyyədə
  göründüyünü seçir (14 region, ya da bütün 73 rayon — Bakı orada da tək
  fiqur kimi qalır, 12 daxili rayonunun ayrıca sərhədi yoxdur, nəticələri
  isə regiona toxunanda bar chart-da və cədvəldə görünür). Xəritəyə və ya
  bara toxunanda eyni yer seçilir (ikisi sinxrondur), qısa bir tooltip
  (ad + rəqəm) çıxır, xəritədə üfüqi sürüşdürmə (swipe) cari sıralamada
  növbəti/əvvəlki yerə keçir. Altda seçilmiş yerin illər üzrə cədvəli var.
- **Bütün göstəricilər**: saytın eyniadlı bölməsi. Kəsim tab-ı — Milli:
  Ölüm, ya da Xəstələnmə-nin hər konkret yaş aralığı bütün illəri (2015-ci
  ildən) sıralana bilən cədvəldə göstərir (susmaya görə il azalan, 2024/ən
  son il yuxarıda); Xəstələnmə — ümumi əhali təkcə bir illik kart qalır
  (artıq KPI sətirində var). Region: İqtisadi region → Rayon seçimi —
  rayon seçilməyəndə regionun öz cəmi + bütün rayonları seçilmiş il üçün
  (ən çox say yuxarıda), rayon seçiləndə o yerin bütün illəri. Sütun
  başlığına toxunub sıralamaq olur (▲/▼ işarəsi aktiv sütunu göstərir);
  "Nisbət" başlığının yanındakı ⓘ-ə toxunanda qısa izah çıxır.
- **AZ / EN**: yuxarı sağdakı dairələrlə dil dəyişir, seçim telefonda
  yadda qalır. Mətnlər saytın öz lüğətləridir (`../frontend/i18n/*.json`,
  bax `metro.config.js`). Yer adları EN-də Azstat-ın rəsmi ingiliscə
  adlarıdır.
- **Tema**: 🌓 düyməsi (dil dəyişənin yanında) Sistem → Açıq → Tünd →
  Sistem sırası ilə dəyişir (susmaya görə Sistem — telefonun öz ayarını
  izləyir); seçim telefonda yadda qalır. Bütün ekranlar, xəritə və
  qrafiklər hər iki rejimdə eyni rəng tokenlərini (`src/theme.tsx`)
  oxuyur, ona görə ikisi də oxunaqlıdır.
- **Giriş animasiyası**: statik native splash-dan (app ikonu) sonra, ~1.6
  saniyəlik animasiyalı ekran — loqo kiçikdən böyüyür, nəbz xətti özü-özünü
  çəkir (əsl ikonla eyni həndəsə, `scripts/make-icons.mjs`), sonra ad
  görünür və ekran sönür (`react-native-reanimated`). Yalnız soyuq
  başlanğıcda bir dəfə (yaddaşda, AsyncStorage-də deyil — hər yenidən
  açılışda təkrar oynasın deyə), data yükləməsini bir an belə
  gecikdirmədən (`Main()` eyni anda fetch başladır).
- Aşağı çəkəndə data yenilənir.

## Expo Go ilə telefonda test

Lazım olanlar:

- Kompüterdə [Node.js LTS](https://nodejs.org/)
- Telefonda **Expo Go**:
  [App Store (iPhone)](https://apps.apple.com/app/expo-go/id982107779) ·
  [Google Play (Android)](https://play.google.com/store/apps/details?id=host.exp.exponent)
- Telefon və kompüter **eyni Wi-Fi şəbəkəsində** olmalıdır.

Addımlar:

1. Reponun kökündən `app` qovluğuna keçin və asılılıqları quraşdırın
   (yalnız ilk dəfə):

   ```bash
   cd app
   npm install
   ```

2. Serveri işə salın:

   ```bash
   npx expo start
   ```

   Terminalda QR kod çıxacaq.

3. QR kodu skan edin:
   - **iPhone**: adi **Kamera** tətbiqini QR koda tutun və çıxan "Open in
     Expo Go" bildirişinə toxunun.
   - **Android**: **Expo Go**-nu açın, **"Scan QR code"** düyməsinə toxunun
     və QR kodu skan edin.

4. İlk açılışda JavaScript bundle-ı yüklənir (10–30 saniyə). Sonra app
   açılır.

Kodu dəyişəndə telefon avtomatik yenilənir. Əl ilə yeniləmək üçün
terminalda `r` basın.

### Qoşulmursa

- Telefon və kompüter fərqli şəbəkədədirsə, ya Wi-Fi "client isolation"
  (qonaq şəbəkəsi) aktivdirsə, tunnel rejimi ilə işə salın:
  `npx expo start --tunnel`. İlk dəfə əlavə paket quraşdırılmasını təklif
  edə bilər.
- Windows təhlükəsizlik divarı Node.js üçün icazə istəyirsə, "Private
  networks"-ə icazə verin.
- Expo Go "project is incompatible" deyirsə, Expo Go-nu mağazadan son
  versiyaya yeniləyin (layihə Expo SDK 57 ilədir).

### Kompüterdə baxmaq (telefonsuz)

```bash
npx expo start --web
```

Brauzerdə eyni app açılır. Bu sürətli yoxlama üçündür, əsl test telefondadır.

## İkon və splash

Ağ nəbz (EKQ) xətti, saytın mavi rəngi (`#2a78d6`) üzərində. Hamısı bir
motivdən yaradılır:

```bash
npm install --no-save sharp && node scripts/make-icons.mjs
```

Qeyd: SDK 52-dən bəri **Expo Go splash screen-i göstərmir**, onun yerinə
app ikonunu göstərir. Splash yalnız əsl build-də (məs. `eas build`) görünür.

## Struktur

| Fayl | Nə edir |
|---|---|
| `App.tsx` | Header (ad + AZ/EN), tablar, data yükləmə, xəta/yeniləmə |
| `src/data.ts` | Fetch, saytın qaydaları: nisbət, dəyişim, açar aliasları, AZ/EN yer adları |
| `src/i18n.tsx` | Dil konteksti; saytın lüğətləri + app-ə aid bir neçə mətn |
| `src/NationalScreen.tsx`, `src/RegionalScreen.tsx`, `src/AllScreen.tsx` | Üç əsas ekran |
| `src/charts.tsx` | Trend xətti (react-native-svg) və heatmap bar chart |
| `src/RegionMap.tsx`, `src/geo.ts` | Real sərhədli xəritə (react-native-svg + d3-geo proyeksiya), tooltip, swipe |
| `src/geo/regions.json`, `src/geo/districts.json` | `frontend/az-*.geojson`-un köçürülmüş surəti (bax `scripts/sync-geo.mjs`) |
| `src/components.tsx` | Seçim siyahısı, seqment düymələri, kart, nişanlar, sıralana bilən cədvəl (`SortableTable`) |
| `src/theme.tsx` | Saytla eyni rəng tokenləri (açıq/qaranlıq), heatmap rampası, Sistem/Açıq/Tünd seçimi (`ThemeModeProvider`) |
| `src/SplashIntro.tsx` | Animasiyalı giriş ekranı (`react-native-reanimated`) |

`src/geo/*.json` saytın `frontend/az-economic-regions.geojson` /
`az-districts.geojson` fayllarının surətidir (Metro `.geojson`
uzantısını tanımır, ona görə `.json` kimi saxlanılıb). Mənbə
dəyişəndə (`scripts/build_region_geojson.py` / `build_district_geojson.py`
yenidən işlədiləndə) yeniləmək üçün:

```bash
node scripts/sync-geo.mjs
```

Yoxlamalar: `npx tsc --noEmit`, `npx expo lint`, `npx expo-doctor`.
