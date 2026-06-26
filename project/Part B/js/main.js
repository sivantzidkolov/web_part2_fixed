/* main.js - גרסה פשוטה ומתוקנת לפרויקט קורס WEB */

var IMAGE_FALLBACK = "picture/logo.jpg";
var CATEGORY_TITLES = {
  "plants": "צמחים מיוחדים",
  "nutrients": "דשנים",
  "led": "תאורת גידול",
  "potting-mix": "מצעי אדמה",
  "growing-accessories": "ציוד נלווה"
};

var CATEGORY_GROUPS = [
  {
    title: "צמחים",
    href: "category.html?type=plants&title=צמחים מיוחדים",
    children: [
      { title: "אלוקסיות", href: "category.html?kind=Alocasia&title=אלוקסיות" },
      { title: "מונסטרות", href: "category.html?kind=Monstera&title=מונסטרות" }
    ]
  },
  {
    title: "דשנים",
    href: "category.html?type=nutrients&title=דשנים",
    children: [
      { title: "Advanced", href: "category.html?kind=Advanced Nutrients&title=דשן Advanced Nutrients" },
      { title: "GHE", href: "category.html?kind=GHE&title=דשן GHE" }
    ]
  },
  { title: "ציוד נלווה", href: "category.html?type=growing-accessories&title=ציוד נלווה", children: [] },
  { title: "תאורה", href: "category.html?type=led&title=תאורת גידול", children: [] },
  { title: "מצעי אדמה", href: "category.html?type=potting-mix&title=מצעי אדמה", children: [] }
];

