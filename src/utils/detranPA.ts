import { LicenciamentoPA, DetranCalendarEntry } from '../types';

/**
 * Tabela Oficial de Licenciamento Anual e IPVA do DETRAN-PA / SEFA-PA (Estado do Pará)
 * Baseada no Calendário Oficial de Vencimentos do IPVA e Licenciamento 2026.
 *
 * Estrutura Oficial:
 * - Coluna 1: Final de Placa (1, 2, 3, 4, 5, 6, 7, 8, 9, 0)
 * - Coluna 2: Variação das terminações de cada placa:
 *     Para cada dígito D (1..0), divide-se em 3 faixas de dezenas:
 *       • 0D - 3D (ex: 01-31, 02-32, ..., 00-30) -> terminações 0D, 1D, 2D, 3D
 *       • 4D - 6D (ex: 41-61, 42-62, ..., 40-60) -> terminações 4D, 5D, 6D
 *       • 7D - 9D (ex: 71-91, 72-92, ..., 70-90) -> terminações 7D, 8D, 9D
 * - Coluna 3: Data do Licenciamento 2026 (Prazo final / 3ª Cota)
 * - Coluna 4: Antecipação 2026 - IPVA Cidadão Cota Única (Com desconto de Bom Condutor)
 * - Coluna 5: Parcelamento sem desconto em 3 parcelas (1ª Cota, 2ª Cota, 3ª Cota)
 */
export interface DetranPARule {
  finalPlaca: string; // '1', '2', ..., '9', '0'
  grupoFinal: string; // '01 - 31', '41 - 61', '71 - 91', etc.
  descricaoFinais: string; // 'Finais 01 a 31'
  finais: string[]; // Lista explícita de dezenas ex: ['01', '11', '21', '31']
  mesReferencia: string;
  dataLicenciamento: string; // YYYY-MM-DD
  dataCotaUnica: string; // YYYY-MM-DD
  cota1Parcelamento: string; // YYYY-MM-DD
  cota2Parcelamento: string; // YYYY-MM-DD
  cota3Parcelamento: string; // YYYY-MM-DD
  dataExemploLicenciamento: string; // '06/mar'
  dataExemploCotaUnica: string; // '06/jan'
}

/**
 * Tabela Oficial Completa com as 30 faixas regulamentadas pela SEFA-PA e DETRAN-PA
 */
