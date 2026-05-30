const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// 🔐 Secret Key (هنحسنها بعدين في .env)
const SECRET = "mysecretkey";


// =========================
// 🟢 REGISTER
// =========================
router.post('/register', async (req, res) => {

  const { name, email, password } = req.body;

  try {

    const existingUser = await db.query(
      'SELECT id FROM users WHERE email=$1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        error: 'Email already exists'
      });
    }

    const hashedPassword =
      await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users(name,email,password)
       VALUES($1,$2,$3)
       RETURNING id,name,email`,
      [name, email, hashedPassword]
    );

    res.json({
      message: 'User created successfully',
      user: result.rows[0]
    });

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

});


// =========================
// 🔵 LOGIN
// =========================
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. نجيب المستخدم
    const result = await db.query(
      `SELECT * FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "User not found" });
    }

    const user = result.rows[0];

    // 2. نتأكد من الباسورد
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ error: "Wrong password" });
    }

    // 3. نعمل Token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email
      },
      SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login success",
      token
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;