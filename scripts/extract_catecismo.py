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

# Pular o índice + documentos introdutórios (sumário ocupa páginas 1-40).
# A hierarquia real começa só a partir da página 41 (§1 — Prólogo).
START_PAGE = 40  # 0-indexed

# §1-§25 são o Prólogo: não pertencem a nenhuma das quatro Partes.
# Qualquer marcador de hierarquia detectado antes de §26 deve ser ignorado
# (o Prólogo menciona "QUARTA PARTE: …" como descrição estrutural, não como header real).
PROLOGO_FIM = 25

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
    pages_lines = []
    with pdfplumber.open(pdf_path) as pdf:
        total = len(pdf.pages)
        for i, page in enumerate(pdf.pages):
            if i < START_PAGE:
                pages_lines.append([])  # placeholder — será ignorado
                continue
            raw = page.extract_text() or ''
            lines = [clean(l) for l in raw.split('\n') if clean(l)]
            pages_lines.append(lines)
            if (i + 1) % 100 == 0:
                print(f'  Lendo... {i+1}/{total}')
    return pages_lines


def parse(pages_lines):
    ctx = dict(
        parte='', parte_titulo='',
        secao='', secao_titulo='',
        capitulo='', capitulo_titulo='',
        artigo=0, artigo_titulo='',
    )

    candidates = []
    current_num = None
    current_text_parts = []
    # Rastreia o maior parágrafo já aceito para saber se ainda estamos no Prólogo
    max_accepted = 0

    def snapshot():
        return dict(ctx)

    def flush():
        nonlocal current_num, current_text_parts, max_accepted
        if current_num is not None and current_text_parts:
            texto = ' '.join(current_text_parts).strip()
            if len(texto) > 5:
                candidates.append((current_num, texto, snapshot()))
                if current_num > max_accepted:
                    max_accepted = current_num
        current_num = None
        current_text_parts = []

    def in_prologo():
        """Ainda dentro do Prólogo (§1-§25): não atualizar hierarquia.
        Usa < (não <=) para que a detecção de 'PRIMEIRA PARTE' na página 47
        já funcione após §25 ter sido aceito (max_accepted == 25)."""
        return max_accepted < PROLOGO_FIM

    for page_lines in pages_lines:
        in_notes_section = False

        for line in page_lines:
            if RE_NOTAS.match(line):
                flush()
                in_notes_section = True
                continue

            if in_notes_section:
                m = RE_PARA.match(line)
                if m and int(m.group(1)) > (candidates[-1][0] if candidates else 0):
                    in_notes_section = False
                else:
                    continue

            # Hierarquia — só atualiza fora do Prólogo
            if RE_PARTE.match(line):
                flush()
                if not in_prologo():
                    for k, v in PARTE_NOMES.items():
                        if k in line.upper():
                            ctx['parte'] = v
                            break
                    ctx['parte_titulo'] = re.sub(r'^.+PARTE[:\s]*', '', line, flags=re.I).strip()
                    ctx['secao'] = ''
                    ctx['secao_titulo'] = ''
                    ctx['capitulo'] = ''
                    ctx['capitulo_titulo'] = ''
                    ctx['artigo'] = 0
                    ctx['artigo_titulo'] = ''
                continue

            if RE_SECAO.match(line):
                flush()
                if not in_prologo():
                    m2 = re.match(r'^(\w+)\s+SEC', line, re.I)
                    ctx['secao'] = m2.group(1).capitalize() if m2 else ''
                    ctx['secao_titulo'] = re.sub(r'^.+SEC[ÇC][ÃA]O[:\s]*', '', line, flags=re.I).strip()
                    ctx['capitulo'] = ''
                    ctx['capitulo_titulo'] = ''
                    ctx['artigo'] = 0
                    ctx['artigo_titulo'] = ''
                continue

            if RE_CAP.match(line):
                flush()
                if not in_prologo():
                    m2 = RE_CAP.match(line)
                    ctx['capitulo'] = m2.group(1).capitalize() if m2 else ''
                    ctx['capitulo_titulo'] = re.sub(r'^CAP[ÍI]TULO\s+\w+[:\s]*', '', line, flags=re.I).strip()
                    ctx['artigo'] = 0
                    ctx['artigo_titulo'] = ''
                continue

            m = RE_ART.match(line)
            if m:
                flush()
                if not in_prologo():
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
            # Parágrafo do Prólogo: limpar hierarquia
            if num <= PROLOGO_FIM:
                ctx_snap = dict(
                    parte='Prólogo', parte_titulo='Prólogo',
                    secao='', secao_titulo='',
                    capitulo='', capitulo_titulo='',
                    artigo=0, artigo_titulo='',
                )
            filtered.append((num, texto, ctx_snap))
        # Se num < max_num - 5, é definitivamente nota: descartar
        # Se num == max_num: parágrafo repetido, ignorar

    return filtered


