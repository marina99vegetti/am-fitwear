
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
  let isAdmin = false;
  let authVersion = 0;

  const money = value =>
    Number(value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });

  function msg(element, text, type = '') {
    if (!element) return;
    element.textContent = text;
    element.className = 'message ' + type;
  }

  function esc(value = '') {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
  }

  function configureView() {
    adminPanel.classList.remove('hidden');
    adminPanel.classList.toggle('public-view', !isAdmin);

    // Visitantes podem ver o formulário, mas não utilizá-lo.
    const form = $('productForm');

    if (form) {
      form.classList.remove('hidden');

      form.querySelectorAll('input, select, textarea, button')
        .forEach(field => {
          field.disabled = !isAdmin;
        });
    }

    // Login disponível para quem ainda não entrou.
    loginCard.classList.toggle('hidden', isAdmin);
    $('logoutBtn').classList.toggle('hidden', !isAdmin);

    const description = adminPanel.querySelector('.panel-head p');

    if (description) {
      description.textContent = isAdmin
        ? 'Cadastre, altere preços, atualize fotos e gerencie os produtos.'
        : 'Consulte os produtos, fotos, preços e disponibilidade.';
    }

    const actionsHeader = adminPanel.querySelector('thead th:last-child');

    if (actionsHeader) {
      actionsHeader.classList.remove('hidden');
    }
  }

  async function checkAdmin(user) {
    if (!user) return false;

    const { data, error } = await client
      .from('admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao verificar administrador:', error);
      return false;
    }

    return !!data;
  }

  async function setLoggedIn(user) {
    const version = ++authVersion;

    currentUser = user || null;
    isAdmin = false;

    if (currentUser) {
      isAdmin = await checkAdmin(currentUser);

      if (version !== authVersion) return;

      if (!isAdmin) {
        currentUser = null;

        // Uma conta sem permissão administrativa não pode editar.
        await client.auth.signOut();

        msg(
          loginMessage,
          'Esta conta não possui permissão administrativa.',
          'error'
        );
      } else {
        msg(loginMessage, '');
      }
    }

    if (version !== authVersion) return;

    configureView();
    await loadProducts();
  }

  if (!configured || !window.supabase) {
    adminPanel.classList.remove('hidden');
    loginCard.classList.remove('hidden');

    const form = $('productForm');

    if (form) {
      form.classList.remove('hidden');
      form.querySelectorAll('input, select, textarea, button')
        .forEach(field => {
          field.disabled = true;
        });
    }

    msg(
      loginMessage,
      'Configure a URL e a chave pública em js/supabase-config.js.',
      'error'
    );

    const loginButton = $('loginForm')?.querySelector('button');

    if (loginButton) loginButton.disabled = true;

    return;
  }

  client = window.supabase.createClient(url, key);

  // Garante que visitantes não vejam os botões de editar/excluir.
  const publicStyle = document.createElement('style');

  publicStyle.textContent = `
    #adminPanel.public-view .actions {
      display: none !important;
    }
  `;

  document.head.appendChild(publicStyle);

  // A tabela continua visível mesmo sem login.
  adminPanel.classList.remove('hidden');
  loginCard.classList.remove('hidden');
  configureView();

  client.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => {
      setLoggedIn(session?.user || null);
    }, 0);
  });

  client.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error('Erro ao verificar sessão:', error);
      setLoggedIn(null);
      return;
    }

    setLoggedIn(data.session?.user || null);
  });

  $('loginForm').addEventListener('submit', async event => {
    event.preventDefault();

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

    await setLoggedIn(data.user);
  });

  $('logoutBtn').addEventListener('click', async () => {
    const { error } = await client.auth.signOut();

    if (error) {
      console.error(error);
      alert('Não foi possível sair da conta.');
      return;
    }

    await setLoggedIn(null);
  });

  async function loadProducts() {
    const body = $('productsTable');

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

    if (!data || data.length === 0) {
      body.innerHTML =
        '<tr><td colspan="6">Nenhum produto cadastrado ainda.</td></tr>';
      return;
    }

    body.innerHTML = data.map(product => {
      const actions = isAdmin
        ? `<td>
            <div class="actions">
              <button type="button" data-edit="${esc(product.id)}">Editar</button>
              <button type="button" class="delete" data-delete="${esc(product.id)}">Excluir</button>
            </div>
          </td>`
        : '<td>—</td>';

      return `
        <tr>
          <td>
            ${product.imagem_url
              ? `<img src="${esc(product.imagem_url)}" alt="${esc(product.nome)}">`
              : '—'}
          </td>
          <td>
            <strong>${esc(product.nome)}</strong>
            <br>
            <small>${esc(product.descricao || '')}</small>
          </td>
          <td>${esc(product.categoria || '—')}</td>
          <td>${money(product.preco)}</td>
          <td>
            <span class="status ${product.disponivel ? '' : 'off'}">
              ${product.disponivel ? 'Disponível' : 'Oculto'}
            </span>
          </td>
          ${actions}
        </tr>
      `;
    }).join('');

    if (!isAdmin) return;

    body.querySelectorAll('[data-edit]').forEach(button => {
      button.addEventListener('click', () => {
        if (!isAdmin) return;

        const product = data.find(
          item => String(item.id) === button.dataset.edit
        );

        if (product) editProduct(product);
      });
    });

    body.querySelectorAll('[data-delete]').forEach(button => {
      button.addEventListener('click', () => {
        if (isAdmin) deleteProduct(button.dataset.delete);
      });
    });
  }

  function editProduct(product) {
    if (!isAdmin || !product) return;

    $('productId').value = product.id;
    $('name').value = product.nome || '';
    $('price').value = product.preco ?? '';
    $('category').value = product.categoria || 'Conjuntos';

    $('sizes').value = Array.isArray(product.tamanhos)
      ? product.tamanhos.join(', ')
      : '';

    $('description').value = product.descricao || '';
    $('available').checked = !!product.disponivel;
    $('photo').value = '';

    $('saveBtn').textContent = 'Salvar alterações';
    $('cancelEdit').classList.remove('hidden');

    msg(formMessage, 'Editando: ' + product.nome);

    window.scrollTo({
      top: $('productForm').getBoundingClientRect().top +
        window.scrollY - 20,
      behavior: 'smooth'
    });
  }

  function resetForm() {
    if (!isAdmin) return;

    $('productForm').reset();
    $('productId').value = '';
    $('available').checked = true;
    $('saveBtn').textContent = 'Cadastrar produto';
    $('cancelEdit').classList.add('hidden');

    msg(formMessage, '');
  }

  $('cancelEdit').addEventListener('click', () => {
    if (isAdmin) resetForm();
  });

  async function uploadPhoto(file) {
    if (!isAdmin || !currentUser) {
      throw new Error('Somente a administradora pode enviar fotos.');
    }

    if (!file) return null;

    if (!file.type.startsWith('image/')) {
      throw new Error('Escolha um arquivo de imagem.');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error('A imagem deve ter no máximo 5 MB.');
    }

    const safeName = file.name.toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-');

    const path =
      `${currentUser.id}/${Date.now()}-${safeName}`;

    const { error } = await client.storage
      .from('produtos')
      .upload(path, file, {
        upsert: false,
        contentType: file.type
      });

    if (error) throw error;

    return client.storage
      .from('produtos')
      .getPublicUrl(path).data.publicUrl;
  }

  $('productForm').addEventListener('submit', async event => {
    event.preventDefault();

    if (!isAdmin || !currentUser) {
      msg(
        formMessage,
        'Apenas a administradora pode modificar produtos.',
        'error'
      );
      return;
    }

    const id = $('productId').value;

    const payload = {
      nome: $('name').value.trim(),
      descricao: $('description').value.trim(),
      preco: Number($('price').value),
      categoria: $('category').value,
      tamanhos: $('sizes').value
        .split(',')
        .map(size => size.trim())
        .filter(Boolean),
      disponivel: $('available').checked,
      atualizado_em: new Date().toISOString()
    };

    if (
      !payload.nome ||
      !Number.isFinite(payload.preco) ||
      payload.preco < 0
    ) {
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
        result = await client
          .from('produtos')
          .update(payload)
          .eq('id', id);
      } else {
        if (!payload.imagem_url) payload.imagem_url = '';

        result = await client
          .from('produtos')
          .insert(payload);
      }

      if (result.error) throw result.error;

      msg(
        formMessage,
        id ? 'Produto atualizado com sucesso!' : 'Produto cadastrado com sucesso!',
        'success'
      );

      resetForm();
      await loadProducts();
    } catch (error) {
      console.error(error);

      msg(
        formMessage,
        'Não foi possível salvar: ' +
          (error.message || 'verifique as permissões do Supabase.'),
        'error'
      );
    } finally {
      $('saveBtn').disabled = !isAdmin;
    }
  });

  async function deleteProduct(id) {
    if (!isAdmin || !currentUser) {
      alert('Apenas a administradora pode excluir produtos.');
      return;
    }

    if (!confirm('Deseja excluir este produto do catálogo?')) return;

    const { error } = await client
      .from('produtos')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Não foi possível excluir o produto. Verifique as permissões.');
      console.error(error);
      return;
    }

    await loadProducts();
  }
})();
