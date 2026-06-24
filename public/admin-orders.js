let token = null;

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
  document.getElementById('ordersPanel').style.display = 'block';
  loadOrders();
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST', headers: { 'Authorization': token } });
  token = null;
  document.getElementById('loginSection').style.display = 'block';
  document.getElementById('ordersPanel').style.display = 'none';
  document.getElementById('passwordInput').value = '';
});

document.getElementById('refreshBtn').addEventListener('click', loadOrders);

function authHeaders(headers = {}) {
  headers['Authorization'] = token;
  return headers;
}

function statusText(s) {
  const labels = { pending: '⏳ قيد الانتظار', confirmed: '✅ مؤكد', completed: '✔️ تم التسليم', cancelled: '❌ ملغي' };
  return labels[s] || s;
}

function formatDate(d) {
  try { return new Date(d).toLocaleString('ar'); } catch { return d; }
}

async function loadOrders() {
  const container = document.getElementById('ordersList');
  container.innerHTML = '<p class="loading">جاري التحميل...</p>';
  try {
    const res = await fetch('/api/admin/orders', { headers: authHeaders() });
    const orders = await res.json();
    if (!orders.length) {
      container.innerHTML = '<p class="empty">لا توجد طلبات بعد</p>';
      return;
    }
    container.innerHTML = '';
    orders.forEach(order => {
      const card = document.createElement('div');
      card.className = 'order-card';
      const payLabel = order.payment_method === 'sham' ? '💳 شام كاش' : '💵 عند الاستلام';
      card.innerHTML = `
        <div class="order-header">
          <span class="order-id">طلب #${order.id}</span>
          <span class="order-status status-${order.status}">${statusText(order.status)}</span>
        </div>
        <div class="order-info">
          <span>👤 ${order.customer_name}</span>
          <span>📞 ${order.phone || '—'}</span>
          <span>💳 ${payLabel}</span>
          <span>📅 ${formatDate(order.created_at)}</span>
        </div>
        <div class="order-items">
          ${(order.items || []).map(i => `
            <div class="order-item">
              <span>${i.dish_name_ar} × ${i.quantity}</span>
              <span>${Number(i.price * i.quantity).toLocaleString()} ل.س</span>
            </div>
          `).join('')}
        </div>
        ${order.notes ? `<div class="order-notes">📝 ${order.notes}</div>` : ''}
        <div class="order-total">المجموع: ${Number(order.total).toLocaleString()} ل.س</div>
        <div class="order-actions" style="display:flex;gap:8px;">
          <select class="status-select" data-id="${order.id}" style="flex:1;">
            ${['pending', 'confirmed', 'completed', 'cancelled'].map(s =>
              `<option value="${s}" ${s === order.status ? 'selected' : ''}>${statusText(s)}</option>`
            ).join('')}
          </select>
          <button class="btn btn-danger btn-delete-order" data-id="${order.id}" style="padding:8px 16px;">🗑</button>
        </div>
      `;
      container.appendChild(card);
    });
    document.querySelectorAll('.status-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        await fetch('/api/admin/orders/' + sel.dataset.id, {
          method: 'PUT',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ status: sel.value }),
        });
        loadOrders();
      });
    });
    document.querySelectorAll('.btn-delete-order').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('هل أنت متأكد من حذف الطلب رقم ' + btn.dataset.id + '؟')) return;
        await fetch('/api/admin/orders/' + btn.dataset.id, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        loadOrders();
      });
    });
  } catch (err) {
    container.innerHTML = '<p class="empty">خطأ في تحميل الطلبات</p>';
  }
}