export const DETRAN_PA_CALENDARIO_2026: DetranPARule[] = [
  // FINAL 1
  {
    finalPlaca: '1',
    grupoFinal: '01 - 31',
    descricaoFinais: 'Finais 01 a 31 (01, 11, 21, 31)',
    finais: ['01', '11', '21', '31'],
    mesReferencia: 'Março',
    dataLicenciamento: '2026-03-06',
    dataCotaUnica: '2026-01-06',
    cota1Parcelamento: '2026-01-06',
    cota2Parcelamento: '2026-02-06',
    cota3Parcelamento: '2026-03-06',
    dataExemploLicenciamento: '06/mar',
    dataExemploCotaUnica: '06/jan',
  },
  {
    finalPlaca: '1',
    grupoFinal: '41 - 61',
    descricaoFinais: 'Finais 41 a 61 (41, 51, 61)',
    finais: ['41', '51', '61'],
    mesReferencia: 'Março',
    dataLicenciamento: '2026-03-13',
    dataCotaUnica: '2026-01-13',
    cota1Parcelamento: '2026-01-13',
    cota2Parcelamento: '2026-02-13',
    cota3Parcelamento: '2026-03-13',
    dataExemploLicenciamento: '13/mar',
    dataExemploCotaUnica: '13/jan',
  },
  {
    finalPlaca: '1',
    grupoFinal: '71 - 91',
    descricaoFinais: 'Finais 71 a 91 (71, 81, 91)',
    finais: ['71', '81', '91'],
    mesReferencia: 'Março',
    dataLicenciamento: '2026-03-20',
    dataCotaUnica: '2026-01-20',
    cota1Parcelamento: '2026-01-20',
    cota2Parcelamento: '2026-02-20',
    cota3Parcelamento: '2026-03-20',
    dataExemploLicenciamento: '20/mar',
    dataExemploCotaUnica: '20/jan',
  },

  // FINAL 2
  {
    finalPlaca: '2',
    grupoFinal: '02 - 32',
    descricaoFinais: 'Finais 02 a 32 (02, 12, 22, 32)',
    finais: ['02', '12', '22', '32'],
    mesReferencia: 'Março',
    dataLicenciamento: '2026-03-27',
    dataCotaUnica: '2026-01-27',
    cota1Parcelamento: '2026-01-27',
    cota2Parcelamento: '2026-02-27',
    cota3Parcelamento: '2026-03-27',
    dataExemploLicenciamento: '27/mar',
    dataExemploCotaUnica: '27/jan',
  },
  {
    finalPlaca: '2',
    grupoFinal: '42 - 62',
    descricaoFinais: 'Finais 42 a 62 (42, 52, 62)',
    finais: ['42', '52', '62'],
    mesReferencia: 'Abril',
    dataLicenciamento: '2026-04-10',
    dataCotaUnica: '2026-02-10',
    cota1Parcelamento: '2026-02-10',
    cota2Parcelamento: '2026-03-10',
    cota3Parcelamento: '2026-04-10',
    dataExemploLicenciamento: '10/abr',
    dataExemploCotaUnica: '10/fev',
  },
  {
    finalPlaca: '2',
    grupoFinal: '72 - 92',
    descricaoFinais: 'Finais 72 a 92 (72, 82, 92)',
    finais: ['72', '82', '92'],
    mesReferencia: 'Abril',
    dataLicenciamento: '2026-04-17',
    dataCotaUnica: '2026-02-19',
    cota1Parcelamento: '2026-02-19',
    cota2Parcelamento: '2026-03-17',
    cota3Parcelamento: '2026-04-17',
    dataExemploLicenciamento: '17/abr',
    dataExemploCotaUnica: '19/fev',
  },

  // FINAL 3
  {
    finalPlaca: '3',
    grupoFinal: '03 - 33',
    descricaoFinais: 'Finais 03 a 33 (03, 13, 23, 33)',
    finais: ['03', '13', '23', '33'],
    mesReferencia: 'Abril',
    dataLicenciamento: '2026-04-24',
    dataCotaUnica: '2026-02-24',
    cota1Parcelamento: '2026-02-24',
    cota2Parcelamento: '2026-03-24',
    cota3Parcelamento: '2026-04-24',
    dataExemploLicenciamento: '24/abr',
    dataExemploCotaUnica: '24/fev',
  },
  {
    finalPlaca: '3',
    grupoFinal: '43 - 63',
    descricaoFinais: 'Finais 43 a 63 (43, 53, 63)',
    finais: ['43', '53', '63'],
    mesReferencia: 'Maio',
    dataLicenciamento: '2026-05-08',
    dataCotaUnica: '2026-03-09',
    cota1Parcelamento: '2026-03-09',
    cota2Parcelamento: '2026-04-08',
    cota3Parcelamento: '2026-05-08',
    dataExemploLicenciamento: '08/mai',
    dataExemploCotaUnica: '09/mar',
  },
  {
    finalPlaca: '3',
    grupoFinal: '73 - 93',
    descricaoFinais: 'Finais 73 a 93 (73, 83, 93)',
    finais: ['73', '83', '93'],
    mesReferencia: 'Maio',
    dataLicenciamento: '2026-05-15',
    dataCotaUnica: '2026-03-16',
    cota1Parcelamento: '2026-03-16',
    cota2Parcelamento: '2026-04-15',
    cota3Parcelamento: '2026-05-15',
    dataExemploLicenciamento: '15/mai',
    dataExemploCotaUnica: '16/mar',
  },

  // FINAL 4
  {
    finalPlaca: '4',
    grupoFinal: '04 - 34',
    descricaoFinais: 'Finais 04 a 34 (04, 14, 24, 34)',
    finais: ['04', '14', '24', '34'],
    mesReferencia: 'Maio',
    dataLicenciamento: '2026-05-22',
    dataCotaUnica: '2026-03-23',
    cota1Parcelamento: '2026-03-23',
    cota2Parcelamento: '2026-04-22',
    cota3Parcelamento: '2026-05-22',
    dataExemploLicenciamento: '22/mai',
    dataExemploCotaUnica: '23/mar',
  },
  {
    finalPlaca: '4',
    grupoFinal: '44 - 64',
    descricaoFinais: 'Finais 44 a 64 (44, 54, 64)',
    finais: ['44', '54', '64'],
    mesReferencia: 'Maio',
    dataLicenciamento: '2026-05-29',
    dataCotaUnica: '2026-03-30',
    cota1Parcelamento: '2026-03-30',
    cota2Parcelamento: '2026-04-29',
    cota3Parcelamento: '2026-05-29',
    dataExemploLicenciamento: '29/mai',
    dataExemploCotaUnica: '30/mar',
  },
  {
    finalPlaca: '4',
    grupoFinal: '74 - 94',
    descricaoFinais: 'Finais 74 a 94 (74, 84, 94)',
    finais: ['74', '84', '94'],
    mesReferencia: 'Junho',
    dataLicenciamento: '2026-06-12',
    dataCotaUnica: '2026-04-13',
    cota1Parcelamento: '2026-04-13',
    cota2Parcelamento: '2026-05-12',
    cota3Parcelamento: '2026-06-12',
    dataExemploLicenciamento: '12/jun',
    dataExemploCotaUnica: '13/abr',
  },

  // FINAL 5
  {
    finalPlaca: '5',
    grupoFinal: '05 - 35',
    descricaoFinais: 'Finais 05 a 35 (05, 15, 25, 35)',
    finais: ['05', '15', '25', '35'],
    mesReferencia: 'Junho',
    dataLicenciamento: '2026-06-19',
    dataCotaUnica: '2026-04-20',
    cota1Parcelamento: '2026-04-20',
    cota2Parcelamento: '2026-05-19',
    cota3Parcelamento: '2026-06-19',
    dataExemploLicenciamento: '19/jun',
    dataExemploCotaUnica: '20/abr',
  },
  {
    finalPlaca: '5',
    grupoFinal: '45 - 65',
    descricaoFinais: 'Finais 45 a 65 (45, 55, 65)',
    finais: ['45', '55', '65'],
    mesReferencia: 'Junho',
    dataLicenciamento: '2026-06-26',
    dataCotaUnica: '2026-04-27',
    cota1Parcelamento: '2026-04-27',
    cota2Parcelamento: '2026-05-26',
    cota3Parcelamento: '2026-06-26',
    dataExemploLicenciamento: '26/jun',
    dataExemploCotaUnica: '27/abr',
  },
  {
    finalPlaca: '5',
    grupoFinal: '75 - 95',
    descricaoFinais: 'Finais 75 a 95 (75, 85, 95)',
    finais: ['75', '85', '95'],
    mesReferencia: 'Julho',
    dataLicenciamento: '2026-07-03',
    dataCotaUnica: '2026-05-04',
    cota1Parcelamento: '2026-05-04',
    cota2Parcelamento: '2026-06-03',
    cota3Parcelamento: '2026-07-03',
    dataExemploLicenciamento: '03/jul',
    dataExemploCotaUnica: '04/mai',
  },

  // FINAL 6
  {
    finalPlaca: '6',
    grupoFinal: '06 - 36',
    descricaoFinais: 'Finais 06 a 36 (06, 16, 26, 36)',
    finais: ['06', '16', '26', '36'],
    mesReferencia: 'Julho',
    dataLicenciamento: '2026-07-10',
    dataCotaUnica: '2026-05-11',
    cota1Parcelamento: '2026-05-11',
    cota2Parcelamento: '2026-06-10',
    cota3Parcelamento: '2026-07-10',
    dataExemploLicenciamento: '10/jul',
    dataExemploCotaUnica: '11/mai',
  },
  {
    finalPlaca: '6',
    grupoFinal: '46 - 66',
    descricaoFinais: 'Finais 46 a 66 (46, 56, 66)',
    finais: ['46', '56', '66'],
    mesReferencia: 'Julho',
    dataLicenciamento: '2026-07-17',
    dataCotaUnica: '2026-05-18',
    cota1Parcelamento: '2026-05-18',
    cota2Parcelamento: '2026-06-17',
    cota3Parcelamento: '2026-07-17',
    dataExemploLicenciamento: '17/jul',
    dataExemploCotaUnica: '18/mai',
  },
  {
    finalPlaca: '6',
    grupoFinal: '76 - 96',
    descricaoFinais: 'Finais 76 a 96 (76, 86, 96)',
    finais: ['76', '86', '96'],
    mesReferencia: 'Agosto',
    dataLicenciamento: '2026-08-07',
    dataCotaUnica: '2026-06-08',
    cota1Parcelamento: '2026-06-08',
    cota2Parcelamento: '2026-07-07',
    cota3Parcelamento: '2026-08-07',
    dataExemploLicenciamento: '07/ago',
    dataExemploCotaUnica: '08/jun',
  },

  // FINAL 7
  {
    finalPlaca: '7',
    grupoFinal: '07 - 37',
    descricaoFinais: 'Finais 07 a 37 (07, 17, 27, 37)',
    finais: ['07', '17', '27', '37'],
    mesReferencia: 'Agosto',
    dataLicenciamento: '2026-08-14',
    dataCotaUnica: '2026-06-15',
    cota1Parcelamento: '2026-06-15',
    cota2Parcelamento: '2026-07-14',
    cota3Parcelamento: '2026-08-14',
    dataExemploLicenciamento: '14/ago',
    dataExemploCotaUnica: '15/jun',
  },
  {
    finalPlaca: '7',
    grupoFinal: '47 - 67',
    descricaoFinais: 'Finais 47 a 67 (47, 57, 67)',
    finais: ['47', '57', '67'],
    mesReferencia: 'Agosto',
    dataLicenciamento: '2026-08-21',
    dataCotaUnica: '2026-06-22',
    cota1Parcelamento: '2026-06-22',
    cota2Parcelamento: '2026-07-21',
    cota3Parcelamento: '2026-08-21',
    dataExemploLicenciamento: '21/ago',
    dataExemploCotaUnica: '22/jun',
  },
  {
    finalPlaca: '7',
    grupoFinal: '77 - 97',
    descricaoFinais: 'Finais 77 a 97 (77, 87, 97)',
    finais: ['77', '87', '97'],
    mesReferencia: 'Agosto',
    dataLicenciamento: '2026-08-28',
    dataCotaUnica: '2026-06-29',
    cota1Parcelamento: '2026-06-29',
    cota2Parcelamento: '2026-07-28',
    cota3Parcelamento: '2026-08-28',
    dataExemploLicenciamento: '28/ago',
    dataExemploCotaUnica: '29/jun',
  },

  // FINAL 8
  {
    finalPlaca: '8',
    grupoFinal: '08 - 38',
    descricaoFinais: 'Finais 08 a 38 (08, 18, 28, 38)',
    finais: ['08', '18', '28', '38'],
    mesReferencia: 'Setembro',
    dataLicenciamento: '2026-09-04',
    dataCotaUnica: '2026-07-06',
    cota1Parcelamento: '2026-07-06',
    cota2Parcelamento: '2026-08-04',
    cota3Parcelamento: '2026-09-04',
    dataExemploLicenciamento: '04/set',
    dataExemploCotaUnica: '06/jul',
  },
  {
    finalPlaca: '8',
    grupoFinal: '48 - 68',
    descricaoFinais: 'Finais 48 a 68 (48, 58, 68)',
    finais: ['48', '58', '68'],
    mesReferencia: 'Setembro',
    dataLicenciamento: '2026-09-11',
    dataCotaUnica: '2026-07-13',
    cota1Parcelamento: '2026-07-13',
    cota2Parcelamento: '2026-08-11',
    cota3Parcelamento: '2026-09-11',
    dataExemploLicenciamento: '11/set',
    dataExemploCotaUnica: '13/jul',
  },
  {
    finalPlaca: '8',
    grupoFinal: '78 - 98',
    descricaoFinais: 'Finais 78 a 98 (78, 88, 98)',
    finais: ['78', '88', '98'],
    mesReferencia: 'Setembro',
    dataLicenciamento: '2026-09-18',
    dataCotaUnica: '2026-07-20',
    cota1Parcelamento: '2026-07-20',
    cota2Parcelamento: '2026-08-18',
    cota3Parcelamento: '2026-09-18',
    dataExemploLicenciamento: '18/set',
    dataExemploCotaUnica: '20/jul',
  },

  // FINAL 9
  {
    finalPlaca: '9',
    grupoFinal: '09 - 39',
    descricaoFinais: 'Finais 09 a 39 (09, 19, 29, 39)',
    finais: ['09', '19', '29', '39'],
    mesReferencia: 'Setembro',
    dataLicenciamento: '2026-09-25',
    dataCotaUnica: '2026-07-27',
    cota1Parcelamento: '2026-07-27',
    cota2Parcelamento: '2026-08-25',
    cota3Parcelamento: '2026-09-25',
    dataExemploLicenciamento: '25/set',
    dataExemploCotaUnica: '27/jul',
  },
  {
    finalPlaca: '9',
    grupoFinal: '49 - 69',
    descricaoFinais: 'Finais 49 a 69 (49, 59, 69)',
    finais: ['49', '59', '69'],
    mesReferencia: 'Outubro',
    dataLicenciamento: '2026-10-02',
    dataCotaUnica: '2026-08-03',
    cota1Parcelamento: '2026-08-03',
    cota2Parcelamento: '2026-09-02',
    cota3Parcelamento: '2026-10-02',
    dataExemploLicenciamento: '02/out',
    dataExemploCotaUnica: '03/ago',
  },
  {
    finalPlaca: '9',
    grupoFinal: '79 - 99',
    descricaoFinais: 'Finais 79 a 99 (79, 89, 99)',
    finais: ['79', '89', '99'],
    mesReferencia: 'Outubro',
    dataLicenciamento: '2026-10-16',
    dataCotaUnica: '2026-08-17',
    cota1Parcelamento: '2026-08-17',
    cota2Parcelamento: '2026-09-16',
    cota3Parcelamento: '2026-10-16',
    dataExemploLicenciamento: '16/out',
    dataExemploCotaUnica: '17/ago',
  },

  // FINAL 0
  {
    finalPlaca: '0',
    grupoFinal: '00 - 30',
    descricaoFinais: 'Finais 00 a 30 (00, 10, 20, 30)',
    finais: ['00', '10', '20', '30'],
    mesReferencia: 'Outubro',
    dataLicenciamento: '2026-10-23',
    dataCotaUnica: '2026-08-24',
    cota1Parcelamento: '2026-08-24',
    cota2Parcelamento: '2026-09-23',
    cota3Parcelamento: '2026-10-23',
    dataExemploLicenciamento: '23/out',
    dataExemploCotaUnica: '24/ago',
  },
  {
    finalPlaca: '0',
    grupoFinal: '40 - 60',
    descricaoFinais: 'Finais 40 a 60 (40, 50, 60)',
    finais: ['40', '50', '60'],
    mesReferencia: 'Novembro',
    dataLicenciamento: '2026-11-06',
    dataCotaUnica: '2026-09-08',
    cota1Parcelamento: '2026-09-08',
    cota2Parcelamento: '2026-10-06',
    cota3Parcelamento: '2026-11-06',
    dataExemploLicenciamento: '06/nov',
    dataExemploCotaUnica: '08/set',
  },
  {
    finalPlaca: '0',
    grupoFinal: '70 - 90',
    descricaoFinais: 'Finais 70 a 90 (70, 80, 90)',
    finais: ['70', '80', '90'],
    mesReferencia: 'Novembro',
    dataLicenciamento: '2026-11-13',
    dataCotaUnica: '2026-09-14',
    cota1Parcelamento: '2026-09-14',
    cota2Parcelamento: '2026-10-13',
    cota3Parcelamento: '2026-11-13',
    dataExemploLicenciamento: '13/nov',
    dataExemploCotaUnica: '14/set',
  },
];

