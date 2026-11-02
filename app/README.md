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
- **Regional göstəricilər**: İqtisadi region → Rayon (kaskad) seçimi,
  Say / 10 000 nəfərə görə və İl. Heatmap rəngli bar chart göstərir: bütün
  regionlar, ya da seçilmiş regionun rayonları. Bar-a toxunanda o yer
  seçilir. Altda seçilmiş yerin illər üzrə cədvəli var.
- **AZ / EN**: yuxarı sağdakı dairələrlə dil dəyişir, seçim telefonda
  yadda qalır. Mətnlər saytın öz lüğətləridir (`../frontend/i18n/*.json`,
  bax `metro.config.js`). Yer adları EN-də Azstat-ın rəsmi ingiliscə
  adlarıdır.
- Açıq/qaranlıq rejim telefonun ayarını izləyir. Aşağı çəkəndə data
  yenilənir.
- Xəritə hələ yoxdur, növbəti iterasiyadadır.

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
| `src/NationalScreen.tsx`, `src/RegionalScreen.tsx` | İki əsas ekran |
| `src/charts.tsx` | Trend xətti (react-native-svg) və heatmap bar chart |
| `src/components.tsx` | Seçim siyahısı, seqment düymələri, kart, nişanlar |
| `src/theme.ts` | Saytla eyni rəng tokenləri (açıq/qaranlıq), heatmap rampası |

Yoxlamalar: `npx tsc --noEmit`, `npx expo-doctor`.