function safeReadJSON(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function safeWriteJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getCart() { return safeReadJSON("cart", []); }
function saveCart(cart) { safeWriteJSON("cart", cart); }
function getOrders() { return safeReadJSON("orders", []); }
function saveOrders(orders) { safeWriteJSON("orders", orders); }
function getUser() { return safeReadJSON("currentUser", null); }

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getPriceNumber(priceText) {
  return Number(String(priceText || "0").replace("₪", "").replace(/,/g, "").trim()) || 0;
}

function formatPrice(number) {
  return "₪" + Number(number || 0).toLocaleString("he-IL");
}

function imagePath(src) {
  return src || IMAGE_FALLBACK;
}

function getDisplayPrice(product) {
  if (product.options && product.options.length > 0) {
    return "החל מ־" + product.options[0].price;
  }
  return product.price || "";
}

function getDefaultOption(product) {
  if (product.options && product.options.length > 0) {
    return { label: product.options[0].size || "", price: product.options[0].price };
  }
  return { label: "", price: product.price || "₪0" };
}

function calculateCartTotals(cart, shippingMethod) {
  var productsTotal = 0;
  for (var i = 0; i < cart.length; i++) {
    productsTotal += getPriceNumber(cart[i].unitPrice) * Number(cart[i].quantity || 0);
  }
  var shippingCost = shippingMethod === "שליח עד הבית" ? 30 : 0;
  return { products: productsTotal, shipping: shippingCost, final: productsTotal + shippingCost };
}

function buildProductUrl(id) {
  var returnUrl = location.pathname.split("/").pop() + location.search + location.hash;
  return "product.html?id=" + encodeURIComponent(id) + "&from=" + encodeURIComponent(returnUrl);
}

function rememberListPosition() {
  var page = location.pathname.split("/").pop();
  if (page === "catlog.html" || page === "category.html") {
    safeWriteJSON("floraCatalogReturn", {
      url: page + location.search + location.hash,
      scrollY: window.scrollY,
      featuredX: document.getElementById("featured") ? document.getElementById("featured").scrollLeft : 0,
      dealsX: document.getElementById("deals") ? document.getElementById("deals").scrollLeft : 0,
      q: document.getElementById("catalogSearch") ? document.getElementById("catalogSearch").value : ""
    });
  }
}

function restoreListPosition() {
  var saved = safeReadJSON("floraCatalogReturn", null);
  if (!saved) return;
  var current = location.pathname.split("/").pop() + location.search + location.hash;
  if (saved.url !== current) return;

  var input = document.getElementById("catalogSearch");
  if (input && saved.q) {
    input.value = saved.q;
    filterCurrentList(saved.q);
  }

  setTimeout(function () {
    window.scrollTo(0, Number(saved.scrollY || 0));
    var featured = document.getElementById("featured");
    var deals = document.getElementById("deals");
    if (featured) featured.scrollLeft = Number(saved.featuredX || 0);
    if (deals) deals.scrollLeft = Number(saved.dealsX || 0);
  }, 50);
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[־–—-]/g, " ")
    .replace(/["'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getSearchAliases(product) {
  var typeAliases = {
    "plants": "צמח צמחים צמחים מיוחדים rare plants ארואידים אראוידים",
    "nutrients": "דשן דשנים חומרי הזנה הזנה fertilizer nutrients",
    "led": "תאורה לד led מנורה מנורות תאורת גידול",
    "potting-mix": "מצע מצעים אדמה מצעי אדמה קוקוס פרלייט שתילה",
    "growing-accessories": "ציוד אביזרים ציוד נלווה גידול לחות אוהל מאוורר"
  };
  var kindAliases = {
    "Alocasia": "אלוקסיה אלוקסיות alocasia",
    "Monstera": "מונסטרה מונסטרות monstera",
    "Advanced Nutrients": "advanced nutrients advanced דשן דשנים",
    "GHE": "ghe tripart terra aquatica דשן דשנים"
  };
  return [typeAliases[product.type], kindAliases[product.kind]].join(" ");
}

function productMatches(product, query) {
  query = normalizeSearchText(query);
  if (!query) return true;
  // Search is intentionally based only on the product title/name.
  // It does not search inside the description, category, type or sub-category.
  var title = normalizeSearchText(product.name || "");
  var words = query.split(" ").filter(Boolean);
  for (var i = 0; i < words.length; i++) {
    if (title.indexOf(words[i]) === -1) return false;
  }
  return true;
}

function productInCategory(product, type, kind) {
  if (type && product.type !== type) return false;
  if (kind && product.kind !== kind) return false;
  return true;
}

function createProductCard(id, product) {
  var quickOptions = "";
  if (product.options && product.options.length > 0) {
    quickOptions += '<label class="quick-option-label">בחרי אופציה</label>';
    quickOptions += '<select class="quick-option-select" data-card-option="true" aria-label="בחירת אופציה עבור ' + escapeHtml(product.name) + '">';
    for (var i = 0; i < product.options.length; i++) {
      quickOptions += '<option value="' + i + '">' + escapeHtml(product.options[i].size) + ' - ' + escapeHtml(product.options[i].price) + '</option>';
    }
    quickOptions += '</select>';
  }

  return '' +
    '<div class="product-card" data-product-id="' + escapeHtml(id) + '">' +
      '<a class="product-card-link" data-product-link="true" href="' + buildProductUrl(id) + '">' +
        '<div class="image-box"><img src="' + escapeHtml(imagePath(product.image)) + '" alt="' + escapeHtml(product.name) + '" onerror="this.src=\'' + IMAGE_FALLBACK + '\'"></div>' +
      '</a>' +
      '<h3>' + escapeHtml(product.name) + '</h3>' +
      '<p class="price" data-card-price="true">' + escapeHtml(getDisplayPrice(product)) + '</p>' +
      quickOptions +
      '<div class="product-card-actions">' +
        '<button type="button" class="btn add-card-btn" data-add-id="' + escapeHtml(id) + '">הוספה לסל</button>' +
        '<a class="secondary-btn" data-product-link="true" href="' + buildProductUrl(id) + '">פרטים</a>' +
      '</div>' +
    '</div>';
}

function addProductToCart(id, quantity, optionIndex) {
  if (typeof products === "undefined" || !products[id]) return;
  var product = products[id];
  var option;
  if (product.options && product.options.length > 0) {
    option = product.options[optionIndex || 0];
    option = { label: option.size || "", price: option.price };
  } else {
    option = getDefaultOption(product);
  }
  quantity = Number(quantity || 1);
  if (!quantity || quantity < 1) quantity = 1;

  var cart = getCart();
  var existing = null;
  for (var i = 0; i < cart.length; i++) {
    if (String(cart[i].id) === String(id) && String(cart[i].option || "") === String(option.label || "")) {
      existing = cart[i];
      break;
    }
  }

  if (existing) {
    existing.quantity = Number(existing.quantity) + quantity;
    existing.total = formatPrice(getPriceNumber(existing.unitPrice) * existing.quantity);
  } else {
    cart.push({
      id: String(id),
      name: product.name,
      image: imagePath(product.image),
      option: option.label || "",
      unitPrice: option.price,
      quantity: quantity,
      total: formatPrice(getPriceNumber(option.price) * quantity)
    });
  }
  saveCart(cart);
  updateHeader();
  renderMiniCart();
  showToast("המוצר נוסף לסל");
}

function updateHeader() {
  var cart = getCart();
  var cartCount = document.getElementById("cartCount");
  var accountLink = document.getElementById("accountLink");
  var totalQuantity = 0;
  for (var i = 0; i < cart.length; i++) totalQuantity += Number(cart[i].quantity || 0);
  if (cartCount) cartCount.innerText = totalQuantity;
  if (accountLink) accountLink.innerText = getUser() ? "👤 אזור אישי" : "👤 התחברות / הרשמה";
}

function renderMiniCart() {
  var box = document.getElementById("miniCartItems");
  var totalBox = document.getElementById("miniCartTotal");
  if (!box) return;
  var cart = getCart();
  if (cart.length === 0) {
    box.innerHTML = '<div class="empty">העגלה ריקה</div>';
    if (totalBox) totalBox.innerText = "סה״כ: ₪0";
    return;
  }
  var html = "";
  var totals = calculateCartTotals(cart, "");
  for (var i = 0; i < cart.length; i++) {
    html += '<div class="mini-cart-item">' +
      '<img src="' + escapeHtml(imagePath(cart[i].image)) + '" alt="' + escapeHtml(cart[i].name) + '" onerror="this.src=\'' + IMAGE_FALLBACK + '\'">' +
      '<div><strong>' + escapeHtml(cart[i].name) + '</strong><span>' + escapeHtml(cart[i].option || "") + '</span>' +
      '<div class="qty-controls compact"><button type="button" data-mini-minus="' + i + '">-</button><span>' + cart[i].quantity + '</span><button type="button" data-mini-plus="' + i + '">+</button></div></div>' +
      '<button type="button" class="remove-mini" data-mini-remove="' + i + '">הסר</button>' +
    '</div>';
  }
  box.innerHTML = html;
  if (totalBox) totalBox.innerText = "סה״כ מוצרים: " + formatPrice(totals.products);
}

function initMiniCartEvents() {
  var mini = document.getElementById("miniCart");
  var openBtn = document.getElementById("openMiniCart");
  var closeBtn = document.getElementById("closeMiniCart");
  var continueBtn = document.getElementById("continueShoppingBtn");
  var itemsBox = document.getElementById("miniCartItems");

  function openMini() { if (mini) { mini.classList.add("open"); mini.setAttribute("aria-hidden", "false"); renderMiniCart(); } }
  function closeMini() { if (mini) { mini.classList.remove("open"); mini.setAttribute("aria-hidden", "true"); } }
  if (openBtn) openBtn.addEventListener("click", openMini);
  if (closeBtn) closeBtn.addEventListener("click", closeMini);
  if (continueBtn) continueBtn.addEventListener("click", closeMini);
  if (mini) mini.addEventListener("click", function (event) { if (event.target === mini) closeMini(); });
  document.addEventListener("keydown", function (event) { if (event.key === "Escape") closeMini(); });

  if (itemsBox) {
    itemsBox.addEventListener("click", function (event) {
      var cart = getCart();
      if (event.target.hasAttribute("data-mini-plus")) {
        var plusIndex = Number(event.target.getAttribute("data-mini-plus"));
        cart[plusIndex].quantity = Number(cart[plusIndex].quantity) + 1;
      }
      if (event.target.hasAttribute("data-mini-minus")) {
        var minusIndex = Number(event.target.getAttribute("data-mini-minus"));
        cart[minusIndex].quantity = Number(cart[minusIndex].quantity) - 1;
        if (cart[minusIndex].quantity <= 0) cart.splice(minusIndex, 1);
      }
      if (event.target.hasAttribute("data-mini-remove")) {
        cart.splice(Number(event.target.getAttribute("data-mini-remove")), 1);
      }
      for (var i = 0; i < cart.length; i++) {
        cart[i].total = formatPrice(getPriceNumber(cart[i].unitPrice) * Number(cart[i].quantity || 0));
      }
      saveCart(cart);
      updateHeader();
      renderMiniCart();
      renderCart();
      updateCartTotalWithShipping();
    });
  }
}

function renderCatalogMenu() {
  var menu = document.getElementById("catalogMenu");
  if (!menu) return;
  var html = "";
  for (var i = 0; i < CATEGORY_GROUPS.length; i++) {
    var group = CATEGORY_GROUPS[i];
    var hasChildren = group.children && group.children.length;
    html += '<div class="category-group" data-category-group="' + i + '">';
    if (hasChildren) {
      html += '<button type="button" class="category-main has-children" data-toggle-group="' + i + '">' + escapeHtml(group.title) + '</button>' +
        '<div class="subcategory-list">' +
        '<a class="subcategory-link" href="' + group.href + '">כל ' + escapeHtml(group.title) + '</a>';
      for (var j = 0; j < group.children.length; j++) {
        html += '<a class="subcategory-link" href="' + group.children[j].href + '">' + escapeHtml(group.children[j].title) + '</a>';
      }
      html += '</div>';
    } else {
      html += '<a class="category-main" href="' + group.href + '">' + escapeHtml(group.title) + '</a>';
    }
    html += '</div>';
  }
  menu.innerHTML = html;
}

function renderSubcategoryOptions(filter) {
  var box = document.getElementById("subcategoryOptions");
  if (!box) return;
  var group = null;
  for (var i = 0; i < CATEGORY_GROUPS.length; i++) {
    if (CATEGORY_GROUPS[i].href.indexOf("type=" + encodeURIComponent(filter.type)) !== -1) {
      group = CATEGORY_GROUPS[i];
      break;
    }
  }
  if (!group || !group.children || !group.children.length) {
    box.innerHTML = "";
    return;
  }

  var html = '<a class="subcategory-card" href="' + group.href + '">כל ' + escapeHtml(group.title) + '</a>';
  for (var j = 0; j < group.children.length; j++) {
    html += '<a class="subcategory-card" href="' + group.children[j].href + '">' + escapeHtml(group.children[j].title) + '</a>';
  }
  box.innerHTML = html;
}

function renderCatalog() {
  if (typeof products === "undefined") return;
  var featured = document.getElementById("featured");
  var deals = document.getElementById("deals");
  if (featured) featured.innerHTML = "";
  if (deals) deals.innerHTML = "";
  for (var id in products) {
    if (featured && products[id].category === "featured") featured.innerHTML += createProductCard(id, products[id]);
    if (deals && products[id].category === "sale") deals.innerHTML += createProductCard(id, products[id]);
  }
  renderCategoryPage();
  restoreListPosition();
}

function getCurrentCategoryFilter() {
  var params = new URLSearchParams(location.search);
  var type = params.get("type") || "";
  var kind = params.get("kind") || "";
  var title = params.get("title") || CATEGORY_TITLES[type] || kind || "קטגוריה";
  return { type: type, kind: kind, title: title };
}

function renderCategoryPage(query) {
  var grid = document.getElementById("productGrid");
  if (!grid || typeof products === "undefined") return 0;
  var filter = getCurrentCategoryFilter();
  var title = document.getElementById("categoryTitle");
  var subtitle = document.getElementById("categorySubtitle");
  var summary = document.getElementById("categorySearchSummary");
  query = String(query || "").trim();
  if (title) title.innerText = filter.title;
  if (subtitle) subtitle.innerText = query ? 'תוצאות עבור "' + query + '"' : filter.title;
  renderSubcategoryOptions(filter);

  grid.innerHTML = "";
  var count = 0;
  for (var id in products) {
    var product = products[id];
    if (productInCategory(product, filter.type, filter.kind) && productMatches(product, query)) {
      grid.innerHTML += createProductCard(id, product);
      count++;
    }
  }
  if (summary) {
    summary.innerText = query ? ('נמצאו ' + count + ' מוצרים מתאימים בתוך הקטגוריה.') : '';
  }
  if (count === 0) grid.innerHTML = '<div class="empty">לא נמצאו מוצרים מתאימים לחיפוש הזה.</div>';
  return count;
}

function resetCatalogSearch() {
  var searchInput = document.getElementById("catalogSearch");
  var searchSection = document.getElementById("catalogSearchSection");
  var featuredSection = document.getElementById("featuredSection");
  var dealsSection = document.getElementById("dealsSection");
  var results = document.getElementById("catalogResults");
  var summary = document.getElementById("catalogSearchSummary");
  var categorySummary = document.getElementById("categorySearchSummary");
  var categorySubtitle = document.getElementById("categorySubtitle");
  if (searchInput) searchInput.value = "";
  if (searchSection) searchSection.classList.add("hidden");
  if (featuredSection) featuredSection.classList.remove("hidden");
  if (dealsSection) dealsSection.classList.remove("hidden");
  if (results) results.innerHTML = "";
  if (summary) summary.innerText = "";
  if (categorySummary) categorySummary.innerText = "";
  if (categorySubtitle) categorySubtitle.innerText = getCurrentCategoryFilter().title;
  renderCategoryPage("");
}

function filterCurrentList(query) {
  var results = document.getElementById("catalogResults");
  query = String(query || "").trim();

  if (!query) {
    resetCatalogSearch();
    showToast("כתבי מילת חיפוש ואז לחצי על חיפוש");
    return;
  }

  if (results) {
    var featuredSection = document.getElementById("featuredSection");
    var dealsSection = document.getElementById("dealsSection");
    var searchSection = document.getElementById("catalogSearchSection");
    var title = document.getElementById("catalogSearchTitle");
    var summary = document.getElementById("catalogSearchSummary");

    if (searchSection) searchSection.classList.remove("hidden");
    if (featuredSection) featuredSection.classList.add("hidden");
    if (dealsSection) dealsSection.classList.add("hidden");
    if (title) title.innerText = 'תוצאות עבור "' + query + '"';

    results.innerHTML = "";
    var count = 0;
    for (var id in products) {
      if (productMatches(products[id], query)) {
        results.innerHTML += createProductCard(id, products[id]);
        count++;
      }
    }
    if (summary) summary.innerText = 'נמצאו ' + count + ' מוצרים מתאימים.';
    if (count === 0) results.innerHTML = '<div class="empty">לא נמצאו מוצרים בשם הזה. נסי לחפש חלק משם מוצר, למשל Monstera, GHE, Sensi או קוקוס.</div>';
    if (searchSection) searchSection.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  var categoryCount = renderCategoryPage(query);
  var grid = document.getElementById("productGrid");
  if (grid) grid.scrollIntoView({ behavior: "smooth", block: "start" });
}

function initCatalogEvents() {
  var featured = document.getElementById("featured");
  var deals = document.getElementById("deals");
  var pairs = [
    ["featuredRight", featured, 300], ["featuredLeft", featured, -300],
    ["dealsRight", deals, 300], ["dealsLeft", deals, -300]
  ];
  for (var i = 0; i < pairs.length; i++) {
    var btn = document.getElementById(pairs[i][0]);
    (function (button, box, amount) {
      if (button && box) button.addEventListener("click", function () { box.scrollBy({ left: amount, behavior: "smooth" }); });
    })(btn, pairs[i][1], pairs[i][2]);
  }

  var searchInput = document.getElementById("catalogSearch");
  var searchBtn = document.getElementById("catalogSearchBtn");
  var clearBtn = document.getElementById("catalogClearBtn");
  if (searchInput) {
    searchInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        filterCurrentList(searchInput.value);
      }
    });
  }
  if (searchBtn) searchBtn.addEventListener("click", function () { filterCurrentList(searchInput ? searchInput.value : ""); });
  if (clearBtn) clearBtn.addEventListener("click", function () { resetCatalogSearch(); if (searchInput) searchInput.focus(); });

  document.addEventListener("click", function (event) {
    var toggleButton = event.target.closest("[data-toggle-group]");
    if (toggleButton) {
      event.preventDefault();
      var groupBox = toggleButton.closest(".category-group");
      if (groupBox) groupBox.classList.toggle("open");
      return;
    }
    if (event.target.closest("[data-product-link]")) rememberListPosition();
    var optionSelect = event.target.closest("[data-card-option]");
    if (optionSelect) {
      var cardForPrice = optionSelect.closest(".product-card");
      var productIdForPrice = cardForPrice ? cardForPrice.getAttribute("data-product-id") : "";
      var priceEl = cardForPrice ? cardForPrice.querySelector("[data-card-price]") : null;
      var productForPrice = productIdForPrice && products ? products[productIdForPrice] : null;
      if (priceEl && productForPrice && productForPrice.options && productForPrice.options[Number(optionSelect.value)]) {
        priceEl.innerText = productForPrice.options[Number(optionSelect.value)].price;
      }
      return;
    }

    var addButton = event.target.closest("[data-add-id]");
    if (addButton) {
      event.preventDefault();
      var idToAdd = addButton.getAttribute("data-add-id");
      var card = addButton.closest(".product-card");
      var select = card ? card.querySelector("[data-card-option]") : null;
      var selectedOptionIndex = select ? Number(select.value || 0) : 0;
      addProductToCart(idToAdd, 1, selectedOptionIndex);
    }
  });
}

