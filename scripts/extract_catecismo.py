"""
Extrai o Catecismo da Igreja Católica (PDF Loyola) para catecismo.json
Estratégia: filtro monotônico — parágrafos do CCC são estritamente crescentes.
Qualquer número que "volte" em relação ao máximo já visto é nota bibliográfica.
"""

import pdfplumber
import re
import json
import sys

PDF_PATH = r"C:\Users\Elias\Documents\Catecismo da Igreja Católica (Loyola).pdf"
OUTPUT_PATH = r"C:\Users\Elias\Documents\Projeto Lumen+\lumenplus-main\lumen_mobile\assets\catecismo.json"

# Padrões de hierarquia — detectados pelo texto em MAIÚSCULAS no PDF
PARTE_NOMES = {
    'PRIMEIRA': 'Primeira',
    'SEGUNDA': 'Segunda',
    'TERCEIRA': 'Terceira',
    'QUARTA': 'Quarta',
}

RE_PARTE  = re.compile(r'^(PRIMEIRA|SEGUNDA|TERCEIRA|QUARTA)\s+PARTE', re.I)
RE_SECAO  = re.compile(r'^(PRIMEIRA|SEGUNDA|TERCEIRA|QUARTA|QUINTA)\s+SEC[ÇC][ÃA]O', re.I)
RE_CAP    = re.compile(r'^CAP[ÍI]TULO\s+(PRIMEIRO|SEGUNDO|TERCEIRO|QUARTO|QUINTO|SEXTO|S[EÉ]TIMO|OITAVO|NONO|D[EÉ]CIMO)', re.I)
RE_ART    = re.compile(r'^ARTIGO\s+(\d+)\s*[:\-–]?\s*(.*)', re.I)
RE_PARA   = re.compile(r'^(\d{1,4})\.\s+(.*)')
RE_NOTAS  = re.compile(r'^Notas\s*$', re.I)

def clean(t: str) -> str:
    t = re.sub(r'[ \t]+', ' ', t)
    return t.strip()


def extract(pdf_path: str):
    """
    Retorna lista de candidatos a parágrafo:
    [(page_idx, line_idx, num, text_so_far)]
    e lista de linhas por página.
    """
    pages_lines = []
    with pdfplumber.open(pdf_path) as pdf:
        total = len(pdf.pages)
        for i, page in enumerate(pdf.pages):
            raw = page.extract_text() or ''
            lines = [clean(l) for l in raw.split('\n') if clean(l)]
            pages_lines.append(lines)
            if (i + 1) % 100 == 0:
                print(f'  Lendo... {i+1}/{total}')
    return pages_lines


def parse(pages_lines):
    # Contexto de hierarquia
    ctx = dict(
        parte='', parte_titulo='',
        secao='', secao_titulo='',
        capitulo='', capitulo_titulo='',
        artigo=0,  artigo_titulo='',
    )

    # Candidatos: (num, texto, ctx_snapshot)
    candidates = []

    # Dentro de cada página, detectamos se entrou em seção "Notas"
    current_num = None
    current_text_parts = []

    def snapshot():
        return dict(ctx)

    def flush():
        nonlocal current_num, current_text_parts
        if current_num is not None and current_text_parts:
            texto = ' '.join(current_text_parts).strip()
            if len(texto) > 5:
                candidates.append((current_num, texto, snapshot()))
        current_num = None
        current_text_parts = []

    for page_lines in pages_lines:
        in_notes_section = False

        for line in page_lines:
            # Início de seção de Notas → para tudo até próxima página
            if RE_NOTAS.match(line):
                flush()
                in_notes_section = True
                continue

            if in_notes_section:
                # Checar se voltou conteúdo (hierarquia ou parágrafo alto)
                m = RE_PARA.match(line)
                if m and int(m.group(1)) > (candidates[-1][0] if candidates else 0):
                    in_notes_section = False
                    # Cai no processamento normal abaixo
                else:
                    continue

            # Hierarquia
            if RE_PARTE.match(line):
                flush()
                for k, v in PARTE_NOMES.items():
                    if k in line.upper():
                        ctx['parte'] = v
                        break
                # Título vem na mesma linha após "PARTE"
                titulo = re.sub(r'^.+PARTE[:\s]*', '', line, flags=re.I).strip()
                ctx['parte_titulo'] = titulo
                ctx['secao'] = ''
                ctx['capitulo'] = ''
                ctx['artigo'] = 0
                continue

            if RE_SECAO.match(line):
                flush()
                m2 = re.match(r'^(\w+)\s+SEC', line, re.I)
                ctx['secao'] = m2.group(1).capitalize() if m2 else ''
                ctx['secao_titulo'] = re.sub(r'^.+SEC[ÇC][ÃA]O[:\s]*', '', line, flags=re.I).strip()
                ctx['capitulo'] = ''
                ctx['artigo'] = 0
                continue

            if RE_CAP.match(line):
                flush()
                m2 = RE_CAP.match(line)
                ctx['capitulo'] = m2.group(1).capitalize() if m2 else ''
                ctx['capitulo_titulo'] = re.sub(r'^CAP[ÍI]TULO\s+\w+[:\s]*', '', line, flags=re.I).strip()
                ctx['artigo'] = 0
                continue

            m = RE_ART.match(line)
            if m:
                flush()
                ctx['artigo'] = int(m.group(1))
                ctx['artigo_titulo'] = m.group(2).strip()
                continue

            # Candidato a parágrafo
            m = RE_PARA.match(line)
            if m:
                num = int(m.group(1))
                rest = m.group(2).strip()
                flush()
                current_num = num
                current_text_parts = [rest]
                continue

            # Continuação do parágrafo atual
            if current_num is not None:
                current_text_parts.append(line)

    flush()

    # -----------------------------------------------------------------------
    # FILTRO MONOTÔNICO
    # Os parágrafos do CCC são estritamente crescentes de §1 a ~§2557.
    # Qualquer número que seja <= o máximo já aceito é nota bibliográfica.
    # Tolerância: permitimos até 5 de variação para evitar problemas de ordem.
    # -----------------------------------------------------------------------
    max_num = 0
    filtered = []
    for (num, texto, ctx_snap) in candidates:
        if num > max_num:
            max_num = num
            filtered.append((num, texto, ctx_snap))
        # Se num < max_num - 5, é definitivamente nota: descartar
        # Se num == max_num: parágrafo repetido, ignorar

    return filtered


