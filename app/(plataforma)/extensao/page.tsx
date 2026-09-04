import { Cabecalho } from '@/components/layout/Cabecalho'
import { Card, CardCabecalho } from '@/components/ui/Card'
import { TokensDaExtensao } from '@/components/crm/TokensDaExtensao'
import { exigirMembro } from '@/lib/sessao'
import { listarTokensDoMembro } from '@/lib/extensao'
import manifesto from '@/chrome-extension/manifest.json'

export const metadata = { title: 'Extensão do Chrome' }

const ARQUIVO_ZIP = '/extensao-nucleo-comercial.zip'

/**
 * Onde o membro baixa a extensão do Chrome e a conecta ao CRM.
 *
 * O .zip é gerado no build a partir de `chrome-extension/` (ver
 * `scripts/empacotar-extensao.mjs`), então o que o time baixa é sempre o
 * código que está no repositório — não existe passo manual de "subir o zip
 * novo", que é como uma extensão distribuída assim envelhece sem ninguém ver.
 */
export default async function PaginaExtensao() {
  const membro = await exigirMembro()
  const tokens = await listarTokensDoMembro(membro.email)

  return (
    <>
      <Cabecalho
        titulo="Extensão do Chrome"
        descricao="Captura perfis do LinkedIn direto para a sua aba da planilha, sem copiar e colar."
      />

      <Card className="mb-6 border-verde-200 bg-verde-50/60">
        <CardCabecalho
          titulo="1. Instalar no Chrome"
          descricao={`Versão ${manifesto.version} · leva menos de dois minutos, e só precisa ser feito uma vez por computador.`}
          className="border-verde-200"
          acao={
            <a
              href={ARQUIVO_ZIP}
              download
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-verde-600 px-4 text-sm font-semibold whitespace-nowrap text-white transition-colors duration-150 hover:bg-verde-700 active:bg-verde-800"
            >
              Baixar a extensão
            </a>
          }
        />
        <ol className="space-y-2.5 p-5 text-sm leading-relaxed text-tinta-700">
          <li>
            <strong className="text-tinta-900">Baixe o arquivo</strong> no botão
            acima e <strong className="text-tinta-900">descompacte</strong> a
            pasta. Deixe ela num lugar definitivo (Documentos, por exemplo) — se
            você apagar ou mover a pasta depois, o Chrome desativa a extensão.
          </li>
          <li>
            No Chrome, abra{' '}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-tinta-800 ring-1 ring-tinta-200">
              chrome://extensions
            </code>{' '}
            e ligue o <strong className="text-tinta-900">Modo de desenvolvedor</strong>,
            no canto superior direito.
          </li>
          <li>
            Clique em{' '}
            <strong className="text-tinta-900">Carregar sem compactação</strong>{' '}
            e escolha a pasta que você descompactou.
          </li>
          <li>
            Gere o token no passo 2 abaixo, clique no ícone da extensão na barra
            do Chrome e cole o token lá.
          </li>
        </ol>
        <p className="border-t border-verde-200 px-5 py-3.5 text-xs leading-relaxed text-tinta-600">
          O “Modo de desenvolvedor” assusta pelo nome, mas é só como o Chrome
          chama instalar uma extensão que não veio da loja dele. Publicar na
          Chrome Web Store custa uma taxa e passa por revisão da Google — para
          uma ferramenta interna de dez pessoas, não compensa.
        </p>
      </Card>

      {!membro.abaPlanilha && (
        <p className="mb-5 rounded-lg border border-amarelo-200 bg-amarelo-50 px-3.5 py-2.5 text-xs leading-relaxed text-amarelo-700">
          Sua conta ainda não está vinculada a uma aba da planilha. O token
          funciona, mas a{' '}
          <strong>captura de perfis não tem onde ser gravada</strong> até um
          administrador fazer o vínculo.
        </p>
      )}

      <TokensDaExtensao tokens={tokens} />

      <Card className="mt-6">
        <CardCabecalho titulo="Para que serve o token" />
        <div className="space-y-3 p-5 text-sm leading-relaxed text-tinta-700">
          <p>
            O token é a sua identidade dentro da extensão. Sem ele o CRM recebe
            uma captura e não tem como saber de quem ela veio —{' '}
            <strong className="text-tinta-900">
              é o token que diz em qual aba da planilha gravar
            </strong>{' '}
            e em nome de quem criar a empresa e o contato no CRM.
          </p>
          <p>
            Você já está logado no CRM, então parece que a extensão poderia
            aproveitar esse login. Ela não consegue: a extensão roda dentro do
            linkedin.com, e o cookie do CRM não é visível de outro site — é
            justamente assim que o navegador impede que qualquer página leia a
            sua sessão. O token existe para preencher esse buraco.
          </p>
          <p>
            Ele é um texto começando com{' '}
            <code className="rounded bg-tinta-50 px-1.5 py-0.5 font-mono text-xs text-tinta-800 ring-1 ring-tinta-200">
              lhx_
            </code>{' '}
            que você cola na extensão{' '}
            <strong className="text-tinta-900">uma vez</strong>. Depois disso
            ela lembra sozinha — não precisa gerar de novo a cada uso.
          </p>
        </div>
        <ul className="space-y-2 border-t border-tinta-100 px-5 py-4 text-xs leading-relaxed text-tinta-600">
          <li>
            <strong className="text-tinta-800">Ele vale como sua senha.</strong>{' '}
            Não mande no WhatsApp nem cole em documento compartilhado. Quem tem
            o token grava na sua aba.
          </li>
          <li>
            <strong className="text-tinta-800">O CRM não guarda o token.</strong>{' '}
            Guarda só uma impressão digital dele, que serve para conferir mas não
            para reconstruir o texto. É por isso que ele aparece uma vez só: nem
            nós conseguimos mostrar de novo. Perdeu, gera outro e revoga o
            antigo.
          </li>
          <li>
            <strong className="text-tinta-800">Um por computador.</strong> Assim,
            se você trocar de máquina ou perder o notebook, revoga só aquele sem
            derrubar os outros.
          </li>
        </ul>
      </Card>

      <Card className="mt-6">
        <CardCabecalho titulo="O que ela faz" />
        <ul className="space-y-3 p-5 text-sm leading-relaxed text-tinta-700">
          <li>
            <strong className="text-tinta-900">Captura de perfil.</strong> No
            LinkedIn, quando você envia o convite, a extensão lê nome, empresa e
            cargo e grava na sua aba da planilha — a mesma que o resto da
            prospecção usa. A empresa e o contato também entram no CRM.{' '}
            <span className="text-tinta-500">
              É o que já funcionava no ProspectAI.
            </span>
          </li>
          <li>
            <strong className="text-tinta-900">Aceite de conexão.</strong> Ao
            abrir “Minha rede”, ela compara quem aceitou com quem você
            prospectou e marca os que bateram, sem você clicar em nada.
          </li>
          <li>
            <strong className="text-tinta-900">Resposta.</strong> Nas mensagens,
            ela detecta quem respondeu e marca. O que você mesmo enviou é
            ignorado.
          </li>
        </ul>
        <div className="space-y-2 border-t border-tinta-100 px-5 py-4 text-xs leading-relaxed text-tinta-600">
          <p>
            <strong className="text-tinta-800">
              Sobre o aceite e a resposta:
            </strong>{' '}
            você está certo, no ProspectAI eles nunca funcionaram. O código
            existia, mas mandava os dados direto da página do LinkedIn para a
            API, e o navegador bloqueava todas essas chamadas por uma
            configuração errada de CORS no servidor. A captura de perfil escapava
            porque passava por outro caminho dentro da extensão — daí a captura
            funcionar e o resto não.
          </p>
          <p>
            Aqui os dois passaram a usar esse mesmo caminho da captura, que é o
            que sempre funcionou, e o endereço no CRM que recebe esses eventos
            está pronto e testado contra o banco. O que{' '}
            <strong className="text-tinta-800">ainda não foi provado</strong> é a
            leitura da tela do LinkedIn: ela depende do desenho das páginas
            “Minha rede” e “Mensagens”, que a Google não controla e o LinkedIn
            muda quando quer. Quando alguém rodar, vai dar para conferir em
            Insights → Funil se os números de aceite e resposta começam a subir
            sozinhos.
          </p>
          <p>
            O botão manual continua existindo na tela do lead. Ele cobre a
            prospecção por email, que segue sem detecção automática, e serve de
            rede de segurança se a leitura da tela quebrar.
          </p>
        </div>
      </Card>
    </>
  )
}
