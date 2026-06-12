// Short shareable room codes like "TACO-7842".

const WORDS = [
  "TACO",
  "SUSHI",
  "PIZZA",
  "CURRY",
  "RAMEN",
  "BAGEL",
  "MANGO",
  "MOCHA",
  "PESTO",
  "NACHO",
  "GUMBO",
  "WAFFLE",
];

export function generateRoomCode(): string {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const num = Math.floor(1000 + Math.random() * 9000); // 4 digits
  return `${word}-${num}`;
}

export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}
