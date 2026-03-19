"""Insere Termos de Uso e Política de Privacidade v1.0 (LGPD)

Revision ID: 009_legal_documents_v1
Revises: 008_profile_extra_fields
Create Date: 2026-03-19
"""

import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "009_legal_documents_v1"
down_revision: Union[str, None] = "008_profile_extra_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PUBLISHED_AT = datetime(2026, 3, 19, 0, 0, 0, tzinfo=timezone.utc)

TERMS_V1 = """\
TERMOS DE USO — LUMEN+
Versão 1.0 | Vigência: 19 de março de 2026

1. ACEITAÇÃO DOS TERMOS
Ao acessar ou utilizar o aplicativo Lumen+ ("Aplicativo"), você ("Usuário") concorda com estes Termos de Uso ("Termos"). Se não concordar com alguma cláusula, não utilize o Aplicativo.

2. SOBRE O LUMEN+
O Lumen+ é uma plataforma de gestão comunitária desenvolvida e operada pela Obra Lumen de Evangelização ("Obra"), associação religiosa sem fins lucrativos. O Aplicativo permite que membros da Obra gerenciem seu vínculo comunitário, recebam comunicados e organizem atividades pastorais.

3. ELEGIBILIDADE
3.1. O Aplicativo destina-se exclusivamente a membros, candidatos e colaboradores da Obra Lumen de Evangelização.
3.2. É necessário ter 18 (dezoito) anos ou mais para criar uma conta. Menores de 18 anos precisam de autorização expressa dos responsáveis legais.
3.3. O acesso é condicionado ao convite ou aprovação por um responsável da Obra.

4. CONTA DO USUÁRIO
4.1. Você é responsável por manter a confidencialidade das suas credenciais de acesso.
4.2. Você é responsável por todas as atividades realizadas com sua conta.
4.3. Notifique imediatamente a Obra em caso de uso não autorizado da sua conta.
4.4. É proibido criar contas falsas, representar outra pessoa ou fornecer informações inverídicas.

5. USO PERMITIDO
Você pode usar o Aplicativo para:
• Gerenciar seu perfil e informações pessoais na comunidade;
• Receber e enviar comunicados internos;
• Visualizar e participar de estruturas organizacionais da Obra;
• Gerenciar convites e vínculos de ministérios e grupos.

6. USO PROIBIDO
É vedado ao Usuário:
6.1. Utilizar o Aplicativo para fins ilícitos ou contrários à missão e valores da Obra;
6.2. Compartilhar acesso ou dados de outros membros sem autorização;
6.3. Tentar acessar funcionalidades, contas ou dados de outros usuários sem permissão;
6.4. Introduzir vírus, malware ou qualquer código malicioso;
6.5. Realizar engenharia reversa, descompilar ou tentar extrair o código-fonte do Aplicativo;
6.6. Utilizar o Aplicativo para enviar spam ou comunicações não solicitadas.

7. DADOS PESSOAIS E PRIVACIDADE
O tratamento dos seus dados pessoais é regido pela nossa Política de Privacidade, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD). Ao aceitar estes Termos, você também aceita a Política de Privacidade.

8. COMUNICAÇÕES
8.1. Ao criar uma conta, você pode receber comunicados essenciais da Obra (avisos pastorais, organizacionais e operacionais).
8.2. Notificações de uso analítico são opcionais e podem ser recusadas ou revogadas a qualquer momento.

9. PROPRIEDADE INTELECTUAL
Todo o conteúdo do Aplicativo — incluindo textos, imagens, logotipos e software — é de propriedade da Obra Lumen de Evangelização ou licenciado por ela. É proibida a reprodução ou uso sem autorização expressa por escrito.

10. DISPONIBILIDADE DO SERVIÇO
10.1. A Obra não garante disponibilidade ininterrupta do Aplicativo.
10.2. Reserva-se o direito de suspender ou encerrar o Aplicativo com aviso prévio razoável.
10.3. Em caso de manutenção programada, serão feitas comunicações com antecedência quando possível.

11. LIMITAÇÃO DE RESPONSABILIDADE
A Obra não se responsabiliza por:
• Danos decorrentes de uso indevido do Aplicativo pelo Usuário;
• Interrupções do serviço por causas de força maior;
• Decisões tomadas com base em informações do Aplicativo.

12. SUSPENSÃO E ENCERRAMENTO
12.1. A Obra pode suspender ou encerrar o acesso do Usuário em caso de violação destes Termos.
12.2. O Usuário pode encerrar sua conta a qualquer momento solicitando a exclusão pelo Aplicativo ou por e-mail.
12.3. O encerramento não afeta as obrigações legais de retenção de dados previstas em lei.

13. ALTERAÇÕES DOS TERMOS
13.1. Estes Termos podem ser alterados pela Obra a qualquer momento.
13.2. Alterações relevantes serão comunicadas pelo Aplicativo com antecedência mínima de 15 dias.
13.3. O uso continuado após a vigência das alterações implica aceitação dos novos termos.

14. LEI APLICÁVEL E FORO
Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca da sede da Obra para dirimir eventuais controvérsias, com renúncia expressa a qualquer outro.

15. CONTATO
Em caso de dúvidas sobre estes Termos, entre em contato pelo e-mail: juridico@obralumen.org.br
"""

