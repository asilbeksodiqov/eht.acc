# Ehtirom Workflow — O'rnatish yo'riqnomasi

Bu tizim ikki qismdan iborat:
- **Backend** — Google Apps Script (Google Sheets + Google Drive bilan ishlaydi)
- **Frontend** — statik HTML/CSS/JS sayt (GitHub Pages'da joylashadi)

Quyidagi qadamlarni ketma-ket bajaring.

---

## 1-QADAM: Google Sheet tayyorlash

1. Google Drive'da yangi Google Sheet yarating, nomini masalan **"Ehtirom Workflow DB"** deb qo'ying.
2. Uning ichida **3 ta list (varaq)** yarating, nomlari **aynan** quyidagicha bo'lishi shart (katta-kichik harflarga e'tibor bering):

### `Users` listi
| username | password | role | branch |
|---|---|---|---|
| admin1 | parol123 | admin | - |
| filial1 | parol456 | branch | Chilonzor filiali |
| filial2 | parol789 | branch | Yunusobod filiali |

- `role` ustunida faqat `admin` yoki `branch` yozilishi kerak.
- Admin uchun `branch` ustuniga `-` qo'yishingiz mumkin.

### `DocType` listi
| DocumentType | byWho | Period |
|---|---|---|
| Shartnoma | 1 | 1 |
| Pasport nusxasi | 2 | 1 |
| To'lov cheki | 1 | 1 |
| Kafolat xati | 2 | 15 |

- `byWho`: **1** = buxgalter yuboradi, **2** = kassir yuboradi. Bu qiymat avtomatik ravishda `SubmissionID`ning oxiriga qo'shiladi (masalan `000123-1`), lekin saytda alohida login talab qilinmaydi — filial xodimi bitta umumiy login bilan kirib, hujjat turini tanlashi bilan tizim kimga tegishli ekanini o'zi biladi.
- `Period`: **1** = bu hujjat turi har kuni yuborilishi kerak (har doim ochiq). **15** = faqat oyning **15-kuni** va **oxirgi kunida** yuborish tugmasi ochiq bo'ladi, qolgan kunlari yopiq turadi.

### `Report` listi
Faqat sarlavhalarni yozing (ma'lumotlar avtomatik to'ladi):

| SubmissionID | UploadDate | UploadTime | Branch | DocumentType | FilePath | Status | ErrorType | Comment | Version |
|---|---|---|---|---|---|---|---|---|---|

