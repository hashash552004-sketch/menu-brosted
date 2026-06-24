// ------------------------------------------------------------
//  Load categories into filter
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
//  Load dishes
// ------------------------------------------------------------
async function loadDishes() {
  const grid = document.getElementById('dishesGrid');
  grid.innerHTML = '<p class="loading">جاري التحميل...</p>';

  const search = document.getElementById('searchInput').value;
  const cat = document.getElementById('categoryFilter').value;

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (cat) params.set('category_id', cat);

  const res = await fetch('/api/dishes?' + params.toString());
  const dishes = await res.json();

  if (!dishes.length) {
    grid.innerHTML = '<p class="empty">لا توجد أطباق مطابقة</p>';
    return;
  }

  grid.innerHTML = '';
  dishes.forEach(d => {
    const card = document.createElement('div');
    card.className = 'dish-card';

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

    body.innerHTML = `
      <h3 class="dish-name">${d.name_ar}</h3>
      <p class="dish-category">${d.category_name_ar}</p>
      <p class="dish-desc">${d.description_ar || ''}</p>
      <div class="dish-meta">
        <span class="dish-price">${Number(d.price).toLocaleString()}</span>
        <span class="dish-time">${d.cooking_time} دقيقة</span>
      </div>
    `;

    card.appendChild(body);
    grid.appendChild(card);
  });
}

// ------------------------------------------------------------
//  Event listeners
// ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadCategories();
  loadDishes();

  document.getElementById('searchInput').addEventListener('input', loadDishes);
  document.getElementById('categoryFilter').addEventListener('change', loadDishes);
});
