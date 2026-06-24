// ------------------------------------------------------------
//  State
// ------------------------------------------------------------
let cart = JSON.parse(localStorage.getItem('cart') || '{"items":[]}');
let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
let allDishes = [];
let maxPrice = 100000;

// ------------------------------------------------------------
//  Favorites helpers
// ------------------------------------------------------------
function isFav(id) { return favorites.includes(Number(id)); }

function toggleFav(id) {
  id = Number(id);
  if (isFav(id)) favorites = favorites.filter(f => f !== id);
  else favorites.push(id);
  localStorage.setItem('favorites', JSON.stringify(favorites));
  loadDishes();
}

// ------------------------------------------------------------
//  Cart helpers
// ------------------------------------------------------------
function saveCart() { localStorage.setItem('cart', JSON.stringify(cart)); }

function getCartCount() { return cart.items.reduce((s, i) => s + i.quantity, 0); }

function getCartTotal() { return cart.items.reduce((s, i) => s + i.price * i.quantity, 0); }

function addToCart(dish) {
  const existing = cart.items.find(i => i.dish_id === dish.id);
  if (existing) existing.quantity++;
  else cart.items.push({ dish_id: dish.id, dish_name_ar: dish.name_ar, price: dish.price, image: dish.image || '', quantity: 1 });
  saveCart();
  updateCartUI();
}

function removeFromCart(dishId) {
  cart.items = cart.items.filter(i => i.dish_id !== dishId);
  saveCart();
  updateCartUI();
  renderCartPanel();
}

function changeQty(dishId, delta) {
  const item = cart.items.find(i => i.dish_id === dishId);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) removeFromCart(dishId);
  else { saveCart(); updateCartUI(); renderCartPanel(); }
}

function clearCart() {
  cart.items = [];
  saveCart();
  updateCartUI();
  renderCartPanel();
}

// ------------------------------------------------------------
//  Cart UI
// ------------------------------------------------------------
function updateCartUI() {
  const count = getCartCount();
  document.getElementById('cartCount').textContent = count;
  const footer = document.getElementById('cartFooter');
  footer.style.display = count > 0 ? 'block' : 'none';
}

