module.exports = async function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    // TODO: Replace with real auth verification (Firebase/JWT) when available.
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};
