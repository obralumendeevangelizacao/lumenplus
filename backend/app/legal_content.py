"""
Conteúdo canônico dos documentos legais.
=========================================
Fonte única de verdade para Termos de Uso e Política de Privacidade.
Importado pelas migrations e pelo seed de dev.

ATENÇÃO: Qualquer alteração de texto aqui requer:
  1. Bump de versão (ex: "1.0" → "1.1")
  2. Nova migration que insira o documento com a nova versão
  3. Os usuários serão solicitados a aceitar novamente via /auth/me (pending_terms/pending_privacy)
"""

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
CNPJ: 19.614.384/0001-60
Endereço: Rua Coronel Jucá, 2040, Meireles, Fortaleza/CE, 60170-320
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

Identificação (nome, e-mail): Criação e gestão de conta | Base: Art. 7º, V (execução de contrato)
CPF e RG: Verificação de identidade para fins pastorais | Base: Art. 7º, I (consentimento)
Telefone: Comunicações e verificação de segurança | Base: Art. 7º, V (execução de contrato)
Dados vocacionais: Acompanhamento pastoral personalizado | Base: Art. 7º, I (consentimento)
Dados de saúde: Segurança em eventos e retiros | Base: Art. 7º, I (consentimento) e Art. 11, II (tutela da saúde)
IP e User-Agent: Segurança e auditoria | Base: Art. 7º, IX (legítimo interesse)
Analytics (opcional): Melhoria do Aplicativo | Base: Art. 7º, I (consentimento)

4. DADOS SENSÍVEIS
CPF e RG são armazenados com criptografia forte (AES-256-GCM) e acessíveis apenas por pessoal autorizado mediante processo formal de aprovação.

Dados de saúde são tratados como dados sensíveis conforme o Art. 11 da LGPD, coletados exclusivamente com seu consentimento explícito e utilizados apenas para fins de segurança em eventos da Obra.

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
• Dados de consentimento: mantidos por 5 anos para cumprimento de obrigação legal

7. SEGURANÇA DOS DADOS
Adotamos medidas técnicas e organizacionais para proteger seus dados:
• CPF e RG: criptografia AES-256-GCM com chaves gerenciadas separadamente
• Transmissão: HTTPS/TLS em toda comunicação
• Autenticação: Firebase Authentication com verificação disponível
• Acesso a dados sensíveis: requer aprovação formal e é auditado
• Logs de auditoria: sem registro de dados sensíveis em texto plano

8. SEUS DIREITOS (LGPD, art. 18)
Você tem direito a:

a) ACESSO: saber quais dados pessoais temos sobre você;
b) CORREÇÃO: corrigir dados incompletos, inexatos ou desatualizados;
c) ANONIMIZAÇÃO/BLOQUEIO/ELIMINAÇÃO: solicitar o bloqueio ou eliminação de dados desnecessários;
d) PORTABILIDADE: receber seus dados em formato estruturado;
e) ELIMINAÇÃO: excluir dados tratados com base no consentimento;
f) INFORMAÇÃO: ser informado sobre compartilhamento de dados com terceiros;
g) REVOGAÇÃO DO CONSENTIMENTO: retirar o consentimento a qualquer momento;
h) OPOSIÇÃO: opor-se ao tratamento em caso de descumprimento da LGPD;
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
Não coletamos intencionalmente dados de menores de 18 anos sem consentimento dos responsáveis legais. Se identificarmos tal situação, os dados serão excluídos imediatamente.

12. ALTERAÇÕES DESTA POLÍTICA
Alterações relevantes serão comunicadas pelo Aplicativo com antecedência mínima de 15 dias.

13. ENCARREGADO DE PROTEÇÃO DE DADOS (DPO)
Conforme o Art. 41 da LGPD, a Obra Lumen de Evangelização está em processo de designação formal do Encarregado pelo Tratamento de Dados. Enquanto isso, o canal de contato para exercício de direitos dos titulares é:
E-mail: privacidade@obralumen.org.br
Prazo de resposta: até 15 dias úteis.

14. BASE TERRITORIAL
O Lumen+ opera exclusivamente em território brasileiro. Os dados são armazenados em servidores localizados no Brasil ou em países com nível de proteção equivalente, conforme Art. 33 da LGPD.

15. CONTATO
Dúvidas sobre esta Política de Privacidade:
E-mail: privacidade@obralumen.org.br
"""

# v1.1 — mesmo conteúdo da v1.0, versão bumped para forçar re-aceitação de todos os usuários
# (substitui texto placeholder que pôde ter sido aceito antes da migration 009)
TERMS_V1_1 = TERMS_V1.replace("Versão 1.0", "Versão 1.1")
PRIVACY_V1_1 = PRIVACY_V1.replace("Versão 1.0", "Versão 1.1")

# v1.2 — textos definitivos com CNPJ, endereço e situação real do DPO preenchidos
# (v1.0 e v1.1 tinham placeholders "[INSERIR ...]")
TERMS_V1_2 = TERMS_V1.replace("Versão 1.0", "Versão 1.2")
PRIVACY_V1_2 = PRIVACY_V1.replace("Versão 1.0", "Versão 1.2")