// Compatibilidade de nome
export const DETRAN_PA_CALENDARIO = DETRAN_PA_CALENDARIO_2026;

/**
 * Retorna as 30 entradas oficiais prontas para o armazenamento configurável do sistema.
 */
export function getDefaultDetranCalendar(exercicio = 2026): DetranCalendarEntry[] {
  return DETRAN_PA_CALENDARIO_2026.map((rule, idx) => {
    const adjustYear = (dateStr: string) => dateStr.replace(/^2026/, String(exercicio));
    return {
      id: `cal-detran-${idx + 1}`,
      finalPlaca: rule.finalPlaca,
      grupoFinal: rule.grupoFinal,
      descricaoFinais: rule.descricaoFinais,
      mesReferencia: rule.mesReferencia,
      dataLicenciamento: adjustYear(rule.dataLicenciamento),
      dataLimite: adjustYear(rule.dataLicenciamento),
      dataCotaUnica: adjustYear(rule.dataCotaUnica),
      data15Desc: adjustYear(rule.dataCotaUnica),
      data10Desc: adjustYear(rule.dataCotaUnica),
      cota1Parcelamento: adjustYear(rule.cota1Parcelamento),
      cota2Parcelamento: adjustYear(rule.cota2Parcelamento),
      cota3Parcelamento: adjustYear(rule.cota3Parcelamento),
      finaisAceitos: rule.finais,
      observacoes: `Portaria SEFA-PA / DETRAN-PA ${exercicio} • Final ${rule.finalPlaca} [${rule.grupoFinal}]`,
    };
  });
}

