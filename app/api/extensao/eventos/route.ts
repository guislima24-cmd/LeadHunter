import { criarClienteAdmin } from '@/lib/supabase/admin'
import { exigirMembroDaExtensao } from '@/lib/extensao'

/**
 * Aceites de conexão e respostas detectados no LinkedIn pela extensão.
 *
 * Isto é o que a aba Insights media à mão até agora. O funil de prospecção
 * tem sete etapas, e duas delas — Aceite e Resposta — dependiam de alguém
 * lembrar de clicar num botão, porque nenhum workflow lê caixa de entrada.
 * Só que a extensão **já detectava as duas** no LinkedIn desde antes do CRM
 * existir; o que faltava era ela ter para onde mandar.
 *
 * O botão manual continua valendo: ele cobre o email, que segue sem detecção
 * automática. Os dois caminhos convivem — um grava por `lead_cnpj`, o outro
 * por `contato_id`, e o índice único de cada um impede repetição.
 */

/** Nome sem acento, sem caixa e sem espaço duplo — para comparar pessoas. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}

/** O caminho `/in/alguma-coisa` de uma URL do LinkedIn, sem barra final. */
function chaveDoPerfil(url: string | null | undefined): string | null {
  if (!url) return null
  const encontrado = /\/in\/([^/?#]+)/.exec(url)
  return encontrado ? decodeURIComponent(encontrado[1]).toLowerCase() : null
}

/**
 * Dois nomes são a mesma pessoa?
 *
 * O LinkedIn mostra o nome como a pessoa o escreveu ("Ana B. Moraes"), e o
 * CRM guarda o que veio da captura ("Ana Beatriz Moraes"). Exigir igualdade
 * exata perderia quase tudo.
 *
 * A regra: todas as palavras com mais de duas letras do nome mais curto têm
 * de aparecer no mais longo, e precisam ser pelo menos duas. Duas palavras é
 * o piso que evita o desastre de casar toda "Ana" da base com toda "Ana" do
 * LinkedIn — um sobrenome em comum já é evidência; um primeiro nome sozinho
 * não é.
 */
function mesmaPessoa(a: string, b: string): boolean {
  const na = normalizar(a)
  const nb = normalizar(b)
  if (!na || !nb) return false
  if (na === nb) return true

  const palavrasA = na.split(' ').filter((p) => p.length > 2)
  const palavrasB = nb.split(' ').filter((p) => p.length > 2)
  const [curto, longo] =
    palavrasA.length <= palavrasB.length ? [palavrasA, nb] : [palavrasB, na]

  return curto.length >= 2 && curto.every((p) => longo.includes(p))
}

interface PessoaDetectada {
  nome?: string
  profileUrl?: string
}

export async function POST(req: Request) {
  const sessao = await exigirMembroDaExtensao(req)
  if ('resposta' in sessao) return sessao.resposta
  const { membro } = sessao

  const corpo = await req.json().catch(() => ({}))
  const tipo = corpo.tipoEvento

  if (tipo !== 'aceite' && tipo !== 'resposta') {
    return Response.json(
      {
        erro: 'tipo_invalido',
        mensagem: 'O evento precisa ser "aceite" ou "resposta".',
      },
      { status: 400 },
    )
  }

  const pessoas: PessoaDetectada[] = Array.isArray(corpo.pessoas)
    ? corpo.pessoas.slice(0, 200)
    : []

  if (pessoas.length === 0) {
    return Response.json({ ok: true, registrados: 0, semCorrespondencia: 0 })
  }

  const admin = criarClienteAdmin()

  // Só os contatos que este membro cadastrou. Sem esse recorte, a rede de
  // contatos pessoal de uma pessoa marcaria como "aceito" o lead que outra
  // estava trabalhando — os dois podem conhecer a mesma pessoa no LinkedIn,
  // e só um deles a prospectou.
  const { data: contatos } = await admin
    .from('contatos')
    .select('id, nome, linkedin_url, organizacao_id')
    .eq('criado_por_email', membro.email)
    .limit(5000)

  if (!contatos?.length) {
    return Response.json({
      ok: true,
      registrados: 0,
      semCorrespondencia: pessoas.length,
    })
  }

  const porPerfil = new Map<string, (typeof contatos)[number]>()
  for (const c of contatos) {
    const chave = chaveDoPerfil(c.linkedin_url as string | null)
    if (chave) porPerfil.set(chave, c)
  }

  const casados = new Map<string, (typeof contatos)[number]>()

  for (const pessoa of pessoas) {
    // A URL do perfil é identidade de verdade; o nome é palpite. Quando a
    // extensão manda as duas, a URL decide.
    const chave = chaveDoPerfil(pessoa.profileUrl)
    const porUrl = chave ? porPerfil.get(chave) : undefined
    if (porUrl) {
      casados.set(porUrl.id as string, porUrl)
      continue
    }

    const nome = String(pessoa.nome ?? '').trim()
    if (!nome) continue

    const achado = contatos.find((c) => mesmaPessoa(nome, c.nome as string))
    if (achado) casados.set(achado.id as string, achado)
  }

  if (casados.size === 0) {
    return Response.json({
      ok: true,
      registrados: 0,
      semCorrespondencia: pessoas.length,
    })
  }

  // O CNPJ da empresa entra junto quando existe — assim o evento aparece
  // tanto na conta por contato quanto na do lead. Empresa cadastrada pela
  // captura do LinkedIn costuma não ter CNPJ, e nesse caso o contato basta.
  const { data: orgs } = await admin
    .from('organizacoes')
    .select('id, cnpj, lead_origem_cnpj')
    .in('id', [...new Set([...casados.values()].map((c) => c.organizacao_id))])

  const cnpjPorOrg = new Map(
    (orgs ?? []).map((o) => [
      o.id as string,
      ((o.lead_origem_cnpj as string | null) ??
        (o.cnpj as string | null)) || null,
    ]),
  )

  const linhas = [...casados.values()].map((c) => ({
    contato_id: c.id as string,
    lead_cnpj: cnpjPorOrg.get(c.organizacao_id as string) ?? null,
    tipo_evento: tipo,
    canal: 'linkedin',
    registrado_por_email: membro.email,
  }))

  // `ignoreDuplicates` porque os detectores varrem a mesma tela a cada 30s:
  // reenviar o que já foi registrado é o comportamento normal deles, não um
  // erro. O índice único por (contato, tipo) é quem garante a contagem certa.
  const { data: inseridos, error } = await admin
    .from('funil_prospeccao_eventos')
    .upsert(linhas, {
      onConflict: 'contato_id,tipo_evento',
      ignoreDuplicates: true,
    })
    .select('id')

  if (error) {
    return Response.json(
      { erro: 'falha_ao_registrar', mensagem: error.message },
      { status: 500 },
    )
  }

  return Response.json({
    ok: true,
    registrados: inseridos?.length ?? 0,
    jaConhecidos: casados.size - (inseridos?.length ?? 0),
    semCorrespondencia: pessoas.length - casados.size,
  })
}