function getProductIdFromUrl() {
  return new URLSearchParams(window.location.search).get("id");
}

function renderProductPage() {
  if (typeof products === "undefined") return;
  var productName = document.getElementById("productName");
  if (!productName) return;
  var id = getProductIdFromUrl();
  var product = products[id];
  if (!product) {
    productName.innerText = "המוצר לא נמצא";
    return;
  }

  var productImage = document.getElementById("productImage");
  var productDesc = document.getElementById("productDesc");
  var productPrice = document.getElementById("productPrice");
  var optionBox = document.getElementById("optionBox");
  var productOption = document.getElementById("productOption");
  var quantityInput = document.getElementById("quantity");
  var addToCartBtn = document.getElementById("addToCartBtn");
  var message = document.getElementById("message");
  var breadcrumb = document.getElementById("productBreadcrumb");
  var selectedIndex = 0;

  productName.innerText = product.name;
  if (breadcrumb) breadcrumb.innerText = product.name;
  if (productImage) { productImage.src = imagePath(product.image); productImage.alt = product.name; productImage.onerror = function(){ this.src = IMAGE_FALLBACK; }; }
  if (productDesc) productDesc.innerText = product.desc || "";

  if (product.options && product.options.length > 0) {
    optionBox.style.display = "block";
    productOption.innerHTML = "";
    for (var i = 0; i < product.options.length; i++) {
      productOption.innerHTML += '<option value="' + i + '">' + escapeHtml(product.options[i].size) + ' - ' + escapeHtml(product.options[i].price) + '</option>';
    }
    productOption.addEventListener("change", function () { selectedIndex = Number(this.value); updateProductPrice(); });
  }

  function updateProductPrice() {
    var option = product.options && product.options.length ? product.options[selectedIndex] : { price: product.price };
    var quantity = Number(quantityInput.value || 1);
    if (quantity < 1 || isNaN(quantity)) { quantity = 1; quantityInput.value = 1; }
    productPrice.innerText = formatPrice(getPriceNumber(option.price) * quantity);
  }
  quantityInput.addEventListener("input", updateProductPrice);
  addToCartBtn.addEventListener("click", function () {
    addProductToCart(id, Number(quantityInput.value || 1), selectedIndex);
    if (message) { message.style.display = "block"; setTimeout(function(){ message.style.display = "none"; }, 1500); }
  });

  var back = document.getElementById("backToCatalog");
  if (back) {
    var params = new URLSearchParams(location.search);
    var from = params.get("from");
    var saved = safeReadJSON("floraCatalogReturn", null);
    back.href = from || (saved && saved.url) || "catlog.html";
  }

  updateProductPrice();
}

