const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// ➕ إضافة عميل
router.post(
  '/',
  auth,

  async (req, res) => {

    try {

      const {

        name,
        phone,
        address

      } = req.body;

      const user_id =
        req.user.id;


      /* نجيب بيانات المستخدم */

      const user =
        await db.query(

          `

SELECT *

FROM users

WHERE id=$1

`,

          [user_id]

        );


      if (
        user.rows.length === 0
      ) {

        return res
          .status(404)
          .json({

            error:
              'User not found'

          });

      }


      /* نحسب عدد العملاء الحاليين */

      const currentCustomers =
        await db.query(

          `

SELECT COUNT(*) 

FROM customers

WHERE user_id=$1

`,

          [user_id]

        );


      const count =

        Number(

          currentCustomers
            .rows[0]
            .count

        );


      /* التحقق من النسخة التجريبية */

      if (

        user.rows[0].is_demo

        &&

        count >=

        user.rows[0]
          .max_customers

      ) {

        return res
          .status(403)
          .json({

            error:

              `Demo version allows only ${user.rows[0].max_customers} customers`

          });

      }


      /* إضافة العميل */

      const result =
        await db.query(

          `

INSERT INTO customers

(

name,
phone,
address,
user_id

)

VALUES

(

$1,
$2,
$3,
$4

)

RETURNING *

`,

          [

            name,
            phone,
            address,
            user_id

          ]

        );


      res.json(
        result.rows[0]
      );

    }

    catch (err) {

      console.log(err);

      res
        .status(500)
        .json({

          error:
            err.message

        });

    }

  });
/*router.post('/', auth, async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    const user_id = req.user.id;

    const result = await db.query(
      `INSERT INTO customers (name, phone, address, user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, phone, address, user_id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});*/


// 📥 كل العملاء (بتوع المستخدم فقط)
router.get('/', auth, async (req, res) => {
  try {
    const user_id = req.user.id;

    const result = await db.query(
      `SELECT * FROM customers
       WHERE user_id = $1
       ORDER BY id DESC`,
      [user_id]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put(
  '/:id',
  auth,
  async (req, res) => {

    try {

      const user_id =
        req.user.id;

      const {
        name,
        phone
      }
        =
        req.body;

      const result =
        await db.query(

          `
UPDATE customers

SET

name=$1,
phone=$2

WHERE

id=$3

AND

user_id=$4

RETURNING *
`,

          [
            name,
            phone,
            req.params.id,
            user_id
          ]

        );

      if (
        result.rows.length === 0
      ) {

        return res
          .status(404)
          .json({

            error:
              'Customer not found'

          });

      }

      res.json(
        result.rows[0]
      );

    }

    catch (err) {

      res.status(500)
        .json({

          error:
            err.message

        });

    }

  });

router.delete(
  '/:id',
  auth,
  async (req, res) => {

    try {

      const user_id =
        req.user.id;

      const customerId =
        req.params.id;


      // نتأكد إن العميل له أقساط

      const checkInstallments =
        await db.query(

          `
SELECT COUNT(*)
AS count

FROM installments

WHERE

customer_id=$1

AND

user_id=$2
`,

          [
            customerId,
            user_id
          ]

        );


      if (

        Number(

          checkInstallments
            .rows[0]
            .count

        )

        > 0

      ) {

        return res
          .status(400)
          .json({

            error:
              'Cannot delete customer because this customer has installments'

          });

      }


      // حذف العميل

      const result =
        await db.query(

          `
DELETE FROM customers

WHERE

id=$1

AND

user_id=$2

RETURNING *
`,

          [
            customerId,
            user_id
          ]

        );


      if (
        result.rows.length === 0
      ) {

        return res
          .status(404)
          .json({

            error:
              'Customer not found'

          });

      }


      res.json({

        message:
          'Customer deleted successfully'

      });

    }

    catch (err) {

      res.status(500)
        .json({

          error:
            err.message

        });

    }

  });


module.exports = router;