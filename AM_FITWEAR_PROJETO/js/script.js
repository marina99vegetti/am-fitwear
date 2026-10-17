
const produtosOriginais = [
  { id: 0, name: "Macaquinho Power Pink", category: "Macaquinhos", price: 89.9, color: "Rosa pink", img: "img/produtos/imagem-01.jpg" },
  { id: 1, name: "Conjunto Nude Glow", category: "Conjuntos", price: 79.9, color: "Rosé", img: "img/produtos/imagem-02.jpg" },
  { id: 2, name: "Conjunto Energy", category: "Conjuntos", price: 89.9, color: "Pink intenso", img: "img/produtos/imagem-03.jpg" },
  { id: 3, name: "Colete Move + Short", category: "Conjuntos", price: 69.9, color: "Branco e roxo", img: "img/produtos/imagem-04.jpg" },
  { id: 4, name: "Conjunto Terra", category: "Conjuntos", price: 89.9, color: "Terracota", img: "img/produtos/imagem-05.jpg" },
  { id: 5, name: "Short Fit Pro", category: "Shorts", price: 44.9, color: "Preto", img: "img/produtos/imagem-06.jpg" },
  { id: 6, name: "Conjunto Solar", category: "Conjuntos", price: 89.9, color: "Amarelo", img: "img/produtos/imagem-07.jpg" },
  { id: 7, name: "Top Soft + Short", category: "Conjuntos", price: 79.9, color: "Branco e rosa", img: "img/produtos/imagem-08.jpg" },
  { id: 8, name: "Conjunto Vinho Active", category: "Conjuntos", price: 89.9, color: "Vinho", img: "img/produtos/imagem-09.jpg" },
  { id: 9, name: "Conjunto Areia", category: "Conjuntos", price: 79.9, color: "Areia", img: "img/produtos/imagem-10.jpg" },
  { id: 10, name: "Conjunto Purple Rush", category: "Conjuntos", price: 89.9, color: "Roxo", img: "img/produtos/imagem-11.jpg" }
];

let products = [...produtosOriginais];
let filter = 'Todos';
let cart = {};

const money = n =>
  n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

function setFilter(f, btn) {
  filter = f;
  document.querySelectorAll('.filter').forEach(b =>
    b.classList.remove('active')
  );
  btn.classList.add('active');
  renderProducts();
}

function renderProducts() {
  const q = document.getElementById('search').value.toLowerCase();

  const list = products.filter(p =>
    (filter === 'Todos' || p.category === filter) &&
    (p.name + ' ' + p.color).toLowerCase().includes(q)
  );

  document.getElementById('grid').innerHTML = list.length
    ? list.map(p => `
        <article class="product">
          <div class="product-img">
            <img src="${p.img}" alt="${p.name}" loading="lazy">
            <span class="tag">AM ESSENTIAL</span>
            <button class="quick" onclick="add(${p.id})">
              Adicionar à sacola +
            </button>
          </div>
          <h3>${p.name}</h3>
          <div class="colorname">${p.color}</div>
          <div class="price">${money(p.price)}</div>
        </article>
      `).join('')
    : '<div class="noresult">Não encontramos peças com esse nome.</div>';
}

async function carregarProdutosSupabase() {
  try {
    if (
      !window.supabase ||
      !window.AM_SUPABASE_URL ||
      !window.AM_SUPABASE_ANON_KEY
    ) {
      console.warn('Supabase não configurado. Mantendo produtos originais.');
      return;
    }

    const clienteSupabase = window.supabase.createClient(
      window.AM_SUPABASE_URL,
      window.AM_SUPABASE_ANON_KEY
    );

    const { data, error } = await clienteSupabase
      .from('produtos')
      .select('*')
      .eq('disponivel', true);

    if (error) throw error;

    const nomesOriginais = new Set(
      produtosOriginais.map(p => p.name.trim().toLowerCase())
    );

    const produtosNovos = (data || [])
      .filter(p => {
        const nome = (p.nome || '').trim().toLowerCase();
        return nome && !nomesOriginais.has(nome);
      })
      .map(p => ({
        id: 1000000 + Number(p.id),
        name: p.nome,
        category: p.categoria || 'Outros',
        price: Number(p.preco) || 0,
        color: p.descricao || '',
        img: p.imagem_url || 'img/produtos/imagem-01.jpg'
      }));

    products = [...produtosOriginais, ...produtosNovos];
    renderProducts();

    console.log('Produtos carregados do Supabase:', produtosNovos.length);
  } catch (erro) {
    console.error('Erro ao carregar produtos do Supabase:', erro);
    products = [...produtosOriginais];
    renderProducts();
  }
}