function renderCart() {
  var container = document.getElementById("cartContainer");
  var totalBox = document.getElementById("totalPrice");
  if (!container || !totalBox) return;
  var cart = getCart();
  container.innerHTML = "";
  if (cart.length === 0) {
    container.innerHTML = '<div class="empty">העגלה ריקה</div>';
    totalBox.innerText = "סה״כ לתשלום: ₪0";
    updateHeader();
    return;
  }
  for (var i = 0; i < cart.length; i++) {
    var itemTotal = getPriceNumber(cart[i].unitPrice) * Number(cart[i].quantity || 0);
    cart[i].total = formatPrice(itemTotal);
    container.innerHTML += '<div class="cart-item">' +
      '<img src="' + escapeHtml(imagePath(cart[i].image)) + '" alt="' + escapeHtml(cart[i].name) + '" onerror="this.src=\'' + IMAGE_FALLBACK + '\'">' +
      '<div class="cart-details"><h3>' + escapeHtml(cart[i].name) + '</h3>' +
      '<div class="muted">' + escapeHtml(cart[i].option || "") + '</div>' +
      '<div class="price">מחיר יחידה: ' + escapeHtml(cart[i].unitPrice) + '</div>' +
      '<div class="qty-controls"><button type="button" class="qty-minus" data-index="' + i + '">-</button><span>כמות: ' + cart[i].quantity + '</span><button type="button" class="qty-plus" data-index="' + i + '">+</button></div>' +
      '<div class="price">סה״כ מוצר: ' + cart[i].total + '</div></div>' +
      '<button type="button" class="danger-btn remove-item" data-index="' + i + '">הסר</button>' +
    '</div>';
  }
  saveCart(cart);
  updateCartTotalWithShipping();
  updateHeader();
}