/**
 * Extrai os dois últimos dígitos e o último dígito de uma placa (padrão antigo ou Mercosul).
 * Ex: QEN4521 -> final 21 (dois dígitos), final 1 (simples).
 * Ex: BRA2E19 -> final 19 (dois dígitos), final 9 (simples).
 */
export function extrairDigitosPlaca(placa: string): { doisDigitos: string; finalSimples: string } {
  const limpa = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const apenasNumeros = limpa.replace(/[^0-9]/g, '');

  if (apenasNumeros.length >= 2) {
    const doisDigitos = apenasNumeros.slice(-2);
    const finalSimples = apenasNumeros.slice(-1);
    return { doisDigitos, finalSimples };
  } else if (apenasNumeros.length === 1) {
    return { doisDigitos: '0' + apenasNumeros, finalSimples: apenasNumeros };
  }
  return { doisDigitos: '01', finalSimples: '1' };
}

/**
 * Determina o grupo da placa baseado no último dígito e na dezena.
 * Cada dígito (1, 2, ..., 0) possui 3 variações de terminações:
 * - Dezenas 0, 1, 2, 3 -> '0D - 3D'
 * - Dezenas 4, 5, 6    -> '4D - 6D'
 * - Dezenas 7, 8, 9    -> '7D - 9D'
 */
