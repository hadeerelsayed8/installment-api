const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const auth = require('../middleware/auth');
const jwt = require('jsonwebtoken');

// 🔐 Secret Key (هنحسنها بعدين في .env)
const SECRET = process.env.JWT_SECRET;
//const SECRET = "mysecretkey";




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
  `INSERT INTO users(
      name,
      email,
      password,
      is_demo,
      max_customers,
      max_installments
    )
   VALUES(
      $1,
      $2,
      $3,
      true,
      2,
      10
    )
   RETURNING id,name,email,is_demo`,
  [name, email, hashedPassword]
);

   // res.json({
   //   message: 'User created successfully',
   //   user: result.rows[0]
  //  });
  const user = result.rows[0];

const token = jwt.sign(
  {
    id: user.id,
    email: user.email
  },
  SECRET,
  {
    expiresIn: '7d'
  }
);

res.json({
  message: 'User created successfully',
  token,
  user
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

//Route لجلب بيانات المستخدم

router.get(
'/profile',
auth,
async(req,res)=>{

try{

const result=
await db.query(

`
SELECT

id,
name,
email,
created_at

FROM users

WHERE id=$1
`,
[
req.user.id
]

);

res.json(
result.rows[0]
);

}
catch(err){

res.status(500).json({

error:
err.message

});

}

});

//تغيير كلمه السر 
router.put(
'/change-password',
auth,
async(req,res)=>{

try{

const {
currentPassword,
newPassword
}
=
req.body;

const user=
await db.query(

`
SELECT *
FROM users
WHERE id=$1
`,
[
req.user.id
]

);

if(
user.rows.length===0
){

return res
.status(404)
.json({

error:
'User not found'

});

}

const isValid=
await bcrypt.compare(

currentPassword,

user.rows[0]
.password

);

if(
!isValid
){

return res
.status(400)
.json({

error:
'Current password is incorrect'

});

}

const hashed=
await bcrypt.hash(
newPassword,
10
);

await db.query(

`
UPDATE users
SET password=$1
WHERE id=$2
`,

[
hashed,
req.user.id
]

);

res.json({

message:
'Password updated'

});

}
catch(err){

res.status(500)
.json({

error:
err.message

});

}

});

module.exports = router;