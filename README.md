# Ehtirom Workflow

Mikromoliya tashkiloti filiallari uchun hujjat topshirish va nazorat qilish tizimi.

## Tuzilma

```
ehtirom-workflow/
├── backend/                 → Google Apps Script fayllari (Sheets/Drive bilan ishlaydi)
│   ├── Code.gs               (asosiy routing)
│   ├── SheetService.gs        (Google Sheets bilan ishlash)
│   └── DriveService.gs        (Google Drive bilan ishlash)
│
├── frontend/                → Statik sayt (GitHub Pages uchun)
│   ├── index.html             (login sahifasi)
│   ├── branch.html            (filial xodimi paneli)
│   ├── admin.html             (admin paneli)
│   ├── css/style.css
│   └── js/
│       ├── config.js           (API_URL sozlamasi)
│       ├── api.js               (umumiy yordamchi funksiyalar)
│       ├── login.js
│       ├── branch.js
│       └── admin.js
│
└── SETUP.md                 → To'liq o'rnatish yo'riqnomasi (shundan boshlang!)
```

## Ishlash tartibi

1. **Filial xodimi**: tizimga kiradi → hujjat turini tanlaydi → bitta yoki bir nechta fayl/rasm birga yuklaydi → holatni kuzatib boradi.
2. **Fayl(lar)** avtomatik ravishda Google Drive'da `Ehtirom Workflow / Uploads / Filial / Sana / Hujjat turi /` papkasiga saqlanadi — bir nechta fayl yuklansa ham, hammasi shu BITTA papkaga tushadi va Report listida faqat shu papkaning manzili (bitta qator) ko'rinadi.
3. **Ma'lumotlar** Google Sheets'ning `Report` listiga yoziladi.
4. **Admin**: filial, sana, hujjat turini tanlab qidiradi → hujjatni ko'rib chiqadi → tasdiqlaydi (xatosiz yoki izoh bilan) yoki xato bilan filialga qaytaradi.
5. Qaytarilgan hujjatni **filial qayta yuborishi** mumkin (bir nechta fayl bilan ham) — bu safar Report listiga **yangi qator** qo'shiladi, `Version` raqami +1 oshadi, eski fayllar Drive'dan o'chirilib o'rniga yangilari joylanadi, eski qator esa "Almashtirildi" statusiga o'tadi (tarix sifatida saqlanib qoladi, lekin endi faol emas).

Batafsil o'rnatish qadamlari uchun **SETUP.md** faylini o'qing.
