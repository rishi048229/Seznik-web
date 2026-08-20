import 'dotenv/config';
import jwt from 'jsonwebtoken';

const getSecret = () => process.env.JWT_SECRET || 'fallback_secret_for_development';

export const generateToken = (userId: string, role: string) => {
  return jwt.sign({ id: userId, role }, getSecret(), { expiresIn: '7d' });
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, getSecret()) as { id: string; role: string };
};
