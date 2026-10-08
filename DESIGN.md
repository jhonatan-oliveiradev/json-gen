---
version: alpha
name: "JSON Gen"
description: "Ferramenta operacional local para transformar planilhas de campanhas aéreas em JSON validado, com leitura rápida e confiança de preflight."
colors:
  primary: "#5B35D5"
  background: "#F4F5F8"
  surface: "#FFFFFF"
  foreground: "#19181D"
  muted: "#6C6975"
  border: "#DDDDE5"
  success: "#167A57"
  warning: "#986000"
  danger: "#B43B43"
  focus: "#7357E6"
typography:
  sans:
    fontFamily: "Aptos, Segoe UI Variable, Segoe UI, system-ui, sans-serif"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
rounded:
  DEFAULT: "0.625rem"
  sm: "0.5rem"
  md: "0.625rem"
  lg: "0.875rem"
spacing:
  section-gap: "2rem"
  page-max: "78rem"
components:
  button: {}
  input: {}
  status: {}
  upload: {}
---

# JSON Gen Design System

## Overview

### Creative North Star

Uma bancada de pré-impressão digital: conteúdo denso, controles precisos, sinais de estado inequívocos e um único gesto visual memorável — a linha de compilação Parse → Agrupar → Assets → Validar → Exportar.

### Product context and register

- **Audience and primary job:** equipe de produção que precisa transformar rapidamente uma planilha de campanha aérea em JSON publicável sem perder agrupamentos ou assets.
- **Target market(s) and evidence:** operação interna brasileira; interface em PT-BR.
- **Locale(s) and language policy:** PT-BR, mantendo nomes de campos do contrato de produção quando necessário.
- **Usage scene:** desktop, uso recorrente e urgente, alta densidade de informação.
- **Register:** produto operacional.
- **Memorable signature:** compile rail no topo que mostra o estado real do pipeline.
- **Restraint:** dados, campos, alertas e ações permanecem familiares; nenhuma decoração compete com validação.
- **Anti-references:** dashboard SaaS cheio de cards, gradientes decorativos, glassmorphism e interfaces excessivamente arredondadas.
- **Token ownership/runtime mapping:** este documento define intenção e tokens; `src/app/globals.css` implementa os valores semânticos.

## Colors

Base fria quase branca, superfícies brancas e texto grafite. Roxo é reservado a foco, progresso e ação principal. Verde, âmbar e vermelho são exclusivamente semânticos para estados de validação.

## Typography

Aptos/Segoe UI dá leitura nativa no ambiente Windows da operação. Dados técnicos, IATAs e caminhos usam stack monoespaçada. Hierarquia vem de peso e espaçamento, não de títulos gigantes.

## Layout

Uma coluna central larga de até 78rem. Seções são separadas por linhas e ritmo vertical, não por dezenas de cards. Em telas estreitas, resumo e controles empilham sem esconder estado ou ação.

## Elevation & Depth

Superfícies são quase planas; apenas o workspace principal e estados flutuantes recebem sombra discreta. Inputs e divisores usam borda para hierarquia.

## Shapes

Raios médios de 8–14px. Botões e campos não são pílulas. Badges de status podem ser pílulas porque representam tokens compactos.

## Components

### Foundational visual states

Focus visível em roxo, disabled preserva geometria, sucesso/aviso/erro sempre têm texto e não dependem apenas de cor.

### Buttons and actions

Ação primária é usada para resolver assets e exportar. Ações secundárias usam outline/ghost. Loading mantém largura do botão.

### Navigation and data display

Carrosséis são alternados por controles compactos. Dropdowns usam disclosure/accordion com rotas preservadas em ordem de origem.

### Forms and overlays

Upload sempre tem alternativa por seletor de arquivo. Erros de parsing e Liferay aparecem próximos da etapa responsável, com orientação de correção.

### Iconography

Lucide, traço consistente, sempre acompanhado de texto nas ações críticas.

### Motion

Transições de 160–220ms para mudança de estado e expansão. `prefers-reduced-motion` desativa animações não essenciais.

### Content and data visualization

Texto direto e operacional: “Resolver assets”, “Gerar JSON”, “Imagem não encontrada”. Contagens sempre especificam o que foi contado.

## Do's and Don'ts

- **Do:** tornar evidente o que foi interpretado e o que ainda impede exportação.
- **Do:** preservar a ordem e o conteúdo da planilha, sinalizando inconsistências sem corrigi-las silenciosamente.
- **Don't:** esconder falhas atrás de estados genéricos de loading ou sucesso.
- **Don't:** usar decoração que reduza a densidade útil ou faça a ferramenta parecer uma landing page.
