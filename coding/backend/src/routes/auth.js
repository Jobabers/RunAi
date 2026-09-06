const express = require('express');
const authProvider = require('../services/authProvider');
const store = require('../storage');
const { assertCondition, HttpError } = require('../utils/httpError');

const router = express.Router();

function validateAuthInput({ email, password }) {
  assertCondition(email && String(email).includes('@'), 400, 'อีเมลไม่ถูกต้อง');
  assertCondition(password && String(password).length >= 8, 400, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
}

async function ensureProfile(authUser, attrs = {}) {
  assertCondition(authUser?.id, 500, 'Supabase Auth ไม่ส่ง user id กลับมา');

  const existingProfile = await store.findUserById(authUser.id);
  const profileAttrs = {
    email: authProvider.normalizeEmail(authUser.email),
    ...attrs,
  };

  if (existingProfile) {
    return store.updateRecord('profiles', existingProfile.user_id, profileAttrs);
  }

  return store.createRecord('profiles', {
    user_id: authUser.id,
    name: null,
    age: null,
    weight: null,
    height: null,
    experience_level: 'beginner',
    ...profileAttrs,
  });
}

router.post('/register', async (req, res, next) => {
  try {
    validateAuthInput(req.body);
    const { email, password } = req.body;

    if (await store.findUserByEmail(email)) {
      throw new HttpError(409, 'อีเมลนี้ถูกใช้งานแล้ว');
    }

    const authUser = await authProvider.registerUser({ email, password });
    const user = await ensureProfile(authUser);

    res.status(201).json({
      user: store.publicUser(user),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    validateAuthInput(req.body);
    const { email, password } = req.body;
    const session = await authProvider.loginUser({ email, password });
    const user = await ensureProfile(session.user);

    res.json({
      user: store.publicUser(user),
      token: session.accessToken,
      session: {
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
        expires_in: session.expiresIn,
        token_type: session.tokenType,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
