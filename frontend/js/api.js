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

// ---------- Fayllarni yuborishdan oldin avtomatik siqish ----------
// MUHIM: bu bo'lim faqat fayl hajmini kamaytirish uchun qo'shildi —
// boshqa hech qanday oqim (submit/resubmit, tarix, reyting va h.k.)
// o'zgartirilmagan. Agar siqish biror sababga ko'ra ishlamasa yoki
// natija asl fayldan katta chiqsa, ORIGINAL fayl o'zgarishsiz yuboriladi.

const COMPRESS_CFG = {
  image: {
    minSizeToCompress: 300 * 1024,   // 300 KB dan kichik rasm siqilmaydi
    maxDimension: 1920,              // uzun tomoni shu qiymatdan oshsa kichraytiriladi
    quality: 0.72                    // JPEG sifati (0-1)
  },
  video: {
    // Videolar rasmlarga qaraganda ANCHA ko'proq siqiladi — chunki
    // ularning hajmi odatda eng katta muammo bo'ladi.
    minSizeToCompress: 2 * 1024 * 1024, // 2 MB dan kichik video siqilmaydi
    maxWidth: 960,                       // maksimal kenglik (piksel)
    bitrate: 900 * 1000,                 // ~0.9 Mbps maqsadli bitreyt
    maxDurationSec: 300                  // 5 daqiqadan uzun video siqilmaydi (juda uzoq ketmasligi uchun), original yuboriladi
  }
};

function replaceExtension_(fileName, newExt) {
  const dot = fileName.lastIndexOf('.');
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  return `${base}.${newExt}`;
}

// Rasmni canvas orqali kichraytirib, JPEG sifatida qayta siqadi.
function compressImageFile_(file) {
  return new Promise((resolve) => {
    const cfg = COMPRESS_CFG.image;
    if (!file.type || !file.type.startsWith('image/') || file.type === 'image/gif' || file.size < cfg.minSizeToCompress) {
      resolve(file);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      const maxSide = Math.max(width, height);
      if (maxSide > cfg.maxDimension) {
        const scale = cfg.maxDimension / maxSide;
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (!blob || blob.size >= file.size) {
          resolve(file); // siqish foyda bermadi — original yuboriladi
          return;
        }
        resolve(new File([blob], replaceExtension_(file.name, 'jpg'), { type: 'image/jpeg' }));
      }, 'image/jpeg', cfg.quality);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

// Videoni brauzerda (ffmpeg'siz) qayta kodlaydi: canvas orqali
// kichikroq o'lchamda qayta chiziladi, ovoz asl trekdan olinadi va
// MediaRecorder past bitreytda yozib chiqadi. Brauzer qo'llamasa yoki
// biror muammo yuzaga kelsa — original fayl o'zgarishsiz qaytariladi.
function compressVideoFile_(file) {
  return new Promise((resolve) => {
    const cfg = COMPRESS_CFG.video;

    if (!file.type || !file.type.startsWith('video/') || file.size < cfg.minSizeToCompress) {
      resolve(file);
      return;
    }
    if (typeof MediaRecorder === 'undefined' || !HTMLVideoElement.prototype.captureStream) {
      resolve(file);
      return;
    }

    let settled = false;
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = objectUrl;

    function finish(result) {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objectUrl);
      resolve(result);
    }

    video.onerror = () => finish(file);

    video.onloadedmetadata = () => {
      if (!video.duration || !isFinite(video.duration) || video.duration > cfg.maxDurationSec || !video.videoWidth) {
        finish(file);
        return;
      }

      let width = video.videoWidth;
      let height = video.videoHeight;
      if (width > cfg.maxWidth) {
        height = Math.round(height * (cfg.maxWidth / width));
        width = cfg.maxWidth;
      }
      width -= width % 2;
      height -= height % 2;
      if (!width || !height) { finish(file); return; }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      let mimeType = '';
      ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].some((c) => {
        if (MediaRecorder.isTypeSupported(c)) { mimeType = c; return true; }
        return false;
      });
      if (!mimeType) { finish(file); return; }

      let recorder;
      let combinedStream;
      try {
        const canvasStream = canvas.captureStream(30);
        const sourceStream = video.captureStream ? video.captureStream() : (video.mozCaptureStream ? video.mozCaptureStream() : null);
        const audioTracks = sourceStream ? sourceStream.getAudioTracks() : [];
        combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
        recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: cfg.bitrate });
      } catch (err) {
        finish(file);
        return;
      }

      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

      let rafId = null;
      function drawLoop() {
        if (video.paused || video.ended) return;
        ctx.drawImage(video, 0, 0, width, height);
        rafId = requestAnimationFrame(drawLoop);
      }

      function stopAll() {
        if (rafId) cancelAnimationFrame(rafId);
        if (recorder.state !== 'inactive') recorder.stop();
      }

      // Video kutilganidan uzoq "osilib qolsa" ham jarayon abadiy
      // to'xtab qolmasligi uchun xavfsizlik taymeri.
      const safetyTimer = setTimeout(stopAll, (video.duration + 10) * 1000);

      recorder.onstop = () => {
        clearTimeout(safetyTimer);
        if (!chunks.length) { finish(file); return; }
        const blob = new Blob(chunks, { type: mimeType });
        if (blob.size >= file.size) { finish(file); return; }
        finish(new File([blob], replaceExtension_(file.name, 'webm'), { type: mimeType.split(';')[0] }));
      };

      video.onended = stopAll;
      video.onerror = () => { clearTimeout(safetyTimer); finish(file); };
      video.onplay = () => { recorder.start(); drawLoop(); };

      video.play().catch(() => { clearTimeout(safetyTimer); finish(file); });
    };
  });
}

// Fayl turiga qarab mos siqish funksiyasini tanlaydi. Xatolik yuz
// bersa, asl fayl qaytariladi — yuborish jarayoni hech qachon
// to'xtab qolmaydi.
async function compressFile_(file) {
  try {
    if (file.type && file.type.startsWith('image/')) {
      return await compressImageFile_(file);
    }
    if (file.type && file.type.startsWith('video/')) {
      return await compressVideoFile_(file);
    }
  } catch (err) {
    // Siqishda kutilmagan xatolik — original fayl bilan davom etamiz.
  }
  return file;
}

// Bir nechta faylni backend'ga yuborish uchun kerakli formatga
// ([{fileName, mimeType, fileBase64}, ...]) o'giradi. Yuborishdan oldin
// har bir fayl avtomatik siqiladi (rasm — yengil, video — kuchliroq).
async function filesToPayload(fileList) {
  const files = Array.from(fileList);
  const payload = [];
  for (const file of files) {
    const compressed = await compressFile_(file);
    const fileBase64 = await fileToBase64(compressed);
    payload.push({ fileName: compressed.name, mimeType: compressed.type || file.type, fileBase64 });
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
