/**
 * Dígito verificador de CPF/CNPJ (algoritmo da Receita Federal) — rejeita tamanho errado e
 * sequências como "00000000000", não só formato. Porta de lib/validacao.js do fiscal-sinapi-local.
 */
function validarCpf(digitos: string): boolean {
  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) return false;
  const calcularDigito = (base: string) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  if (calcularDigito(digitos.slice(0, 9)) !== Number(digitos[9])) return false;
  if (calcularDigito(digitos.slice(0, 10)) !== Number(digitos[10])) return false;
  return true;
}

function validarCnpj(digitos: string): boolean {
  if (digitos.length !== 14 || /^(\d)\1{13}$/.test(digitos)) return false;
  const calcularDigito = (base: string) => {
    const pesos =
      base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  if (calcularDigito(digitos.slice(0, 12)) !== Number(digitos[12])) return false;
  if (calcularDigito(digitos.slice(0, 13)) !== Number(digitos[13])) return false;
  return true;
}

export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function cpfCnpjValido(digitos: string): boolean {
  if (digitos.length === 11) return validarCpf(digitos);
  if (digitos.length === 14) return validarCnpj(digitos);
  return false;
}