function initCartEvents() {
  var container = document.getElementById("cartContainer");
  var clearCartBtn = document.getElementById("clearCartBtn");
  var shipping = document.getElementById("shipping");
  if (container) {
    container.addEventListener("click", function (event) {
      var target = event.target;
      if (!target.hasAttribute("data-index")) return;
      var index = Number(target.getAttribute("data-index"));
      if (target.classList.contains("qty-plus")) changeQty(index, 1);
      if (target.classList.contains("qty-minus")) changeQty(index, -1);
      if (target.classList.contains("remove-item")) removeItem(index);
    });
  }
  if (clearCartBtn) clearCartBtn.addEventListener("click", function () { localStorage.removeItem("cart"); renderCart(); renderMiniCart(); });
  if (shipping) shipping.addEventListener("change", updateCartTotalWithShipping);
}

function updateCartTotalWithShipping() {
  var totalBox = document.getElementById("totalPrice");
  if (!totalBox) return;
  var shipping = document.getElementById("shipping");
  var totals = calculateCartTotals(getCart(), shipping ? shipping.value : "");
  totalBox.innerHTML = "סה״כ מוצרים: " + formatPrice(totals.products) + "<br>משלוח: " + formatPrice(totals.shipping) + "<br>סה״כ לתשלום: " + formatPrice(totals.final);
}

