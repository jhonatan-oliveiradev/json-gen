# Uso operacional — JSON Gen v1

## 1. Abrir a ferramenta

No terminal do projeto:

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## 2. Carregar a campanha

Arraste a planilha XLSX ou use **Selecionar XLSX**. A ferramenta detecta a linha real de cabeçalho; linhas extras antes/depois da tabela não entram como oferta.

Depois da leitura, confirme as contagens exibidas. Para a campanha AER1525 usada como regressão, a expectativa é 58 ofertas e 4 carrosséis.

## 3. Configurar assets

Escolha o **Ambiente dos documentos Liferay**: `Produção` (padrão, para JSON definitivo), `Staging Green` ou `Staging Blue` (somente testes). Cada ambiente usa sua base e site ID configurados; a URL de mídia retornada pela API é preservada sem trocar hostname. Publicar no staging não prova que o documento existe em produção.


Para cada carrossel é sugerida uma pasta seguindo o padrão:

```text
AER1525 + Carrossel 2 → aer1525_offers_02_v1
```

A sugestão é editável. O match de imagem usa o IATA de destino. Exemplo:

```text
MIA → MIA_750x500_1 → URL pública retornada pelo Liferay
```

A pasta de logos começa come` default_cias_v5` e também pode ser alterada.

Clique em **Resolver assets**. Caso a API do Liferay esteja inacessível por autenticação ou pelo ambiente de consulta, o diagnóstico exibirá qual pasta falhou. Para imagens de destinos, selecione o carrossel, cole os links HTTPS reais do Documents and Media no campo **Associar imagens por URL**, um por linha, e clique **Associar URLs ao carrossel**. Os documentos são associados pelo prefixo IATA, sem inventar caminhos. O preflight continuará bloqueando imagens faltantes, logotipos faltantes e qualquer outra divergência.

## 4. Conferir agrupamentos

Troque entre os carrosséis no seletor acima dos assets. Em **Como a vitrine será montada**:

- `Solta` representa um card independente.
- `Dropdown` representa um grupo de ofertas com o mesmo identificador dentro do mesmo carrossel.
- As rotas são mantidas na ordem original da planilha.

Uma rota repetida com data ou preço diferente não é apagada automaticamente.

## 5. Preflight

### Erros bloqueantes

Impedem o botão **Gerar JSON**:

- IATA ausente;
- data inválida;
- link de emissão ausente;
- ID final duplicado;
- dropdown misturando destinos;
- imagem de destino ausente ou ambígua;
- logo de companhia ausente ou ambíguo.

### Avisos

Não impedem a geração. Exemplo: mesma rota aparece em mais de uma data/preço.

## 6. Exportar

O botão no rodapé exporta somente o carrossel selecionado, mantendo o contrato utilizado pela vitrine. O nome segue:

```text
AER1525_OFFERS01.json
AER1525_OFFERS02.json
...
```

## Limitações do v1

- Não há login, banco ou histórico.
- Não publica o JSON automaticamente.
- Desktop/mobile usam a mesma imagem quando existe apenas um asset por IATA.
- Se o Liferay passar a exigir autenticação para leitura Headless, será necessário configurar a integração server-side.
- Mudanças estruturais grandes na planilha são reportadas como erro em vez de serem “corrigidas” silenciosamente.
