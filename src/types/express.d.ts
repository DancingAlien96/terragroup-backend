import { Request } from 'express';

declare global {
  namespace Express {
    interface User {
      id: number;
      empresaId: number;
      rol: string;
      username: string;
    }

    interface Request {
      user?: User;
    }
  }
}
