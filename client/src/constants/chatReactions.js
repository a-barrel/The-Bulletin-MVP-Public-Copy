export const CHAT_REACTION_OPTIONS = [
  { key: 'surprised', emoji: '😲', label: 'Surprised' },
  { key: 'angry', emoji: '😡', label: 'Angry' },
  { key: 'happy', emoji: '🙂', label: 'Happy' },
  { key: 'thumbs_up', emoji: '👍', label: 'Thumbs up' },
  { key: 'thumbs_down', emoji: '👎', label: 'Thumbs down' },
  { key: 'heart', emoji: '❤️', label: 'Love' },
  { key: 'fire', emoji: '🔥', label: 'Fire' },
  { key: 'party', emoji: '🥳', label: 'Party' },
  { key: 'laugh', emoji: '😂', label: 'Laugh' },
  { key: 'clap', emoji: '👏', label: 'Clap' },
  { key: 'alien', emoji: '👽', label: 'Alien' },
  { key: 'hundred', emoji: '💯', label: '100' },
  { key: 'skull', emoji: '💀', label: 'Skull' },
  { key: 'mind_blown', emoji: '🤯', label: 'Mind blown' }
];

export const CHAT_REACTION_LOOKUP = CHAT_REACTION_OPTIONS.reduce((acc, option) => {
  acc[option.key] = option;
  return acc;
}, {});
