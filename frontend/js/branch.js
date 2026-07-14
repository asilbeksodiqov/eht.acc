(function () {
  const session = requireAuth('branch');
  if (!session) return;

  document.getElementById('branchLabel').textContent = session.branch + ' filiali';

  const docTypeSelect = document.getElementById('docType');
  const fileInput = document.getElementById('fileInput');
  const fileNameLabel = document.getElementById('fileNameLabel');
  const submitForm = document.getElementById('submitForm');
  const submitBtn = document.getElementById('submitBtn');
  const submitAlert = document.getElementById('submitAlert');
  const historyList = document.getElementById('historyList');
  const historyDateFilter = document.getElementById('historyDateFilter');
  const resubmitFileInput = document.getElementById('resubmitFileInput');
  const rankingList = document.getElementById('rankingList');
  const rankingToggle = document.getElementById('rankingToggle');
  const rankingBody = document.getElementById('rankingBody');
  const rankingChevron = document.getElementById('rankingChevron');

  const notAvailableBtn = document.getElementById('notAvailableBtn');
  const notAvailableModal = document.getElementById('notAvailableModal');
  const notAvailableDocTypeName = document.getElementById('notAvailableDocTypeName');
  const notAvailableCancelBtn = document.getElementById('notAvailableCancelBtn');
  const notAvailableConfirmBtn = document.getElementById('notAvailableConfirmBtn');

  let resubmitTargetId = null;
  let docTypesData = [];

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
    loadRanking();
  }

  function todayStr_() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Reyting oynasi standart holatda yopiq — dropdown orqali ochiladi
  rankingToggle.addEventListener('click', () => {
    const isOpen = rankingBody.classList.toggle('is-open');
    rankingChevron.classList.toggle('is-open', isOpen);
    rankingToggle.setAttribute('aria-expanded', String(isOpen));
  });

  async function loadDocTypes() {
    const res = await apiGet('getDocTypes');
    if (!res.success) return;
    docTypesData = res.docTypes;
    docTypesData.forEach(dt => {
      const opt = document.createElement('option');
      opt.value = dt.name;
      let label = dt.name;
      if (Number(dt.period) > 1) label += ` (har ${dt.period} kunda)`;
      if (!dt.isOpenToday) {
        label += ' — bugun yopiq';
        opt.disabled = true;
      } else if (!isHourWindowOpen_(dt.name)) {
        label += ` — hozir yopiq (${hourWindowLabel_(dt.name)} ochiq)`;
        opt.disabled = true;
      }
      opt.textContent = label;
      docTypeSelect.appendChild(opt);
    });
  }

  // 15 kunda (yoki boshqa davriylikda) bir marta yuboriladigan hujjat turi
  // ochilgan kunda tanlanganda, "Yuborish" tugmasi yonida "Mavjud emas"
  // tugmasi ham chiqadi.
  docTypeSelect.addEventListener('change', updateNotAvailableButton);

  function updateNotAvailableButton() {
    const dt = docTypesData.find(d => d.name === docTypeSelect.value);
    const showBtn = !!dt && Number(dt.period) > 1 && dt.isOpenToday;
    notAvailableBtn.style.display = showBtn ? '' : 'none';
  }

  notAvailableBtn.addEventListener('click', () => {
    if (!docTypeSelect.value) return;
    notAvailableDocTypeName.textContent = docTypeSelect.value;
    notAvailableModal.classList.add('show');
  });

  notAvailableCancelBtn.addEventListener('click', () => {
    notAvailableModal.classList.remove('show');
  });

  notAvailableConfirmBtn.addEventListener('click', async () => {
    const docType = docTypeSelect.value;
    if (!docType) {
      notAvailableModal.classList.remove('show');
      return;
    }

    const originalText = notAvailableConfirmBtn.textContent;
    notAvailableConfirmBtn.disabled = true;
    notAvailableConfirmBtn.innerHTML = '<span class="spinner"></span>';

    const res = await apiPost('markNotAvailable', { branch: session.branch, docType });

    notAvailableConfirmBtn.disabled = false;
    notAvailableConfirmBtn.textContent = originalText;
    notAvailableModal.classList.remove('show');

    if (!res.success) {
      alert(res.message || 'Amalni bajarishda xatolik yuz berdi');
      return;
    }

    hideAlert(submitAlert);
    showAlert(submitAlert, `"${docType}" mavjud emas deb qayd etildi`, 'success');
    submitForm.reset();
    fileNameLabel.textContent = '';
    notAvailableBtn.style.display = 'none';
    loadHistory();
  });

  fileInput.addEventListener('change', () => {
    const files = fileInput.files;
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

    submitBtn.disabled = true;
    submitBtn.textContent = 'Yuborilmoqda...';

    try {
      // Bir nechta fayl tanlangan bo'lsa ham, hammasi BITTA so'rov bilan
      // yuboriladi — natijada Report listida faqat BITTA qator (bitta
      // SubmissionID) hosil bo'ladi, fayllar esa shu qatorning
      // FilePath'i ko'rsatgan bitta papkaga joylanadi.
      const filesPayload = await filesToPayload(files);
      const res = await apiPost('submitDocument', {
        branch: session.branch,
        docType,
        files: filesPayload
      });

      if (res.success) {
        submitForm.reset();
        fileNameLabel.textContent = '';
        updateNotAvailableButton();
        showAlert(submitAlert, 'Hujjat muvaffaqiyatli yuborildi', 'success');
      } else {
        showAlert(submitAlert, res.message || 'Yuborishda xatolik yuz berdi');
      }
    } catch (err) {
      showAlert(submitAlert, "Yuborib bo'lmadi. Internetni tekshiring va qayta urinib ko'ring");
    }

    submitBtn.disabled = false;
    submitBtn.textContent = 'Yuborish';

    loadHistory();
    loadRanking();
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
  }

  resubmitFileInput.addEventListener('change', async () => {
    const files = resubmitFileInput.files;
    if (!files.length || !resubmitTargetId) return;

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
        loadRanking();
      }
    } catch (err) {
      alert("Yuborib bo'lmadi. Internetni tekshiring va qayta urinib ko'ring");
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    }
  });

  async function loadRanking() {
    const res = await apiGet('getRanking');
    if (!res.success || !res.ranking.length) {
      rankingList.innerHTML = `<div class="empty-state"><div class="empty-state__desc">Ma'lumot yo'q</div></div>`;
      return;
    }
    rankingList.innerHTML = res.ranking.map((r, idx) => {
      const isSelf = r.branch === session.branch;
      const isTop = idx === 0 && r.errorCount > 0;
      return `
        <div class="ranking-item ${isTop ? 'is-top' : ''} ${isSelf ? 'is-self' : ''}">
          <div class="ranking-item__rank">${idx + 1}</div>
          <div class="ranking-item__name">${escapeHtml(r.branch)}${isSelf ? ' (siz)' : ''}</div>
          <div class="ranking-item__count">${r.errorCount} ta xato</div>
        </div>`;
    }).join('');
  }

  function renderHistoryItem(item) {
    const meta = statusMeta(item.status);
    const canResubmit = item.status === 'Qaytarildi' || item.status === 'Yuborilmadi';
    const resubmitLabel = item.status === 'Yuborilmadi' ? 'Yuborish' : 'Qayta yuborish';
    const note = ((item.status === 'Qaytarildi' || item.status === 'Almashtirildi') && (item.errorType || item.comment))
      ? `<div class="history-item__note"><strong>${escapeHtml(item.errorType || 'Izoh')}:</strong> ${escapeHtml(item.comment || '')}</div>`
      : '';

    return `
      <div class="history-item">
        <div class="history-item__main">
          <div class="history-item__title">${escapeHtml(item.docType)}</div>
          <div class="history-item__meta">${escapeHtml(item.uploadDate)}${item.uploadTime ? ' · ' + escapeHtml(item.uploadTime) : ''} · Versiya ${escapeHtml(String(item.version))} · ID: ${escapeHtml(item.submissionId)}</div>
          ${renderStepper(item.status)}
          ${note}
        </div>
        <div class="history-item__actions">
          <span class="status-pill ${meta.cls}">${meta.label}</span>
          ${canResubmit ? `<button class="btn btn-ghost btn-sm" data-resubmit="${escapeHtml(item.submissionId)}">${resubmitLabel}</button>` : ''}
        </div>
      </div>`;
  }
})();
