import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const $ = id => document.getElementById(id);
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const fmtEuro = n => new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR'
}).format(Number(n || 0));

const fmtQty = g => {
  g = Number(g || 0);
  if (g >= 1000) {
    const kg = Math.floor(g / 1000);
    const rest = Math.round((g - kg * 1000) * 100) / 100;
    return rest ? `${kg} kg ${rest} g` : `${kg} kg`;
  }
  return `${Math.round(g * 100) / 100} g`;
};

const toGrams = (q, u) => u === 'kg' ? Number(q) * 1000 : Number(q);

let state = {
  products: [],
  movements: [],
  credits: []
};

function activeMovements() {
  return state.movements.filter(m => !m.reversed);
}

function totalCredits() {
  return state.credits.reduce(
    (s, c) => s + Math.max(0, Number(c.total) - Number(c.paid)),
    0
  );
}

function totalStockValue() {
  return state.products.reduce(
    (s, p) => s + Number(p.qty_g) * Number(p.avg_cost_per_g),
    0
  );
}

function totalQty() {
  return state.products.reduce((s, p) => s + Number(p.qty_g), 0);
}

function totalSales() {
  return activeMovements()
    .filter(m => m.type === 'sale')
    .reduce((s, m) => s + Number(m.total_amount || 0), 0);
}

function totalCash() {
  const initialCash = activeMovements()
    .reduce((s, m) => s + Number(m.cash_received || 0), 0);

  const extraCash = state.credits
    .reduce((s, c) => s + Number(c.extra_paid || 0), 0);

  return initialCash + extraCash;
}

function ensureHistoryBox() {
  if ($('movementList')) return;

  const box = document.createElement('div');
  box.className = 'panel';
  box.style.marginTop = '18px';

  box.innerHTML = `
    <h3>Storico movimenti</h3>
    <div id="movementList" class="stack"></div>
  `;

  $('moves').appendChild(box);
}

function fillProducts() {
  const opts = state.products
    .map(p => `<option value="${p.id}">${p.name}</option>`)
    .join('');

  $('buyProduct').innerHTML = opts;
  $('sellProduct').innerHTML = opts;
}

function render() {

  ensureHistoryBox();

  $('totalQty').textContent = fmtQty(totalQty());
  $('totalValue').textContent = fmtEuro(totalStockValue());
  $('totalCredits').textContent = fmtEuro(totalCredits());
  $('totalCash').textContent = fmtEuro(totalCash());

  $('homeStock').innerHTML = state.products.length
    ? state.products.map(p => `
      <div class="stock-row">

        <div>
          <strong>${p.name}</strong>
          <div class="muted">Disponibile</div>
        </div>

        <div>
          <span class="muted">Quantità</span><br>
          <strong>${fmtQty(p.qty_g)}</strong>
        </div>

        <div>
          <span class="muted">Valore</span><br>
          <strong>
            ${fmtEuro(Number(p.qty_g) * Number(p.avg_cost_per_g))}
          </strong>
        </div>

        <div>
          <span class="badge">
            ${fmtEuro(p.avg_cost_per_g)}/g
          </span>
        </div>

      </div>
    `).join('')
    : 'Nessun prodotto.';

  $('stockList').innerHTML = state.products.length
    ? state.products.map(p => `
      <div class="stock-row">

        <div>
          <strong>${p.name}</strong>
          <div class="muted">${fmtQty(p.qty_g)}</div>
        </div>

        <div>
          <span class="muted">Costo medio</span><br>
          <strong>${fmtEuro(p.avg_cost_per_g)}/g</strong>
        </div>

        <div>
          <span class="muted">Valore</span><br>
          <strong>
            ${fmtEuro(Number(p.qty_g) * Number(p.avg_cost_per_g))}
          </strong>
        </div>

        <div style="display:flex;gap:6px;flex-wrap:wrap">

          <button
            class="edit-product"
            data-id="${p.id}">
            ✏️ Modifica
          </button>

          <button
            class="delete-product"
            data-id="${p.id}"
            style="background:#5a1d1d;color:white">
            🗑️ Cancella
          </button>

        </div>

      </div>
    `).join('')
    : 'Nessun prodotto.';

  $('creditList').innerHTML = state.credits.length
    ? state.credits.map(c => {

        const rem = Math.max(
          0,
          Number(c.total) - Number(c.paid)
        );

        return `
          <div class="credit-row">

            <div>
              <strong>${c.client}</strong>
              <div class="muted">
                ${c.product || ''} · ${fmtQty(c.qty_g)}
              </div>
            </div>

            <div>
              <span class="muted">Totale</span><br>
              <strong>${fmtEuro(c.total)}</strong>
            </div>

            <div>
              <span class="muted">Da ricevere</span><br>
              <strong>${fmtEuro(rem)}</strong>
            </div>

            <div style="display:flex;gap:6px;flex-wrap:wrap">

              <button
                class="pay-credit"
                data-id="${c.id}"
                ${rem <= 0 ? 'disabled' : ''}>
                💶 Pagamento
              </button>

              <button
                class="delete-credit"
                data-id="${c.id}"
                style="background:#5a1d1d;color:white">
                🗑️ Cancella
              </button>

            </div>

          </div>
        `;
      }).join('')
    : '<div class="panel">Nessun credito aperto.</div>';

  $('movementList').innerHTML = state.movements.length
    ? state.movements.map(m => {

        const p = state.products.find(
          x => x.id === m.product_id
        );

        return `
          <div class="stock-row">

            <div>

              <strong>
                ${m.type === 'sale' ? 'Vendita' : 'Acquisto'}
                ${m.reversed ? ' — ANNULLATO' : ''}
              </strong>

              <div class="muted">
                ${p?.name || 'Prodotto'} ·
                ${fmtQty(m.qty_g)}
                ${m.client ? ` · ${m.client}` : ''}
              </div>

            </div>

            <div>
              <span class="muted">Totale</span><br>
              <strong>${fmtEuro(m.total_amount)}</strong>
            </div>

            <div>
              <span class="muted">Data</span><br>
              <strong>
                ${new Date(m.created_at).toLocaleString('it-IT')}
              </strong>
            </div>

            <div>

              ${
                m.reversed
                ? ''
                : `
                  <button
                    class="reverse-movement"
                    data-id="${m.id}"
                    style="background:#5a1d1d;color:white">
                    ↩️ Annulla
                  </button>
                `
              }

            </div>

          </div>
        `;
      }).join('')
    : 'Nessun movimento.';

  $('reportSales').textContent = fmtEuro(totalSales());
  $('reportCash').textContent = fmtEuro(totalCash());
  $('reportCredits').textContent = fmtEuro(totalCredits());
  $('reportStock').textContent = fmtEuro(totalStockValue());

  fillProducts();
  bindRowActions();
}

