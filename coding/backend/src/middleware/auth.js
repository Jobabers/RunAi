const authProvider = require('../services/authProvider');
const store = require('../storage');
const { HttpError } = require('../utils/httpError');

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new HttpError(401, 'กรุณาเข้าสู่ระบบก่อนใช้งาน');
    }

    const authUser = await authProvider.getUserFromToken(token);
    let user = await store.findUserById(authUser.id);

    if (!user) {
      user = await store.createRecord('profiles', {
        user_id: authUser.id,
        email: authProvider.normalizeEmail(authUser.email),
        name: null,
        age: null,
        weight: null,
        height: null,
        experience_level: 'beginner',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof HttpError) {
      next(err);
      return;
    }

    next(new HttpError(401, 'Token ไม่ถูกต้องหรือหมดอายุ'));
  }
}

module.exports = {
  requireAuth,
};
