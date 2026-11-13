/**
 * Add / edit a shop product in a dialog. Used by sellers (Account → My shop)
 * and by staff (admin console → Products).
 *   const editor = productEditor({ onSaved });
 *   editor.open();          // new product
 *   editor.open(product);   // edit
 */
import { api } from './api.js';
import { SPECIES, PRODUCT_CATEGORIES } from './config.js';
import { toast, setupModal, showFieldErrors, setBusy, options, createPhotoPicker, esc, $ } from './ui.js';

const X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

export function productEditor({ onSaved = () => {} } = {}) {
  document.body.insertAdjacentHTML('beforeend', `<dialog class="modal modal-wide" id="product-editor" aria-labelledby="pe-title">
    <form id="pe-form" novalidate>
      <div class="modal-head"><h2 id="pe-title">New product</h2><button class="icon-btn" type="button" data-close aria-label="Close">${X}</button></div>
      <div class="modal-body">
        <div class="field"><span class="field-label">Photos <span class="muted">(up to 4; the first is the main photo)</span></span><div id="pe-photos"></div></div>
        <div class="form-grid">
          <label class="field span-2"><span>Product name</span><input class="input" name="name" maxlength="100" required placeholder="e.g. Adjustable dog collar, medium"><small class="field-error"></small></label>
          <label class="field"><span>Category</span><select class="input" name="category">${options(PRODUCT_CATEGORIES)}</select><small class="field-error"></small></label>
          <label class="field"><span>Brand <span class="muted">(optional)</span></span><input class="input" name="brand" maxlength="60"></label>
          <label class="field"><span>Price (₱)</span><input class="input" name="price" type="number" min="1" step="0.01" inputmode="decimal" required><small class="field-error"></small></label>
          <label class="field"><span>Stock</span><input class="input" name="stock" type="number" min="0" step="1" inputmode="numeric" required><small class="field-error"></small></label>
          <fieldset class="field span-2" style="border:0;padding:0;margin:0"><legend class="field-label" style="margin-bottom:6px">For which pets? <span class="muted">(none = any pet)</span></legend>
            <div class="species-checks">${Object.entries(SPECIES).map(([k, l]) => `<label class="check"><input type="checkbox" name="species" value="${k}"><span>${esc(l)}</span></label>`).join('')}</div></fieldset>
          <label class="field span-2"><span>Description</span><textarea class="input" name="description" maxlength="2000" required placeholder="Size, material, how to use, what is included"></textarea><small class="field-error"></small></label>
          <label class="check span-2"><input type="checkbox" name="active" checked><span>Show in Alaga Market</span></label>
        </div>
        <p class="notice notice-error" id="pe-error" hidden role="alert"></p>
      </div>
      <div class="modal-foot"><button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit" id="pe-save">Save product</button></div>
    </form>
  </dialog>`);
  const dialog = setupModal($('#product-editor'));
  const form = $('#pe-form');
  const photos = createPhotoPicker($('#pe-photos'), { max: 4, label: 'Add photos', main: true });
  let editing = null;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = form.elements;
    const errors = {};
    if (f.name.value.trim().length < 3) errors.name = 'Enter the product name.';
    if (!(Number(f.price.value) >= 1)) errors.price = 'Enter a price of at least ₱1.';
    if (!(Number.isInteger(Number(f.stock.value)) && Number(f.stock.value) >= 0) || f.stock.value === '') errors.stock = 'Enter how many you have (0 or more).';
    if (f.description.value.trim().length < 10) errors.description = 'Describe the product in a sentence or two.';
    showFieldErrors(form, errors);
    if (Object.keys(errors).length) return;
    if (photos.busy) return toast('Wait for the photos to finish uploading.', 'error');
    const body = {
      name: f.name.value.trim(), category: f.category.value, brand: f.brand.value.trim(),
      price: Number(f.price.value), stock: Number(f.stock.value), description: f.description.value.trim(),
      species: [...form.querySelectorAll('[name=species]:checked')].map((c) => c.value),
      photos: photos.paths, active: f.active.checked,
    };
    const btn = $('#pe-save');
    setBusy(btn, true, 'Saving…');
    try {
      const saved = await api(editing ? `/shop/products/${editing}` : '/shop/products', { method: editing ? 'PUT' : 'POST', body });
      dialog.close();
      toast(editing ? 'Product updated.' : 'Product listed.');
      onSaved(saved);
    } catch (err) {
      $('#pe-error').textContent = err.message;
      $('#pe-error').hidden = false;
      if (err.details) showFieldErrors(form, err.details);
    } finally {
      setBusy(btn, false);
    }
  });

  return {
    open(p = null) {
      editing = p?._id || null;
      form.reset();
      showFieldErrors(form, {});
      $('#pe-error').hidden = true;
      $('#pe-title').textContent = p ? 'Edit product' : 'New product';
      const f = form.elements;
      if (p) {
        ['name', 'category', 'brand', 'price', 'stock', 'description'].forEach((k) => { f[k].value = p[k] ?? ''; });
        f.active.checked = p.active !== false;
        form.querySelectorAll('[name=species]').forEach((c) => { c.checked = (p.species || []).includes(c.value); });
      }
      photos.set(p?.photos || []);
      dialog.showModal();
    },
  };
}
