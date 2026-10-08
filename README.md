# JSON Gen

Gerador local de JSON para vitrines de campanhas aéreas. A ferramenta lê a planilha XLSX, preserva a ordem das ofertas, agrupa dropdowns corretamente, resolve imagens e logos no Liferay e executa um preflight antes de liberar cada JSON de carrossel.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Fluxo

1. Envie o XLSX da campanha.
2. Confira a quantidade de ofertas, carrosséis, dropdowns e itens soltos detectados.
3. Revise ou ajuste as pastas de imagens sugeridas para cada carrossel.
4. Confirme a pasta compartilhada de logos das companhias (`default_cias_v5` por padrão).
5. Clique em **Resolver assets**. Se a API não conseguir consultar o ambiente (por exemplo, por depender de sessão autenticada), cole as URLs completas dos documentos na seção **Associar imagens por URL** do carrossel. O app associa cada URL ao destino pelo IATA e valida domínio e duplicidade. O mesmo preflight se aplica às imagens importadas manualmente.
6. Selecione o carrossel que quer revisar.
7. Confira agrupamentos e o preflight.
8. Quando não houver erro bloqueante, clique em **Gerar JSON**.

O arquivo segue o padrão `AER####_OFFERS01.json`, `AER####_OFFERS02.json` etc.

## Segurança do processo

- `SOLTA` nunca é agrupado com outra oferta.
- Dropdowns são agrupados por carrossel + identificador do dropdown.
- Rotas repetidas com datas/preços diferentes são mantidas e sinalizadas como aviso.
- URLs de documentos do Liferay são usadas como retornadas pela API; o app não inventa sufixos.
- Imagem/logo ausente ou ambíguo bloqueia exportação.
- IDs duplicados bloqueiam exportação.
- O XLSX é processado no navegador. Não há banco, login ou histórico no v1.

## Liferay

Por padrão, o backend local consulta:

- Base: `https://portal-green-stg-svc.smiles.com.br`
- Site ID: `20124`

Você pode substituir sem alterar código:

```bash
LIFERAY_BASE_URL=https://www.smiles.com.br
LIFERAY_SITE_ID=20124
```

O resolver procura a pasta pelo nome e depois busca os documentos da pasta.
Confirme que `LIFERAY_BASE_URL` aponta para o **mesmo ambiente** das imagens (staging neste caso). Se houver um `.env.local` antigo com a base de produção, ele prevalece sobre o valor padrão e deve ser atualizado. O app server-side não reutiliza a sessão do Liferay aberta no navegador: quando a API exige SSO, use as URLs completas já publicadas no Documents and Media, ou configure acesso de leitura Headless autorizado. Se o endpoint direto vier vazio, há um fallback pelo site filtrando `documentFolderId`.

## Comandos

```bash
npm test
npm run lint
npm run build
```

Veja também [`docs/usage.md`](docs/usage.md).