export function obterGrupoTerminacao(doisDigitosStr: string): { finalPlaca: string; grupoTerminacao: string } {
  const numPadded = doisDigitosStr.padStart(2, '0');
  const finalPlaca = numPadded.slice(-1);
  const dezena = parseInt(numPadded.charAt(0), 10);

  let faixa = '';
  if (dezena >= 0 && dezena <= 3) {
    faixa = `0${finalPlaca} - 3${finalPlaca}`;
  } else if (dezena >= 4 && dezena <= 6) {
    faixa = `4${finalPlaca} - 6${finalPlaca}`;
  } else {
    faixa = `7${finalPlaca} - 9${finalPlaca}`;
  }

  return { finalPlaca, grupoTerminacao: faixa };
}

/**
 * Determina a data limite oficial do DETRAN-PA de acordo com a tabela do IPVA 2026.
 */
export function calcularRegraDetranPA(
  doisDigitosStr: string,
  exercicio = 2026,
  customCalendar?: DetranCalendarEntry[]
): {
  finalPlaca: string;
  grupoFinal: string;
  mesVencimento: string;
  dataLimite: string;
  dataCotaUnica: string;
  data15Desc: string;
  data10Desc: string;
  dataSemDesc: string;
  cota1Parcelamento: string;
  cota2Parcelamento: string;
  cota3Parcelamento: string;
} {
  const numPadded = doisDigitosStr.padStart(2, '0');
  const { finalPlaca, grupoTerminacao } = obterGrupoTerminacao(numPadded);

  // 1. Se houver calendário customizado ativo no sistema (ex: editado pelo usuário em Configurações)
  if (customCalendar && customCalendar.length > 0) {
    // 1.1 Match direto pelo array de finais aceitos (ex: ['01', '11', '21', '31'])
    const directMatch = customCalendar.find(c => c.finaisAceitos && c.finaisAceitos.includes(numPadded));
    if (directMatch) {
      const dataLim = directMatch.dataLicenciamento || directMatch.dataLimite;
      const dataCota = directMatch.dataCotaUnica || directMatch.data15Desc || dataLim;
      return {
        finalPlaca: directMatch.finalPlaca || finalPlaca,
        grupoFinal: directMatch.grupoFinal || grupoTerminacao,
        mesVencimento: `${directMatch.mesReferencia} / ${exercicio}`,
        dataLimite: dataLim,
        dataCotaUnica: dataCota,
        data15Desc: dataCota,
        data10Desc: directMatch.data10Desc || dataCota,
        dataSemDesc: dataLim,
        cota1Parcelamento: directMatch.cota1Parcelamento || dataCota,
        cota2Parcelamento: directMatch.cota2Parcelamento || dataLim,
        cota3Parcelamento: directMatch.cota3Parcelamento || dataLim,
      };
    }

    // 1.2 Match pela chave de final e grupo (ex: finalPlaca: '1', grupo: '01 - 31')
    const groupMatch = customCalendar.find(c => {
      const g = (c.grupoFinal || '').replace(/\s+/g, '');
      const targetG = grupoTerminacao.replace(/\s+/g, '');
      const f = c.finalPlaca ? String(c.finalPlaca).trim() : '';
      return (f === finalPlaca && g === targetG) || (c.descricaoFinais && c.descricaoFinais.includes(grupoTerminacao));
    });

    if (groupMatch) {
      const dataLim = groupMatch.dataLicenciamento || groupMatch.dataLimite;
      const dataCota = groupMatch.dataCotaUnica || groupMatch.data15Desc || dataLim;
      return {
        finalPlaca: groupMatch.finalPlaca || finalPlaca,
        grupoFinal: groupMatch.grupoFinal || grupoTerminacao,
        mesVencimento: `${groupMatch.mesReferencia} / ${exercicio}`,
        dataLimite: dataLim,
        dataCotaUnica: dataCota,
        data15Desc: dataCota,
        data10Desc: groupMatch.data10Desc || dataCota,
        dataSemDesc: dataLim,
        cota1Parcelamento: groupMatch.cota1Parcelamento || dataCota,
        cota2Parcelamento: groupMatch.cota2Parcelamento || dataLim,
        cota3Parcelamento: groupMatch.cota3Parcelamento || dataLim,
      };
    }
  }

  // 2. Busca na Tabela Oficial Padrão SEFA-PA / DETRAN-PA
  const officialRule = DETRAN_PA_CALENDARIO_2026.find(
    r => r.finalPlaca === finalPlaca && r.grupoFinal === grupoTerminacao
  ) || DETRAN_PA_CALENDARIO_2026[0];

  const adjustYear = (dateStr: string) => dateStr.replace(/^2026/, String(exercicio));

  return {
    finalPlaca: officialRule.finalPlaca,
    grupoFinal: officialRule.grupoFinal,
    mesVencimento: `${officialRule.mesReferencia} / ${exercicio}`,
    dataLimite: adjustYear(officialRule.dataLicenciamento),
    dataCotaUnica: adjustYear(officialRule.dataCotaUnica),
    data15Desc: adjustYear(officialRule.dataCotaUnica),
    data10Desc: adjustYear(officialRule.dataCotaUnica),
    dataSemDesc: adjustYear(officialRule.dataLicenciamento),
    cota1Parcelamento: adjustYear(officialRule.cota1Parcelamento),
    cota2Parcelamento: adjustYear(officialRule.cota2Parcelamento),
    cota3Parcelamento: adjustYear(officialRule.cota3Parcelamento),
  };
}

