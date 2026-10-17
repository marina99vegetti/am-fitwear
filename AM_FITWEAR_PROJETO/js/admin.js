
(() => {
  const url = window.AM_SUPABASE_URL;
  const key = window.AM_SUPABASE_ANON_KEY;
  const configured =
    url && key &&
    !url.includes('COLE_A_') &&
    !key.includes('COLE_A_');

  const $ = id => document.getElementById(id);
  const loginCard = $('loginCard');
  const adminPanel = $('adminPanel');
  const loginMessage = $('loginMessage');
  const formMessage = $('formMessage');

  let client = null;
  let currentUser = null;

  const money = n =>
    Number(n || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });

  function msg(el, text, type = '') {
    if (!el) return;
    el.textContent = text;
    el.className = 'message ' + type;
  }

  function esc(v = '') {
    return String(v).replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

  function setReadOnlyMode(readOnly) {
    const form = $('productForm');
    if (form) form.classList.toggle('hidden', readOnly);

    ['cancelEdit', 'logoutBtn'].forEach(id => {
      const el = $(id);
      if (el) el.classList.toggle('hidden', !currentUser);
    });
  }

  function setLoggedIn(user) {
    currentUser = user || null;

    // O painel fica disponível mesmo sem login.
    if (loginCard) loginCard.classList.toggle('hidden', true);
    if (adminPanel) adminPanel.classList.remove('hidden');

    // Visitantes só consultam; usuários autenticados
    // continuam sujeitos às permissões do Supabase.
    setReadOnlyMode(!currentUser);
    loadProducts();
  }

  if (!configured || !window.supabase) {
    msg(
      loginMessage,
      'Configure a URL e a chave pública em js/supabase-config.js.',
      'error'
    );
    loadStaticError();
    return;
  }

  client = window.supabase.createClient(url, key);

  client.auth.getSession().then(({ data }) => {
    setLoggedIn(data.session?.user || null);
  });

  client.auth.onAuthStateChange((_event, session) => {
    setLoggedIn(session?.user || null);
  });

  const loginForm = $('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      msg(loginMessage, 'Verificando acesso...');

      const { data, error } = await client.auth.signInWithPassword({
        email: $('email').value.trim(),
        password: $('password').value
      });

      if (error) {
        msg(
          loginMessage,
          'Não foi possível entrar. Confira o e-mail e a senha.',
          'error'
        );
        return;
      }

      setLoggedIn(data.user);
      msg(loginMessage, 'Acesso realizado.', 'success');
    });
  }

  const logoutBtn = $('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await client.auth.signOut();
      setLoggedIn(null);
    });
  }

  async function loadProducts() {
    const body = $('productsTable');
    if (!body || !client) return;

    body.innerHTML =
      '<tr><td colspan="6">Carregando produtos...</td></tr>';

    const { data, error } = await client
      .from('produtos')
      .select('*')
      .order('criado_em', { ascending: false });

    if (error) {
      body.innerHTML =
        '<tr><td colspan="6">Não foi possível carregar os produtos. Verifique as políticas de leitura do Supabase.</td></tr>';
      console.error(error);
      return;
    }

    if (!data || !data.length) {
      body.innerHTML =
        '<tr><td colspan="6">Nenhum produto cadastrado ainda.</td></tr>';
      return;
    }

    body.innerHTML = data.map(p => {
      const actions = currentUser
        ? `<div class="actions">
             <button data-edit="${esc(p.id)}">Editar</button>
             <button class="delete" data-delete="${esc(p.id)}">Excluir</button>
           </div>`
        : '<span>Somente consulta</span>';

      return `<tr>
        <td>${p.imagem_url
          ? `<img src="${esc(p.imagem_url)}" alt="">`
          : '—'}</td>
        <td><strong>${esc(p.nome)}</strong><br>
          <small>${esc(p.descricao || '')}</small></td>
        <td>${esc(p.categoria || '—')}</td>
        <td>${money(p.preco)}</td>
        <td><span class="status ${p.disponivel ? '' : 'off'}">${
          p.disponivel ? 'Disponível' : 'Oculto'
        }</span></td>
        <td>${actions}</td>
      </tr>`;
    }).join('');

    if (currentUser) {
      body.querySelectorAll('[data-edit]').forEach(button => {
        button.addEventListener('click', () => {
          const product = data.find(
            p => String(p.id) === button.dataset.edit
          );
          if (product) editProduct(product);
        });
      });

      body.querySelectorAll('[data-delete]').forEach(button => {
        button.addEventListener('click', () => {
          deleteProduct(button.dataset.delete);
        });
      });
    }
  }

  function loadStaticError() {
    const body = $('productsTable');
    if (body) {
      body.innerHTML =
        '<tr><td colspan="6">Configure o Supabase para consultar os produtos.</td></tr>';
    }
  }

  function editProduct(p) {
    if (!currentUser) return;

    $('productId').value = p.id;
    $('name').value = p.nome || '';
    $('price').value = p.preco ?? '';
    $('category').value = p.categoria || 'Conjuntos';
    $('sizes').value = Array.isArray(p.tamanhos)
      ? p.tamanhos.join(', ')
      : '';
    $('description').value = p.descricao || '';
    $('available').checked = !!p.disponivel;
    $('photo').value = '';
    $('saveBtn').textContent = 'Salvar alterações';
    $('cancelEdit').classList.remove('hidden');
    formMessage.textContent = 'Editando: ' + p.nome;

    window.scrollTo({
      top: $('productForm').getBoundingClientRect().top +
        window.scrollY - 20,
      behavior: 'smooth'
    });
  }

  function resetForm() {
    if (!$('productForm')) return;
    $('productForm').reset();
    $('productId').value = '';
    $('available').checked = true;
    $('saveBtn').textContent = 'Cadastrar produto';
    $('cancelEdit').classList.add('hidden');
    msg(formMessage, '');
  }

  const cancelEdit = $('cancelEdit');
  if (cancelEdit) {
    cancelEdit.addEventListener('click', resetForm);
  }

  async function uploadPhoto(file) {
    if (!currentUser) throw new Error('Acesso somente para consulta.');
    if (!file) return null;

    if (!file.type.startsWith('image/')) {
      throw new Error('Escolha um arquivo de imagem.');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error('A imagem deve ter no máximo 5 MB.');
    }

    const safeName = file.name.toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-');
    const path = `${currentUser.id}/${Date.now()}-${safeName}`;

    const { error } = await client.storage
      .from('produtos')
      .upload(path, file, {
        upsert: false,
        contentType: file.type
      });

    if (error) throw error;

    return client.storage.from('produtos')
      .getPublicUrl(path).data.publicUrl;
  }

  const productForm = $('productForm');
  if (productForm) {
    productForm.addEventListener('submit', async e => {
      e.preventDefault();

      if (!currentUser) {
        msg(formMessage, 'Modo somente consulta.', 'error');
        return;
      }

      const id = $('productId').value;
      const payload = {
        nome: $('name').value.trim(),
        descricao: $('description').value.trim(),
        preco: Number($('price').value),
        categoria: $('category').value,
        tamanhos: $('sizes').value.split(',')
          .map(s => s.trim()).filter(Boolean),
        disponivel: $('available').checked,
        atualizado_em: new Date().toISOString()
      };

      if (!payload.nome ||
          !Number.isFinite(payload.preco) ||
          payload.preco < 0) {
        msg(formMessage, 'Informe um nome e um preço válido.', 'error');
        return;
      }

      const file = $('photo').files[0];
      $('saveBtn').disabled = true;
      msg(formMessage, 'Salvando produto...');

      try {
        if (file) payload.imagem_url = await uploadPhoto(file);

        let result;
        if (id) {
          result = await client.from('produtos')
            .update(payload).eq('id', id);
        } else {
          if (!payload.imagem_url) payload.imagem_url = '';
          result = await client.from('produtos').insert(payload);
        }

        if (result.error) throw result.error;

        msg(
          formMessage,
          id ? 'Produto atualizado com sucesso!' : 'Produto cadastrado com sucesso!',
          'success'
        );

        resetForm();
        await loadProducts();
      } catch (err) {
        console.error(err);
        msg(
          formMessage,
          'Não foi possível salvar: ' + (err.message || 'verifique as permissões do Supabase.'),
          'error'
        );
      } finally {
        $('saveBtn').disabled = false;
      }
    });
  }

  async function deleteProduct(id) {
    if (!currentUser) return;
    if (!confirm('Deseja excluir este produto do catálogo?')) return;

    const { error } = await client
      .from('produtos').delete().eq('id', id);

    if (error) {
      alert('Não foi possível excluir o produto. Verifique as permissões.');
      console.error(error);
      return;
    }

    await loadProducts();
  }
})();
