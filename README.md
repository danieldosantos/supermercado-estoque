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
DB_PATH=./server/estoque.sqlite
```

`PORT` define a porta em que o servidor Express irá escutar e `DB_PATH` indica o caminho do arquivo SQLite utilizado pela aplicação.
