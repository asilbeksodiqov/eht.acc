(function () {
  const session = requireAuth('branch');
  if (!session) return;

  document.getElementById('branchLabel').textContent = session.branch;

  const docTypeSelect = document.getElementById('docType');
  const fileInput = document.getElementById('fileInput');
  const fileNameLabel = document.getElementById('fileNameLabel');
  const submitForm = document.getElementById('submitForm');
  const submitBtn = document.getElementById('submitBtn');
  const submitAlert = document.getElementById('submitAlert');
  const historyList = document.getElementById('historyList');
  const historyDateFilter = document.getElementById('historyDateFilter');
  const resubmitFileInput = document.getElementById('resubmitFileInput');
  const videoTelegramField = document.getElementById('videoTelegramField');
  const videoTelegramCheck = document.getElementById('videoTelegramCheck');
  const submitBtnFill = document.getElementById('submitBtnFill');
  const submitBtnLabel = document.getElementById('submitBtnLabel');
  const uploadNotice = document.getElementById('uploadNotice');
  const todayStatusModal = document.getElementById('todayStatusModal');
  const todayStatusTitle = document.getElementById('todayStatusTitle');
  const todayStatusBody = document.getElementById('todayStatusBody');
  const todayStatusCloseBtn = document.getElementById('todayStatusCloseBtn');

  let resubmitTargetId = null;
  let docTypesData = [];

  function closeTodayStatusModal() {
    todayStatusModal.classList.remove('show');
  }
  todayStatusCloseBtn.addEventListener('click', closeTodayStatusModal);
  todayStatusModal.addEventListener('click', (e) => {
    if (e.target === todayStatusModal) closeTodayStatusModal();
  });

  // Tugma ustidagi holatni yangilaydi. `active`=true bo'lsa "Yuborilmoqda..."
  // animatsiyasi ko'rsatiladi (aniq foiz endi kuzatilmaydi), false bo'lsa
  // boshlang'ich holatga qaytadi.
  function setSubmitProgress(active, label) {
    submitBtnFill.style.width = active ? '100%' : '0%';
    submitBtnFill.classList.toggle('is-indeterminate', !!active);
    submitBtnLabel.textContent = label;
  }

  // Faqat shu nomdagi hujjat turi uchun kunlik soat oynasi (frontend
  // tomonda tekshiriladi). Kerak bo'lsa shu ro'yxatga boshqa hujjat
  // turlarini ham xuddi shunday qo'shish mumkin.
  const HOURLY_WINDOW_DOC_TYPES = {
    'Касса хужжатлари': { startHour: 7, endHour: 10 }
  };

  // Berilgan hujjat turi uchun hozir soat oynasi ochiqmi (agar shu turga
  // cheklov belgilangan bo'lsa). Cheklov yo'q turlar uchun har doim true.
  function isHourWindowOpen_(docTypeName) {
    const win = HOURLY_WINDOW_DOC_TYPES[docTypeName];
    if (!win) return true;
    const now = new Date();
    const nowInMinutes = now.getHours() * 60 + now.getMinutes();
    return nowInMinutes >= win.startHour * 60 && nowInMinutes < win.endHour * 60;
  }

  function hourWindowLabel_(docTypeName) {
    const win = HOURLY_WINDOW_DOC_TYPES[docTypeName];
    if (!win) return '';
    const fmt = h => String(h).padStart(2, '0') + ':00';
    return `soat ${fmt(win.startHour)} dan ${fmt(win.endHour)} gacha`;
  }

  init();

  async function init() {
    // Standart holatda faqat BUGUNGI hujjatlar ko'rsatiladi — boshqa
    // sanadagi hujjatlarni ko'rish uchun filial "Sana bo'yicha filtr"
    // maydonidan foydalanadi (yoki uni tozalab, hammasini ko'rishi mumkin).
    historyDateFilter.value = todayStr_();
    loadDocTypes();
    loadHistory();
    showTodayStatusModal();
  }

  // Filial panelga kirganda chiqadigan qisqa ogohlantirish oynasi:
  // bugun dam kuni bo'lsa — yoqimli hordiq xabari; ish kuni bo'lsa —
  // bugun hali yubormagan (faqat HAR KUNI MAJBURIY, ya'ni DocType
  // listida Period=1 bo'lgan) hujjat turlari ro'yxati (agar hammasi
  // yuborilgan bo'lsa — tabrik xabari). Oyna avtomatik yopilmaydi —
  // foydalanuvchi "✕" tugmasi yoki fondan tashqariga bosish orqali
  // o'zi yopadi.
  async function showTodayStatusModal() {
    const res = await apiGet('getTodayMissing', { branch: session.branch });
    if (!res.success) return;

    if (res.isWeekend) {
      todayStatusTitle.textContent = 'Dam kuni 🌿';
      todayStatusBody.innerHTML = `<p class="modal__desc" style="margin-bottom:0;">Bugun dam kuni — hujjat talab qilinmaydi. Dam kunlari yoqimli hordiq tilaymiz!</p>`;
    } else if (res.items && res.items.length) {
      todayStatusTitle.textContent = "Bugun hali yubormagan hujjatlaringiz";
      todayStatusBody.innerHTML = `
        <p class="modal__desc">Quyidagi hujjat turlarini hali yubormadingiz:</p>
        <ul style="margin:0 0 4px; padding-left:18px; font-size:13.5px; color:var(--ink-soft); line-height:1.7;">
          ${res.items.map(i => `<li>${escapeHtml(i.docType)}</li>`).join('')}
        </ul>`;
    } else {
      todayStatusTitle.textContent = 'Ajoyib! ✅';
      todayStatusBody.innerHTML = `<p class="modal__desc" style="margin-bottom:0;">Bugungi barcha hujjatlaringiz yuborilgan.</p>`;
    }

    todayStatusModal.classList.add('show');
  }

  function todayStr_() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  async function loadDocTypes() {
    const res = await apiGet('getDocTypes');
    if (!res.success) return;
    docTypesData = res.docTypes;
    docTypesData.forEach(dt => {
      const opt = document.createElement('option');
      opt.value = dt.name;
      let label = dt.name;
      if (Number(dt.period) > 1) label += ' (davriy)';
      if (!dt.isOpenToday) {
        label += ' — bugun dam kuni, yopiq';
        opt.disabled = true;
      } else if (!isHourWindowOpen_(dt.name)) {
        label += ` — hozir yopiq (${hourWindowLabel_(dt.name)} ochiq)`;
        opt.disabled = true;
      }
      opt.textContent = label;
      docTypeSelect.appendChild(opt);
    });
  }

  // byWho=2 (kassir) bo'lgan hujjat turlari tanlanganda, "Video Telegram
  // orqali jo'natildi" degan ixtiyoriy checkbox ko'rsatiladi. Belgilash
  // majburiy emas — filial xohlasa belgilaydi, xohlamasa bo'sh qoldiradi.
  docTypeSelect.addEventListener('change', () => {
    const selected = docTypesData.find(dt => dt.name === docTypeSelect.value);
    const showCheckbox = !!selected && Number(selected.byWho) === 2;
    videoTelegramField.style.display = showCheckbox ? '' : 'none';
    if (!showCheckbox) videoTelegramCheck.checked = false;
  });

  // Video fayl tanlanganligini tekshiradi — video yuborish taqiqlangan.
  function hasVideoFile_(fileList) {
    return Array.from(fileList).some(f => String(f.type || '').toLowerCase().indexOf('video/') === 0);
  }

  fileInput.addEventListener('change', () => {
    const files = fileInput.files;
    if (hasVideoFile_(files)) {
      alert('Video fayl yuborish mumkin emas. Faqat hujjat yoki rasm tanlang.');
      fileInput.value = '';
      fileNameLabel.textContent = '';
      return;
    }
    if (!files.length) {
      fileNameLabel.textContent = '';
    } else if (files.length === 1) {
      fileNameLabel.textContent = files[0].name;
    } else {
      fileNameLabel.textContent = `${files.length} ta fayl tanlandi: ` + Array.from(files).map(f => f.name).join(', ');
    }
  });

  submitForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert(submitAlert);

    const docType = docTypeSelect.value;
    const files = fileInput.files;
    if (!docType || !files.length) {
      showAlert(submitAlert, 'Hujjat turini tanlang va kamida bitta fayl yuklang');
      return;
    }
    if (!isHourWindowOpen_(docType)) {
      showAlert(submitAlert, `"${docType}" hujjatini faqat ${hourWindowLabel_(docType)} yuborish mumkin`);
      return;
    }
    if (hasVideoFile_(files)) {
      showAlert(submitAlert, 'Video fayl yuborish mumkin emas. Faqat hujjat yoki rasm tanlang.');
      return;
    }

    submitBtn.disabled = true;
    setSubmitProgress(true, 'Yuborilmoqda...');
    uploadNotice.classList.add('show');

    try {
      // Bir nechta fayl tanlangan bo'lsa ham, hammasi BITTA so'rov bilan
      // yuboriladi — natijada Report listida faqat BITTA qator (bitta
      // SubmissionID) hosil bo'ladi, fayllar esa shu qatorning
      // FilePath'i ko'rsatgan bitta papkaga joylanadi.
      const filesPayload = await filesToPayload(files);

      const res = await apiPostWithProgress('submitDocument', {
        branch: session.branch,
        docType,
        files: filesPayload,
        videoSentViaTelegram: videoTelegramField.style.display !== 'none' && videoTelegramCheck.checked
      }, (active) => setSubmitProgress(active, active ? 'Yuborilmoqda...' : 'Yuborish'));

      if (res.success) {
        submitForm.reset();
        fileNameLabel.textContent = '';
        videoTelegramField.style.display = 'none';
        showAlert(submitAlert, 'Hujjat muvaffaqiyatli yuborildi', 'success');
      } else {
        showAlert(submitAlert, res.message || 'Yuborishda xatolik yuz berdi');
      }
    } catch (err) {
      showAlert(submitAlert, "Yuborib bo'lmadi. Internetni tekshiring va qayta urinib ko'ring");
    }

    uploadNotice.classList.remove('show');
    submitBtn.disabled = false;
    setSubmitProgress(false, 'Yuborish');

    loadHistory();
  });

  historyDateFilter.addEventListener('change', loadHistory);

  async function loadHistory() {
    const params = { branch: session.branch };
    if (historyDateFilter.value) params.date = historyDateFilter.value;

    const res = await apiGet('getMyHistory', params);
    if (!res.success || !res.items.length) {
      historyList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🗂️</div>
          <div class="empty-state__title">Hozircha hujjat yo'q</div>
          <div class="empty-state__desc">Yuborilgan hujjatlaringiz shu yerda ko'rinadi</div>
        </div>`;
      return;
    }

    historyList.innerHTML = res.items.map(renderHistoryItem).join('');

    document.querySelectorAll('[data-resubmit]').forEach(btn => {
      btn.addEventListener('click', () => {
        resubmitTargetId = btn.getAttribute('data-resubmit');
        resubmitFileInput.value = '';
        resubmitFileInput.click();
      });
    });

    document.querySelectorAll('[data-ack]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const submissionId = btn.getAttribute('data-ack');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner spinner-dark"></span>';
        const res = await apiPost('ackComment', { submissionId, branch: session.branch });
        if (!res.success) {
          alert(res.message || 'Amalni bajarishda xatolik yuz berdi');
          btn.disabled = false;
          btn.textContent = 'Tushunarli';
          return;
        }
        loadHistory();
      });
    });
  }

  resubmitFileInput.addEventListener('change', async () => {
    const files = resubmitFileInput.files;
    if (!files.length || !resubmitTargetId) return;
    if (hasVideoFile_(files)) {
      alert('Video fayl yuborish mumkin emas. Faqat hujjat yoki rasm tanlang.');
      resubmitFileInput.value = '';
      return;
    }

    const btn = document.querySelector(`[data-resubmit="${resubmitTargetId}"]`);
    const originalText = btn ? btn.textContent : '';
    // "Qayta yuborish" tugmasi och (ghost) fonli bo'lgani uchun, standart
    // oq spinner unda ko'rinmay, tugma "bo'sh" bo'lib qolganday tuyulardi —
    // shu sababli shu yerda to'q rangli (.spinner-dark) variant ishlatiladi.
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner spinner-dark"></span>';
    }

    try {
      const filesPayload = await filesToPayload(files);
      const res = await apiPost('resubmitDocument', {
        submissionId: resubmitTargetId,
        files: filesPayload
      });

      if (!res.success) {
        alert(res.message || 'Yuborishda xatolik yuz berdi');
        if (btn) {
          btn.disabled = false;
          btn.textContent = originalText;
        }
      } else {
        loadHistory();
      }
    } catch (err) {
      alert("Yuborib bo'lmadi. Internetni tekshiring va qayta urinib ko'ring");
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    }
  });

  function renderHistoryItem(item) {
    const meta = statusMeta(item.status);
    const canResubmit = item.status === 'Qaytarildi' || item.status === 'Yuborilmadi';
    const resubmitLabel = item.status === 'Yuborilmadi' ? 'Yuborish' : 'Qayta yuborish';
    const note = ((item.status === 'Qaytarildi' || item.status === 'Almashtirildi') && (item.errorType || item.comment))
      ? `<div class="history-item__note"><strong>${escapeHtml(item.errorType || 'Izoh')}:</strong> ${escapeHtml(item.comment || '')}</div>`
      : '';

    // Admin izoh bilan tasdiqlagan hujjatlar uchun "Tushunarli" tugmasi —
    // bosilgach admin panelida "filial o'qidi" belgisi chiqadi.
    const hasApprovedComment = item.status === 'Tasdiqlandi' && (item.errorType || item.comment);
    let ackBlock = '';
    if (hasApprovedComment) {
      ackBlock = `<div class="history-item__note"><strong>${escapeHtml(item.errorType || 'Izoh')}:</strong> ${escapeHtml(item.comment || '')}</div>`;
      ackBlock += item.ackRead
        ? `<div class="ack-badge">✅ Tushunarli deb belgilandi</div>`
        : `<button class="btn btn-ghost btn-sm ack-btn" data-ack="${escapeHtml(item.submissionId)}">Tushunarli</button>`;
    }

    return `
      <div class="history-item">
        <div class="history-item__main">
          <div class="history-item__title">${escapeHtml(item.docType)}</div>
          <div class="history-item__meta">${escapeHtml(item.uploadDate)}${item.uploadTime ? ' · ' + escapeHtml(item.uploadTime) : ''} · Versiya ${escapeHtml(String(item.version))} · ID: ${escapeHtml(item.submissionId)}</div>
          ${renderStepper(item.status)}
          ${note}
          ${ackBlock}
        </div>
        <div class="history-item__actions">
          <span class="status-pill ${meta.cls}">${meta.label}</span>
          ${canResubmit ? `<button class="btn btn-ghost btn-sm" data-resubmit="${escapeHtml(item.submissionId)}">${resubmitLabel}</button>` : ''}
        </div>
      </div>`;
  }
})();