function renderCartPanel() {
  const body = document.getElementById('cartBody');
  const totalEl = document.getElementById('cartTotal');
  const summary = document.getElementById('orderSummary');

  if (!cart.items.length) {
    body.innerHTML = '<p class="cart-empty">السلة فارغة</p>';
    totalEl.textContent = '0';
    if (summary) summary.innerHTML = '';
    return;
  }

  body.innerHTML = '';
  cart.items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <div class="cart-item-info">
        <span class="cart-item-name">${item.dish_name_ar}</span>
        <span class="cart-item-price">${Number(item.price).toLocaleString()} ل.س</span>
      </div>
      <div class="cart-item-controls">
        <button class="qty-btn" data-id="${item.dish_id}" data-delta="-1">−</button>
        <span class="qty-val">${item.quantity}</span>
        <button class="qty-btn" data-id="${item.dish_id}" data-delta="1">+</button>
        <button class="remove-btn" data-id="${item.dish_id}">✕</button>
      </div>
    `;
    body.appendChild(div);
  });

  const total = getCartTotal();
  totalEl.textContent = Number(total).toLocaleString() + ' ل.س';

  // order summary
  if (summary) {
    summary.innerHTML = cart.items.map(i =>
      `${i.dish_name_ar} × ${i.quantity} = ${Number(i.price * i.quantity).toLocaleString()} ل.س`
    ).join('<br>') + `<br><br><strong>المجموع: ${Number(total).toLocaleString()} ل.س</strong>`;
  }

  body.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => changeQty(Number(btn.dataset.id), Number(btn.dataset.delta)));
  });
  body.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => removeFromCart(Number(btn.dataset.id)));
  });
}

// ------------------------------------------------------------
//  Load categories
// ------------------------------------------------------------
async function loadCategories() {
  const res = await fetch('/api/categories');
  const cats = await res.json();
  const sel = document.getElementById('categoryFilter');
  sel.innerHTML = '<option value="">جميع الأقسام</option>';
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name_ar;
    sel.appendChild(opt);
  });
}

// ------------------------------------------------------------
//  Render dish cards
// ------------------------------------------------------------
function renderDishCard(d) {
  const card = document.createElement('div');
  card.className = 'dish-card';

  // Badge
  if (d.badge === 'new') {
    const b = document.createElement('span');
    b.className = 'badge badge-new';
    b.textContent = 'جديد 🔥';
    card.appendChild(b);
  } else if (d.badge === 'bestseller') {
    const b = document.createElement('span');
    b.className = 'badge badge-bestseller';
    b.textContent = 'الأكثر مبيعًا 🏆';
    card.appendChild(b);
  }

  // Image
  if (d.image) {
    const img = document.createElement('img');
    img.className = 'dish-img';
    img.src = d.image;
    img.alt = d.name_ar;
    card.appendChild(img);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'dish-img-placeholder';
    placeholder.textContent = '🍽';
    card.appendChild(placeholder);
  }

  const body = document.createElement('div');
  body.className = 'dish-body';

  const favBtn = document.createElement('button');
  favBtn.className = 'fav-btn' + (isFav(d.id) ? ' active' : '');
  favBtn.textContent = isFav(d.id) ? '❤️' : '🤍';
  favBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFav(d.id); });
  body.appendChild(favBtn);

  const nameRow = document.createElement('div');
  nameRow.innerHTML = `
    <h3 class="dish-name">${d.name_ar}</h3>
    <p class="dish-category">${d.category_name_ar}</p>
  `;
  body.appendChild(nameRow);

  if (d.description_ar) {
    const desc = document.createElement('p');
    desc.className = 'dish-desc';
    desc.textContent = d.description_ar;
    body.appendChild(desc);
  }

  const meta = document.createElement('div');
  meta.className = 'dish-meta';
  meta.innerHTML = `
    <span class="dish-price">${Number(d.price).toLocaleString()}</span>
    <span class="dish-time">${d.cooking_time} دقيقة</span>
  `;
  body.appendChild(meta);

  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-primary add-to-cart';
  addBtn.textContent = '➕ أضف للسلة';
  addBtn.addEventListener('click', () => addToCart(d));
  body.appendChild(addBtn);

  card.appendChild(body);
  return card;
}

// ------------------------------------------------------------
//  Load dishes
// ------------------------------------------------------------
async function loadDishes() {
  const grid = document.getElementById('dishesGrid');
  grid.innerHTML = '<p class="loading">جاري التحميل...</p>';

  const tab = document.querySelector('.tab.active').dataset.tab;
  const search = document.getElementById('searchInput').value;
  const cat = document.getElementById('categoryFilter').value;
  const priceMax = Number(document.getElementById('priceMax').value) || Infinity;

  if (tab === 'favorites') {
    const ids = favorites;
    if (!ids.length) { grid.innerHTML = '<p class="empty">لا توجد أطباق في المفضلة</p>'; return; }
    const all = await Promise.all(ids.map(id => fetch('/api/dishes/' + id).then(r => r.json())));
    const dishes = all.filter(d => !d.error).filter(d => {
      if (cat && d.category_id !== Number(cat)) return false;
      if (search && !d.name_ar.includes(search) && !d.description_ar?.includes(search)) return false;
      if (d.price > priceMax) return false;
      return true;
    });
    grid.innerHTML = '';
    dishes.forEach(d => grid.appendChild(renderDishCard(d)));
    return;
  }

  if (tab === 'popular') {
    const res = await fetch('/api/dishes/popular');
    let dishes = await res.json();
    dishes = dishes.filter(d => {
      if (cat && d.category_id !== Number(cat)) return false;
      if (search && !d.name_ar.includes(search) && !d.description_ar?.includes(search)) return false;
      if (d.price > priceMax) return false;
      return true;
    });
    grid.innerHTML = '';
    if (!dishes.length) { grid.innerHTML = '<p class="empty">لا توجد أطباق مطابقة</p>'; return; }
    dishes.forEach(d => grid.appendChild(renderDishCard(d)));
    return;
  }

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (cat) params.set('category_id', cat);
  const res = await fetch('/api/dishes?' + params.toString());
  let dishes = await res.json();
  dishes = dishes.filter(d => d.price <= priceMax);

  grid.innerHTML = '';
  if (!dishes.length) { grid.innerHTML = '<p class="empty">لا توجد أطباق مطابقة</p>'; return; }
  dishes.forEach(d => grid.appendChild(renderDishCard(d)));

    // update max price placeholder
    if (dishes.length) {
      const m = Math.max(...dishes.map(d => d.price));
      if (m > maxPrice) {
        maxPrice = m;
        document.getElementById('priceMax').placeholder = 'أقصى سعر (أقصى ' + Number(m).toLocaleString() + ')';
      }
    }
}

// ------------------------------------------------------------
//  WhatsApp order
// ------------------------------------------------------------
async function sendWhatsApp() {
  if (!cart.items.length) return;
  const res = await fetch('/api/settings/whatsapp_number');
  const data = await res.json();
  const number = data.value;
  if (!number) { alert('رقم واتساب غير مضبوط في لوحة التحكم'); return; }
  let msg = '🍽 طلب جديد من منيو بروستد الزواق\n------------------\n';
  cart.items.forEach(i => {
    msg += `${i.dish_name_ar} × ${i.quantity} = ${Number(i.price * i.quantity).toLocaleString()} ل.س\n`;
  });
  msg += `------------------\n💰 المجموع: ${Number(getCartTotal()).toLocaleString()} ل.س`;
  const url = `https://wa.me/${number}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

// ------------------------------------------------------------
//  Submit order to server
// ------------------------------------------------------------
async function submitOrder(name, phone, notes) {
  const items = cart.items.map(i => ({
    dish_id: i.dish_id,
    dish_name_ar: i.dish_name_ar,
    quantity: i.quantity,
    price: i.price,
  }));
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer_name: name, phone, notes, items }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'فشل الإرسال'); }
  return res.json();
}