> `Status` ustuni endi 6 xil qiymat qabul qiladi: `Yuborildi`, `Tasdiqlandi`, `Qaytarildi`, **`Yuborilmadi`**, **`Mavjud emas`** va **`Almashtirildi`**. `Yuborilmadi` — kunlik avtomatik tekshiruv orqali (pastdagi 3-QADAM'ga qarang) tizim tomonidan qo'shiladi, agar shu kuni biror filial majburiy hujjatni yubormagan bo'lsa. `Mavjud emas` — davriy (masalan har 15 kunda) hujjat turlari uchun, filial "bu hujjat turi bizda umuman yo'q" deb tasdiqlagach qo'shiladi (filial panelidagi tasdiqlash oynasi orqali). `Almashtirildi` — filial biror hujjatni qayta yuborganda, ESKI qatorga qo'yiladi (yangi qator qo'shilib, eski qator endi "tarix" sifatida saqlanadi, lekin faol emas — qayta yuborish yoki admin amallari uchun ko'rinmaydi).

3. Sheet URL manzilidan **Spreadsheet ID**ni nusxalab oling:
   `https://docs.google.com/spreadsheets/d/`**`BU_QISM_ID`**`/edit`

---

## 2-QADAM: Apps Script (backend) yaratish

1. Ochiq Google Sheet ichida: **Extensions → Apps Script** (Kengaytmalar → Apps Script) ni bosing.
2. Ochilgan muharrirda standart `Code.gs` faylini oching va uning ichidagi hamma narsani o'chirib, ushbu loyihadagi **`backend/Code.gs`** faylining tarkibini joylashtiring.
3. `SPREADSHEET_ID = 'BU_YERGA_SHEET_ID_NI_QOYING';` qatorini toping va 1-qadamda olgan Spreadsheet ID'ingizni qo'ying.
4. Chap tomondagi **+** belgisini bosib, yangi Script fayli qo'shing, nomini **`SheetService`** deb qo'ying va `backend/SheetService.gs` tarkibini shu yerga joylashtiring.
5. Yana bitta yangi Script fayli qo'shing, nomini **`DriveService`** deb qo'ying va `backend/DriveService.gs` tarkibini joylashtiring.
6. Yana bitta yangi Script fayli qo'shing, nomini **`Triggers`** deb qo'ying va `backend/Triggers.gs` tarkibini joylashtiring.
7. **Saqlang** (Ctrl+S / Cmd+S).

### Deploy qilish (Web App sifatida)

1. Yuqori o'ng burchakdagi **Deploy → New deployment** tugmasini bosing.
2. "Select type" (⚙️ belgisi) dan **Web app** ni tanlang.
3. Sozlamalar:
   - **Execute as**: `Me` (siz)
   - **Who has access**: `Anyone` (Har kim) — bu muhim, aks holda frontend ulana olmaydi
4. **Deploy** tugmasini bosing.
5. Birinchi marta deploy qilganda Google sizdan ruxsat so'raydi — o'z akkountingizni tanlab, "Advanced" → "Go to [loyiha nomi] (unsafe)" orqali ruxsat bering (bu sizning o'z skriptingiz bo'lgani uchun xavfsiz).
6. Deploy tugagach sizga **Web app URL** beriladi, masalan:
   `https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxx/exec`
   Shu URL'ni nusxalab oling — bu **API_URL**.

> **Eslatma:** Agar keyinchalik `Code.gs` yoki boshqa fayllarga o'zgartirish kiritsangiz, o'zgarishlar ishlashi uchun **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy** qilishingiz kerak bo'ladi.

---

## 3-QADAM: Kunlik avtomatik trigger sozlash ("Yuborilmadi" qatorlari uchun)

> **Eslatma:** Admin paneldagi "Bugungi yuborilmaganlar" ro'yxati **jonli (real-time)** hisoblanadi — u trigger ishga tushishini kutmaydi. Har safar admin panel ochilganda tizim bugungi sanani, barcha filiallarni va bugun ochiq bo'lgan hamma hujjat turlarini solishtirib, `Report` listida hali yozuv yo'q kombinatsiyalarni (yoki `Yuborilmadi` holatidagilarni) o'zi topib ko'rsatadi. Shunga qaramay, quyidagi trigger **tavsiya etiladi** — u kunlik "rasmiy" `Yuborilmadi` qatorlarini `Report` listiga yozib qo'yadi, bu esa filialga keyinchalik o'sha kunni "qayta yuborish" imkonini beradi (davriylik oynasi yopilib qolgan bo'lsa ham).

1. Apps Script muharririda chap tomondagi soat ⏰ belgisini (**Triggers**) bosing.
2. **+ Add Trigger** tugmasini bosing.
3. Sozlamalar:
   - **Choose which function to run**: `createMissingSubmissionRows`
   - **Select event source**: `Time-driven`
   - **Select type of time based trigger**: `Day timer`
   - **Select time of day**: masalan `23:00 - 00:00` (kun tugashidan oldin)
4. **Save** tugmasini bosing, ruxsat so'ralsa **Allow** qiling.

Shundan keyin har kuni belgilangan vaqt oralig'ida tizim avtomatik ishlaydi va o'sha kuni ochiq bo'lgan (Period jadvaliga mos) hujjat turlaridan hali yuborilmaganlarini har bir filial uchun aniqlab, `Report` listiga `Yuborilmadi` statusi bilan yangi qator qo'shadi.

