const request = require('supertest');
const app = require('./setup');

let token;

beforeAll(async () => {
  const res = await request(app)
    .post('/api/login')
    .send({ email: 'admin', senha: 'admin12345' });
  token = res.body.token;
});

describe('Login', () => {
  test('should login admin user', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ email: 'admin', senha: 'admin12345' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });
});

describe('Produtos CRUD', () => {
  let produtoId;
  const headers = () => ({ 'x-session-token': token });

  test('create produto', async () => {
    const res = await request(app)
      .post('/api/produtos')
      .set(headers())
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
    const res = await request(app)
      .get('/api/produtos')
      .set(headers());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('update produto', async () => {
    const res = await request(app)
      .put(`/api/produtos/${produtoId}`)
      .set(headers())
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
    const res = await request(app)
      .delete(`/api/produtos/${produtoId}`)
      .set(headers());
    expect(res.status).toBe(200);
  });
});

describe('Quebras e Saidas', () => {
  let produtoId;
  const headers = () => ({ 'x-session-token': token });

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/produtos')
      .set(headers())
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
    const res = await request(app)
      .post('/api/quebras')
      .set(headers())
      .send({ produto_id: produtoId, quantidade: 1, valor_quebra: 2.0 });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  test('registrar saida', async () => {
    const res = await request(app)
      .post('/api/saidas')
      .set(headers())
      .send({ produto_id: produtoId, quantidade: 1, valor_saida: 3.0 });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });
});