function add(id) {
  cart[id] = (cart[id] || 0) + 1;
  updateCount();
  openCart();
}

function updateCount() {
  document.getElementById('count').textContent =
    Object.values(cart).reduce((a, b) => a + b, 0);
}

function openCart() {
  document.getElementById('drawerbg').style.display = 'block';
  renderCart();
}

function closeCart() {
  document.getElementById('drawerbg').style.display = 'none';
}

function changeQty(id, d) {
  cart[id] = (cart[id] || 0) + d;
  if (cart[id] <= 0) delete cart[id];
  updateCount();
  renderCart();
}

function renderCart() {
  const items = products.filter(p => cart[p.id]);
  const el = document.getElementById('cartitems');
  const bottom = document.getElementById('cartbottom');

  if (!items.length) {
    el.innerHTML =
      '<div class="empty">Sua sacola ainda está vazia.<br>Que tal encontrar um look que combine com você?</div>';

    bottom.innerHTML =
      '<button class="cta full" onclick="closeCart();document.getElementById(\'produtos\').scrollIntoView({behavior:\'smooth\'})">Ver coleção</button>';
    return;
  }

  el.innerHTML = items.map(p => `
    <div class="cartitem">
      <img src="${p.img}" alt="">
      <div>
        <h4>${p.name}</h4>
        <p>${money(p.price)}</p>
        <div class="qty">
          <button onclick="changeQty(${p.id},-1)">−</button>
          <span>${cart[p.id]}</span>
          <button onclick="changeQty(${p.id},1)">+</button>
        </div>
      </div>
      <b style="font-size:12px">${money(p.price * cart[p.id])}</b>
    </div>
  `).join('');

  const total = items.reduce(
    (a, p) => a + p.price * cart[p.id], 0
  );

  bottom.innerHTML = `
    <div class="total">
      <span>Subtotal</span>
      <span>${money(total)}</span>
    </div>
    <button class="cta full" onclick="checkout()">
      Continuar para checkout ↗
    </button>
    <p style="font-size:10px;color:#8b8189;line-height:1.5">
      Checkout de demonstração. Nenhuma cobrança será feita.
    </p>
  `;
}

function checkout() {
  closeCart();
  document.getElementById('modalbg').style.display = 'flex';

  const total = products.reduce(
    (a, p) => a + p.price * (cart[p.id] || 0), 0
  );

  document.getElementById('modal').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div class="eyebrow">Última etapa</div>
      <button class="close" onclick="closeCheckout()">×</button>
    </div>
    <h2>Finalizar pedido</h2>
    <p>Preencha os campos para experimentar o checkout da AM FITWEAR.</p>
    <div class="notice">
      <b>⚠ Apenas demonstração</b><br>
      Este checkout não envia pedidos, não guarda seus dados e não realiza pagamentos reais.
    </div>
    <form onsubmit="finish(event)">
      <div class="formrow">
        <label>Nome para o pedido</label>
        <input required placeholder="Seu nome">
      </div>
      <div class="formrow">
        <label>E-mail</label>
        <input required type="email" placeholder="voce@email.com">
      </div>
      <div class="formrow">
        <label>Forma de pagamento ilustrativa</label>
        <select>
          <option>Pix (simulação)</option>
          <option>Cartão de crédito (simulação)</option>
          <option>Boleto (simulação)</option>
        </select>
      </div>
      <div class="total">
        <span>Total demonstrativo</span>
        <span>${money(total)}</span>
      </div>
      <button class="cta full" type="submit">Simular pedido</button>
    </form>
  `;
}

function finish(e) {
  e.preventDefault();

  document.getElementById('modal').innerHTML = `
    <div class="success">
      <div style="font-size:48px;color:var(--pink)">♡</div>
      <h2>Simulação concluída!</h2>
      <p>Prontinho! Você visualizou como seria a finalização de uma compra na AM FITWEAR. Nenhum pedido foi enviado e nenhum pagamento foi realizado.</p>
      <button class="cta" onclick="cart={};updateCount();closeCheckout();renderCart()">
        Voltar à loja
      </button>
    </div>
  `;
}

function closeCheckout() {
  document.getElementById('modalbg').style.display = 'none';
}

renderProducts();
carregarProdutosSupabase();
