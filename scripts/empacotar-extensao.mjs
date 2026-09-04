// Gera public/extensao-nucleo-comercial.zip a partir de chrome-extension/.
//
// Roda no `prebuild`, então o .zip que o time baixa é sempre o código que
// está no repositório — não tem passo manual de "gerar o zip e subir", que é
// exatamente como uma extensão publicada fica velha sem ninguém perceber.
//
// O ZIP é escrito à mão com `zlib` em vez de uma biblioteca de empacotamento
// porque o build da Vercel não tem `zip` garantido e uma dependência a mais
// para escrever ~40 KB de arquivo não se paga.

import { createHash } from 'node:crypto'
import { deflateRawSync } from 'node:zlib'
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const origem = join(raiz, 'chrome-extension')
const destino = join(raiz, 'public', 'extensao-nucleo-comercial.zip')

const TABELA_CRC = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = TABELA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function listar(dir) {
  const saida = []
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, item.name)
    if (item.isDirectory()) saida.push(...listar(caminho))
    else saida.push(caminho)
  }
  return saida.sort()
}

// Data fixa (1980-01-01, o zero do formato DOS) em vez do mtime: assim dois
// builds do mesmo código geram bytes idênticos, e dá para conferir se o zip
// publicado corresponde ao commit.
const DATA_DOS = 33 // (1980-1980)<<9 | 1<<5 | 1
const HORA_DOS = 0

const locais = []
const centrais = []
let deslocamento = 0

for (const caminho of listar(origem)) {
  const nome = relative(origem, caminho).split('\\').join('/')
  const bruto = readFileSync(caminho)
  const comprimido = deflateRawSync(bruto, { level: 9 })
  const crc = crc32(bruto)
  const nomeBuf = Buffer.from(nome, 'utf8')

  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4) // versão necessária
  local.writeUInt16LE(0, 6) // flags
  local.writeUInt16LE(8, 8) // método: deflate
  local.writeUInt16LE(HORA_DOS, 10)
  local.writeUInt16LE(DATA_DOS, 12)
  local.writeUInt32LE(crc, 14)
  local.writeUInt32LE(comprimido.length, 18)
  local.writeUInt32LE(bruto.length, 22)
  local.writeUInt16LE(nomeBuf.length, 26)
  local.writeUInt16LE(0, 28) // extra
  locais.push(local, nomeBuf, comprimido)

  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(20, 4) // versão de origem
  central.writeUInt16LE(20, 6)
  central.writeUInt16LE(0, 8)
  central.writeUInt16LE(8, 10)
  central.writeUInt16LE(HORA_DOS, 12)
  central.writeUInt16LE(DATA_DOS, 14)
  central.writeUInt32LE(crc, 16)
  central.writeUInt32LE(comprimido.length, 20)
  central.writeUInt32LE(bruto.length, 24)
  central.writeUInt16LE(nomeBuf.length, 28)
  central.writeUInt16LE(0, 30) // extra
  central.writeUInt16LE(0, 32) // comentário
  central.writeUInt16LE(0, 34) // disco
  central.writeUInt16LE(0, 36) // atributos internos
  central.writeUInt32LE((0o100644 << 16) >>> 0, 38) // atributos externos (unix)
  central.writeUInt32LE(deslocamento, 42)
  centrais.push(central, nomeBuf)

  deslocamento += local.length + nomeBuf.length + comprimido.length
}

const diretorio = Buffer.concat(centrais)
const fim = Buffer.alloc(22)
fim.writeUInt32LE(0x06054b50, 0)
fim.writeUInt16LE(0, 4)
fim.writeUInt16LE(0, 6)
fim.writeUInt16LE(centrais.length / 2, 8)
fim.writeUInt16LE(centrais.length / 2, 10)
fim.writeUInt32LE(diretorio.length, 12)
fim.writeUInt32LE(deslocamento, 16)
fim.writeUInt16LE(0, 20)

const zip = Buffer.concat([...locais, diretorio, fim])
mkdirSync(dirname(destino), { recursive: true })
writeFileSync(destino, zip)

const versao = JSON.parse(readFileSync(join(origem, 'manifest.json'), 'utf8')).version
const impressao = createHash('sha256').update(zip).digest('hex').slice(0, 12)
console.log(
  `extensao-nucleo-comercial.zip · v${versao} · ${centrais.length / 2} arquivos · ` +
    `${(zip.length / 1024).toFixed(1)} KB · sha256:${impressao}`,
)
