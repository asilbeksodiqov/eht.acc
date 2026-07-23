(function () {
  const session = requireAuthAny(['ceo']);
  if (!session) return;

  // ---------- Tablar ----------
  const tabs = document.querySelectorAll('.ceo-tab');
  const panels = {
    reports: document.getElementById('panel-reports'),
    users: document.getElementById('panel-users'),
    branches: document.getElementById('panel-branches'),
    doctypes: document.getElementById('panel-doctypes')
  };
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      Object.values(panels).forEach(p => p.classList.remove('is-active'));
      panels[tab.getAttribute('data-tab')].classList.add('is-active');
    });
  });

  let allBranchNames = [];
  let allDocTypeNames = [];

  init();

  async function init() {
    await Promise.all([
      loadBranchesForDropdowns(),
      loadDocTypesForDropdowns()
    ]);
    loadUsers();
    loadBranchesTable();
    loadDocTypesTable();
  }

  function makeOption(value, text) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    return opt;
  }

  async function loadBranchesForDropdowns() {
    const res = await apiGet('getBranches');
    if (!res.success) return;
    allBranchNames = res.branches;
    const ceoBranchSelect = document.getElementById('ceoBranchSelect');
    const ceoEditBranch = document.getElementById('ceoEditBranch');
    ceoBranchSelect.innerHTML = '<option value="">Barchasi</option>';
    ceoEditBranch.innerHTML = '';
    allBranchNames.forEach(b => {
      ceoBranchSelect.appendChild(makeOption(b, b));
      ceoEditBranch.appendChild(makeOption(b, b));
    });
  }

  async function loadDocTypesForDropdowns() {
    const res = await apiGet('getDocTypes');
    if (!res.success) return;
    allDocTypeNames = res.docTypes.map(dt => dt.name);
    const ceoDocTypeSelect = document.getElementById('ceoDocTypeSelect');
    const ceoEditDocType = document.getElementById('ceoEditDocType');
    ceoDocTypeSelect.innerHTML = '<option value="">Barchasi</option>';
    ceoEditDocType.innerHTML = '';
    allDocTypeNames.forEach(name => {
      ceoDocTypeSelect.appendChild(makeOption(name, name));
      ceoEditDocType.appendChild(makeOption(name, name));
    });
  }

  // ================= HISOBOTLAR =================
  const ceoResultsWrap = document.getElementById('ceoResultsWrap');
  document.getElementById('ceoSearchBtn').addEventListener('click', runCeoSearch);

  const CEO_PAGE_SIZE = 10;
  let ceoResultItems = [];
  let ceoCurrentPage = 0;

  async function runCeoSearch() {
    ceoResultsWrap.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⏳</div><div class="empty-state__title">Qidirilmoqda...</div></div>`;

    const res = await apiGet('getAdminSubmissions', {
      branch: document.getElementById('ceoBranchSelect').value,
      date: document.getElementById('ceoDateInput').value,
      docType: document.getElementById('ceoDocTypeSelect').value,
      statusFilter: document.getElementById('ceoStatusFilterSelect').value,
      role: 'ceo'
    });

    if (!res.success || !res.items.length) {
      ceoResultItems = [];
      ceoResultsWrap.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🗂️</div>
          <div class="empty-state__title">Hujjat topilmadi</div>
          <div class="empty-state__desc">Tanlangan filtrlar bo'yicha yuborilgan hujjat yo'q</div>
        </div>`;
      return;
    }

    ceoResultItems = res.items;
    ceoCurrentPage = 0;
    renderCeoResultsPage();
  }

  function renderCeoResultsPage() {
    const totalPages = Math.max(1, Math.ceil(ceoResultItems.length / CEO_PAGE_SIZE));
    if (ceoCurrentPage >= totalPages) ceoCurrentPage = totalPages - 1;
    const start = ceoCurrentPage * CEO_PAGE_SIZE;
    const pageItems = ceoResultItems.slice(start, start + CEO_PAGE_SIZE);

    ceoResultsWrap.innerHTML = pageItems.map(renderCeoCard).join('') + renderCeoPagination(totalPages);
    pageItems.forEach(bindCeoCardEvents);

    const prevBtn = document.getElementById('ceoPagePrev');
    const nextBtn = document.getElementById('ceoPageNext');
    if (prevBtn) prevBtn.addEventListener('click', () => { if (ceoCurrentPage > 0) { ceoCurrentPage--; renderCeoResultsPage(); } });
    if (nextBtn) nextBtn.addEventListener('click', () => { if (ceoCurrentPage < totalPages - 1) { ceoCurrentPage++; renderCeoResultsPage(); } });
  }

  function renderCeoPagination(totalPages) {
    if (totalPages <= 1) return '';
    const page = ceoCurrentPage + 1;
    return `
      <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-top:16px;">
        <button type="button" class="btn btn-ghost btn-sm" id="ceoPagePrev" ${ceoCurrentPage === 0 ? 'disabled' : ''}>← Oldingi</button>
        <span class="text-faint" style="font-size:13px;">Sahifa ${page} / ${totalPages} (jami ${ceoResultItems.length} ta)</span>
        <button type="button" class="btn btn-ghost btn-sm" id="ceoPageNext" ${ceoCurrentPage === totalPages - 1 ? 'disabled' : ''}>Keyingi →</button>
      </div>`;
  }

  function cssId(id) { return String(id).replace(/[^a-zA-Z0-9]/g, ''); }

  function renderCeoCard(item) {
    return `
      <div class="compact-item" id="ceo-card-${cssId(item.submissionId)}">
        <div class="history-item__meta" style="padding:14px 16px 0;">
          ${escapeHtml(item.branch)} · ${escapeHtml(item.docType)} · ${escapeHtml(item.uploadDate)} · Versiya ${escapeHtml(String(item.version))} · <span class="status-pill ${statusMeta(item.status).cls}">${statusMeta(item.status).label}</span>
        </div>
        <div style="padding:10px 16px 16px;">
          ${item.errorType || item.comment ? `<div class="history-item__note"><strong>${escapeHtml(item.errorType || 'Izoh')}:</strong> ${escapeHtml(item.comment || '—')}</div>` : ''}
          <div class="compact-item__manage" style="margin-top:10px;">
            <button class="btn btn-ghost btn-sm" data-action="ceo-edit" data-id="${escapeHtml(item.submissionId)}">✏️ To'liq tahrirlash</button>
            <button class="btn btn-danger btn-sm" data-action="ceo-delete" data-id="${escapeHtml(item.submissionId)}">🗑️ O'chirish</button>
          </div>
        </div>
      </div>`;
  }

  function bindCeoCardEvents(item) {
    const card = document.getElementById(`ceo-card-${cssId(item.submissionId)}`);
    if (!card) return;
    const editBtn = card.querySelector('[data-action="ceo-edit"]');
    const deleteBtn = card.querySelector('[data-action="ceo-delete"]');
    if (editBtn) editBtn.addEventListener('click', () => openCeoEditModal(item));
    if (deleteBtn) deleteBtn.addEventListener('click', () => openCeoDeleteModal(item.submissionId, 'submission'));
  }

  // ---------- To'liq tahrirlash oynasi ----------
  const ceoEditModal = document.getElementById('ceoEditModal');
  const ceoEditAlert = document.getElementById('ceoEditAlert');
  let ceoEditTargetId = null;

  function closeCeoEditModal() {
    ceoEditModal.classList.remove('show');
    hideAlert(ceoEditAlert);
    ceoEditTargetId = null;
  }
  document.getElementById('ceoEditCloseBtn').addEventListener('click', closeCeoEditModal);
  document.getElementById('ceoEditCancelBtn').addEventListener('click', closeCeoEditModal);
  ceoEditModal.addEventListener('click', (e) => { if (e.target === ceoEditModal) closeCeoEditModal(); });

  function openCeoEditModal(item) {
    ceoEditTargetId = item.submissionId;
    hideAlert(ceoEditAlert);
    document.getElementById('ceoEditBranch').value = item.branch;
    document.getElementById('ceoEditDocType').value = item.docType;
    document.getElementById('ceoEditUploadDate').value = item.uploadDate || '';
    document.getElementById('ceoEditStatus').value = item.status;
    document.getElementById('ceoEditErrorType').value = item.errorType || '';
    document.getElementById('ceoEditComment').value = item.comment || '';
    document.getElementById('ceoEditVersion').value = item.version || 1;
    document.getElementById('ceoEditVideoTelegram').checked = !!item.videoTelegram;
    ceoEditModal.classList.add('show');
  }

  document.getElementById('ceoEditSaveBtn').addEventListener('click', async () => {
    if (!ceoEditTargetId) return;
    const btn = document.getElementById('ceoEditSaveBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner-dark"></span>';

    const res = await apiPost('ceoEditSubmissionFull', {
      submissionId: ceoEditTargetId,
      role: 'ceo',
      branch: document.getElementById('ceoEditBranch').value,
      docType: document.getElementById('ceoEditDocType').value,
      uploadDate: document.getElementById('ceoEditUploadDate').value,
      status: document.getElementById('ceoEditStatus').value,
      errorType: document.getElementById('ceoEditErrorType').value,
      comment: document.getElementById('ceoEditComment').value,
      version: document.getElementById('ceoEditVersion').value,
      videoTelegram: document.getElementById('ceoEditVideoTelegram').checked
    });

    btn.disabled = false;
    btn.textContent = 'Saqlash';

    if (!res.success) {
      showAlert(ceoEditAlert, res.message || 'Saqlashda xatolik yuz berdi');
      return;
    }
    closeCeoEditModal();
    runCeoSearch();
  });

  // ---------- Umumiy o'chirishni tasdiqlash oynasi ----------
  const ceoDeleteModal = document.getElementById('ceoDeleteModal');
  let deleteTarget = null; // { id, kind }

  function openCeoDeleteModal(id, kind) {
    deleteTarget = { id, kind };
    ceoDeleteModal.classList.add('show');
  }
  function closeCeoDeleteModal() {
    ceoDeleteModal.classList.remove('show');
    deleteTarget = null;
  }
  document.getElementById('ceoDeleteCancelBtn').addEventListener('click', closeCeoDeleteModal);
  ceoDeleteModal.addEventListener('click', (e) => { if (e.target === ceoDeleteModal) closeCeoDeleteModal(); });

  document.getElementById('ceoDeleteConfirmBtn').addEventListener('click', async () => {
    if (!deleteTarget) return;
    const { id, kind } = deleteTarget;
    let res;
    if (kind === 'submission') {
      res = await apiPost('deleteSubmission', { submissionId: id, role: 'ceo' });
    } else if (kind === 'user') {
      res = await apiPost('ceoDeleteUser', { username: id, role: 'ceo' });
    } else if (kind === 'branch') {
      res = await apiPost('ceoDeleteBranch', { username: id, role: 'ceo' });
    } else if (kind === 'doctype') {
      res = await apiPost('ceoDeleteDocType', { name: id, role: 'ceo' });
    }
    closeCeoDeleteModal();
    if (!res.success) {
      alert(res.message || "O'chirishda xatolik yuz berdi");
      return;
    }
    if (kind === 'submission') runCeoSearch();
    if (kind === 'user') loadUsers();
    if (kind === 'branch') { loadBranchesTable(); loadBranchesForDropdowns(); }
    if (kind === 'doctype') { loadDocTypesTable(); loadDocTypesForDropdowns(); }
  });

  // ================= FOYDALANUVCHILAR =================
  const userAlert = document.getElementById('userAlert');
  document.getElementById('addUserBtn').addEventListener('click', async () => {
    const username = document.getElementById('newUserUsername').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const role = document.getElementById('newUserRole').value;
    hideAlert(userAlert);
    if (!username || !password) {
      showAlert(userAlert, "Username va parolni to'ldiring");
      return;
    }
    const res = await apiPost('ceoAddUser', { username, password, newRole: role, role: 'ceo' });
    if (!res.success) {
      showAlert(userAlert, res.message || "Qo'shishda xatolik yuz berdi");
      return;
    }
    document.getElementById('newUserUsername').value = '';
    document.getElementById('newUserPassword').value = '';
    loadUsers();
  });

  async function loadUsers() {
    const res = await apiPost('ceoListUsers', { role: 'ceo' });
    const tbody = document.getElementById('usersTableBody');
    if (!res.success) {
      tbody.innerHTML = `<tr><td colspan="3">Yuklab bo'lmadi</td></tr>`;
      return;
    }
    if (!res.users.length) {
      tbody.innerHTML = `<tr><td colspan="3">Hali foydalanuvchi yo'q</td></tr>`;
      return;
    }
    tbody.innerHTML = res.users.map(u => `
      <tr>
        <td>${escapeHtml(u.username)}</td>
        <td><span class="pill-group">${escapeHtml(u.role)}</span></td>
        <td><button class="btn btn-danger btn-sm" data-username="${escapeHtml(u.username)}">O'chirish</button></td>
      </tr>
    `).join('');
    tbody.querySelectorAll('button[data-username]').forEach(btn => {
      btn.addEventListener('click', () => openCeoDeleteModal(btn.getAttribute('data-username'), 'user'));
    });
  }

  // ================= FILIALLAR =================
  const branchAlert = document.getElementById('branchAlert');
  document.getElementById('addBranchBtn').addEventListener('click', async () => {
    const branch = document.getElementById('newBranchName').value.trim();
    const username = document.getElementById('newBranchUsername').value.trim();
    const password = document.getElementById('newBranchPassword').value;
    hideAlert(branchAlert);
    if (!branch || !username || !password) {
      showAlert(branchAlert, "Barcha maydonlarni to'ldiring");
      return;
    }
    const res = await apiPost('ceoAddBranch', { branch, username, password, role: 'ceo' });
    if (!res.success) {
      showAlert(branchAlert, res.message || "Qo'shishda xatolik yuz berdi");
      return;
    }
    document.getElementById('newBranchName').value = '';
    document.getElementById('newBranchUsername').value = '';
    document.getElementById('newBranchPassword').value = '';
    loadBranchesTable();
    loadBranchesForDropdowns();
  });

  async function loadBranchesTable() {
    const res = await apiPost('ceoListBranches', { role: 'ceo' });
    const tbody = document.getElementById('branchesTableBody');
    if (!res.success) {
      tbody.innerHTML = `<tr><td colspan="3">Yuklab bo'lmadi</td></tr>`;
      return;
    }
    if (!res.branches.length) {
      tbody.innerHTML = `<tr><td colspan="3">Hali filial yo'q</td></tr>`;
      return;
    }
    tbody.innerHTML = res.branches.map(b => `
      <tr>
        <td>${escapeHtml(b.branch)}</td>
        <td>${escapeHtml(b.username)}</td>
        <td><button class="btn btn-danger btn-sm" data-username="${escapeHtml(b.username)}">O'chirish</button></td>
      </tr>
    `).join('');
    tbody.querySelectorAll('button[data-username]').forEach(btn => {
      btn.addEventListener('click', () => openCeoDeleteModal(btn.getAttribute('data-username'), 'branch'));
    });
  }

  // ================= HUJJAT TURLARI =================
  const docTypeAlert = document.getElementById('docTypeAlert');
  let docTypeEditOriginalName = null;
  const addDocTypeBtn = document.getElementById('addDocTypeBtn');

  addDocTypeBtn.addEventListener('click', async () => {
    const name = document.getElementById('newDocTypeName').value.trim();
    const byWho = document.getElementById('newDocTypeByWho').value;
    const period = document.getElementById('newDocTypePeriod').value;
    const adminGroup = document.getElementById('newDocTypeAdminGroup').value;
    hideAlert(docTypeAlert);
    if (!name) {
      showAlert(docTypeAlert, "Hujjat turi nomini kiriting");
      return;
    }

    let res;
    if (docTypeEditOriginalName) {
      res = await apiPost('ceoUpdateDocType', { originalName: docTypeEditOriginalName, name, byWho, period, adminGroup, role: 'ceo' });
    } else {
      res = await apiPost('ceoAddDocType', { name, byWho, period, adminGroup, role: 'ceo' });
    }

    if (!res.success) {
      showAlert(docTypeAlert, res.message || 'Saqlashda xatolik yuz berdi');
      return;
    }
    resetDocTypeForm();
    loadDocTypesTable();
    loadDocTypesForDropdowns();
  });

  function resetDocTypeForm() {
    docTypeEditOriginalName = null;
    document.getElementById('newDocTypeName').value = '';
    document.getElementById('newDocTypeByWho').value = '1';
    document.getElementById('newDocTypePeriod').value = '1';
    document.getElementById('newDocTypeAdminGroup').value = '1';
    addDocTypeBtn.textContent = "Qo'shish";
  }

  function startEditDocType(dt) {
    docTypeEditOriginalName = dt.name;
    document.getElementById('newDocTypeName').value = dt.name;
    document.getElementById('newDocTypeByWho').value = dt.byWho;
    document.getElementById('newDocTypePeriod').value = dt.period;
    document.getElementById('newDocTypeAdminGroup').value = dt.adminGroup;
    addDocTypeBtn.textContent = 'Yangilash';
    document.getElementById('newDocTypeName').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function loadDocTypesTable() {
    const res = await apiGet('getDocTypes');
    const tbody = document.getElementById('docTypesTableBody');
    if (!res.success) {
      tbody.innerHTML = `<tr><td colspan="5">Yuklab bo'lmadi</td></tr>`;
      return;
    }
    if (!res.docTypes.length) {
      tbody.innerHTML = `<tr><td colspan="5">Hali hujjat turi yo'q</td></tr>`;
      return;
    }
    tbody.innerHTML = res.docTypes.map(dt => `
      <tr>
        <td>${escapeHtml(dt.name)}</td>
        <td>${escapeHtml(String(dt.byWho))}</td>
        <td>${escapeHtml(String(dt.period))}</td>
        <td>${escapeHtml(String(dt.adminGroup))}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-ghost btn-sm" data-edit="${escapeHtml(dt.name)}">✏️</button>
          <button class="btn btn-danger btn-sm" data-delete="${escapeHtml(dt.name)}">🗑️</button>
        </td>
      </tr>
    `).join('');
    tbody.querySelectorAll('button[data-edit]').forEach(btn => {
      const dt = res.docTypes.find(d => d.name === btn.getAttribute('data-edit'));
      btn.addEventListener('click', () => startEditDocType(dt));
    });
    tbody.querySelectorAll('button[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => openCeoDeleteModal(btn.getAttribute('data-delete'), 'doctype'));
    });
  }
})();
