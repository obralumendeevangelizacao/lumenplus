export type MisterioItem = { titulo: string; texto: string };
export type MisterioData = { label: string; emoji: string; cor: string; items: MisterioItem[] };

export const GOZOSOS: MisterioData = {
  label: 'Gozosos',
  emoji: '☀️',
  cor: '#f59e0b',
  items: [
    {
      titulo: '1º Mistério Gozoso — A Anunciação',
      texto: 'O Anjo Gabriel anuncia a Maria que ela será a Mãe do Salvador. Maria responde com total confiança: "Eis aqui a serva do Senhor; faça-se em mim segundo a tua palavra." (Lc 1, 38)',
    },
    {
      titulo: '2º Mistério Gozoso — A Visitação',
      texto: 'Maria visita sua prima Isabel, que estava grávida de João Batista. Ao ouvir a saudação de Maria, o menino saltou de alegria no seio de Isabel, que exclamou: "Bendita és tu entre as mulheres!" (Lc 1, 42)',
    },
    {
      titulo: '3º Mistério Gozoso — O Nascimento de Jesus',
      texto: 'Jesus nasce em Belém, numa manjedoura, por falta de lugar na hospedaria. Os anjos anunciam aos pastores: "Hoje, na cidade de Davi, nasceu para vós o Salvador, que é Cristo Senhor." (Lc 2, 11)',
    },
    {
      titulo: '4º Mistério Gozoso — A Apresentação no Templo',
      texto: 'Maria e José apresentam o Menino Jesus no Templo. O ancião Simeão proclama: "Agora, Senhor, podes deixar teu servo ir em paz, porque meus olhos viram a tua salvação." (Lc 2, 29-30)',
    },
    {
      titulo: '5º Mistério Gozoso — A Perda e o Achado de Jesus no Templo',
      texto: 'Aos doze anos, Jesus fica no Templo enquanto seus pais retornam para Nazaré. Após três dias de angústia, Maria e José o encontram entre os doutores, ouvindo-os e fazendo-lhes perguntas. (Lc 2, 46)',
    },
  ],
};

export const LUMINOSOS: MisterioData = {
  label: 'Luminosos',
  emoji: '✨',
  cor: '#3b82f6',
  items: [
    {
      titulo: '1º Mistério Luminoso — O Batismo no Jordão',
      texto: 'Jesus é batizado por João no Rio Jordão. O Espírito Santo desce sobre Ele em forma de pomba, e uma voz do céu proclama: "Este é o meu Filho amado, em quem me comprazo." (Mt 3, 17)',
    },
    {
      titulo: '2º Mistério Luminoso — As Bodas de Caná',
      texto: 'No casamento em Caná, Maria intercede junto a Jesus pela família que ficou sem vinho. Jesus transforma a água em vinho, realizando seu primeiro milagre e manifestando a sua glória. (Jo 2, 1-11)',
    },
    {
      titulo: '3º Mistério Luminoso — O Anúncio do Reino de Deus',
      texto: 'Jesus percorre a Galileia pregando: "Convertei-vos, porque o Reino dos Céus está próximo." Chama os primeiros discípulos e anuncia a Boa Nova a todos, especialmente aos pobres. (Mc 1, 14-15)',
    },
    {
      titulo: '4º Mistério Luminoso — A Transfiguração',
      texto: 'No Monte Tabor, Jesus se transfigura diante de Pedro, Tiago e João. Seu rosto resplandece como o sol e uma voz do céu diz: "Este é o meu Filho amado, ouvi-o." (Mt 17, 5)',
    },
    {
      titulo: '5º Mistério Luminoso — A Instituição da Eucaristia',
      texto: 'Na Última Ceia, Jesus toma o pão e o cálice e diz: "Tomai e comei, isto é o meu Corpo... Este é o cálice do meu Sangue." Institui a Eucaristia como memorial perene de sua entrega. (Lc 22, 19-20)',
    },
  ],
};

