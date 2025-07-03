# Sistema de Estoque de Supermercado

Sistema simples de controle de estoque com:
- Cadastro de produtos
- Registro de quebras
- Registro de saídas (vendas)
- Conferência de validade, quantidade e preço

## Tecnologias
- HTML, CSS, JavaScript
- Node.js com Express
- SQLite (banco de dados leve e embutido)

## Configuração

Crie um arquivo `.env` na raiz do projeto baseado em `.env.example` com as seguintes variáveis:

```
PORT=3000
DB_PATH=server/estoque.sqlite
```

- `PORT` define a porta em que o servidor Express irá escutar.
- `DB_PATH` indica o caminho do arquivo SQLite utilizado pela aplicação.

## Instalação

1. Instale as dependências do projeto:

   ```bash
   npm install
   ```

2. O banco de dados SQLite é criado automaticamente na primeira execução.

## Inicialização

Para iniciar o servidor execute:

```bash
npm start
```

O servidor será iniciado em `http://localhost:3000`.

## Primeiro usuário admin

O sistema cria um administrador padrão (e-mail `admin` e senha `admin12345`) na
primeira inicialização. Caso precise recriá‑lo manualmente, rode:

```bash
node server/criarAdmin.js
```

## Endpoints da API

### Autenticação e usuários:

- `POST /api/login` – realiza login (body: `email`, `senha`).
- `POST /api/logout` – encerra a sessão.
- `POST /api/usuarios` – cria usuário (admin).
- `PUT /api/usuarios/:id/senha` – altera senha.

### Produtos:

- `POST /api/produtos` – cadastra produto (admin).
- `GET /api/produtos` – lista produtos (`departamento` e `busca` como query).
- `PUT /api/produtos/:id` – edita produto (admin).
- `DELETE /api/produtos/:id` – remove produto (admin).
- `GET /api/produtos/export/csv` – exporta lista em CSV.
- `GET /api/notificacoes/baixo-estoque` – avisa itens com baixo estoque.
- `GET /api/logs` – lista logs (admin).

### Estilo de formulários

Os formulários usam as classes `.form-container` e `.form-group` definidas em
`public/css/style.css`. Aplique `.form-container` na tag `<form>` para alinhar os
campos em coluna e centralizar a largura, utilizando espaçamento consistente.
Utilize `.form-group` para envolver cada conjunto de campos e manter margens
uniformes.

## Testes

Quando os testes forem implementados, execute-os com:

```bash
npm test
```
