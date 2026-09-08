# Ordenação de presentes completos na lista

## Problema

Na página `/lista`, os presentes são carregados por preço crescente. Quando um presente fica totalmente contribuído, continua na mesma posição, o que faz com que itens indisponíveis ocupem as primeiras posições da lista.

## Objetivo

Mostrar primeiro os presentes ainda disponíveis e deslocar os presentes completos para o fim da grelha.

## Não objetivos

- Não alterar os dados guardados no Firebase.
- Não alterar o aspeto dos cartões nem os textos existentes.
- Não alterar a ordenação no painel de administração.

## Abordagem escolhida

Depois de calcular o total contribuído por presente no carregamento da página, ordenar a lista em memória por estado de conclusão:

1. Presentes incompletos primeiro.
2. Presentes completos depois, quando `contributed >= price` e o preço é positivo.
3. Dentro de cada grupo, manter a ordem atual por preço crescente.

Esta abordagem não requer migração de dados, reflete automaticamente novas contribuições e preserva a ordenação atual para todos os presentes que ainda podem receber contribuições.

## Fluxo

Firebase (`gifts` e `gift_contributions`) → cálculo de totais → ordenação por conclusão → cartões da lista.

Após uma contribuição efetuada na página, a lista atualiza o total localmente; a atualização periódica existente volta a aplicar a ordenação logo de seguida.

## Testes

- Executar `npm run build` e `npm run lint`.
- Confirmar que presentes incompletos aparecem antes dos completos.
- Confirmar que a ordem por preço continua ascendente dentro de cada grupo.
- Confirmar que presentes sem preço positivo não são classificados como completos.

## Critérios de aceitação

- Um presente com total contribuído igual ou superior ao seu preço passa para o fim da lista.
- Um presente ainda incompleto continua antes de qualquer presente completo.
- A publicação no GitHub Pages é acionada pelo push para `main`.
