const request = require('supertest');
const app = require('./setup');

const agent = request.agent(app);

beforeAll(async () => {
  await agent
    .post('/api/login')
    .send({ email: 'admin', senha: 'admin12345' });
});

describe('Login', () => {
  test('should login admin user', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ email: 'admin', senha: 'admin12345' });
    expect(res.status).toBe(200);
  });
});

describe('Produtos CRUD', () => {
  let produtoId;

  test('create produto', async () => {
    const res = await agent
      .post('/api/produtos')
      .send({
        nome: 'Teste',
        codigo_barras: '123',
        departamento: 'Bebidas',
        quantidade: 5,
        validade: '2030-01-01',
        preco: "10,5"
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    produtoId = res.body.id;
  });

  test('get produtos', async () => {
    const res = await agent.get('/api/produtos');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('update produto', async () => {
    const res = await agent
      .put(`/api/produtos/${produtoId}`)
      .send({
        nome: 'Teste2',
        departamento: 'Mercearia',
        quantidade: 8,
        validade: '2030-06-01',
        preco: "12"
      });
    expect(res.status).toBe(200);
  });

  test('movimentacoes registradas', async () => {
    const res = await agent.get(`/api/produtos/${produtoId}/movimentacoes`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  test('delete produto', async () => {
    const res = await agent.delete(`/api/produtos/${produtoId}`);
    expect(res.status).toBe(200);
  });
});

describe('Quebras e Saidas', () => {
  let produtoId;

  beforeAll(async () => {
    const res = await agent
      .post('/api/produtos')
      .send({
        nome: 'ProdutoQS',
        codigo_barras: '999',
        departamento: 'Teste',
        quantidade: 10,
        validade: '2030-12-31',
        preco: "5"
      });
    produtoId = res.body.id;
  });

  test('registrar quebra', async () => {
    const res = await agent
      .post('/api/quebras')
      .send({ produto_id: produtoId, quantidade: 1, valor_quebra: "2" });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');

    const prodRes = await agent.get('/api/produtos');
    const produto = prodRes.body.find((p) => p.id === produtoId);
    expect(produto.quantidade).toBe(9);
  });

  test('registrar saida', async () => {
    const res = await agent
      .post('/api/saidas')
      .send({ produto_id: produtoId, quantidade: 1, valor_saida: "3" });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');

    const prodRes = await agent.get('/api/produtos');
    const produto = prodRes.body.find((p) => p.id === produtoId);
    expect(produto.quantidade).toBe(8);
  });

  test('quantidade final apos operacoes', async () => {
    const res = await agent.get('/api/produtos');
    const produto = res.body.find((p) => p.id === produtoId);
    expect(produto.quantidade).toBe(8);
  });

  test('historico de movimentacoes', async () => {
    const res = await agent.get(`/api/produtos/${produtoId}/movimentacoes`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(3);
  });
});

describe('Notificações de validade', () => {
  let produtoId;
  const validadeProxima = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  beforeAll(async () => {
    const res = await agent.post('/api/produtos').send({
      nome: 'ValidadeProxima',
      codigo_barras: '555',
      departamento: 'Teste',
      quantidade: 2,
      validade: validadeProxima,
      preco: "1",
    });
    produtoId = res.body.id;
  });

  afterAll(async () => {
    await agent.delete(`/api/produtos/${produtoId}`);
  });

  test('listar produtos próximos do vencimento', async () => {
    const res = await agent.get('/api/notificacoes/validade');
    expect(res.status).toBe(200);
    const prod = res.body.find((p) => p.codigo_barras === '555');
    expect(prod).toBeDefined();
    const dias =
      (new Date(prod.validade) - new Date()) / (1000 * 60 * 60 * 24);
    expect(dias).toBeLessThanOrEqual(20);
  });
});

describe('Resumo por departamento', () => {
  test('deve calcular valores agregados', async () => {
    const res = await agent.get('/api/departamentos/resumo');
    expect(res.status).toBe(200);
    const dep = res.body.find((d) => d.departamento === 'Teste');
    expect(dep).toBeDefined();
    expect(dep.valor_estoque).toBe(40);
    expect(dep.valor_quebras).toBe(5);
    expect(dep.valor_saidas).toBe(5);
  });
});

describe('Fornecedores CRUD', () => {
  let fornecedorId;

  test('criar fornecedor', async () => {
    const res = await agent.post('/api/fornecedores').send({
      nome: 'Fornecedor Teste',
      cnpj: '00',
      telefone: '1111',
      email: 'f@teste',
      endereco: 'Rua 1',
      data_inicio: '2023-01-01'
    });
    expect(res.status).toBe(201);
    fornecedorId = res.body.id;
    expect(fornecedorId).toBeDefined();
  });

  test('listar fornecedores', async () => {
    const res = await agent.get('/api/fornecedores');
    expect(res.status).toBe(200);
    const forn = res.body.find((f) => f.id === fornecedorId);
    expect(forn).toBeDefined();
  });

  test('atualizar fornecedor', async () => {
    const res = await agent.put(`/api/fornecedores/${fornecedorId}`).send({
      nome: 'Fornecedor Editado',
      cnpj: '11',
      telefone: '2222',
      email: 'f@edit',
      endereco: 'Rua 2',
      data_inicio: '2023-02-01'
    });
    expect(res.status).toBe(200);
  });

  test('excluir fornecedor', async () => {
    const res = await agent.delete(`/api/fornecedores/${fornecedorId}`);
    expect(res.status).toBe(200);
  });
});

describe('Alertas de Ruptura', () => {
  let produtoId;

  beforeAll(async () => {
    const res = await agent.post('/api/produtos').send({
      nome: 'Ruptura',
      codigo_barras: '777',
      departamento: 'Teste',
      quantidade: 3,
      estoque_minimo: 2,
      validade: '2030-01-01',
      preco: "1"
    });
    produtoId = res.body.id;
  });

  afterAll(async () => {
    await agent.delete(`/api/produtos/${produtoId}`);
  });

  test('gera alerta quando abaixo do minimo', async () => {
    await agent.post('/api/saidas').send({ produto_id: produtoId, quantidade: 2, valor_saida: 1 });
    const res = await agent.get('/api/notificacoes/rupturas');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  test('resolver alerta e remover da listagem', async () => {
    const list = await agent.get('/api/notificacoes/rupturas');
    const alertaId = list.body[0].alerta_id;
    const r = await agent.post(`/api/notificacoes/rupturas/${alertaId}/resolver`);
    expect(r.status).toBe(200);
    const res2 = await agent.get('/api/notificacoes/rupturas');
    expect(res2.body.length).toBe(0);
  });

  test('alerta some ao aumentar quantidade', async () => {
    await agent.put(`/api/produtos/${produtoId}`).send({
      nome: 'Ruptura',
      departamento: 'Teste',
      quantidade: 5,
      preco: "1",
      validade: '2030-01-01',
      fornecedor_id: null,
      estoque_minimo: 2
    });
    const res = await agent.get('/api/notificacoes/rupturas');
    expect(res.body.length).toBe(0);
  });
});