function bindRowActions() {

  document.querySelectorAll('.edit-product')
    .forEach(btn => {
      btn.addEventListener(
        'click',
        () => editProduct(btn.dataset.id)
      );
    });

  document.querySelectorAll('.delete-product')
    .forEach(btn => {
      btn.addEventListener(
        'click',
        () => deleteProduct(btn.dataset.id)
      );
    });

  document.querySelectorAll('.pay-credit')
    .forEach(btn => {
      btn.addEventListener(
        'click',
        () => payCredit(btn.dataset.id)
      );
    });

  document.querySelectorAll('.delete-credit')
    .forEach(btn => {
      btn.addEventListener(
        'click',
        () => deleteCredit(btn.dataset.id)
      );
    });

  document.querySelectorAll('.reverse-movement')
    .forEach(btn => {
      btn.addEventListener(
        'click',
        () => reverseMovement(btn.dataset.id)
      );
    });
}

async function loadFromDb() {

  const [pRes, mRes, cRes] = await Promise.all([

    supabase
      .from('products')
      .select('*')
      .order('name'),

    supabase
      .from('movements')
      .select('*')
      .order('created_at', { ascending: false }),

    supabase
      .from('credits')
      .select('*')
      .order('created_at', { ascending: false })

  ]);

  if (pRes.error || mRes.error || cRes.error) {
    console.error(pRes.error, mRes.error, cRes.error);
    throw new Error('Errore caricamento database');
  }

  state.products = pRes.data || [];
  state.movements = mRes.data || [];
  state.credits = cRes.data || [];
}

async function login() {

  const email = $('email').value.trim();
  const password = $('password').value;

  $('loginMsg').textContent = '';

  const { error } =
    await supabase.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    $('loginMsg').textContent =
      'Accesso non riuscito.';
    return;
  }

  await loadFromDb();
  showApp();
}

async function logout() {
  await supabase.auth.signOut();
  location.reload();
}

function showApp() {

  $('loginView').classList.add('hidden');
  $('appView').classList.remove('hidden');

  render();
}

$('loginBtn').addEventListener(
  'click',
  login
);

$('password').addEventListener(
  'keydown',
  e => {
    if (e.key === 'Enter') login();
  }
);

$('logoutBtn').addEventListener(
  'click',
  logout
);

document.querySelectorAll('.nav-btn')
  .forEach(btn => {

    btn.addEventListener('click', () => {

      document
        .querySelectorAll('.nav-btn')
        .forEach(x =>
          x.classList.remove('active')
        );

      btn.classList.add('active');

      document
        .querySelectorAll('.page')
        .forEach(x =>
          x.classList.add('hidden')
        );

      $(btn.dataset.page)
        .classList.remove('hidden');

    });

  });