> Sinov uchun trigger o'rnatilishini kutmasdan, `createMissingSubmissionRows` funksiyasini yuqoridagi funksiya tanlash menyusidan tanlab, qo'lda **Run** qilib ko'rishingiz mumkin.

---

## 4-QADAM: Frontend'ni sozlash

1. `frontend/js/config.js` faylini oching.
2. `API_URL` qatoriga 2-qadamda olgan Web App URL'ini qo'ying:
   ```js
   const API_URL = 'https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxx/exec';
   ```
3. Saqlang.

---

## 5-QADAM: GitHub Pages'ga joylashtirish

1. GitHub'da yangi repository (ombor) yarating, masalan `ehtirom-workflow`.
2. `frontend` papkasining **ichidagi barcha fayllarni** (index.html, branch.html, admin.html, css/, js/) repository'ning **root** (asosiy) qismiga yuklang.
   - Eslatma: `frontend` papkasining o'zini emas, ichidagi fayllarni yuklang, aks holda havolalar ishlamay qoladi.
3. Repository → **Settings → Pages** bo'limiga o'ting.
4. **Source**: `Deploy from a branch`, **Branch**: `main` (yoki `master`), papka: `/root` ni tanlang → **Save**.
5. Bir necha daqiqadan so'ng sizga sayt manzili beriladi:
   `https://SIZNING_USERNAME.github.io/ehtirom-workflow/`

---

## 6-QADAM: Sinovdan o'tkazish

1. Berilgan GitHub Pages havolasini oching.
2. `Users` listidagi login/parol bilan kirib ko'ring (masalan `filial1` / `parol456`).
3. Hujjat turini tanlab, fayl(lar) yuklab yuboring (bir nechta faylni birga tanlash mumkin).
4. Google Drive'ni tekshiring — **Ehtirom Workflow / Uploads / [Filial] / [Sana] / [Hujjat turi] /** papkasida fayl paydo bo'lishi kerak, `Report` listida esa yangi qator qo'shiladi (`SubmissionID` — masalan `000001-1`).
5. Chiqib, `admin1` / `parol123` bilan admin sifatida kirib, "Bugungi yuborilmaganlar" va "Filiallar reytingi" widgetlari ko'rinishini tekshiring, so'ng filial/sana/hujjat turi/holat bo'yicha qidiring — yuborilgan hujjat ko'rinishi kerak.
6. `createMissingSubmissionRows` funksiyasini qo'lda ishga tushirib (3-QADAM oxiridagi eslatmaga qarang), keyin admin panelidagi "Bugungi yuborilmaganlar" ro'yxatini yangilab ko'ring.

---

## Muhim eslatmalar

