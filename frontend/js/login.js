(function () {
  // Allaqachon tizimga kirgan bo'lsa, tegishli panelga yo'naltirish
  const existing = getSession();
  if (existing && existing.role) {
    window.location.href = 'frontend/' + homePageForRole(existing.role);
    return;
  }

  const form = document.getElementById('loginForm');
  const alertEl = document.getElementById('alert');
  const submitBtn = document.getElementById('submitBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert(alertEl);

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Tekshirilmoqda...';

    const res = await apiPost('login', { username, password });

    submitBtn.disabled = false;
    submitBtn.textContent = 'Kirish';

    if (!res.success) {
      showAlert(alertEl, res.message || 'Kirishda xatolik yuz berdi');
      return;
    }

    setSession({
      username: res.username,
      role: res.role,
      branch: res.branch
    });

    window.location.href = 'frontend/' + homePageForRole(res.role);
  });
})();
