(function () {
  const session = requireAuthAny(['admin', 'buxgalter', 'kassir']);
  if (!session) return;

  const ROLE_LABELS = { admin: 'Admin', buxgalter: 'Buxgalter', kassir: 'Kassir' };
  const roleBadge = document.getElementById('roleBadge');
  if (roleBadge) roleBadge.textContent = ROLE_LABELS[session.role] || session.role;

  const branchSelect = document.getElementById('branchSelect');
  const dateInput = document.getElementById('dateInput');
  const docTypeSelect = document.getElementById('docTypeSelect');
  const statusFilterSelect = document.getElementById('statusFilterSelect');
  const searchBtn = document.getElementById('searchBtn');
  const resultsWrap = document.getElementById('resultsWrap');

  const missingBranchFilter = document.getElementById('missingBranchFilter');
  const missingDocTypeFilter = document.getElementById('missingDocTypeFilter');
  const missingList = document.getElementById('missingList');
  const missingToggle = document.getElementById('missingToggle');
  const missingBody = document.getElementById('missingBody');
  const missingChevron = document.getElementById('missingChevron');

  const editModal = document.getElementById('editModal');
  const editCloseBtn = document.getElementById('editCloseBtn');
  const editCancelBtn = document.getElementById('editCancelBtn');
  const editSaveBtn = document.getElementById('editSaveBtn');
  const editAlert = document.getElementById('editAlert');
  const editDocType = document.getElementById('editDocType');
  const editUploadDate = document.getElementById('editUploadDate');
  const editStatus = document.getElementById('editStatus');
  const editVideoTelegram = document.getElementById('editVideoTelegram');

  const deleteModal = document.getElementById('deleteModal');
  const deleteCancelBtn = document.getElementById('deleteCancelBtn');
  const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');

  let editTargetId = null;
  let deleteTargetId = null;

  // "Yuborilmaganlar" oynasi standart holatda yopiq — sarlavha bosilganda
  // dropdown kabi ochiladi/yopiladi
  missingToggle.addEventListener('click', () => {
    const isOpen = missingBody.classList.toggle('is-open');
    missingChevron.classList.toggle('is-open', isOpen);
    missingToggle.setAttribute('aria-expanded', String(isOpen));
  });

  // ---------- Tahrirlash oynasi ----------
  function closeEditModal() {
    editModal.classList.remove('show');
    hideAlert(editAlert);
    editTargetId = null;
  }
  editCloseBtn.addEventListener('click', closeEditModal);
  editCancelBtn.addEventListener('click', closeEditModal);
  editModal.addEventListener('click', (e) => { if (e.target === editModal) closeEditModal(); });

  function openEditModal(item) {
    editTargetId = item.submissionId;
    hideAlert(editAlert);
    editDocType.innerHTML = '';
    allDocTypeNames.forEach(name => editDocType.appendChild(makeOption(name, name)));
    editDocType.value = item.docType;
    editUploadDate.value = item.uploadDate || '';
    editStatus.value = item.status || 'Yuborildi';
    editVideoTelegram.checked = !!item.videoTelegram;
    editModal.classList.add('show');
  }

  editSaveBtn.addEventListener('click', async () => {
    if (!editTargetId) return;
    if (!editDocType.value || !editUploadDate.value) {
      showAlert(editAlert, "Hujjat turi va sanani to'ldiring");
      return;
    }
    editSaveBtn.disabled = true;
    editSaveBtn.innerHTML = '<span class="spinner spinner-dark"></span>';

    const res = await apiPost('editSubmission', {
      submissionId: editTargetId,
      docType: editDocType.value,
      uploadDate: editUploadDate.value,
      status: editStatus.value,
      videoTelegram: editVideoTelegram.checked,
      role: session.role
    });

    editSaveBtn.disabled = false;
    editSaveBtn.textContent = 'Saqlash';

    if (!res.success) {
      showAlert(editAlert, res.message || 'Saqlashda xatolik yuz berdi');
      return;
    }

    closeEditModal();
    runSearch();
    loadMissingToday();
  });

  // ---------- O'chirishni tasdiqlash oynasi ----------
  function closeDeleteModal() {
    deleteModal.classList.remove('show');
    deleteTargetId = null;
  }
  deleteCancelBtn.addEventListener('click', closeDeleteModal);
  deleteModal.addEventListener('click', (e) => { if (e.target === deleteModal) closeDeleteModal(); });

  function openDeleteModal(submissionId) {
    deleteTargetId = submissionId;
    deleteModal.classList.add('show');
  }

  deleteConfirmBtn.addEventListener('click', async () => {
    if (!deleteTargetId) return;
    deleteConfirmBtn.disabled = true;
    deleteConfirmBtn.innerHTML = '<span class="spinner"></span>';

    const res = await apiPost('deleteSubmission', { submissionId: deleteTargetId, role: session.role });

    deleteConfirmBtn.disabled = false;
    deleteConfirmBtn.textContent = 'Ha, o\'chirish';

    if (!res.success) {
      alert(res.message || "O'chirishda xatolik yuz berdi");
      return;
    }

    closeDeleteModal();
    runSearch();
    loadMissingToday();
  });

  let allDocTypeNames = [];
  let allMissingItems = [];

  init();

  async function init() {
    const [branchesRes, docTypesRes] = await Promise.all([
      apiGet('getBranches'),
      apiGet('getDocTypes', { role: session.role })
    ]);

    if (branchesRes.success) {
      branchesRes.branches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        branchSelect.appendChild(opt);
        missingBranchFilter.appendChild(makeOption(b, b));
      });
    }
    if (docTypesRes.success) {
      allDocTypeNames = docTypesRes.docTypes.map(dt => dt.name);
      allDocTypeNames.forEach(name => {
        docTypeSelect.appendChild(makeOption(name, name));
        missingDocTypeFilter.appendChild(makeOption(name, name));
      });
    }

    loadMissingToday();
  }

  function makeOption(value, text) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    return opt;
  }

  // ---------- Bugungi yuborilmaganlar ----------
  async function loadMissingToday() {
    const res = await apiGet('getTodayMissing', { role: session.role });
    if (!res.success) {
      missingList.innerHTML = `<div class="empty-state"><div class="empty-state__desc">Yuklab bo'lmadi</div></div>`;
      return;
    }
    allMissingItems = res.items;
    document.getElementById('missingCountBadge').textContent = String(allMissingItems.length);
    renderMissingList();
  }

  missingDocTypeFilter.addEventListener('change', renderMissingList);
  missingBranchFilter.addEventListener('change', renderMissingList);

  function renderMissingList() {
    const docTypeVal = missingDocTypeFilter.value;
    const branchVal = missingBranchFilter.value;
    let items = allMissingItems;
    if (docTypeVal) items = items.filter(i => i.docType === docTypeVal);
    if (branchVal) items = items.filter(i => i.branch === branchVal);

    if (!items.length) {
      missingList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">✅</div>
          <div class="empty-state__title">Yuborilmagan hujjat yo'q</div>
          <div class="empty-state__desc">Bugun barcha majburiy hujjatlar yuborilgan (yoki bugun dam kuni)</div>
        </div>`;
      return;
    }

    missingList.innerHTML = items.map(i => `
      <div class="missing-item">
        <span class="missing-item__branch">${escapeHtml(i.branch)}</span>
        <span class="missing-item__doctype">${escapeHtml(i.docType)}</span>
      </div>
    `).join('');
  }

  // ---------- Qidiruv ----------
  searchBtn.addEventListener('click', runSearch);

  // Natijalarni sahifalash — bir sahifada ko'rsatiladigan hujjatlar soni.
  // "Barchasi" filtri bilan qidirilganda ko'p hujjat chiqishi mumkin, shuning
  // uchun natijalar 10 tadan bo'lib, "Keyingi 10 ta" tugmasi bilan ko'rsatiladi.
  const SEARCH_PAGE_SIZE = 10;
  let searchResultItems = [];
  let searchCurrentPage = 0;

  async function runSearch() {
    resultsWrap.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⏳</div><div class="empty-state__title">Qidirilmoqda...</div></div>`;

    const res = await apiGet('getAdminSubmissions', {
      branch: branchSelect.value,
      date: dateInput.value,
      docType: docTypeSelect.value,
      statusFilter: statusFilterSelect.value,
      role: session.role
    });

    if (!res.success || !res.items.length) {
      searchResultItems = [];
      resultsWrap.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🗂️</div>
          <div class="empty-state__title">Hujjat topilmadi</div>
          <div class="empty-state__desc">Tanlangan filtrlar bo'yicha yuborilgan hujjat yo'q</div>
        </div>`;
      return;
    }

    searchResultItems = res.items;
    searchCurrentPage = 0;
    renderSearchResultsPage();
  }

  // Joriy sahifadagi hujjatlarni (10 tadan) chizadi va pastida
  // "Oldingi/Keyingi" navigatsiya tugmalarini ko'rsatadi (agar kerak bo'lsa).
  function renderSearchResultsPage() {
    const totalPages = Math.max(1, Math.ceil(searchResultItems.length / SEARCH_PAGE_SIZE));
    if (searchCurrentPage >= totalPages) searchCurrentPage = totalPages - 1;
    if (searchCurrentPage < 0) searchCurrentPage = 0;

    const start = searchCurrentPage * SEARCH_PAGE_SIZE;
    const pageItems = searchResultItems.slice(start, start + SEARCH_PAGE_SIZE);

    resultsWrap.innerHTML = pageItems.map(renderResultCard).join('') + renderSearchPagination(totalPages);
    bindToggleEvents();
    pageItems.forEach(bindCardEvents);

    const prevBtn = document.getElementById('searchPagePrev');
    const nextBtn = document.getElementById('searchPageNext');
    if (prevBtn) prevBtn.addEventListener('click', () => {
      if (searchCurrentPage > 0) {
        searchCurrentPage--;
        renderSearchResultsPage();
        resultsWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    if (nextBtn) nextBtn.addEventListener('click', () => {
      if (searchCurrentPage < totalPages - 1) {
        searchCurrentPage++;
        renderSearchResultsPage();
        resultsWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  function renderSearchPagination(totalPages) {
    if (totalPages <= 1) return '';
    const page = searchCurrentPage + 1;
    return `
      <div class="search-pagination" style="display:flex;align-items:center;justify-content:center;gap:12px;margin-top:16px;">
        <button type="button" class="btn btn-ghost btn-sm" id="searchPagePrev" ${searchCurrentPage === 0 ? 'disabled' : ''}>← Oldingi</button>
        <span class="text-faint" style="font-size:13px;">Sahifa ${page} / ${totalPages} (jami ${searchResultItems.length} ta)</span>
        <button type="button" class="btn btn-ghost btn-sm" id="searchPageNext" ${searchCurrentPage === totalPages - 1 ? 'disabled' : ''}>Keyingi →</button>
      </div>`;
  }

  function renderResultCard(item) {
    const meta = statusMeta(item.status);
    const isFileless = item.status === 'Yuborilmadi' || item.status === 'Mavjud emas' || item.status === 'Almashtirildi';
    const filelessText = item.status === 'Mavjud emas'
      ? 'Filial bu hujjat turi mavjud emasligini tasdiqlagan'
      : item.status === 'Almashtirildi'
        ? "Bu versiya qayta yuborilgan — ro'yxatdan yangi versiyani qidiring"
        : 'Bu filial hali fayl yuklamagan';

    const ackBadge = item.ackRead
      ? `<div class="ack-badge">✅ Filial izohni o'qidi (${escapeHtml(item.ackRead)})</div>`
      : '';

    const videoTelegramBadge = item.videoTelegram
      ? `<div class="ack-badge">🎥 Video Telegram orqali jo'natilgan</div>`
      : '';

    return `
      <div class="compact-item" id="card-${cssId(item.submissionId)}">
        <button type="button" class="compact-item__head" data-toggle="${escapeHtml(item.submissionId)}">
          <div class="compact-item__names">
            <div class="compact-item__branch">${escapeHtml(item.branch)}</div>
            <div class="compact-item__doctype">${escapeHtml(item.docType)}</div>
          </div>
          <span class="status-pill ${meta.cls}">${meta.label}</span>
          <span class="compact-item__chevron" id="chevron-${cssId(item.submissionId)}">▾</span>
        </button>

        <div class="compact-item__body" id="body-${cssId(item.submissionId)}">
          <div class="history-item__meta" style="margin-bottom:8px;">${escapeHtml(item.uploadDate)}${item.uploadTime ? ' · ' + escapeHtml(item.uploadTime) : ''} · Versiya ${escapeHtml(String(item.version))} · ID: ${escapeHtml(item.submissionId)}</div>

          ${renderStepper(item.status)}

          ${!isFileless ? `<a href="${escapeHtml(item.filePath)}" target="_blank" rel="noopener" class="result-card__file">📄 Faylni yoki rasmni ko'rish</a>` : `<div class="text-faint" style="margin:10px 0;">${filelessText}</div>`}

          ${(item.status === 'Qaytarildi' || item.status === 'Tasdiqlandi' || item.status === 'Almashtirildi') && (item.errorType || item.comment) ? `
            <div class="history-item__note"><strong>${escapeHtml(item.errorType || 'Izoh')}:</strong> ${escapeHtml(item.comment || '—')}</div>
          ` : ''}
          ${ackBadge}
          ${videoTelegramBadge}

          ${item.status === 'Yuborildi' ? `
            <div class="result-card__actions">
              <button class="btn btn-accent btn-sm" data-action="approve-clean" data-id="${escapeHtml(item.submissionId)}">Tasdiqlash (xatosiz)</button>
              <button class="btn btn-ghost btn-sm" data-action="approve-note" data-id="${escapeHtml(item.submissionId)}">Tasdiqlash (izoh bilan)</button>
              <button class="btn btn-danger btn-sm" data-action="return" data-id="${escapeHtml(item.submissionId)}">Qaytarish</button>
            </div>

            <div class="review-box" id="review-approve-${cssId(item.submissionId)}">
              <div class="field">
                <label>Xato turi (ixtiyoriy)</label>
                <input type="text" id="errType-approve-${cssId(item.submissionId)}" placeholder="Masalan: imzo yetishmaydi">
              </div>
              <div class="field">
                <label>Izoh</label>
                <textarea id="comment-approve-${cssId(item.submissionId)}" placeholder="Izoh yozing..."></textarea>
              </div>
              <button class="btn btn-accent btn-sm" data-action="confirm-approve" data-id="${escapeHtml(item.submissionId)}">Tasdiqlashni yakunlash</button>
            </div>

            <div class="review-box" id="review-return-${cssId(item.submissionId)}">
              <div class="field">
                <label>Xato turi</label>
                <input type="text" id="errType-return-${cssId(item.submissionId)}" placeholder="Masalan: sifatsiz skan" required>
              </div>
              <div class="field">
                <label>Izoh</label>
                <textarea id="comment-return-${cssId(item.submissionId)}" placeholder="Filialga nima uchun qaytarilayotganini yozing..." required></textarea>
              </div>
              <button class="btn btn-danger btn-sm" data-action="confirm-return" data-id="${escapeHtml(item.submissionId)}">Qaytarishni yakunlash</button>
            </div>
          ` : ''}

          <div class="compact-item__manage">
            <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${escapeHtml(item.submissionId)}">✏️ Tahrirlash</button>
            <button class="btn btn-danger btn-sm" data-action="delete" data-id="${escapeHtml(item.submissionId)}">🗑️ O'chirish</button>
          </div>
        </div>
      </div>`;
  }

  function cssId(id) {
    return String(id).replace(/[^a-zA-Z0-9]/g, '');
  }

  // Har bir hujjat kartasi standart holatda yopiq — sarlavha (filial +
  // hujjat nomi) bosilganda dropdown kabi ochilib, to'liq ma'lumot,
  // fayl ko'rish va amal tugmalarini ko'rsatadi.
  function bindToggleEvents() {
    document.querySelectorAll('[data-toggle]').forEach(headBtn => {
      headBtn.addEventListener('click', () => {
        const id = headBtn.getAttribute('data-toggle');
        const body = document.getElementById(`body-${cssId(id)}`);
        const chevron = document.getElementById(`chevron-${cssId(id)}`);
        if (!body) return;
        const isOpen = body.classList.toggle('is-open');
        if (chevron) chevron.classList.toggle('is-open', isOpen);
      });
    });
  }

  // Bitta hujjat kartasi ichida faqat bitta review-box (tasdiqlash yoki
  // qaytarish) ochiq turishi uchun, yangisini ochishdan oldin ikkalasini
  // ham yopib qo'yamiz.
  function closeReviewBoxes(id) {
    const approveBox = document.getElementById(`review-approve-${cssId(id)}`);
    const returnBox = document.getElementById(`review-return-${cssId(id)}`);
    if (approveBox) approveBox.classList.remove('show');
    if (returnBox) returnBox.classList.remove('show');
  }

  function bindCardEvents(item) {
    const id = item.submissionId;
    const card = document.getElementById(`card-${cssId(id)}`);
    if (!card) return;

    const cleanBtn = card.querySelector('[data-action="approve-clean"]');
    const noteBtn = card.querySelector('[data-action="approve-note"]');
    const returnBtn = card.querySelector('[data-action="return"]');
    const confirmApproveBtn = card.querySelector('[data-action="confirm-approve"]');
    const confirmReturnBtn = card.querySelector('[data-action="confirm-return"]');
    const editBtn = card.querySelector('[data-action="edit"]');
    const deleteBtn = card.querySelector('[data-action="delete"]');

    if (editBtn) editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal(item);
    });
    if (deleteBtn) deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openDeleteModal(id);
    });

    if (cleanBtn) cleanBtn.addEventListener('click', () => sendAdminAction(id, 'approve', '', '', cleanBtn));
    if (noteBtn) noteBtn.addEventListener('click', () => {
      closeReviewBoxes(id);
      document.getElementById(`review-approve-${cssId(id)}`).classList.add('show');
    });
    if (returnBtn) returnBtn.addEventListener('click', () => {
      closeReviewBoxes(id);
      document.getElementById(`review-return-${cssId(id)}`).classList.add('show');
    });
    if (confirmApproveBtn) confirmApproveBtn.addEventListener('click', () => {
      const errType = document.getElementById(`errType-approve-${cssId(id)}`).value;
      const comment = document.getElementById(`comment-approve-${cssId(id)}`).value;
      sendAdminAction(id, 'approve', errType, comment, confirmApproveBtn);
    });
    if (confirmReturnBtn) confirmReturnBtn.addEventListener('click', () => {
      const errType = document.getElementById(`errType-return-${cssId(id)}`).value;
      const comment = document.getElementById(`comment-return-${cssId(id)}`).value;
      if (!errType.trim() || !comment.trim()) {
        alert("Xato turi va izohni to'ldiring");
        return;
      }
      sendAdminAction(id, 'return', errType, comment, confirmReturnBtn);
    });
  }

  async function sendAdminAction(submissionId, decision, errorType, comment, btn) {
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    const res = await apiPost('adminAction', { submissionId, decision, errorType, comment, role: session.role });

    if (!res.success) {
      alert(res.message || 'Amalni bajarishda xatolik yuz berdi');
      btn.disabled = false;
      btn.textContent = originalText;
      return;
    }

    runSearch();
    loadMissingToday();
  }
})();
