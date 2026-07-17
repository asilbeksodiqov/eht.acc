(function () {
  // Bu sahifaga ham admin, ham filial kirishi mumkin — shu sababli
  // requireAuth() rolsiz chaqiriladi (faqat sessiya borligini tekshiradi).
  const session = requireAuth();
  if (!session) return;

  const isAdmin = String(session.role).trim().toLowerCase() === 'admin';
  const homePage = isAdmin ? 'admin.html' : 'branch.html';

  document.getElementById('homeLinkBtn').setAttribute('href', homePage);
  document.getElementById('homeNavItem').setAttribute('href', homePage);
  document.getElementById('roleBadge').textContent = isAdmin ? 'Admin' : 'Filial';

  const startDateInput = document.getElementById('startDateInput');
  const endDateInput = document.getElementById('endDateInput');
  const typeFilterSelect = document.getElementById('typeFilterSelect');
  const modeFilterSelect = document.getElementById('modeFilterSelect');
  const rankingSearchBtn = document.getElementById('rankingSearchBtn');
  const rankingList = document.getElementById('rankingList');
  const rankingCardTitle = document.getElementById('rankingCardTitle');
  const rankingCardDesc = document.getElementById('rankingCardDesc');

  rankingSearchBtn.addEventListener('click', loadRanking);

  loadRanking();

  async function loadRanking() {
    rankingList.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⏳</div><div class="empty-state__title">Yuklanmoqda...</div></div>`;

    const mode = modeFilterSelect.value;
    const res = await apiGet('getRankingFiltered', {
      startDate: startDateInput.value,
      endDate: endDateInput.value,
      type: typeFilterSelect.value,
      mode: mode
    });

    updateCardHeader(mode);

    if (!res.success || !res.ranking.length) {
      rankingList.innerHTML = `<div class="empty-state"><div class="empty-state__desc">Ma'lumot yo'q</div></div>`;
      return;
    }

    const unit = mode === 'notSent' ? 'ta yuborilmagan' : 'ta xato';

    rankingList.innerHTML = res.ranking.map((r, idx) => {
      const isSelf = !isAdmin && r.branch === session.branch;
      const isTop = idx === 0 && r.count > 0;
      return `
        <div class="ranking-item ${isTop ? 'is-top' : ''} ${isSelf ? 'is-self' : ''}">
          <div class="ranking-item__rank">${idx + 1}</div>
          <div class="ranking-item__name">${escapeHtml(r.branch)}${isSelf ? ' (siz)' : ''}</div>
          <div class="ranking-item__count">${r.count} ${unit}</div>
        </div>`;
    }).join('');
  }

  function updateCardHeader(mode) {
    const dateRangeText = describeDateRange();
    if (mode === 'notSent') {
      rankingCardTitle.textContent = "Yuborilmaganlar soni bo'yicha (ko'pdan kamga)";
    } else {
      rankingCardTitle.textContent = "Xatolar soni bo'yicha (ko'pdan kamga)";
    }
    rankingCardDesc.textContent = dateRangeText;
  }

  function describeDateRange() {
    const start = startDateInput.value;
    const end = endDateInput.value;
    if (start && end) return `${start} dan ${end} gacha`;
    if (start) return `${start} dan buyon`;
    if (end) return `${end} sanagacha`;
    return 'Barcha vaqt uchun';
  }
})();
