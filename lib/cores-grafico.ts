/**
 * Paleta dos gráficos — validada, não escolhida a olho.
 *
 * As cores não são as da interface, e isso é de propósito. O verde da marca
 * (`#00634a`) tem croma 0.09: como traço de ícone funciona, como preenchimento
 * de área ele lê como cinza. E verde contra vermelho é exatamente o par que a
 * protanopia não separa — o caso mais comum de daltonismo.
 *
 * Cada par aqui passou pelo validador de paleta do `dataviz`, no modo claro,
 * sobre a superfície do cartão:
 *
 *   ganho × perdido            ΔE 12,8 (deutan)   · 29,7 visão normal
 *   as três origens            ΔE 12,4 (protan)   · 18,7 visão normal
 *   os três estados de meta    ΔE 12,4 (protan)   · 18,7 visão normal
 *
 * O piso do validador é 8. **Trocar qualquer hexadecimal daqui sem rodar o
 * validador de novo quebra a leitura para quem não enxerga cor como a
 * maioria** — e quebra em silêncio, porque continua bonito na tela de quem
 * trocou.
 *
 * `atencao` (#bd9a00) fica em 2,63:1 de contraste com o fundo, abaixo do 3:1
 * que o validador pede. Passa porque nunca aparece sozinho: todo lugar que o
 * usa escreve o estado por extenso ao lado ("Atenção") e o número. Cor ali é
 * reforço, não a informação.
 */
export const COR = {
  /** Série única — sem vizinha com que possa ser confundida. */
  serie: '#0f7c62',
  ganho: '#2c957d',
  perdido: '#b91c1c',
  origem: ['#2c957d', '#bd9a00', '#2563eb'],
  /** Estados de meta. Sempre acompanhados do rótulo escrito. */
  meta: {
    noRitmo: '#2c957d',
    atencao: '#bd9a00',
    atrasada: '#b91c1c',
  },
  grade: '#eef0ee',
  eixo: '#939a95',
} as const

/** Eixos recessivos: a grade não disputa atenção com o dado. */
export const EIXO = {
  tick: { fill: COR.eixo, fontSize: 11 },
  axisLine: false,
  tickLine: false,
} as const
