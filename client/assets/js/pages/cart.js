/**
 * Cart and checkout. The cart lives in localStorage; placing an order
 * sends the line items to POST /api/orders, which re-checks prices and stock.
 */
import { api } from '../api.js';
import { getCart, setQty, removeFromCart, clearCart, cartTotals, getUser } from '../store.js';
import { initPage, formatPrice, esc, toast, showFieldErrors, setBusy, $ } from '../ui.js';

initPage('');
const root = $('#cart-root');

function lineHtml(l) {
  const isVehicle = l.category === 'vehicle';
  const sub = isVehicle
    ? `<span class="mono muted">${esc(l.stockNumber)}</span> · Deposit ${formatPrice(l.deposit)} now`
    : `${formatPrice(l.price)} each`;
  const qty = isVehicle
    ? '<span class="label">Qty 1</span>'
    : `<div class="qty"><button type="button" data-dec="${l.id}" aria-label="Fewer">−</button>
         <input type="number" value="${l.qty}" min="1" max="${l.stock}" data-qty="${l.id}" aria-label="Quantity for ${esc(l.name)}">
         <button type="button" data-inc="${l.id}" aria-label="More">+</button></div>`;
  return `<article class="cart-line">
    <a href="product.html?slug=${encodeURIComponent(l.slug)}"><img src="${esc(l.image)}" alt=""></a>
    <div class="cart-line-info">
      <a href="product.html?slug=${encodeURIComponent(l.slug)}" style="text-decoration:none"><h3>${esc(l.name)}</h3></a>
      <span class="muted" style="font-size:.875rem">${sub}</span>
    </div>
    <div class="cart-line-side">
      <span class="price" style="font-size:1.125rem">${formatPrice(l.price * l.qty)}</span>
      ${qty}
      <button class="btn btn-danger btn-sm" type="button" data-remove="${l.id}">Remove</button>
    </div>
  </article>`;
}

function summaryHtml(cart) {
  const t = cartTotals(cart);
  const hasVehicle = cart.some((l) => l.category === 'vehicle');
  return `<div class="summary">
    <div class="summary-row"><span>Full price</span><span class="mono">${formatPrice(t.subtotal)}</span></div>
    ${hasVehicle ? `<div class="summary-row muted"><span>Balance at handover</span><span class="mono">${formatPrice(t.balance)}</span></div>` : ''}
    <div class="summary-row total"><span>Due now</span><span class="mono">${formatPrice(t.dueNow)}</span></div>
    ${hasVehicle ? '<p class="muted" style="font-size:.875rem">Vehicle deposits are refundable until handover. Accessories are paid in full.</p>' : ''}
  </div>`;
}

function checkoutHtml(user) {
  if (user?.role === 'admin') {
    return `<div class="stack">
      <p class="notice">You are signed in as an admin. Only customer accounts can place orders.</p>
      <a class="btn btn-accent btn-block" href="admin.html">Go to the admin panel</a>
    </div>`;
  }
  if (!user) {
    return `<div class="stack">
      <p>Log in or create an account to place your order. Your cart stays saved.</p>
      <a class="btn btn-accent btn-block" href="account.html?next=cart.html">Log in to check out</a>
    </div>`;
  }
  return `<form id="checkout" class="stack" novalidate>
    <h3>Checkout</h3>
    <div class="radio-cards" role="radiogroup" aria-label="Fulfilment">
      <label><input type="radio" name="method" value="pickup" checked><strong>Showroom pickup</strong><small>Mogpog showroom</small></label>
      <label><input type="radio" name="method" value="delivery"><strong>Delivery</strong><small>Anywhere in Marinduque</small></label>
    </div>
    <label class="field"><span>Full name</span><input class="input" id="fullName" name="fullName" value="${esc(user.name)}" required autocomplete="name"><small class="field-error"></small></label>
    <label class="field"><span>Mobile number</span><input class="input" id="phone" name="phone" value="${esc(user.phone || '')}" required autocomplete="tel" placeholder="0917 123 4567"><small class="field-error"></small></label>
    <div id="address-fields" class="stack" hidden>
      <label class="field"><span>Street address</span><input class="input" id="address" name="address" autocomplete="street-address"><small class="field-error"></small></label>
      <label class="field"><span>City</span><input class="input" id="city" name="city" autocomplete="address-level2" placeholder="Boac"><small class="field-error"></small></label>
    </div>
    <label class="field"><span>Payment</span>
      <select class="input" id="paymentMethod" name="paymentMethod">
        <option value="pay-at-showroom">Pay at the showroom</option>
        <option value="bank-transfer">Bank transfer (details sent by email)</option>
      </select>
    </label>
    <label class="field"><span>Notes <span class="muted">(optional)</span></span><textarea class="input" id="notes" name="notes" maxlength="500" style="min-height:80px" placeholder="Preferred pickup day, trade-in details…"></textarea></label>
    <p class="notice notice-error" id="checkout-error" hidden></p>
    <button class="btn btn-accent btn-block" type="submit" id="place">Place order</button>
    <p class="muted" style="font-size:.8125rem">No card is charged online. We confirm your order by phone within one business day.</p>
  </form>`;
}

