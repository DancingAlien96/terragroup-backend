import { Request, Response } from 'express';
import { findUserByUsername, verifyPassword, signJwt, getUserWithPlan } from './auth.service.js';

export async function login(req: Request, res: Response) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  const user = await findUserByUsername(username);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid username or password' });
  }

  const passwordMatches = await verifyPassword(password, user.password);
  if (!passwordMatches) {
    return res.status(401).json({ success: false, message: 'Invalid username or password' });
  }

  if (!user.activo) {
    return res.status(403).json({ success: false, message: 'User is inactive' });
  }

  const token = signJwt(user);
  const userWithPlan = await getUserWithPlan(user.id);

  return res.json({ success: true, data: { token, user: userWithPlan } });
}

export function logout(_req: Request, res: Response) {
  return res.json({ success: true, message: 'Logged out successfully' });
}

export async function me(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const userWithPlan = await getUserWithPlan(req.user.id);
  return res.json({ success: true, data: { user: userWithPlan } });
}