export const DOLOROSOS: MisterioData = {
  label: 'Dolorosos',
  emoji: '🕊️',
  cor: '#7c3aed',
  items: [
    {
      titulo: '1º Mistério Doloroso — A Agonia no Horto',
      texto: 'No Jardim das Oliveiras, Jesus ora em angústia: "Pai, se queres, afasta de mim este cálice! Contudo, não se faça a minha vontade, mas a tua." Um anjo aparece para confortá-lo. (Lc 22, 42-43)',
    },
    {
      titulo: '2º Mistério Doloroso — A Flagelação',
      texto: 'Jesus é preso, levado a Pilatos e condenado. É amarrado a uma coluna e flagelado pelos soldados romanos, cumprindo a profecia: "Pelas suas chagas fomos curados." (Is 53, 5)',
    },
    {
      titulo: '3º Mistério Doloroso — A Coroação de Espinhos',
      texto: 'Os soldados trançam uma coroa de espinhos e a impõem sobre a cabeça de Jesus, vestem-no com um manto vermelho e, em escárnio, dobram os joelhos diante dele dizendo: "Salve, Rei dos Judeus!" (Jo 19, 2-3)',
    },
    {
      titulo: '4º Mistério Doloroso — Jesus Carrega a Cruz',
      texto: 'Condenado à morte, Jesus carrega a pesada cruz pelo Caminho da Cruz até o Calvário. Cai várias vezes sob o peso. Simão de Cirene é obrigado a ajudá-lo a carregar a cruz. (Lc 23, 26)',
    },
    {
      titulo: '5º Mistério Doloroso — A Crucificação e Morte',
      texto: 'Jesus é pregado na cruz entre dois ladrões no Gólgota. Após três horas de agonia, entrega seu espírito ao Pai: "Pai, nas tuas mãos entrego o meu espírito." O véu do Templo rasga-se ao meio. (Lc 23, 46)',
    },
  ],
};

export const GLORIOSOS: MisterioData = {
  label: 'Gloriosos',
  emoji: '👑',
  cor: '#d97706',
  items: [
    {
      titulo: '1º Mistério Glorioso — A Ressurreição',
      texto: 'No terceiro dia, Jesus ressuscita dos mortos conforme as Escrituras. As mulheres vão ao sepulcro e encontram-no vazio. O Anjo anuncia: "Não está aqui, ressuscitou!" (Lc 24, 6)',
    },
    {
      titulo: '2º Mistério Glorioso — A Ascensão',
      texto: 'Quarenta dias após a Ressurreição, Jesus sobe ao Céu à vista dos discípulos no Monte das Oliveiras. Prometendo enviar o Espírito Santo, é elevado e uma nuvem o subtrai aos seus olhos. (At 1, 9)',
    },
    {
      titulo: '3º Mistério Glorioso — A Vinda do Espírito Santo',
      texto: 'No dia de Pentecostes, o Espírito Santo desce sobre Maria e os Apóstolos reunidos no cenáculo, em forma de línguas de fogo. Todos ficam cheios do Espírito Santo e começam a pregar. (At 2, 1-4)',
    },
    {
      titulo: '4º Mistério Glorioso — A Assunção de Maria',
      texto: 'Ao fim de sua vida terrena, Maria é assunta em corpo e alma ao Céu. Ela que foi digna de conceber o Filho de Deus é elevada à glória celeste como Rainha de todos os santos e anjos.',
    },
    {
      titulo: '5º Mistério Glorioso — A Coroação de Maria',
      texto: 'Maria é coroada Rainha do Céu e da Terra pela Santíssima Trindade. Ela intercede por nós como Mãe de misericórdia e advogada dos pecadores, até que todos seus filhos cheguem à pátria celestial.',
    },
  ],
};

export const MISTERIO_POR_DIA: Record<number, MisterioData> = {
  0: GLORIOSOS,
  1: GOZOSOS,
  2: DOLOROSOS,
  3: GLORIOSOS,
  4: LUMINOSOS,
  5: DOLOROSOS,
  6: GOZOSOS,
};

export const DIAS_SEMANA = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];