function render() {
  const cart = getCart();
  if (!cart.length) {
    root.innerHTML = `<div class="empty"><h2 style="font-size:var(--step-2)">Your cart is empty</h2>
      <p class="muted">Reserve a car or add chargers and parts, and they will appear here.</p>
      <div class="row"><a class="btn btn-accent" href="products.html">Browse inventory</a>
      <a class="btn btn-ghost" href="products.html?category=accessory">Charging & parts</a></div></div>`;
    return;
  }
  root.innerHTML = `<div class="cart-layout">
    <div class="cart-lines">${cart.map(lineHtml).join('')}</div>
    <aside class="panel stack">${summaryHtml(cart)}<hr style="border:0;border-top:1px solid var(--line);margin:0">${checkoutHtml(getUser())}</aside>
  </div>`;
  bindCheckout();
}

/* Cart line controls (event delegation, attached once) */
root.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  const cart = getCart();
  if (t.dataset.remove) { removeFromCart(t.dataset.remove); render(); }
  if (t.dataset.inc) { const l = cart.find((x) => x.id === t.dataset.inc); setQty(l.id, l.qty + 1); render(); }
  if (t.dataset.dec) { const l = cart.find((x) => x.id === t.dataset.dec); setQty(l.id, l.qty - 1); render(); }
});
root.addEventListener('change', (e) => {
  if (e.target.dataset.qty) { setQty(e.target.dataset.qty, Number(e.target.value) || 1); render(); }
});

function bindCheckout() {
  const form = $('#checkout');
  if (!form) return;
  const toggleAddress = () => ($('#address-fields').hidden = form.elements.method.value !== 'delivery');
  form.addEventListener('change', toggleAddress);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = form.elements;
    const errBox = $('#checkout-error');
    errBox.hidden = true;

    // Quick client-side checks; the server validates again.
    const errors = {};
    if (!f.fullName.value.trim()) errors.fullName = 'Enter the name for the order.';
    if (!/^[0-9+\s-]{7,}$/.test(f.phone.value.trim())) errors.phone = 'Enter a mobile number we can call.';
    if (f.method.value === 'delivery' && !f.address.value.trim()) errors.address = 'Enter the delivery address.';
    showFieldErrors(form, errors);
    if (Object.keys(errors).length) return;

    const btn = $('#place');
    setBusy(btn, true, 'Placing order…');
    try {
      const order = await api('/orders', {
        method: 'POST',
        body: {
          items: getCart().map((l) => ({ product: l.id, qty: l.qty })),
          fulfillment: {
            method: f.method.value,
            fullName: f.fullName.value.trim(),
            phone: f.phone.value.trim(),
            address: f.address.value.trim(),
            city: f.city.value.trim(),
          },
          paymentMethod: f.paymentMethod.value,
          notes: f.notes.value.trim(),
        },
      });
      clearCart();
      showConfirmation(order);
    } catch (err) {
      errBox.textContent = err.message;
      errBox.hidden = false;
      if (err.details) showFieldErrors(form, err.details);
      setBusy(btn, false);
      if (err.status === 401) toast('Please log in again to place your order.', 'error');
    }
  });
}

function showConfirmation(order) {
  root.innerHTML = `<div class="panel stack" style="max-width:640px">
    <span class="label">Order placed</span>
    <h2>Reference <span class="mono">${esc(order.reference)}</span></h2>
    <p>We will call ${esc(order.fulfillment.phone)} within one business day to confirm. Bring this reference to the showroom.</p>
    ${summaryHtml(order.items.map((i) => ({ ...i, deposit: i.deposit })))}
    <div class="row"><a class="btn btn-accent" href="account.html">View my orders</a><a class="btn btn-ghost" href="products.html">Keep browsing</a></div>
  </div>`;
  toast('Order placed.');
}

render();