- **Xavfsizlik**: Hozirgi versiyada parollar oddiy matn holida saqlanadi (tezkor ishga tushirish uchun tanlangan variant). Bu ishlab chiqarish (production) muhiti uchun yetarli xavfsiz emas — imkon qadar tezroq parollarni hash qilish yoki Google akkount orqali autentifikatsiyaga o'tishni tavsiya qilamiz.
- **Fayl hajmi**: Apps Script POST so'rovlari uchun taxminan 50MB chegara bor; amalda 10MB dan kichik fayllar bilan ishlashni tavsiya qilamiz (rasm/skan uchun yetarli).
- **"O'zi yuborgan hujjatlar" tarixi**: Report listida alohida "kim yubordi" (xodim) ustuni yo'qligi sababli, tarix filial (branch) bo'yicha ko'rsatiladi — ya'ni bitta filialdagi barcha xodimlar bir xil tarixni ko'radi. `byWho` ustuni orqali `SubmissionID`ning охиридаги raqami (masalan `-1` yoki `-2`) qaysi lavozim yuborganini bildiradi, lekin bu shaxsni emas, hujjat turining "kim mas'ul" ekanini anglatadi.
- **Status qiymatlari**: `Yuborildi`, `Tasdiqlandi`, `Qaytarildi`, `Yuborilmadi`, `Mavjud emas`, `Almashtirildi`. Bu qiymatlarni kodda o'zgartirmang, chunki frontend aynan shu matnlarga qarab ishlaydi.
- **"Mavjud emas" tugmasi**: faqat davriy (`Period > 1`, masalan 15 kunlik) hujjat turlari filial panelida tanlanganda va o'sha kun ochiq bo'lganda ko'rinadi. Bosilganda tasdiqlash oynasi chiqadi; tasdiqlangandan keyingina `Report` listiga `Mavjud emas` statusli yangi qator qo'shiladi — tasdiqlanmaguncha hech narsa yozilmaydi.
- **Bir nechta fayl/rasm yuklash**: filial bir marta yuborishda (yoki qayta yuborishda) bir nechta fayl/rasm birga tanlashi mumkin. Bularning hammasi bitta Drive papkasiga ({Filial}/{Sana}/{Hujjat turi}) joylanadi va `Report` listida faqat shu papkaning manzili (`FilePath`) bilan **bitta qator** hosil bo'ladi — har bir fayl uchun alohida qator ochilmaydi.
- **Reyting oynasi**: admin va filial panellarining eng pastida joylashgan, standart holatda yopiq — sarlavhasini bosib ochish/yopish mumkin (dropdown).
- **Versiya va qayta yuborish (yangilangan mantiq)**: Admin hujjatni qaytarsa (yoki tizim uni "Yuborilmadi" deb belgilasa) va filial keyin hujjatni qayta yuborsa, `Report` listiga **YANGI qator** qo'shiladi (yangi `SubmissionID` bilan), `Version` mos ravishda oshadi (`Yuborilmadi` → birinchi marta yuborilganda `Version=1`; `Qaytarildi` → qayta yuborilganda +1). Eski fayllar Drive'dagi o'sha papkadan o'chirilib, o'rniga yangi fayllar joylanadi. Eski qatorning `Status`i esa `Almashtirildi` deb belgilanadi — u tarixda ko'rinishda qoladi, lekin endi faol (qayta yuborilishi yoki admin tomonidan ko'rib chiqilishi mumkin bo'lgan) qator emas.
- **SubmissionID formati**: `000123-1` — birinchi qism ketma-ket raqam (barcha filiallar uchun umumiy hisoblagich), ikkinchi qism `DocType` listidagi `byWho` qiymati. Qayta yuborilgan har bir versiya ham o'zining yangi `SubmissionID`sini oladi.
- **Davriylik (Period)**: `1` = har kuni ochiq, `15` = faqat oyning 15-kuni va oxirgi kunida ochiq. Boshqa raqamlar kiritilsa, tizim uni "har shuncha kunda + oyning oxirgi kunida" deb umumlashtiradi.
- **Reyting**: "Xato" deb `ErrorType` maydoni bo'sh bo'lmagan barcha yozuvlar hisoblanadi (status qat'iy nazar — ya'ni qaytarilgan yoki izoh bilan tasdiqlangan holatlar ham kiradi).
- **Reytingda "hamma joyda 0" muammosi haqida**: bu odatda `Users` listidagi `branch` ustunida bexosdan qo'shilib qolgan bo'sh joy (probel) sababli yuz beradi (masalan "Chilonzor filiali " — oxirida probel bilan). Tizim endi bunday probellarni avtomatik trim qilib solishtiradi, lekin baribir `Users` listidagi filial nomlarini toza (ortiqcha probelsiz) yozish tavsiya etiladi. Shuningdek, reyting sonini yangilash uchun admin "Qaytarish" amalini albatta **"Qaytarishni yakunlash"** tugmasi bosilib, xato turi va izoh to'ldirilgandan keyin yakunlanishini unutmang — faqat "Qaytarish" tugmasini bosib forma ochilishining o'zi hali hech narsani saqlamaydi.