export type Oracao = { id: string; titulo: string; texto: string };

const PAI_NOSSO = 'Pai nosso que estais no céu,\nsantificado seja o vosso nome,\nvenha a nós o vosso reino,\nseja feita a vossa vontade,\nassim na terra como no céu.\n\nO pão nosso de cada dia nos dai hoje,\nperdoai-nos as nossas ofensas,\nassim como nós perdoamos a quem nos tem ofendido,\ne não nos deixeis cair em tentação,\nmas livrai-nos do mal.\nAmém.';

const AVE_MARIA = 'Ave Maria, cheia de graça,\no Senhor é convosco,\nbendita sois vós entre as mulheres\ne bendito é o fruto do vosso ventre, Jesus.\n\nSanta Maria, Mãe de Deus,\nrogai por nós, pecadores,\nagora e na hora da nossa morte.\nAmém.';

const GLORIA = 'Glória ao Pai, ao Filho e ao Espírito Santo,\ncomo era no princípio, agora e sempre,\npor todos os séculos dos séculos.\nAmém.';

const FATIMA = 'Ó meu Jesus, perdoai-nos, livrai-nos do fogo do inferno,\nlevai as almas todas para o Céu,\nespecialmente as que mais precisarem da vossa misericórdia.\nAmém.';

const SALVE_RAINHA = 'Salve Rainha, Mãe de misericórdia,\nvida, doçura e esperança nossa, salve!\n\nA vós bradamos, os degredados filhos de Eva;\na vós suspiramos, gemendo e chorando\nneste vale de lágrimas.\n\nEia, pois, advogada nossa,\nessas vossas misericordiosas vistas a nós volveis,\ne depois deste desterro,\nmostrai-nos Jesus, fruto bendito do vosso ventre.\n\nÓ clemente, ó piedosa,\nó doce sempre Virgem Maria!\nAmém.';

const CREDO = 'Creio em Deus Pai todo-poderoso,\nCriador do céu e da terra.\n\nCreio em Jesus Cristo,\nseu único Filho, nosso Senhor,\nque foi concebido pelo poder do Espírito Santo,\nnasceu da Virgem Maria,\npadeceu sob Pôncio Pilatos,\nfoi crucificado, morto e sepultado,\ndesceu à mansão dos mortos,\nressuscitou ao terceiro dia,\nsubiu aos céus,\nestá sentado à direita de Deus Pai todo-poderoso,\nonde há de vir a julgar os vivos e os mortos.\n\nCreio no Espírito Santo,\nna santa Igreja Católica,\nna comunhão dos santos,\nna remissão dos pecados,\nna ressurreição da carne,\nna vida eterna.\nAmém.';

const CONFITEOR = 'Confesso a Deus todo-poderoso,\ne a vós, irmãos,\nque pequei muitas vezes\npor pensamentos e palavras,\natos e omissões,\npor minha culpa, minha culpa,\nminha tão grande culpa.\n\nE peço à Virgem Maria,\naos anjos e santos,\ne a vós, irmãos,\nque rogueis por mim\na Deus, nosso Senhor.\nAmém.';

export const ORACOES: Oracao[] = [
  { id: 'pai-nosso', titulo: 'Pai Nosso', texto: PAI_NOSSO },
  { id: 'ave-maria', titulo: 'Ave Maria', texto: AVE_MARIA },
  { id: 'gloria', titulo: 'Glória', texto: GLORIA },
  { id: 'fatima', titulo: 'Oração de Fátima', texto: FATIMA },
  { id: 'salve-rainha', titulo: 'Salve Rainha', texto: SALVE_RAINHA },
  { id: 'credo', titulo: 'Credo Apostólico', texto: CREDO },
  { id: 'confiteor', titulo: 'Confiteor', texto: CONFITEOR },
];

// TODO: Adicionar orações personalizadas da Obra Lumen
export const ORACOES_LUMEN: Oracao[] = [];
