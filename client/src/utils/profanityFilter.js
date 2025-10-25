const FRUITS = [
  'Apple',
  'Banana',
  'Cherry',
  'Mango',
  'Pineapple',
  'Watermelon',
  'Peach',
  'Kiwi',
  'Grapefruit',
  'Blueberry'
];

const PROFANITY_WORDS = [
  'fuck',
  'fucking',
  'fucker',
  'fuckers',
  'shit',
  'bitch',
  'bitches',
  'ass',
  'asshole',
  'bastard',
  'damn',
  'dick',
  'dicks',
  'piss',
  'cunt'
];

const PROFANITY_REGEX = new RegExp(`\\b(${PROFANITY_WORDS.join('|')})\\b`, 'gi');

const normalizeFruit = (fruit, original) => {
  if (original === original.toUpperCase()) {
    return fruit.toUpperCase();
  }
  if (original[0] === original[0].toUpperCase()) {
    return fruit.charAt(0).toUpperCase() + fruit.slice(1).toLowerCase();
  }
  return fruit.toLowerCase();
};

const pickFruitForWord = (word) => {
  const normalized = word.toLowerCase();
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash + normalized.charCodeAt(index)) % FRUITS.length;
  }
  return FRUITS[hash];
};

export const replaceProfanityWithFruit = (input) => {
  if (typeof input !== 'string' || !input) {
    return input;
  }

  return input.replace(PROFANITY_REGEX, (match) => {
    const fruit = pickFruitForWord(match);
    return normalizeFruit(fruit, match);
  });
};
