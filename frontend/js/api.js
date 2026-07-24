/**
 * Apps Script backend bilan aloqa uchun yordamchi funksiyalar.
 * MUHIM: fetch so'rovlarida Content-Type header'i ATAYLAB qo'yilmaydi
 * (CORS preflight so'rovining oldini olish uchun — Apps Script buni
 * to'g'ri boshqara olmaydi). Body matn (text/plain) sifatida ketadi,
 * backend tomonda JSON.parse() bilan o'qiladi.
 */

async function apiPost(action, data = {}) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action, ...data })
    });
    return await res.json();
  } catch (err) {
    return { success: false, message: "Serverga ulanib bo'lmadi. Internetni yoki API_URL sozlamasini tekshiring." };
  }
}

// MUHIM: avval bu funksiya XMLHttpRequest orqali ishlagan (haqiqiy
// yuklash foizini ko'rsatish uchun), lekin Apps Script'ning /exec
// manzili katta POST so'rovlarda (fayl + Base64) berayotgan javobni XHR
// boshqacha qayta ishlaganidan, brauzer buni CORS xatosi sifatida
// bloklardi (garchi oddiy fetch() orqali xuddi shu URL'ga POST so'rovlar
// muammosiz o'tsa ham). Shu sababli endi bu funksiya ham boshqa hamma
// joyda ishlatiladigan fetch()ga o'tkazildi — haqiqiy foiz endi
// ko'rsatilmaydi, faqat so'rov davomida chaqiruvchi tomon "Yuborilmoqda..."
// kabi indikator ko'rsatishi uchun onProgress(true/false) chaqiriladi.
async function apiPostWithProgress(action, data = {}, onProgress) {
  try {
    if (typeof onProgress === 'function') onProgress(true);
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action, ...data })
    });
    return await res.json();
  } catch (err) {
    return { success: false, message: "Serverga ulanib bo'lmadi. Internetni yoki API_URL sozlamasini tekshiring." };
  } finally {
    if (typeof onProgress === 'function') onProgress(false);
  }
}

