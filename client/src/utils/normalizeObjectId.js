const normalizeObjectId = (value) => {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    if (typeof value.$oid === 'string') {
      return value.$oid;
    }
    if (typeof value.id === 'string') {
      return value.id;
    }
    if (typeof value.toHexString === 'function') {
      return value.toHexString();
    }
    if (typeof value.toString === 'function') {
      const stringified = value.toString();
      if (stringified && stringified !== '[object Object]') {
        return stringified;
      }
    }
  }
  return null;
};

export default normalizeObjectId;
