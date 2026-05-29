const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// 💰 إضافة دفعة
router.post('/', auth, async (req, res) => {
  const { installment_detail_id, amount } = req.body;

  try {
    const user_id = req.user.id;

    // 1. تسجيل الدفع
    await db.query(
      `INSERT INTO payments (installment_detail_id, amount, user_id)
       VALUES ($1,$2,$3)`,
      [installment_detail_id, amount, user_id]
    );

    // 2. حساب إجمالي المدفوع
    const sumResult = await db.query(
      `SELECT COALESCE(SUM(amount),0) AS total_paid
       FROM payments
       WHERE installment_detail_id = $1`,
      [installment_detail_id]
    );

    const totalPaid = sumResult.rows[0].total_paid;

    // 3. قيمة القسط
    const detailResult = await db.query(
      `SELECT amount FROM installment_details WHERE id = $1`,
      [installment_detail_id]
    );

    const installmentAmount = detailResult.rows[0].amount;

    // 4. لو اتدفع بالكامل
    if (totalPaid >= installmentAmount) {
      await db.query(
        `UPDATE installment_details
         SET paid = true, paid_date = CURRENT_DATE
         WHERE id = $1`,
        [installment_detail_id]
      );
    }

    res.json({
      message: "Payment recorded",
      totalPaid
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 📥 عرض مدفوعات قسط
router.get('/:id', auth, async (req, res) => {
  try {
    const user_id = req.user.id;

    const result = await db.query(
      `SELECT p.*
       FROM payments p
       JOIN installment_details d ON d.id = p.installment_detail_id
       JOIN installments i ON i.id = d.installment_id
       WHERE p.installment_detail_id = $1 AND p.user_id = $2`,
      [req.params.id, user_id]
    );

    res.json(result.rows);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;