function changeQty(index, change) {
  var cart = getCart();
  if (!cart[index]) return;
  cart[index].quantity = Number(cart[index].quantity) + change;
  if (cart[index].quantity <= 0) cart.splice(index, 1);
  saveCart(cart);
  renderCart();
  renderMiniCart();
}

function removeItem(index) {
  var cart = getCart();
  cart.splice(index, 1);
  saveCart(cart);
  renderCart();
  renderMiniCart();
}

function statusIsPast(status) {
  return status === "הושלמה" || status === "סופקה" || status === "בוטלה";
}

function renderOrders(tab) {
  var list = document.getElementById("ordersList");
  if (!list) return;
  tab = tab || "active";
  var orders = getOrders();
  var html = "";
  var counter = 0;
  for (var i = 0; i < orders.length; i++) {
    var order = orders[i];
    var isPast = statusIsPast(order.status);
    if ((tab === "past" && isPast) || (tab === "active" && !isPast)) {
      counter++;
      html += '<article class="order-card">' +
        '<div class="order-card-header"><div><h3>הזמנה #' + escapeHtml(order.id) + '</h3><p>תאריך: ' + escapeHtml(order.date || "") + '</p></div><span class="status-badge">' + escapeHtml(order.status || "בטיפול") + '</span></div>' +
        '<p><strong>משלוח:</strong> ' + escapeHtml(order.customer ? order.customer.shipping : "") + '</p>' +
        '<p><strong>כתובת:</strong> ' + escapeHtml(order.customer ? (order.customer.address + ", " + order.customer.city) : "") + '</p>' +
        '<div class="order-items-list">';
      var items = order.cart || order.items || [];
      for (var j = 0; j < items.length; j++) {
        html += '<div class="order-product-row"><img src="' + escapeHtml(imagePath(items[j].image)) + '" alt="' + escapeHtml(items[j].name) + '" onerror="this.src=\'' + IMAGE_FALLBACK + '\'"><div><strong>' + escapeHtml(items[j].name) + '</strong><span>' + escapeHtml(items[j].option || "") + ' × ' + escapeHtml(items[j].quantity) + '</span></div></div>';
      }
      html += '</div><div class="order-total">סה״כ: ' + formatPrice(order.totals ? order.totals.final : 0) + '</div>' +
        '<p class="muted">ההזמנה נשמרה לאחר התשלום והיא מוצגת כאן לצפייה ומעקב. שינוי פריטים מתבצע לפני התשלום בעגלת הקניות.</p>' +
      '</article>';
    }
  }
  list.innerHTML = counter ? html : '<div class="empty">אין הזמנות להצגה.</div>';
}

