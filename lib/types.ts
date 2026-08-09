export const BELTS = ['branca', 'azul', 'roxa', 'marrom', 'preta'] as const;
export const ROLES = ['admin', 'professor', 'aluno'] as const;
export const DAYS = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'] as const;

export type Belt = (typeof BELTS)[number];
export type Role = (typeof ROLES)[number];
export type Day = (typeof DAYS)[number];
