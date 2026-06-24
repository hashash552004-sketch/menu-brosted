let token = null;

// ------------------------------------------------------------
//  Auth
// ------------------------------------------------------------
document.getElementById('loginBtn').addEventListener('click', async () => {
  const password = document.getElementById('passwordInput').value;
  const errEl = document.getElementById('loginError');
  errEl.style.display = 'none';
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const data = await res.json();
    errEl.textContent = data.error || 'كلمة السر خطأ';
    errEl.style.display = 'block';
    return;
  }
  const data = await res.json();
  token = data.token;
  document.getElementById('loginSection').style.display = 'none';
  document.getElementById('adminPanel').style.display = 'block';
  loadDishes();
  populateCategorySelect();
  loadCategoriesList();
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST', headers: { 'Authorization': token } });
  token = null;
  document.getElementById('loginSection').style.display = 'block';
  document.getElementById('adminPanel').style.display = 'none';
  document.getElementById('passwordInput').value = '';
});

function authHeaders(headers = {}) {
  headers['Authorization'] = token;
  return headers;
}

// ------------------------------------------------------------
//  Load dishes table
// ------------------------------------------------------------
async function loadDishes() {
  const res = await fetch('/api/dishes');
  const dishes = await res.json();
  const tbody = document.getElementById('dishesBody');
  tbody.innerHTML = '';
  dishes.forEach(d => {
    const tr = document.createElement('tr');
    let badgeText = { 'new': 'جديد 🔥', 'bestseller': '🏆 الأكثر مبيعًا' }[d.badge] || '—';
    tr.innerHTML = `
      <td>${d.image ? `<img src="${d.image}" />` : '🍽'}</td>
      <td>${d.name_ar}</td>
      <td>${d.category_name_ar}</td>
      <td style="font-size:.8rem;">${badgeText}</td>
      <td>${Number(d.price).toLocaleString()}</td>
      <td>${d.cooking_time} د</td>
      <td>
        <button class="btn btn-warning btn-edit" data-id="${d.id}">تعديل</button>
        <button class="btn btn-danger btn-delete" data-id="${d.id}">حذف</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => editDish(btn.dataset.id));
  });
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteDish(btn.dataset.id));
  });
}

// ------------------------------------------------------------
//  Populate category select in dish form
// ------------------------------------------------------------
async function populateCategorySelect(selectedId) {
  const res = await fetch('/api/categories');
  const cats = await res.json();
  const sel = document.getElementById('categoryId');
  sel.innerHTML = '';
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name_ar;
    if (selectedId && Number(selectedId) === c.id) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ------------------------------------------------------------
//  Dish modal
// ------------------------------------------------------------
document.getElementById('addDishBtn').addEventListener('click', () => {
  document.getElementById('modalTitle').textContent = '➕ إضافة طبق';
  document.getElementById('dishForm').reset();
  document.getElementById('editId').value = '';
  document.getElementById('saveBtn').textContent = 'إضافة';
  document.getElementById('badge').value = '';
  populateCategorySelect();
  document.getElementById('imagePreview').style.display = 'none';
  document.getElementById('modalOverlay').classList.add('active');
});

document.getElementById('cancelBtn').addEventListener('click', () => {
  document.getElementById('modalOverlay').classList.remove('active');
});
document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) document.getElementById('modalOverlay').classList.remove('active');
});

// ------------------------------------------------------------
//  Edit dish
// ------------------------------------------------------------
async function editDish(id) {
  const res = await fetch('/api/dishes/' + id);
  const d = await res.json();
  if (!d || d.error) return;
  document.getElementById('modalTitle').textContent = '✏️ تعديل طبق';
  document.getElementById('editId').value = d.id;
  document.getElementById('nameAr').value = d.name_ar;
  document.getElementById('nameEn').value = d.name;
  document.getElementById('descAr').value = d.description_ar || '';
  document.getElementById('descEn').value = d.description || '';
  document.getElementById('price').value = d.price;
  document.getElementById('cookingTime').value = d.cooking_time;
  document.getElementById('badge').value = d.badge || '';
  document.getElementById('saveBtn').textContent = 'تحديث';
  populateCategorySelect(d.category_id);
  const preview = document.getElementById('imagePreview');
  const previewImg = document.getElementById('previewImg');
  if (d.image) { previewImg.src = d.image; preview.style.display = 'block'; }
  else { preview.style.display = 'none'; }
  document.getElementById('modalOverlay').classList.add('active');
}

// ------------------------------------------------------------
//  Save dish (add / update)
// ------------------------------------------------------------
document.getElementById('dishForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  btn.textContent = 'جاري الحفظ...';
  try {
    const id = document.getElementById('editId').value;
    const fd = new FormData();
    fd.append('name_ar', document.getElementById('nameAr').value);
    fd.append('name', document.getElementById('nameEn').value);
    fd.append('description_ar', document.getElementById('descAr').value);
    fd.append('description', document.getElementById('descEn').value);
    fd.append('price', document.getElementById('price').value);
    fd.append('cooking_time', document.getElementById('cookingTime').value);
    fd.append('category_id', document.getElementById('categoryId').value);
    fd.append('badge', document.getElementById('badge').value);
    const fileInput = document.getElementById('image');
    if (fileInput.files.length) {
      if (fileInput.files[0].size > 5 * 1024 * 1024) {
        alert('الصورة كبيرة جداً (أقصى حد 5MB)');
        btn.disabled = false;
        btn.textContent = id ? 'تحديث' : 'إضافة';
        return;
      }
      fd.append('image', fileInput.files[0]);
    }
    let res;
    if (id) {
      res = await fetch('/api/admin/dishes/' + id, { method: 'PUT', headers: authHeaders(), body: fd });
    } else {
      res = await fetch('/api/admin/dishes', { method: 'POST', headers: authHeaders(), body: fd });
    }
    if (!res.ok) {
      let msg;
      try { const err = await res.json(); msg = err.error || res.statusText; } catch { msg = 'خطأ ' + res.status; }
      alert('خطأ: ' + msg);
      btn.disabled = false;
      btn.textContent = id ? 'تحديث' : 'إضافة';
      return;
    }
    document.getElementById('modalOverlay').classList.remove('active');
    loadDishes();
  } catch (err) {
    alert('فشل الاتصال بالخادم: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = document.getElementById('editId').value ? 'تحديث' : 'إضافة';
  }
});

// ------------------------------------------------------------
//  Delete dish
// ------------------------------------------------------------
async function deleteDish(id) {
  if (!confirm('هل أنت متأكد من حذف هذا الطبق؟')) return;
  const res = await fetch('/api/admin/dishes/' + id, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) return alert('حدث خطأ أثناء الحذف');
  loadDishes();
}

// ------------------------------------------------------------
//  Category modal
// ------------------------------------------------------------
document.getElementById('addCategoryBtn').addEventListener('click', () => {
  document.getElementById('catForm').reset();
  document.getElementById('catModalOverlay').classList.add('active');
});
document.getElementById('cancelCatBtn').addEventListener('click', () => {
  document.getElementById('catModalOverlay').classList.remove('active');
});
document.getElementById('catModalOverlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) document.getElementById('catModalOverlay').classList.remove('active');
});
document.getElementById('catForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name_ar = document.getElementById('catNameAr').value;
  const name = document.getElementById('catNameEn').value;
  const res = await fetch('/api/admin/categories', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ name, name_ar }),
  });
  if (!res.ok) return alert('حدث خطأ أثناء إضافة القسم');
  document.getElementById('catModalOverlay').classList.remove('active');
  populateCategorySelect();
  loadDishes();
  loadCategoriesList();
});

// ------------------------------------------------------------
//  Password change
// ------------------------------------------------------------
document.getElementById('changePwBtn').addEventListener('click', () => {
  document.getElementById('pwForm').reset();
  document.getElementById('pwError').style.display = 'none';
  document.getElementById('pwModalOverlay').classList.add('active');
});
document.getElementById('cancelPwBtn').addEventListener('click', () => {
  document.getElementById('pwModalOverlay').classList.remove('active');
});
document.getElementById('pwModalOverlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) document.getElementById('pwModalOverlay').classList.remove('active');
});
document.getElementById('pwForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('pwError');
  errEl.style.display = 'none';
  const current = document.getElementById('currentPassword').value;
  const newPw = document.getElementById('newPassword').value;
  const confirm = document.getElementById('confirmPassword').value;
  if (newPw !== confirm) {
    errEl.textContent = 'كلمة السر الجديدة وتأكيدها غير متطابقين';
    errEl.style.display = 'block';
    return;
  }
  const res = await fetch('/api/admin/password', {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ current_password: current, new_password: newPw }),
  });
  if (!res.ok) {
    const data = await res.json();
    errEl.textContent = data.error || 'حدث خطأ';
    errEl.style.display = 'block';
    return;
  }
  document.getElementById('pwModalOverlay').classList.remove('active');
  alert('✅ تم تغيير كلمة السر بنجاح');
});

// ------------------------------------------------------------
//  Category list management
// ------------------------------------------------------------
async function loadCategoriesList() {
  const res = await fetch('/api/categories');
  const cats = await res.json();
  const container = document.getElementById('categoriesList');
  container.innerHTML = '';
  cats.forEach(c => {
    const tag = document.createElement('span');
    tag.style.cssText = 'display:inline-flex;align-items:center;gap:8px;background:var(--orange-soft);border:1px solid var(--orange);border-radius:8px;padding:6px 14px;font-size:.85rem;font-weight:600;color:var(--orange-dark);';
    tag.innerHTML = `${c.name_ar} <button class="btn btn-danger btn-delete-cat" data-id="${c.id}" style="padding:2px 8px;font-size:.7rem;">✕</button>`;
    container.appendChild(tag);
  });
  document.querySelectorAll('.btn-delete-cat').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('هل أنت متأكد من حذف هذا القسم؟')) return;
      const res = await fetch('/api/admin/categories/' + btn.dataset.id, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) return alert('حدث خطأ. تأكد من عدم وجود أطباق في هذا القسم');
      loadCategoriesList();
      populateCategorySelect();
      loadDishes();
    });
  });
}

// ------------------------------------------------------------
//  WhatsApp settings
// ------------------------------------------------------------
document.getElementById('whatsappSettingsBtn').addEventListener('click', async () => {
  const res = await fetch('/api/settings/whatsapp_number');
  const data = await res.json();
  document.getElementById('whatsappNumber').value = data.value || '';
  document.getElementById('whatsappModal').classList.add('active');
});
document.getElementById('cancelWhatsappBtn').addEventListener('click', () => {
  document.getElementById('whatsappModal').classList.remove('active');
});
document.getElementById('whatsappModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) document.getElementById('whatsappModal').classList.remove('active');
});
document.getElementById('whatsappForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const value = document.getElementById('whatsappNumber').value;
  const res = await fetch('/api/admin/settings', {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ key: 'whatsapp_number', value }),
  });
  if (!res.ok) return alert('حدث خطأ');
  document.getElementById('whatsappModal').classList.remove('active');
  alert('✅ تم حفظ رقم واتساب');
});

// ------------------------------------------------------------
//  QR code
// ------------------------------------------------------------
document.getElementById('showQrBtn').addEventListener('click', async () => {
  const baseUrl = window.location.origin;
  document.getElementById('qrUrlText').textContent = baseUrl;
  document.getElementById('qrImage').src = '/api/qrcode?url=' + encodeURIComponent(baseUrl);
  document.getElementById('qrModalOverlay').classList.add('active');
});
document.getElementById('closeQrBtn').addEventListener('click', () => {
  document.getElementById('qrModalOverlay').classList.remove('active');
});
document.getElementById('qrModalOverlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) document.getElementById('qrModalOverlay').classList.remove('active');
});