function initOrdersEvents() {
  var tabButtons = document.querySelectorAll(".tab-btn");
  for (var i = 0; i < tabButtons.length; i++) {
    tabButtons[i].addEventListener("click", function () {
      for (var j = 0; j < tabButtons.length; j++) tabButtons[j].classList.remove("active");
      this.classList.add("active");
      renderOrders(this.getAttribute("data-order-tab"));
    });
  }
}

function renderSuccess() {
  var box = document.getElementById("successOrderDetails");
  if (!box) return;
  var order = safeReadJSON("lastOrder", null);
  if (!order) { box.innerHTML = "<p>לא נמצאה הזמנה אחרונה.</p>"; return; }
  var html = '<p><strong>מספר הזמנה:</strong> ' + escapeHtml(order.id) + '</p>' +
    '<p><strong>שם:</strong> ' + escapeHtml(order.customer.fullName) + '</p>' +
    '<p><strong>סה״כ לתשלום:</strong> ' + formatPrice(order.totals.final) + '</p>' +
    '<h3>המוצרים שהוזמנו</h3><div class="success-items">';
  for (var i = 0; i < order.cart.length; i++) {
    html += '<div class="order-product-row"><img src="' + escapeHtml(imagePath(order.cart[i].image)) + '" alt="' + escapeHtml(order.cart[i].name) + '" onerror="this.src=\'' + IMAGE_FALLBACK + '\'"><div><strong>' + escapeHtml(order.cart[i].name) + '</strong><span>' + escapeHtml(order.cart[i].option || "") + ' × ' + escapeHtml(order.cart[i].quantity) + '</span></div></div>';
  }
  html += '</div>';
  box.innerHTML = html;
}

