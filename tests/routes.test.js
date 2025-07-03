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
        preco: 10.5
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
        preco: 12.0
      });
    expect(res.status).toBe(200);
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
        preco: 5.0
      });
    produtoId = res.body.id;
  });

  test('registrar quebra', async () => {
    const res = await agent
      .post('/api/quebras')
      .send({ produto_id: produtoId, quantidade: 1, valor_quebra: 2.0 });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  test('registrar saida', async () => {
    const res = await agent
      .post('/api/saidas')
      .send({ produto_id: produtoId, quantidade: 1, valor_saida: 3.0 });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
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
      preco: 1.0,
    });
    produtoId = res.body.id;
  });

  afterAll(async () => {
    await agent.delete(`/api/produtos/${produtoId}`);
  });

  test('listar produtos próximos do vencimento', async () => {
    const res = await agent.get('/api/notificacoes/validade');
    expect(res.status).toBe(200);
    expect(res.body.some((p) => p.codigo_barras === '555')).toBe(true);
  });
});

describe('Resumo por departamento', () => {
  test('deve calcular valores agregados', async () => {
    const res = await agent.get('/api/departamentos/resumo');
    expect(res.status).toBe(200);
    const dep = res.body.find((d) => d.departamento === 'Teste');
    expect(dep).toBeDefined();
    expect(dep.valor_estoque).toBe(50);
    expect(dep.valor_quebras).toBe(5);
    expect(dep.valor_saidas).toBe(5);
  });
});
