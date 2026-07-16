(function () {
  const session = requireAuth('admin');
  if (!session) return;

  const branchSelect = document.getElementById('branchSelect');
  const dateInput = document.getElementById('dateInput');
  const docTypeSelect = document.getElementById('docTypeSelect');
  const statusFilterSelect = document.getElementById('statusFilterSelect');
  const searchBtn = document.getElementById('searchBtn');
  const resultsWrap = document.getElementById('resultsWrap');

  const missingDocTypeFilter = document.getElementById('missingDocTypeFilter');
  const missingList = document.getElementById('missingList');
  const missingToggle = document.getElementById('missingToggle');
  const missingBody = document.getElementById('missingBody');
  const missingChevron = document.getElementById('missingChevron');
  const rankingList = document.getElementById('rankingList');
  const rankingToggle = document.getElementById('rankingToggle');
  const rankingBody = document.getElementById('rankingBody');
  const rankingChevron = document.getElementById('rankingChevron');

  // Reyting va "yuborilmaganlar" oynalari standart holatda yopiq — sarlavha
  // bosilganda dropdown kabi ochiladi/yopiladi
  missingToggle.addEventListener('click', () => {
    const isOpen = missingBody.classList.toggle('is-open');
    missingChevron.classList.toggle('is-open', isOpen);
    missingToggle.setAttribute('aria-expanded', String(isOpen));
  });

  rankingToggle.addEventListener('click', () => {
    const isOpen = rankingBody.classList.toggle('is-open');
    rankingChevron.classList.toggle('is-open', isOpen);
    rankingToggle.setAttribute('aria-expanded', String(isOpen));
  });

  let allDocTypeNames = [];
  let allMissingItems = [];

  init();

  async function init() {
    const [branchesRes, docTypesRes] = await Promise.all([
      apiGet('getBranches'),
      apiGet('getDocTypes')
    ]);

    if (branchesRes.success) {
      branchesRes.branches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        branchSelect.appendChild(opt);
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
    loadRanking();
  }

  function makeOption(value, text) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    return opt;
  }

  // ---------- Bugungi yuborilmaganlar ----------
  async function loadMissingToday() {
    const res = await apiGet('getTodayMissing');
    if (!res.success) {
      missingList.innerHTML = `<div class="empty-state"><div class="empty-state__desc">Yuklab bo'lmadi</div></div>`;
      return;
    }
    allMissingItems = res.items;
    document.getElementById('missingCountBadge').textContent = String(allMissingItems.length);
    renderMissingList();
  }

  missingDocTypeFilter.addEventListener('change', renderMissingList);

  function renderMissingList() {
    const filterVal = missingDocTypeFilter.value;
    const items = filterVal ? allMissingItems.filter(i => i.docType === filterVal) : allMissingItems;

    if (!items.length) {
      missingList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">✅</div>
          <div class="empty-state__title">Bugun hammasi yuborilgan</div>
          <div class="empty-state__desc">Yuborilmagan hujjat topilmadi</div>
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

  // ---------- Reyting ----------
  async function loadRanking() {
    const res = await apiGet('getRanking');
    if (!res.success || !res.ranking.length) {
      rankingList.innerHTML = `<div class="empty-state"><div class="empty-state__desc">Ma'lumot yo'q</div></div>`;
      return;
    }
    rankingList.innerHTML = res.ranking.map((r, idx) => {
      const isTop = idx === 0 && r.errorCount > 0;
      return `
        <div class="ranking-item ${isTop ? 'is-top' : ''}">
          <div class="ranking-item__rank">${idx + 1}</div>
          <div class="ranking-item__name">${escapeHtml(r.branch)}</div>
          <div class="ranking-item__count">${r.errorCount} ta xato</div>
        </div>`;
    }).join('');
  }

  // ---------- Qidiruv ----------
  searchBtn.addEventListener('click', runSearch);

  async function runSearch() {
    resultsWrap.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⏳</div><div class="empty-state__title">Qidirilmoqda...</div></div>`;

    const res = await apiGet('getAdminSubmissions', {
      branch: branchSelect.value,
      date: dateInput.value,
      docType: docTypeSelect.value,
      statusFilter: statusFilterSelect.value
    });

    if (!res.success || !res.items.length) {
      resultsWrap.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🗂️</div>
          <div class="empty-state__title">Hujjat topilmadi</div>
          <div class="empty-state__desc">Tanlangan filtrlar bo'yicha yuborilgan hujjat yo'q</div>
        </div>`;
      return;
    }

    resultsWrap.innerHTML = res.items.map(renderResultCard).join('');
    res.items.forEach(bindCardEvents);
  }

  function renderResultCard(item) {
    const meta = statusMeta(item.status);
    const isFileless = item.status === 'Yuborilmadi' || item.status === 'Mavjud emas' || item.status === 'Almashtirildi';
    const filelessText = item.status === 'Mavjud emas'
      ? 'Filial bu hujjat turi mavjud emasligini tasdiqlagan'
      : item.status === 'Almashtirildi'
        ? "Bu versiya qayta yuborilgan — ro'yxatdan yangi versiyani qidiring"
        : 'Bu filial hali fayl yuklamagan';

    return `
      <div class="result-card" id="card-${cssId(item.submissionId)}">
        <div class="result-card__head">
          <div>
            <div class="history-item__title">${escapeHtml(item.branch)} — ${escapeHtml(item.docType)}</div>
            <div class="history-item__meta">${escapeHtml(item.uploadDate)}${item.uploadTime ? ' · ' + escapeHtml(item.uploadTime) : ''} · Versiya ${escapeHtml(String(item.version))} · ID: ${escapeHtml(item.submissionId)}</div>
          </div>
          <span class="status-pill ${meta.cls}">${meta.label}</span>
        </div>

        ${renderStepper(item.status)}

        ${!isFileless ? `<a href="${escapeHtml(item.filePath)}" target="_blank" rel="noopener" class="result-card__file">📄 Faylni ochish</a>` : `<div class="text-faint" style="margin:10px 0;">${filelessText}</div>`}

        ${(item.status === 'Qaytarildi' || item.status === 'Tasdiqlandi' || item.status === 'Almashtirildi') && (item.errorType || item.comment) ? `
          <div class="history-item__note"><strong>${escapeHtml(item.errorType || 'Izoh')}:</strong> ${escapeHtml(item.comment || '—')}</div>
        ` : ''}

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
      </div>`;
  }

  function cssId(id) {
    return String(id).replace(/[^a-zA-Z0-9]/g, '');
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

    const res = await apiPost('adminAction', { submissionId, decision, errorType, comment });

    if (!res.success) {
      alert(res.message || 'Amalni bajarishda xatolik yuz berdi');
      btn.disabled = false;
      btn.textContent = originalText;
      return;
    }

    runSearch();
    loadMissingToday();
    loadRanking();
  }
})();