/**
 * Calcula os dados consolidados de Licenciamento & IPVA para um veículo no Pará.
 */
export function calcularLicenciamentoPA(
  placa: string,
  anoFabricacao: number,
  categoria: 'PASSEIO' | 'UTILITARIO' | 'CAMINHAO' | 'MOTO' | 'VAN',
  valorVenalFipe: number,
  tempoSemMultasAnos = 2,
  exercicio = 2026,
  taxaDetran = 254.12,
  customCalendar?: DetranCalendarEntry[]
): LicenciamentoPA {
  const { doisDigitos, finalSimples } = extrairDigitosPlaca(placa);
  const regra = calcularRegraDetranPA(doisDigitos, exercicio, customCalendar);

  // Alíquota do Estado do Pará (Lei Estadual nº 6.010/1996 e SEFA-PA)
  // 2,5% para veículos de passeio/caminhonetes/vans
  // 1,0% para caminhões, ônibus e motocicletas
  const aliquotaIpva = categoria === 'PASSEIO' || categoria === 'VAN' ? 0.025 : 0.01;

  // No Pará, veículos com mais de 15 anos de fabricação são isentos de IPVA
  const idadeVeiculo = exercicio - anoFabricacao;
  const isentoIpva = idadeVeiculo > 15;

  let valorIpvaEstimado = isentoIpva ? 0 : valorVenalFipe * aliquotaIpva;

  // Desconto IPVA Cidadão (SEFA-PA):
  // 15% para quem está há 2 anos sem multas de trânsito
  // 10% para quem está há 1 ano sem multas
  let percentualDesconto = 0;
  if (!isentoIpva) {
    if (tempoSemMultasAnos >= 2) {
      percentualDesconto = 0.15; // 15%
    } else if (tempoSemMultasAnos === 1) {
      percentualDesconto = 0.10; // 10%
    }
  }

  const descontoAplicado = valorIpvaEstimado * percentualDesconto;
  const valorIpvaComDesconto = valorIpvaEstimado - descontoAplicado;
  const valorTotalEstimado = valorIpvaComDesconto + taxaDetran;

  // Cálculo de dias restantes até o vencimento final do licenciamento
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataVencimento = new Date(regra.dataLimite + 'T00:00:00');
  const diffTime = dataVencimento.getTime() - hoje.getTime();
  const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let status: 'EM_DIA' | 'VENCE_EM_BREVE' | 'VENCIDO' = 'EM_DIA';
  if (diasRestantes < 0) {
    status = 'VENCIDO';
  } else if (diasRestantes <= 30) {
    status = 'VENCE_EM_BREVE';
  }

  return {
    placa,
    finalDoisDigitos: doisDigitos,
    finalSimples,
    finalPlaca: regra.finalPlaca,
    grupoFinal: regra.grupoFinal,
    exercicio,
    mesVencimento: regra.mesVencimento,
    dataLimiteLicenciamento: regra.dataLimite,
    dataCotaUnicaDesconto15: regra.data15Desc,
    dataCotaUnicaDesconto10: regra.data10Desc,
    dataCotaSemDesconto: regra.dataSemDesc,
    cota1Parcelamento: regra.cota1Parcelamento,
    cota2Parcelamento: regra.cota2Parcelamento,
    cota3Parcelamento: regra.cota3Parcelamento,
    valorVenalFipe,
    aliquotaIpva,
    valorIpvaEstimado,
    descontoAplicado,
    valorIpvaComDesconto,
    valorTaxaDetran: taxaDetran,
    valorTotalEstimado,
    status,
    diasRestantes,
    pago: false,
  };
}

