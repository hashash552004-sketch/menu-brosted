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
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST', headers: { 'Authorization': token } });
  token = null;
  document.getElementById('loginSection').style.display = 'block';
  document.getElementById('adminPanel').style.display = 'none';
  document.getElementById('passwordInput').value = '';
});

// ------------------------------------------------------------
//  Auth header helper
// ------------------------------------------------------------
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
    tr.innerHTML = `
      <td>${d.image ? `<img src="${d.image}" />` : '🍽'}</td>
      <td>${d.name_ar}</td>
      <td>${d.category_name_ar}</td>
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

  const id = document.getElementById('editId').value;
  const fd = new FormData();
  fd.append('name_ar', document.getElementById('nameAr').value);
  fd.append('name', document.getElementById('nameEn').value);
  fd.append('description_ar', document.getElementById('descAr').value);
  fd.append('description', document.getElementById('descEn').value);
  fd.append('price', document.getElementById('price').value);
  fd.append('cooking_time', document.getElementById('cookingTime').value);
  fd.append('category_id', document.getElementById('categoryId').value);

  const fileInput = document.getElementById('image');
  if (fileInput.files.length) fd.append('image', fileInput.files[0]);

  let res;
  if (id) {
    res = await fetch('/api/admin/dishes/' + id, { method: 'PUT', headers: authHeaders(), body: fd });
  } else {
    res = await fetch('/api/admin/dishes', { method: 'POST', headers: authHeaders(), body: fd });
  }

  if (!res.ok) {
    const err = await res.json();
    alert('خطأ: ' + (err.error || 'غير معروف'));
    return;
  }

  document.getElementById('modalOverlay').classList.remove('active');
  loadDishes();
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
});

// ------------------------------------------------------------
//  Password change modal
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
//  QR code modal
// ------------------------------------------------------------
document.getElementById('showQrBtn').addEventListener('click', async () => {
  const baseUrl = window.location.origin;
  document.getElementById('qrUrlText').textContent = baseUrl;
  const qrImg = document.getElementById('qrImage');
  qrImg.src = '/api/qrcode?url=' + encodeURIComponent(baseUrl);
  document.getElementById('qrModalOverlay').classList.add('active');
});

document.getElementById('closeQrBtn').addEventListener('click', () => {
  document.getElementById('qrModalOverlay').classList.remove('active');
});

document.getElementById('qrModalOverlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) document.getElementById('qrModalOverlay').classList.remove('active');
});
