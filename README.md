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

A interface permite escolher **Produção**, **Staging Green** ou **Staging Blue**. Cada escolha consulta somente o respectivo host; o JSON conserva as URLs retornadas, sem substituir o domínio.

Configure as seguintes variáveis na Vercel (Production e, se for testar deployments de preview, também Preview):

| Variável | Uso |
| --- | --- |
| `LIFERAY_BASE_URL` | URL do Liferay de produção (padrão `https://www.smiles.com.br`) |
| `LIFERAY_SITE_ID_PRODUCTION` | ID do site Liferay em produção |
| `LIFERAY_STAGING_GREEN_BASE_URL` | URL de homologação Green |
| `LIFERAY_STAGING_BLUE_BASE_URL` | URL de homologação Blue |
| `LIFERAY_SITE_ID_STAGING` | ID do site de homologação compartilhado, caso Green e Blue usem o mesmo |

O antigo nome `LIFERAY_STAGING_BASE_URL` não é utilizado. A ausência da variável Green ou Blue escolhida gera um erro explícito, em vez de consultar outro ambiente silenciosamente. Os IDs `20124` do exemplo não foram verificados; devem ser confirmados com a configuração real do Liferay.

Para uso local, configure o mesmo no `.env.local` e reinicie o servidor. Variáveis configuradas na Vercel somente para **Production** não ficam disponíveis nos deploys de **Preview** nem no Next.js local.

O resolvedor encontra pastas por nome e consulta o endpoint de documentos da pasta. Se a pasta for encontrada mas nenhum documento estiver acessível, confira **permissões do Headless Delivery e endpoint de listagem**, não apenas o host ou a URL pública de mídia.


### Diagnóstico de assets (AER1525)

O JSON Gen primeiro identifica a pasta por nome e depois chama os documentos pela API Headless Delivery, usando o ID da pasta. **Abrir um arquivo por uma URL pública `/documents/d/guest/...` não equivale a ter permissão de listar a pasta pelo endpoint Headless.**

A seção "Diagnóstico da consulta" informa agora o resultado real de cada endpoint testado:

- **Variável de ambiente inválida** — verifique `LIFERAY_BASE_URL` no deployment usado. Configure apenas `https://www.smiles.com.br` (sem adicionais). Valores comuns copiados com aspas, espaços externos ou sem `https://` são normalizados.
- **HTTP 401/403** — política/autenticação impede a listagem. Um documento pode continuar publicamente acessível por URL individual.
- **HTTP 302 ou resposta HTML** — provável redirecionamento à tela de login/SSO.
- **Lista vazia** — pasta encontrada, mas o endpoint não retornou itens; confirme site ID, ID da pasta, ambiente e permissões.
- **Itens sem `contentUrl`** — a API retornou metadados, mas não a URL necessária. O JSON Gen não inventa URLs ou sufixos.

Para URLs como `https://portal-green-stg-svc.smiles.com.br/documents/d/guest/scl_750x500_1-68`, selecione **Staging Green**. Para produção, consulte o ambiente **Produção** com URLs de produção efetivamente publicadas.

Se todos os endpoints de listagem exigirem autenticação, será necessário autorizar leitura por uma integração técnica apropriada no Liferay (OAuth2/serviço), ou fornecer as URLs públicas já existentes por carrossel; não é seguro tentar burlar a autenticação com cookies do navegador.

## Comandos

```bash
npm test
npm run lint
npm run build
```

Veja também [`docs/usage.md`](docs/usage.md).