/**
 * Gera mensagem formatada pronta para Chatwoot notificando o motorista/gestor
 */
export function formatarMensagemChatwootLicenciamento(lic: LicenciamentoPA, modelo: string, motoristaNome?: string): string {
  const diasMsg = lic.diasRestantes < 0
    ? `🚨 *VENCIDO HÁ ${Math.abs(lic.diasRestantes)} DIAS!*`
    : lic.diasRestantes <= 10
      ? `⚠️ *VENCE EM APENAS ${lic.diasRestantes} DIAS!*`
      : `🗓️ Vencimento em ${lic.diasRestantes} dias (${lic.dataLimiteLicenciamento.split('-').reverse().join('/')})`;

  const dest = motoristaNome ? `Olá, ${motoristaNome}!` : 'Atenção, Gestão de Frota!';

  return `🚗 *ALERTA SEFA-PA / DETRAN-PA: LICENCIAMENTO & IPVA ${lic.exercicio}*
${dest}

📌 *Veículo:* ${modelo} (Placa: ${lic.placa})
🔢 *Final de Placa:* ${lic.finalPlaca || lic.finalSimples} • *Variação:* ${lic.grupoFinal || 'Terminação ' + lic.finalDoisDigitos} (Dois dígitos: ${lic.finalDoisDigitos})
📅 *Data do Licenciamento (3ª Cota):* ${lic.dataLimiteLicenciamento.split('-').reverse().join('/')}
${diasMsg}

⭐ *Prazos de Antecipação & Parcelamento:*
• *IPVA Cidadão (Cota Única c/ Desconto):* ${lic.dataCotaUnicaDesconto15.split('-').reverse().join('/')}
• *1ª Cota (Parcelamento sem desconto):* ${lic.cota1Parcelamento ? lic.cota1Parcelamento.split('-').reverse().join('/') : lic.dataCotaUnicaDesconto15.split('-').reverse().join('/')}
• *2ª Cota:* ${lic.cota2Parcelamento ? lic.cota2Parcelamento.split('-').reverse().join('/') : 'Ver calendário'}
• *3ª Cota / Licenciamento:* ${lic.dataLimiteLicenciamento.split('-').reverse().join('/')}

💰 *Demonstrativo de Valores:*
• IPVA Estimado (SEFA-PA): R$ ${lic.valorIpvaComDesconto.toFixed(2)} ${lic.descontoAplicado > 0 ? `(Economia Bom Condutor de R$ ${lic.descontoAplicado.toFixed(2)})` : ''}
• Taxa de Licenciamento DETRAN-PA: R$ ${lic.valorTaxaDetran.toFixed(2)}
• *Total Estimado da Guia:* R$ ${lic.valorTotalEstimado.toFixed(2)}

⚠️ *Atenção:* Circular com licenciamento vencido é infração gravíssima (7 pontos na CNH, multa de R$ 293,47 e apreensão do veículo pelo DETRAN-PA / PM-PA / PRF).

🔗 Emita a guia DAE/DUA no Portal DETRAN-PA: https://www.detran.pa.gov.br`;
}