PRIVACY_V1 = """\
POLÍTICA DE PRIVACIDADE — LUMEN+
Versão 1.0 | Vigência: 19 de março de 2026
Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD)

1. CONTROLADOR DE DADOS
Obra Lumen de Evangelização
CNPJ: [INSERIR CNPJ]
Endereço: [INSERIR ENDEREÇO COMPLETO]
E-mail do Encarregado (DPO): privacidade@obralumen.org.br

2. DADOS PESSOAIS COLETADOS
Coletamos os seguintes dados pessoais:

2.1. Dados de identificação e cadastro:
• Nome completo
• Data de nascimento
• CPF (armazenado com criptografia AES-256)
• RG (armazenado com criptografia AES-256)
• Endereço de e-mail
• Número de telefone celular

2.2. Dados de vínculo comunitário:
• Estado de vida (leigo, seminarista, consagrado etc.)
• Estado civil
• Realidade vocacional
• Ministérios e grupos dos quais participa
• Ano de consagração (quando aplicável)

2.3. Dados de saúde e necessidades especiais (coletados para fins de segurança em eventos):
• Restrição alimentar (sim/não e descrição)
• Plano de saúde (sim/não e nome)
• Preferência de acomodação em retiros

2.4. Dados técnicos:
• Endereço IP (registrado no momento da aceitação dos termos)
• User-Agent do dispositivo
• Logs de acesso e auditoria (sem dados sensíveis)

2.5. Dados opcionais:
• Foto de perfil
• Instagram
• Informações sobre acompanhamento vocacional

3. FINALIDADE E BASE LEGAL DO TRATAMENTO

| Dado | Finalidade | Base Legal (LGPD) |
|------|-----------|------------------|
| Identificação (nome, e-mail) | Criação e gestão de conta | Art. 7º, V (execução de contrato) |
| CPF e RG | Verificação de identidade para fins pastorais | Art. 7º, I (consentimento) |
| Telefone | Comunicações e verificação de segurança | Art. 7º, V (execução de contrato) |
| Dados vocacionais | Acompanhamento pastoral personalizado | Art. 7º, I (consentimento) |
| Dados de saúde | Segurança em eventos e retiros | Art. 7º, I (consentimento) e Art. 11, II (tutela da saúde) |
| IP e User-Agent | Segurança e auditoria | Art. 7º, IX (legítimo interesse) |
| Analytics (opcional) | Melhoria do Aplicativo | Art. 7º, I (consentimento) |

4. DADOS SENSÍVEIS
CPF e RG são considerados dados pessoais que permitem identificação direta. Eles são armazenados com criptografia forte (AES-256-GCM) e acessíveis apenas por pessoal autorizado mediante processo formal de aprovação.

Dados de saúde (restrição alimentar, plano de saúde) são tratados como dados sensíveis conforme o Art. 11 da LGPD, coletados exclusivamente com seu consentimento explícito e utilizados apenas para fins de segurança em eventos da Obra.

5. COMPARTILHAMENTO DE DADOS
Seus dados pessoais NÃO são vendidos, alugados ou compartilhados com terceiros para fins comerciais.

Compartilhamos dados apenas com:
• Google Firebase (autenticação — processador de dados, com base no DPA do Firebase)
• Servidores de hospedagem na nuvem (armazenamento seguro dos dados)
• Autoridades competentes, quando exigido por lei ou ordem judicial

6. RETENÇÃO DE DADOS
• Dados de conta ativa: mantidos enquanto o Usuário for membro ativo da Obra
• Após exclusão de conta: dados de identificação anonimizados ou excluídos em até 30 dias
• Logs de auditoria: mantidos por 5 anos (legítimo interesse para segurança)
• CPF e RG: excluídos imediatamente após a exclusão da conta
• Dados de consentimento (registro de aceite dos termos): mantidos por 5 anos para cumprimento de obrigação legal

7. SEGURANÇA DOS DADOS
Adotamos medidas técnicas e organizacionais para proteger seus dados:
• CPF e RG: criptografia AES-256-GCM com chaves gerenciadas separadamente
• Transmissão: HTTPS/TLS em toda comunicação
• Autenticação: Firebase Authentication com verificação multifator disponível
• Acesso a dados sensíveis: requer aprovação formal e é auditado
• Logs de auditoria: sem registro de dados sensíveis em texto plano

8. SEUS DIREITOS (LGPD, art. 18)
Você tem direito a:

a) ACESSO: saber quais dados pessoais temos sobre você;
b) CORREÇÃO: corrigir dados incompletos, inexatos ou desatualizados;
c) ANONIMIZAÇÃO/BLOQUEIO/ELIMINAÇÃO: solicitar o bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade com a LGPD;
d) PORTABILIDADE: receber seus dados em formato estruturado;
e) ELIMINAÇÃO: excluir dados tratados com base no consentimento;
f) INFORMAÇÃO: ser informado sobre compartilhamento de dados com terceiros;
g) REVOGAÇÃO DO CONSENTIMENTO: retirar o consentimento a qualquer momento, sem prejuízo do tratamento já realizado;
h) OPOSIÇÃO: opor-se ao tratamento realizado com base em outras hipóteses legais, em caso de descumprimento da LGPD;
i) RECLAMAÇÃO: peticionar à Autoridade Nacional de Proteção de Dados (ANPD).

Para exercer qualquer desses direitos, contate nosso Encarregado (DPO):
E-mail: privacidade@obralumen.org.br
Prazo de resposta: até 15 dias úteis.

9. EXCLUSÃO DE CONTA
Você pode solicitar a exclusão da sua conta e dados a qualquer momento:
• Pelo Aplicativo: Perfil → Configurações → Excluir conta
• Por e-mail: privacidade@obralumen.org.br
A exclusão será processada em até 30 dias. Dados de auditoria e cumprimento de obrigações legais podem ser mantidos pelo período previsto em lei.

10. COOKIES E TECNOLOGIAS SIMILARES
O Aplicativo móvel não utiliza cookies. Dados de sessão são gerenciados pelo Firebase Authentication de forma segura.

11. MENORES DE IDADE
Não coletamos intencionalmente dados de menores de 18 anos sem consentimento dos responsáveis legais. Se identificarmos tal situação, os dados serão excluídos imediatamente. Responsáveis legais podem solicitar a exclusão de dados de menores pelo e-mail do DPO.

12. ALTERAÇÕES DESTA POLÍTICA
Alterações relevantes serão comunicadas pelo Aplicativo com antecedência mínima de 15 dias. A versão atual sempre estará disponível no Aplicativo e no site da Obra.

13. ENCARREGADO DE PROTEÇÃO DE DADOS (DPO)
Conforme o Art. 41 da LGPD, designamos um Encarregado pelo Tratamento de Dados:
Nome: [INSERIR NOME DO DPO]
E-mail: privacidade@obralumen.org.br
O Encarregado é o ponto de contato para titulares de dados e para a ANPD.

14. BASE TERRITORIAL
O Lumen+ opera exclusivamente em território brasileiro. Os dados são armazenados em servidores localizados no Brasil ou em países com nível de proteção equivalente, conforme Art. 33 da LGPD.

15. CONTATO
Dúvidas sobre esta Política de Privacidade:
E-mail: privacidade@obralumen.org.br
"""


def upgrade() -> None:
    conn = op.get_bind()

    for doc_type, content in [("TERMS", TERMS_V1), ("PRIVACY", PRIVACY_V1)]:
        existing = conn.execute(
            sa.text(
                "SELECT id FROM legal_documents WHERE type = :t AND version = '1.0'"
            ),
            {"t": doc_type},
        ).fetchone()

        if existing:
            conn.execute(
                sa.text(
                    "UPDATE legal_documents SET content = :c WHERE type = :t AND version = '1.0'"
                ),
                {"c": content, "t": doc_type},
            )
        else:
            conn.execute(
                sa.text(
                    "INSERT INTO legal_documents (id, type, version, content, published_at) "
                    "VALUES (:id, :type, :version, :content, :published_at)"
                ),
                {
                    "id": str(uuid.uuid4()),
                    "type": doc_type,
                    "version": "1.0",
                    "content": content,
                    "published_at": PUBLISHED_AT,
                },
            )


def downgrade() -> None:
    # Remove os documentos inseridos por esta migration
    op.execute(
        "DELETE FROM legal_documents WHERE version = '1.0' AND type IN ('TERMS', 'PRIVACY')"
    )
