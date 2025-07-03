# Sistema de Estoque de Supermercado

Sistema simples de controle de estoque com:
- Cadastro de produtos
- Registro de quebras
- Registro de saídas (vendas)
- Conferência de validade, quantidade e preço
- Alertas de baixo estoque e vencimento

## Tecnologias
- HTML, CSS, JavaScript
- Node.js com Express
- SQLite (banco de dados leve e embutido)
- A sanitização básica dos campos é feita manualmente em `server/routes.js`. O middleware `xss-clean` foi removido por incompatibilidade com o Express 5.

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
- `GET /api/notificacoes/validade` – lista produtos que vencem em até 20 dias.
- `GET /api/departamentos/resumo` – valores de estoque, quebras e saídas por departamento.
- `GET /api/logs` – lista logs (admin).
- Ao registrar uma quebra ou saída a API verifica se o produto possui quantidade
  suficiente. Caso contrário, o pedido é recusado com status 400. Quando o
  registro é criado com sucesso a quantidade do produto é reduzida.

### Estilo de formulários

Os formulários usam as classes `.form-container` e `.form-group` definidas em
`public/css/style.css`. Aplique `.form-container` na tag `<form>` para alinhar os
campos em coluna e centralizar a largura, utilizando espaçamento consistente.
Utilize `.form-group` para envolver cada conjunto de campos e manter margens
uniformes.

## Testes

Antes de rodar a suíte de testes, certifique-se de que todas as dependências
(inclusive as de desenvolvimento) estão instaladas:

```bash
npm install
```

Em seguida execute:

```bash
npm test
```

Para ambientes de automação (como pipelines de CI/CD) recomenda-se criar um
script de setup que execute o `npm install` antes de rodar os testes.
