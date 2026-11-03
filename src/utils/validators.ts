/**
 * Validador e formatador de documentos brasileiros (CPF e CNPJ)
 * e contatos (Telefone/WhatsApp).
 */

export function cleanDocument(doc: string): string {
  return (doc || '').replace(/\D/g, '');
}

/**
 * Validação com cálculo oficial de dígitos verificadores para CPF
 */
export function validateCPF(cpfRaw: string): boolean {
  const cpf = cleanDocument(cpfRaw);
  if (cpf.length !== 11) return false;

  // Rejeita sequências de dígitos iguais comuns (ex: 11111111111)
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  // Primeiro dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i), 10) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(9), 10)) return false;

  // Segundo dígito verificador
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i), 10) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(10), 10)) return false;

  return true;
}

/**
 * Validação com cálculo oficial de dígitos verificadores para CNPJ
 */
export function validateCNPJ(cnpjRaw: string): boolean {
  const cnpj = cleanDocument(cnpjRaw);
  if (cnpj.length !== 14) return false;

  // Rejeita sequências de dígitos iguais comuns
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  // Primeiro dígito verificador
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma = 0;
  for (let i = 0; i < 12; i++) {
    soma += parseInt(cnpj.charAt(i), 10) * pesos1[i];
  }
  let resto = soma % 11;
  const digito1 = resto < 2 ? 0 : 11 - resto;
  if (digito1 !== parseInt(cnpj.charAt(12), 10)) return false;

  // Segundo dígito verificador
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  soma = 0;
  for (let i = 0; i < 13; i++) {
    soma += parseInt(cnpj.charAt(i), 10) * pesos2[i];
  }
  resto = soma % 11;
  const digito2 = resto < 2 ? 0 : 11 - resto;
  if (digito2 !== parseInt(cnpj.charAt(13), 10)) return false;

  return true;
}

export function validateCpfCnpj(doc: string): {
  isValid: boolean;
  type: 'CPF' | 'CNPJ' | 'INVALID';
  clean: string;
  errorMessage?: string;
} {
  const clean = cleanDocument(doc);
  if (!clean) {
    return { isValid: false, type: 'INVALID', clean: '', errorMessage: 'Documento não informado' };
  }

  if (clean.length === 11) {
    const valid = validateCPF(clean);
    return {
      isValid: valid,
      type: 'CPF',
      clean,
      errorMessage: valid ? undefined : 'CPF inválido (dígitos verificadores incorretos)',
    };
  }

  if (clean.length === 14) {
    const valid = validateCNPJ(clean);
    return {
      isValid: valid,
      type: 'CNPJ',
      clean,
      errorMessage: valid ? undefined : 'CNPJ inválido (dígitos verificadores incorretos)',
    };
  }

  return {
    isValid: false,
    type: 'INVALID',
    clean,
    errorMessage: `Tamanho inválido (${clean.length} dígitos). CPF requer 11 dígitos e CNPJ requer 14 dígitos.`,
  };
}

export function formatCpfCnpj(doc: string): string {
  const clean = cleanDocument(doc);
  if (clean.length <= 11) {
    return clean
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return clean
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function formatPhone(phone: string): string {
  const clean = (phone || '').replace(/\D/g, '');
  if (clean.length <= 10) {
    return clean
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return clean
    .slice(0, 11)
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}
