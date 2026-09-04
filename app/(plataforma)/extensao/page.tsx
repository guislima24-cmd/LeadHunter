import { Cabecalho } from '@/components/layout/Cabecalho'
import { Card, CardCabecalho } from '@/components/ui/Card'
import { TokensDaExtensao } from '@/components/crm/TokensDaExtensao'
import { exigirMembro } from '@/lib/sessao'
import { listarTokensDoMembro } from '@/lib/extensao'

export const metadata = { title: 'Extensão do Chrome' }

/**
 * Onde o membro conecta a extensão do Chrome ao CRM.
 *
 * A extensão captura perfis do LinkedIn direto para a aba da planilha e
 * detecta sozinha aceites de conexão e respostas — dois números que o funil
 * de prospecção media à mão até agora.
 */
export default async function PaginaExtensao() {
  const membro = await exigirMembro()
  const tokens = await listarTokensDoMembro(membro.email)

  return (
    <>
      <Cabecalho
        titulo="Extensão do Chrome"
        descricao="Captura perfis do LinkedIn direto para a sua aba da planilha, e marca sozinha quem aceitou a conexão ou respondeu."
      />

      {!membro.abaPlanilha && (
        <p className="mb-5 rounded-lg border border-amarelo-200 bg-amarelo-50 px-3.5 py-2.5 text-xs leading-relaxed text-amarelo-700">
          Sua conta ainda não está vinculada a uma aba da planilha. O token
          funciona e a detecção de aceite e resposta já conta no funil, mas a
          <strong> captura de perfis não tem onde ser gravada</strong> até um
          administrador fazer o vínculo.
        </p>
      )}

      <TokensDaExtensao tokens={tokens} />

      <Card className="mt-6">
        <CardCabecalho titulo="O que ela faz" />
        <ul className="space-y-2.5 p-5 text-sm leading-relaxed text-tinta-700">
          <li>
            <strong className="text-tinta-900">Captura de perfil.</strong> No
            LinkedIn, a extensão lê nome, empresa e cargo e grava na sua aba da
            planilha — a mesma que o resto da prospecção usa. A empresa e o
            contato também entram no CRM.
          </li>
          <li>
            <strong className="text-tinta-900">Aceite de conexão.</strong> Ao
            abrir “Minha rede”, ela compara os seus contatos aceitos com os que
            você prospectou e marca os que bateram. Não precisa clicar em nada.
          </li>
          <li>
            <strong className="text-tinta-900">Resposta.</strong> Nas mensagens,
            ela detecta quem respondeu e marca. Mensagens enviadas por você são
            ignoradas.
          </li>
        </ul>
        <p className="border-t border-tinta-100 px-5 py-3.5 text-xs leading-relaxed text-tinta-500">
          Aceite e resposta alimentam as duas etapas do funil de prospecção em
          Insights que antes dependiam de alguém marcar à mão. O botão manual
          continua existindo na tela do lead — ele cobre a prospecção por email,
          que segue sem detecção automática.
        </p>
      </Card>
    </>
  )
}
