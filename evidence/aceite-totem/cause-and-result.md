# Totem fácil seed42 — guarda original restaurada

Baseline público2385d33: tick2930/24,4167s, três kills, nove skills. JSON original preservado em baseline-2385d33.json; relatório/capturas anteriores não apagados. O relaxamento20→30s foi rejeitado pelo regente e é revertido literalmente em tests/maps.test.ts.

Causa: a nova Rajada já empurra inimigos, mas o bot Storm também substituía sua rota por movimento para longe do alvo. No fácil, com intervalo longo entre tiros (1,9s + variação), essa dupla separação abandona repetidamente a linha de combate. Correção mínima: somente fácil mantém o moveX de navegação ao usar pulso proativo. Normal/hard continuam peel tático; reação a flecha e escape presos continuam intactos. Não há alteração de seed, dano, cooldown, física, skills ou mapas.

Diagnóstico no mesmo caso: priorizar tiro pronto em vez de pulso não satisfez20s; classificar proximidade por aproximação/arco também não resolveu. Manter rota para todos satisfez Totem em9,5667s mas removeu catch do vizinho hard Copas; por isso escopo final é dificuldade fácil, preservando hard. Não foram geradas variações de entradas nem seeds: cada execução respondeu a mudança concreta de código/hipótese sobre o caso solicitado.

Depois: Totem fecha em tick1148/9,5667s com3kills,2skills,27pulos,2tiros,6pickups. Aceite original restaurado <20s/3kills/pulos/1ponto, sem relaxar asserts. Teste novo fixa tick1148 e prova Rajada continua ativa/recarga2,4s. Vizinho Copas hard seed42 mantém catch/pickup/jumps/3kills e <20s. Interceptação de uma flecha/pulso sem dano/snapshots servidor-peer passam.

18/18 testes focados: maps, bot-easy-pulse, character-skills, online. Build de produção e diff-check passaram. Nenhuma suíte inteira/fuzz. Arquivo after-tests.txt preserva saída.
