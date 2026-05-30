const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;

module.exports = (req, res, next) => {

  try {

    const authHeader =
      req.headers['authorization'];

    if (!authHeader) {

      return res.status(401).json({
        error: 'No token provided'
      });

    }

    const token =
      authHeader.split(' ')[1];

    const decoded =
      jwt.verify(token, SECRET);

    req.user = decoded;

    next();

  }

  catch (err) {

    return res.status(401).json({
      error: 'Invalid token'
    });

  }

};


/*
const jwt = require('jsonwebtoken');

const SECRET = "mysecretkey";

module.exports = (req, res, next) => {
  try {

    // ناخد authorization header
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
      return res.status(401).json({
        error: 'No token provided'
      });
    }

    // نشيل Bearer
    const token = authHeader.split(' ')[1];

    // نتحقق من التوكن
    const decoded = jwt.verify(token, SECRET);

    // نخزن بيانات المستخدم
    req.user = decoded;

    next();

  } catch (err) {
    return res.status(401).json({
      error: 'Invalid token'
    });
  }
};*/