$('addProductBtn').addEventListener(
  'click',
  async () => {

    const name =
      prompt('Nome prodotto:');

    if (!name) return;

    const qty =
      Number(
        prompt(
          'Quantità iniziale in grammi:',
          '0'
        )
      );

    if (
      Number.isNaN(qty) ||
      qty < 0
    ) return;

    const cost =
      Number(
        prompt(
          'Costo medio in € per grammo:',
          '0'
        )
      );

    if (
      Number.isNaN(cost) ||
      cost < 0
    ) return;

    const { error } =
      await supabase
        .from('products')
        .insert({
          name: name.trim(),
          qty_g: qty,
          avg_cost_per_g: cost
        });

    if (error) {
      alert('Errore creazione prodotto');
      return;
    }

    await loadFromDb();
    render();
  }
);

async function editProduct(id) {

  const p =
    state.products.find(
      x => x.id === id
    );

  if (!p) return;

  const name =
    prompt(
      'Nome prodotto:',
      p.name
    );

  if (!name) return;

  const qty =
    Number(
      prompt(
        'Quantità in grammi:',
        p.qty_g
      )
    );

  if (
    Number.isNaN(qty) ||
    qty < 0
  ) return;

  const cost =
    Number(
      prompt(
        'Costo medio € per grammo:',
        p.avg_cost_per_g
      )
    );

  if (
    Number.isNaN(cost) ||
    cost < 0
  ) return;

  const { error } =
    await supabase
      .from('products')
      .update({
        name: name.trim(),
        qty_g: qty,
        avg_cost_per_g: cost
      })
      .eq('id', id);

  if (error) {
    alert('Errore modifica prodotto');
    return;
  }

  await loadFromDb();
  render();
}

async function deleteProduct(id) {

  const p =
    state.products.find(
      x => x.id === id
    );

  if (!p) return;

  const hasActive =
    activeMovements()
      .some(
        m => m.product_id === id
      );

  if (hasActive) {

    alert(
      'Prima annulla i movimenti collegati a questo prodotto.'
    );

    return;
  }

  if (
    !confirm(
      `Cancellare definitivamente ${p.name}?`
    )
  ) return;

  const { error } =
    await supabase
      .from('products')
      .delete()
      .eq('id', id);

  if (error) {

    alert(
      'Non posso cancellare il prodotto.'
    );

    return;
  }

  await loadFromDb();
  render();
}

$('buyBtn').addEventListener(
  'click',
  async () => {

    const p =
      state.products.find(
        x =>
          x.id ===
          $('buyProduct').value
      );

    const grams =
      toGrams(
        $('buyQty').value,
        $('buyUnit').value
      );

    const cost =
      Number(
        $('buyCost').value || 0
      );

    if (
      !p ||
      grams <= 0 ||
      cost < 0
    ) return;

    const oldQty =
      Number(p.qty_g);

    const oldAvg =
      Number(p.avg_cost_per_g);

    const newQty =
      oldQty + grams;

    const newAvg =
      (oldQty * oldAvg + cost) /
      newQty;

    const { error: productError } =
      await supabase
        .from('products')
        .update({
          qty_g: newQty,
          avg_cost_per_g: newAvg
        })
        .eq('id', p.id);

    if (productError) {

      alert(
        'Errore aggiornamento magazzino'
      );

      return;
    }

    const { error: moveError } =
      await supabase
        .from('movements')
        .insert({
          type: 'purchase',
          product_id: p.id,
          qty_g: grams,
          total_amount: cost,
          cash_received: 0,
          previous_avg_cost: oldAvg
        });

    if (moveError) {

      alert(
        'Errore salvataggio movimento'
      );

      return;
    }

    await loadFromDb();
    render();

    $('moveMsg').textContent =
      'Acquisto registrato.';
  }
);

$('paymentStatus').addEventListener(
  'change',
  () => {

    if (
      $('paymentStatus').value ===
      'paid'
    ) {
      $('sellPaid').value =
        $('sellTotal').value || 0;
    }

    if (
      $('paymentStatus').value ===
      'credit'
    ) {
      $('sellPaid').value = 0;
    }

  }
);