def build_estrutura(paragrafos):
    """Constrói a árvore de navegação a partir dos parágrafos."""
    partes = {}
    for p in paragrafos:
        parte_key = p['parte'] or 'Prólogo'
        if parte_key not in partes:
            partes[parte_key] = {
                'titulo': p['parte_titulo'] or parte_key,
                'secoes': {},
                'paragrafos_inicio': p['num'],
            }
        parte = partes[parte_key]

        secao_key = p['secao'] or '_'
        if secao_key not in parte['secoes']:
            parte['secoes'][secao_key] = {
                'titulo': p['secao_titulo'] or '',
                'capitulos': {},
                'paragrafos_inicio': p['num'],
            }
        secao = parte['secoes'][secao_key]

        cap_key = p['capitulo'] or '_'
        if cap_key not in secao['capitulos']:
            secao['capitulos'][cap_key] = {
                'titulo': p['capitulo_titulo'] or '',
                'artigos': {},
                'paragrafos_inicio': p['num'],
            }
        cap = secao['capitulos'][cap_key]

        art_key = str(p['artigo']) if p['artigo'] else '_'
        if art_key not in cap['artigos']:
            cap['artigos'][art_key] = {
                'num': p['artigo'],
                'titulo': p['artigo_titulo'] or '',
                'paragrafo_inicio': p['num'],
                'paragrafo_fim': p['num'],
            }
        cap['artigos'][art_key]['paragrafo_fim'] = p['num']

    # Converter para listas ordenadas
    def dict_to_list(d, key_fn=lambda k: k):
        return [v for k, v in sorted(d.items(), key=lambda x: key_fn(x[0]))]

    result = []
    for parte_key in partes:
        parte = partes[parte_key]
        secoes_list = []
        for sec_key in parte['secoes']:
            secao = parte['secoes'][sec_key]
            caps_list = []
            for cap_key in secao['capitulos']:
                cap = secao['capitulos'][cap_key]
                arts_list = list(cap['artigos'].values())
                arts_list.sort(key=lambda a: a['num'] if a['num'] else 0)
                caps_list.append({**cap, 'artigos': arts_list})
            secoes_list.append({**secao, 'capitulos': caps_list})
        result.append({**parte, 'secoes': secoes_list})

    return result


def main():
    print(f'Lendo PDF...')
    pages_lines = extract(PDF_PATH)
    print(f'Páginas: {len(pages_lines)}')

    print('Parseando...')
    filtered = parse(pages_lines)
    print(f'Parágrafos após filtro monotônico: {len(filtered)}')

    if filtered:
        print(f'Primeiro: §{filtered[0][0]}')
        print(f'Último:   §{filtered[-1][0]}')

    # Verificar lacunas grandes
    lacunas = []
    for i in range(1, len(filtered)):
        gap = filtered[i][0] - filtered[i-1][0]
        if gap > 5:
            lacunas.append((filtered[i-1][0], filtered[i][0], gap))
    if lacunas:
        print(f'Lacunas > 5 parágrafos ({len(lacunas)} total):')
        for a, b, g in lacunas[:10]:
            print(f'  §{a} → §{b} (gap {g})')

    # Montar objetos finais
    paragrafos = []
    for (num, texto, ctx) in filtered:
        paragrafos.append({
            'num': num,
            'texto': texto,
            'parte': ctx['parte'],
            'parte_titulo': ctx['parte_titulo'],
            'secao': ctx['secao'],
            'secao_titulo': ctx['secao_titulo'],
            'capitulo': ctx['capitulo'],
            'capitulo_titulo': ctx['capitulo_titulo'],
            'artigo': ctx['artigo'],
            'artigo_titulo': ctx['artigo_titulo'],
        })

    estrutura = build_estrutura(paragrafos)

    output = {
        'meta': {
            'titulo': 'Catecismo da Igreja Católica',
            'edicao': 'Loyola',
            'total_paragrafos': len(paragrafos),
            'num_inicio': paragrafos[0]['num'] if paragrafos else 0,
            'num_fim': paragrafos[-1]['num'] if paragrafos else 0,
        },
        'paragrafos': paragrafos,
        'estrutura': estrutura,
    }

    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, separators=(',', ':'))

    import os
    size_mb = os.path.getsize(OUTPUT_PATH) / (1024 * 1024)
    print(f'\nSalvo: {OUTPUT_PATH} ({size_mb:.1f} MB)')


if __name__ == '__main__':
    main()