// ------------------------------------------------------------
//  Event listeners
// ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadCategories();
  loadDishes();
  updateCartUI();

  document.getElementById('searchInput').addEventListener('input', loadDishes);
  document.getElementById('categoryFilter').addEventListener('change', loadDishes);
  document.getElementById('priceMax').addEventListener('input', loadDishes);

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadDishes();
    });
  });

  // Cart toggle
  document.getElementById('cartToggle').addEventListener('click', () => {
    document.getElementById('cartOverlay').classList.add('active');
    document.getElementById('cartPanel').classList.add('active');
    document.body.style.overflow = 'hidden';
    renderCartPanel();
  });
  document.getElementById('cartClose').addEventListener('click', closeCart);
  document.getElementById('cartOverlay').addEventListener('click', closeCart);
  function closeCart() {
    document.getElementById('cartOverlay').classList.remove('active');
    document.getElementById('cartPanel').classList.remove('active');
    document.body.style.overflow = '';
  }

  // WhatsApp
  document.getElementById('whatsappBtn').addEventListener('click', sendWhatsApp);

  // Clear cart
  document.getElementById('clearCartBtn').addEventListener('click', () => {
    if (confirm('تفريغ السلة؟')) clearCart();
  });

  // Order modal
  const orderModal = document.getElementById('orderModal');
  const orderForm = document.getElementById('orderForm');

  document.getElementById('orderBtn').addEventListener('click', () => {
    document.getElementById('orderName').value = '';
    document.getElementById('orderPhone').value = '';
    document.getElementById('orderNotes').value = '';
    renderCartPanel();
    orderModal.classList.add('active');
  });

  document.getElementById('orderCancel').addEventListener('click', () => {
    orderModal.classList.remove('active');
  });
  orderModal.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) orderModal.classList.remove('active');
  });

  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = orderForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'جاري الإرسال...';
    try {
      await submitOrder(
        document.getElementById('orderName').value,
        document.getElementById('orderPhone').value,
        document.getElementById('orderNotes').value
      );
      orderModal.classList.remove('active');
      document.getElementById('successModal').classList.add('active');
      clearCart();
    } catch (err) {
      alert('خطأ: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'إرسال الطلب';
    }
  });

  document.getElementById('successClose').addEventListener('click', () => {
    document.getElementById('successModal').classList.remove('active');
  });
  document.getElementById('successModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) document.getElementById('successModal').classList.remove('active');
  });
});