$('sellBtn').addEventListener(
  'click',
  async () => {

    const p =
      state.products.find(
        x =>
          x.id ===
          $('sellProduct').value
      );

    const grams =
      toGrams(
        $('sellQty').value,
        $('sellUnit').value
      );

    const total =
      Number(
        $('sellTotal').value || 0
      );

    let paid =
      Number(
        $('sellPaid').value || 0
      );

    const client =
      $('sellClient').value.trim()
      || 'Cliente';

    if (
      !p ||
      grams <= 0 ||
      grams > Number(p.qty_g) ||
      total < 0
    ) {

      $('moveMsg').textContent =
        'Controlla quantità e importi.';

      return;
    }

    paid =
      Math.max(
        0,
        Math.min(paid, total)
      );

    const { error: productError } =
      await supabase
        .from('products')
        .update({
          qty_g:
            Number(p.qty_g) -
            grams
        })
        .eq('id', p.id);

    if (productError) {

      alert(
        'Errore aggiornamento magazzino'
      );

      return;
    }

    let creditId = null;

    if (total - paid > 0) {

      const { data, error } =
        await supabase
          .from('credits')
          .insert({
            client,
            product: p.name,
            qty_g: grams,
            total,
            paid,
            extra_paid: 0
          })
          .select()
          .single();

      if (error) {

        alert(
          'Errore creazione credito'
        );

        return;
      }

      creditId = data.id;
    }

    const { error: moveError } =
      await supabase
        .from('movements')
        .insert({
          type: 'sale',
          product_id: p.id,
          client,
          qty_g: grams,
          total_amount: total,
          cash_received: paid,
          credit_id: creditId
        });

    if (moveError) {

      alert(
        'Errore salvataggio vendita'
      );

      return;
    }

    await loadFromDb();
    render();

    $('moveMsg').textContent =
      'Vendita registrata.';
  }
);

async function payCredit(id) {

  const c =
    state.credits.find(
      x => x.id === id
    );

  if (!c) return;

  const remaining =
    Math.max(
      0,
      Number(c.total) -
      Number(c.paid)
    );

  const val =
    Number(
      prompt(
        `Quanto ha pagato ${c.client}? Restano ${fmtEuro(remaining)}`,
        ''
      )
    );

  if (
    !val ||
    val <= 0
  ) return;

  const accepted =
    Math.min(
      val,
      remaining
    );

  const { error } =
    await supabase
      .from('credits')
      .update({
        paid:
          Number(c.paid) +
          accepted,

        extra_paid:
          Number(c.extra_paid || 0) +
          accepted
      })
      .eq('id', id);

  if (error) {

    alert(
      'Errore pagamento'
    );

    return;
  }

  await loadFromDb();
  render();
}

async function deleteCredit(id) {

  const c =
    state.credits.find(
      x => x.id === id
    );

  if (!c) return;

  const linked =
    activeMovements()
      .find(
        m =>
          m.credit_id === id
      );

  if (linked) {

    alert(
      'Questo credito è collegato a una vendita. Annulla prima la vendita dallo Storico movimenti.'
    );

    return;
  }

  if (
    !confirm(
      `Cancellare il credito di ${c.client}?`
    )
  ) return;

  const { error } =
    await supabase
      .from('credits')
      .delete()
      .eq('id', id);

  if (error) {

    alert(
      'Errore cancellazione credito'
    );

    return;
  }

  await loadFromDb();
  render();
}

async function reverseMovement(id) {

  const m =
    state.movements.find(
      x => x.id === id
    );

  if (
    !m ||
    m.reversed
  ) return;

  if (
    !confirm(
      'Annullare questo movimento? Magazzino, crediti e resoconti verranno corretti automaticamente.'
    )
  ) return;

  const p =
    state.products.find(
      x =>
        x.id ===
        m.product_id
    );

  if (!p) {

    alert(
      'Prodotto collegato non trovato.'
    );

    return;
  }

  if (m.type === 'sale') {

    const { error: stockError } =
      await supabase
        .from('products')
        .update({
          qty_g:
            Number(p.qty_g) +
            Number(m.qty_g)
        })
        .eq('id', p.id);

    if (stockError) {

      alert(
        'Errore ripristino magazzino'
      );

      return;
    }

    if (m.credit_id) {

      const { error: creditError } =
        await supabase
          .from('credits')
          .delete()
          .eq(
            'id',
            m.credit_id
          );

      if (creditError) {

        alert(
          'Errore rimozione credito'
        );

        return;
      }
    }

  } else {

    const newQty =
      Number(p.qty_g) -
      Number(m.qty_g);

    if (newQty < 0) {

      alert(
        'Non posso annullare: parte della merce acquistata è già stata venduta.'
      );

      return;
    }

    const { error: stockError } =
      await supabase
        .from('products')
        .update({
          qty_g: newQty,

          avg_cost_per_g:
            Number(
              m.previous_avg_cost ||
              p.avg_cost_per_g
            )
        })
        .eq('id', p.id);

    if (stockError) {

      alert(
        'Errore correzione magazzino'
      );

      return;
    }
  }

  const { error: moveError } =
    await supabase
      .from('movements')
      .update({
        reversed: true,
        reversed_at:
          new Date().toISOString()
      })
      .eq('id', id);

  if (moveError) {

    alert(
      'Errore annullamento movimento'
    );

    return;
  }

  await loadFromDb();
  render();
}

const {
  data: { session }
} =
await supabase.auth.getSession();

if (session) {
  await loadFromDb();
  showApp();
}