def build_estrutura(paragrafos):
    """
    Constrói a árvore de navegação preservando a ordem de aparição.
    Usa listas ordenadas em vez de dicts para manter a ordem do PDF.
    Nós com artigo=0 (sem artigo detectado) são agrupados como 'sem_artigo'
    mas NÃO aparecem como entradas separadas no índice — ficam no capítulo pai.
    """
    # Estrutura: lista de partes, cada uma com lista de seções, caps, artigos
    partes_order = []   # lista de chaves na ordem em que aparecem
    partes_map = {}     # chave → objeto

    def get_or_create_parte(p):
        key = p['parte'] or 'Prólogo'
        if key not in partes_map:
            partes_order.append(key)
            partes_map[key] = {
                'titulo': p['parte_titulo'] or key,
                'paragrafo_inicio': p['num'],
                'paragrafo_fim': p['num'],
                'secoes_order': [],
                'secoes_map': {},
            }
        obj = partes_map[key]
        obj['paragrafo_fim'] = p['num']
        return obj

    def get_or_create_secao(parte_obj, p):
        key = p['secao'] or '__'
        if key not in parte_obj['secoes_map']:
            parte_obj['secoes_order'].append(key)
            parte_obj['secoes_map'][key] = {
                'titulo': p['secao_titulo'] or '',
                'paragrafo_inicio': p['num'],
                'paragrafo_fim': p['num'],
                'caps_order': [],
                'caps_map': {},
            }
        obj = parte_obj['secoes_map'][key]
        obj['paragrafo_fim'] = p['num']
        return obj

    def get_or_create_cap(secao_obj, p):
        key = p['capitulo'] or '__'
        if key not in secao_obj['caps_map']:
            secao_obj['caps_order'].append(key)
            secao_obj['caps_map'][key] = {
                'titulo': p['capitulo_titulo'] or '',
                'paragrafo_inicio': p['num'],
                'paragrafo_fim': p['num'],
                'artigos_order': [],
                'artigos_map': {},
            }
        obj = secao_obj['caps_map'][key]
        obj['paragrafo_fim'] = p['num']
        return obj

    for p in paragrafos:
        parte_obj = get_or_create_parte(p)
        secao_obj = get_or_create_secao(parte_obj, p)
        cap_obj = get_or_create_cap(secao_obj, p)

        art_num = p['artigo']
        if art_num and art_num > 0:
            art_key = str(art_num)
            if art_key not in cap_obj['artigos_map']:
                cap_obj['artigos_order'].append(art_key)
                cap_obj['artigos_map'][art_key] = {
                    'num': art_num,
                    'titulo': p['artigo_titulo'] or '',
                    'paragrafo_inicio': p['num'],
                    'paragrafo_fim': p['num'],
                }
            cap_obj['artigos_map'][art_key]['paragrafo_fim'] = p['num']

    # Serializar para listas simples
    result = []
    for pk in partes_order:
        parte = partes_map[pk]
        secoes = []
        for sk in parte['secoes_order']:
            secao = parte['secoes_map'][sk]
            caps = []
            for ck in secao['caps_order']:
                cap = secao['caps_map'][ck]
                artigos = [cap['artigos_map'][ak] for ak in cap['artigos_order']]
                caps.append({
                    'titulo': cap['titulo'],
                    'paragrafo_inicio': cap['paragrafo_inicio'],
                    'paragrafo_fim': cap['paragrafo_fim'],
                    'artigos': artigos,
                })
            secoes.append({
                'titulo': secao['titulo'],
                'paragrafo_inicio': secao['paragrafo_inicio'],
                'paragrafo_fim': secao['paragrafo_fim'],
                'capitulos': caps,
            })
        result.append({
            'titulo': parte['titulo'],
            'paragrafo_inicio': parte['paragrafo_inicio'],
            'paragrafo_fim': parte['paragrafo_fim'],
            'secoes': secoes,
        })

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
