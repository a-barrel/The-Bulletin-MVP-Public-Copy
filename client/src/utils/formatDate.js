export default function formatMessageTimestamp(dateString) {
  const date = new Date(dateString);
  const now = new Date();

  const sameDay = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timePart = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (sameDay) {
    return `${timePart}`;
  } else if (isYesterday) {
    return `Yesterday at ${timePart}`;
  } else {
    return `${date.toLocaleDateString([], {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
    })} at ${timePart}`;
  }
}