async function apiGet(action, params = {}) {
  try {
    const query = new URLSearchParams({ action, ...params }).toString();
    const res = await fetch(`${API_URL}?${query}`);
    return await res.json();
  } catch (err) {
    return { success: false, message: "Serverga ulanib bo'lmadi. Internetni yoki API_URL sozlamasini tekshiring." };
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Bir nechta faylni backend'ga yuborish uchun kerakli formatga
// ([{fileName, mimeType, fileBase64}, ...]) o'giradi.
async function filesToPayload(fileList) {
  const files = Array.from(fileList);
  const payload = [];
  for (const file of files) {
    const fileBase64 = await fileToBase64(file);
    payload.push({ fileName: file.name, mimeType: file.type, fileBase64 });
  }
  return payload;
}

// ---------- Sessiya (localStorage) ----------

function getSession() {
  const raw = localStorage.getItem('ehtirom_session');
  return raw ? JSON.parse(raw) : null;
}

function setSession(data) {
  localStorage.setItem('ehtirom_session', JSON.stringify(data));
}

function clearSession() {
  localStorage.removeItem('ehtirom_session');
}

// Har bir rol qaysi panelga tegishli ekanini bitta joyda saqlaymiz —
// shu bilan yo'naltirish mantig'i (login.js, requireAuth) doim mos keladi.
const ROLE_HOME_PAGE = {
  admin: 'admin.html',
  buxgalter: 'admin.html',
  kassir: 'admin.html',
  ceo: 'ceo.html',
  branch: 'branch.html'
};

function homePageForRole(role) {
  return ROLE_HOME_PAGE[String(role || '').trim().toLowerCase()] || 'branch.html';
}

// Sahifani himoya qiladi: kerakli role bo'lmasa login sahifasiga qaytaradi
function requireAuth(role) {
  const session = getSession();
  if (!session || !session.role) {
    clearSession();
    window.location.href = '../index.html';
    return null;
  }
  const sessionRole = String(session.role).trim().toLowerCase();
  if (role && sessionRole !== role) {
    // Sessiya bor, lekin noto'g'ri sahifada — cheksiz aylanmaslik uchun
    // to'g'ridan-to'g'ri tegishli panelga yo'naltiramiz, index.html'ga emas.
    window.location.href = homePageForRole(sessionRole);
    return null;
  }
  return session;
}

// requireAuth'ning ko'p rolga ruxsat beruvchi varianti — masalan admin.html
// "admin", "buxgalter" va "kassir" rollarining barchasi uchun ochiq.
function requireAuthAny(roles) {
  const session = getSession();
  if (!session || !session.role) {
    clearSession();
    window.location.href = '../index.html';
    return null;
  }
  const sessionRole = String(session.role).trim().toLowerCase();
  if (roles && roles.indexOf(sessionRole) === -1) {
    window.location.href = homePageForRole(sessionRole);
    return null;
  }
  return session;
}

function logout() {
  clearSession();
  window.location.href = '../index.html';
}

// ---------- Umumiy UI yordamchilari ----------

function showAlert(el, message, type = 'error') {
  el.textContent = message;
  el.className = `alert show alert-${type}`;
}

function hideAlert(el) {
  el.className = 'alert';
}

function statusMeta(status) {
  switch (status) {
    case 'Tasdiqlandi':
      return { cls: 'status-approved', label: 'Tasdiqlandi' };
    case 'Qaytarildi':
      return { cls: 'status-returned', label: 'Qaytarildi' };
    case 'Yuborilmadi':
      return { cls: 'status-returned', label: 'Yuborilmadi' };
    case 'Mavjud emas':
      return { cls: 'status-na', label: 'Mavjud emas' };
    case 'Almashtirildi':
      return { cls: 'status-na', label: 'Almashtirildi (yangi versiya bor)' };
    default:
      return { cls: 'status-pending', label: 'Yuborildi' };
  }
}

// Har bir hisobot uchun jarayon bosqichlarini ko'rsatuvchi stepper (signature UI)
function renderStepper(status) {
  if (status === 'Yuborilmadi') {
    return `<div class="stepper"><div class="stepper__node is-danger"><span class="stepper__dot"></span>Muddati o'tdi — yuborilmadi</div></div>`;
  }

  if (status === 'Mavjud emas') {
    return `<div class="stepper"><div class="stepper__node"><span class="stepper__dot"></span>Filialda mavjud emas deb belgilangan</div></div>`;
  }

  if (status === 'Almashtirildi') {
    return `<div class="stepper"><div class="stepper__node"><span class="stepper__dot"></span>Qayta yuborilgan — yangi versiyaga qarang</div></div>`;
  }

  const steps = [
    { key: 'sent', label: 'Yuborildi' },
    { key: 'review', label: 'Ko\'rib chiqilmoqda' },
    { key: 'result', label: status === 'Qaytarildi' ? 'Qaytarildi' : 'Tasdiqlandi' }
  ];

  let doneCount = 1;
  let activeKey = 'review';
  let dangerLast = false;

  if (status === 'Tasdiqlandi') { doneCount = 3; activeKey = null; }
  else if (status === 'Qaytarildi') { doneCount = 3; activeKey = null; dangerLast = true; }
  else { doneCount = 1; activeKey = 'review'; }

  return `<div class="stepper">${steps.map((s, i) => {
    let cls = '';
    if (i < doneCount - 1) cls = 'is-done';
    else if (i === doneCount - 1 && (status === 'Tasdiqlandi' || status === 'Qaytarildi')) {
      cls = dangerLast && i === 2 ? 'is-danger' : 'is-done';
    } else if (s.key === activeKey) cls = 'is-active';
    return `<div class="stepper__node ${cls}"><span class="stepper__dot"></span>${s.label}</div>${i < steps.length - 1 ? '<span class="stepper__line"></span>' : ''}`;
  }).join('')}</div>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// Backend'dan kelgan Base64 ZIP ma'lumotini foydalanuvchi kompyuteriga
// fayl sifatida yuklab beradi (CEO paneli — "Fayllarni yuklab olish").
function downloadBase64File(base64, fileName, mimeType = 'application/zip') {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'ehtirom_fayllar.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Filial panelida hujjat yuborilmasdan xatolik chiqqanda, xatolik xabari
// ostiga qo'shimcha "Yordam so'rash" tugmasi chiqaradi — bu tugma
// Telegram'da TELEGRAM_HELP_USERNAME bilan chatni ochadi va filial nomi
// bilan hujjat turini avtomatik yozib qo'yadi.
function showAlertWithTelegramHelp(el, message, branch, docType) {
  showAlert(el, message);
  if (!docType) return; // hujjat turi tanlanmagan bo'lsa, mazmunli xabar tuza olmaymiz
  const text = `Filial: ${branch || ''}\nHujjat turi: ${docType}\n\nPastda hujjat rasmlarini yuboryapman, muammoni hal qilishda yordam bering.`;
  const helpUrl = `https://t.me/${TELEGRAM_HELP_USERNAME}?text=${encodeURIComponent(text)}`;
  const helpBtn = document.createElement('a');
  helpBtn.href = helpUrl;
  helpBtn.target = '_blank';
  helpBtn.rel = 'noopener';
  helpBtn.className = 'btn btn-ghost btn-sm';
  helpBtn.style.marginTop = '8px';
  helpBtn.style.display = 'inline-block';
  helpBtn.textContent = '🆘 Telegramda yordam so\'rash';
  el.appendChild(document.createElement('br'));
  el.appendChild(helpBtn);
}
