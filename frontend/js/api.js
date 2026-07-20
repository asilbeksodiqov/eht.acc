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

// fetch() bilan yuklanish jarayonini (progress) kuzatib bo'lmaydi, shu
// sababli fayl yuklanishi kerak bo'lgan so'rovlar (masalan hujjat
// yuborish) uchun XMLHttpRequest ishlatiladi — u haqiqiy yuborilgan
// bayt/umumiy bayt nisbatiga qarab foizni beradi (ya'ni foiz aynan
// fayllar yuborilish TEZLIGI va VAQTIGA qarab harakat qiladi, sun'iy
// animatsiya emas). `onProgress(percent)` har safar yangi ma'lumot
// yuborilganda chaqiriladi (0-99 oralig'ida; 100% javob kelganda
// chaqiruvchi tomonda qo'yiladi).
function apiPostWithProgress(action, data = {}, onProgress) {
  return new Promise((resolve) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', API_URL, true);
      xhr.upload.onprogress = function (e) {
        if (typeof onProgress === 'function' && e.lengthComputable) {
          const pct = Math.max(0, Math.min(99, Math.round((e.loaded / e.total) * 100)));
          onProgress(pct);
        }
      };
      xhr.onload = function () {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (err) {
          resolve({ success: false, message: "Serverdan noto'g'ri javob keldi" });
        }
      };
      xhr.onerror = function () {
        resolve({ success: false, message: "Serverga ulanib bo'lmadi. Internetni yoki API_URL sozlamasini tekshiring." });
      };
      xhr.send(JSON.stringify({ action, ...data }));
    } catch (err) {
      resolve({ success: false, message: "Serverga ulanib bo'lmadi. Internetni yoki API_URL sozlamasini tekshiring." });
    }
  });
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
    window.location.href = sessionRole === 'admin' ? 'admin.html' : 'branch.html';
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