function renderHomePersonalArea() {
  var user = getUser();
  var guestEls = document.getElementsByClassName("guest-only");
  var userEls = document.getElementsByClassName("user-only");
  for (var i = 0; i < guestEls.length; i++) guestEls[i].classList.toggle("hidden", !!user);
  for (var j = 0; j < userEls.length; j++) userEls[j].classList.toggle("hidden", !user);
  var helloUser = document.getElementById("helloUser");
  if (helloUser && user) helloUser.innerText = "שלום " + user.name + " 🌿";
  var homeOrdersText = document.getElementById("homeOrdersText");
  if (homeOrdersText) homeOrdersText.innerText = "יש לך " + getOrders().length + " הזמנות שמורות.";
}

function renderAccountPage() {
  var user = getUser();
  var accountHello = document.getElementById("accountHello");
  if (!accountHello || !user) return;
  accountHello.innerText = "שלום " + user.name + " 🌿";
  var accountDetails = document.getElementById("accountDetails");
  if (accountDetails) accountDetails.innerText = "אימייל מחובר: " + user.email;
  var accountOrdersText = document.getElementById("accountOrdersText");
  if (accountOrdersText) accountOrdersText.innerText = "יש לך " + getOrders().length + " הזמנות שמורות.";
}

function initAccountEvents() {
  var logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", function () { localStorage.removeItem("currentUser"); window.location.href = "account.html"; });
}

function showToast(text) {
  var toast = document.getElementById("toast");
  if (!toast) return;
  toast.innerText = text;
  toast.classList.add("show");
  setTimeout(function () { toast.classList.remove("show"); }, 1600);
}

window.addEventListener("load", function () {
  updateHeader();
  renderMiniCart();
  initMiniCartEvents();
  renderHomePersonalArea();
  renderAccountPage();
  renderCatalogMenu();
  initAccountEvents();
  renderCatalog();
  initCatalogEvents();
  renderProductPage();
  renderCart();
  initCartEvents();
  updateCartTotalWithShipping();
  renderOrders("active");
  initOrdersEvents();
  renderSuccess();
});
