export const CHAT_REACTION_OPTIONS = [
  { key: 'surprised', emoji: '😲', label: 'Surprised' },
  { key: 'angry', emoji: '😡', label: 'Angry' },
  { key: 'happy', emoji: '🙂', label: 'Happy' },
  { key: 'thumbs_up', emoji: '👍', label: 'Thumbs up' },
  { key: 'thumbs_down', emoji: '👎', label: 'Thumbs down' }
];

export const CHAT_REACTION_LOOKUP = CHAT_REACTION_OPTIONS.reduce((acc, option) => {
  acc[option.key] = option;
  return acc;
}, {});
