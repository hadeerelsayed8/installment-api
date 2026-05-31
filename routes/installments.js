const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const PDFDocument = require('pdfkit');

// ➕ إضافة قسط + توليد الأقساط

router.post(
  '/',
  auth,

  async (req, res) => {

    const {

      customer_id,
      total_amount,
      down_payment,
      installment_count,
      installment_value,
      start_date

    } = req.body;

    try {

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


      /* نحسب عدد العقود الحالية */

      const currentInstallments =
        await db.query(

          `

SELECT COUNT(*)

FROM installments

WHERE user_id=$1

`,

          [user_id]

        );


      const count =

        Number(

          currentInstallments
            .rows[0]
            .count

        );


      /* التحقق من نسخة Demo */

      if (

        user.rows[0].is_demo

        &&

        count >=

        user.rows[0]
          .max_installments

      ) {

        return res
          .status(403)
          .json({

            error:

              `Demo version allows only ${user.rows[0].max_installments} installments`

          });

      }


      /* إنشاء عقد التقسيط */

      const result =
        await db.query(

          `

INSERT INTO installments

(

customer_id,
total_amount,
down_payment,
installment_count,
installment_value,
start_date,
user_id

)

VALUES

(

$1,
$2,
$3,
$4,
$5,
$6,
$7

)

RETURNING *

`,

          [

            customer_id,
            total_amount,
            down_payment,
            installment_count,
            installment_value,
            start_date,
            user_id

          ]

        );


      const installmentId =

        result.rows[0].id;


      /* إنشاء تفاصيل الأقساط */

      for (

        let i = 0;

        i < installment_count;

        i++

      ) {

        await db.query(

          `

INSERT INTO installment_details

(

installment_id,
due_date,
amount

)

VALUES(

$1,

$2::date
+

($3 || ' month')
::interval,

$4

)

`,

          [

            installmentId,

            start_date,

            i,

            installment_value

          ]

        );

      }


      res.json({

        message:
          'Installment created successfully',

        installment:
          result.rows[0]

      });

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

/* router.post('/', auth, async (req, res) => {
  const {
    customer_id,
    total_amount,
    down_payment,
    installment_count,
    installment_value,
    start_date
  } = req.body;

  try {
    const user_id = req.user.id;

    // 1. إنشاء عقد التقسيط
    const result = await db.query(
      `INSERT INTO installments
      (customer_id, total_amount, down_payment, installment_count, installment_value, start_date, user_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *`,
      [customer_id, total_amount, down_payment, installment_count, installment_value, start_date, user_id]
    );

    const installmentId = result.rows[0].id;

    // 2. توليد الأقساط
    for (let i = 0; i < installment_count; i++) {
      await db.query(
        `INSERT INTO installment_details
        (installment_id, due_date, amount)
        VALUES (
          $1,
          $2::date + ($3 || ' month')::interval,
          $4
        )`,
        [installmentId, start_date, i, installment_value]
      );
    }

    res.json({
      message: "Installment created successfully",
      installment: result.rows[0]
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});*/


// 📥 كل الأقساط
router.get(
  '/',
  auth,
  async (req, res) => {

    try {

      const result =
        await db.query(

          `

SELECT

i.*,

c.name
AS customer_name

FROM installments i

JOIN customers c

ON c.id=i.customer_id

WHERE i.user_id=$1

ORDER BY i.id DESC

`,

          [req.user.id]

        );

      res.json(
        result.rows
      );

    }
    catch (err) {

      res.status(500)
        .json({

          error: err.message

        });

    }

  });


// 📥 تفاصيل قسط معين
router.get('/:id/details', auth, async (req, res) => {
  try {
    const user_id = req.user.id;

    /* const result = await db.query(
       `SELECT d.*
        FROM installment_details d
        JOIN installments i ON i.id = d.installment_id
        WHERE d.installment_id = $1 AND i.user_id = $2
        ORDER BY d.due_date`,
       [req.params.id, user_id]
     );*/
    const result = await db.query(
      `
SELECT
d.*,

CASE
WHEN
d.paid = false
AND d.due_date < CURRENT_DATE
THEN true

ELSE false

END AS overdue

FROM installment_details d

JOIN installments i
ON i.id=d.installment_id

WHERE
d.installment_id=$1
AND i.user_id=$2

ORDER BY
d.due_date
`,
      [
        req.params.id,
        user_id
      ]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//notification
router.get('/notifications/upcoming', auth, async (req, res) => {
  try {
    const user_id = req.user.id;

    const result = await db.query(
      `
      SELECT 
        d.id,
        d.due_date,
        d.amount,
        c.name AS customer_name
      FROM installment_details d
      JOIN installments i ON i.id = d.installment_id
      JOIN customers c ON c.id = i.customer_id
      WHERE i.user_id = $1
      AND d.paid = false
      AND d.due_date >= CURRENT_DATE - INTERVAL '30 days'
      
      ORDER BY d.due_date ASC
      `,
      [user_id]
    );

    res.json(result.rows);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 📥 أقساط عميل معين
router.get('/customer/:id', auth, async (req, res) => {

  try {

    const user_id = req.user.id;

    const result = await db.query(
      `
      SELECT *
      FROM installments
      WHERE customer_id = $1
      AND user_id = $2
      ORDER BY id DESC
      `,
      [req.params.id, user_id]
    );

    res.json(result.rows);

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

});

//بتسجل اللى ادفع 
router.put(
  '/details/:id/pay',
  auth,
  async (req, res) => {

    try {

      const user_id =
        req.user.id;

      const { amount } =
        req.body;


      if (
        !amount ||
        Number(amount) <= 0
      ) {

        return res
          .status(400)
          .json({

            error:
              'Invalid amount'

          });

      }


      // نتأكد إن القسط للمستخدم

      const check =
        await db.query(

          `

SELECT

d.*,

d.amount
AS installment_amount

FROM
installment_details d

JOIN installments i
ON i.id=d.installment_id

WHERE

d.id=$1

AND

i.user_id=$2

`,

          [
            req.params.id,
            user_id
          ]

        );


      if (
        check.rows.length === 0
      ) {

        return res
          .status(404)
          .json({

            error:
              'Installment not found'

          });

      }


      const installment =
        check.rows[0];


      // إجمالي قيمة القسط

      const installmentAmount =

        Number(
          installment.installment_amount
        );


      // نحسب إجمالي المدفوع الحالي من السجل

      const oldPayments =
        await db.query(

          `

SELECT

COALESCE(
SUM(amount),
0
)

AS total

FROM
installment_payments

WHERE
installment_detail_id=$1

`,

          [
            req.params.id
          ]

        );


      const currentPaid =

        Number(
          oldPayments.rows[0].total
        );


      const newPaid =

        currentPaid +
        Number(amount);


      if (
        newPaid >
        installmentAmount
      ) {

        return res
          .status(400)
          .json({

            error:
              'Amount exceeds installment value'

          });

      }


      // نحفظ الدفعة الجديدة

      await db.query(

        `

INSERT INTO
installment_payments
(

installment_detail_id,
amount

)

VALUES
($1,$2)

`,

        [
          req.params.id,
          amount
        ]

      );


      // نحدد الحالة

      let status = 'UNPAID';

      let paid = false;


      if (
        newPaid === 0
      ) {

        status = 'UNPAID';

      }

      else if (
        newPaid <
        installmentAmount
      ) {

        status = 'PARTIAL';

      }

      else {

        status = 'PAID';

        paid = true;

      }


      // تحديث القسط

      await db.query(

        `

UPDATE
installment_details

SET

paid_amount=$1,

status=$2,

paid=$3

WHERE
id=$4

`,

        [
          newPaid,
          status,
          paid,
          req.params.id
        ]

      );


      res.json({

        message:
          'Payment saved successfully',

        paid_amount:
          newPaid,

        remaining:

          installmentAmount -
          newPaid,

        status

      });

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


//Api بتجيب السجل 
router.get(
  '/details/:id/payments',
  auth,
  async (req, res) => {

    const result =
      await db.query(

        `
SELECT *

FROM
installment_payments

WHERE
installment_detail_id=$1

ORDER BY
payment_date DESC
`,

        [req.params.id]

      );

    res.json(
      result.rows
    );

  });

// 📊 Dashboard Statistics
router.get('/dashboard/stats', auth, async (req, res) => {

  try {

    const user_id = req.user.id;

    // 👥 عدد العملاء
    const customersResult = await db.query(
      `
      SELECT COUNT(*) AS total_customers
      FROM customers
      WHERE user_id = $1
      `,
      [user_id]
    );

    // 💰 عدد العقود
    const installmentsResult = await db.query(
      `
      SELECT COUNT(*) AS total_installments
      FROM installments
      WHERE user_id = $1
      `,
      [user_id]
    );

    // ✅ إجمالي المدفوع
    const paidResult = await db.query(
      `
      SELECT COALESCE(SUM(amount), 0) AS total_paid
      FROM installment_details d
      JOIN installments i
      ON i.id = d.installment_id
      WHERE i.user_id = $1
      AND d.paid = true
      `,
      [user_id]
    );

    // ⏳ إجمالي المتبقي
    const unpaidResult = await db.query(
      `
      SELECT COALESCE(SUM(amount), 0) AS total_unpaid
      FROM installment_details d
      JOIN installments i
      ON i.id = d.installment_id
      WHERE i.user_id = $1
      AND d.paid = false
      `,
      [user_id]
    );

    const overdueResult =
      await db.query(

        `
SELECT COUNT(*)
AS overdue_count

FROM installment_details d

JOIN installments i
ON i.id=d.installment_id

WHERE

i.user_id=$1

AND d.paid=false

AND d.due_date<CURRENT_DATE
`,
        [user_id]

      );

    res.json({

      overdue_count:
        overdueResult
          .rows[0]
          .overdue_count,

      total_customers:
        customersResult.rows[0].total_customers,

      total_installments:
        installmentsResult.rows[0].total_installments,

      total_paid:
        paidResult.rows[0].total_paid,

      total_unpaid:
        unpaidResult.rows[0].total_unpaid,

    });

  } catch (err) {

    res.status(500).json({
      error: err.message,
    });

  }

});

 /*router.get(
  '/customer/:customerId/report',
  auth,
  async (req, res) => {

    try {

      const user_id =
        req.user.id;

      const customerId =
        req.params.customerId;

      const result =
        await db.query(

          `
SELECT

COUNT(d.id)
AS total_installments,

COUNT(
CASE
WHEN d.paid=true
THEN 1
END
)
AS paid_count,

COALESCE(
SUM(d.amount),
0
)
AS total_amount,

COALESCE(
SUM(
CASE
WHEN d.paid=true
THEN d.amount
ELSE 0
END
),
0
)
AS total_paid,

COALESCE(
SUM(
CASE
WHEN d.paid=false
THEN d.amount
ELSE 0
END
),
0
)
AS total_remaining

FROM installment_details d

JOIN installments i
ON i.id=d.installment_id

WHERE
i.customer_id=$1
AND i.user_id=$2
`,
          [customerId, user_id]

        );

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

  });*/

router.get(
'/reports',
auth,
async(req,res)=>{

try{

const user_id=
req.user.id;

console.log(
'USER ID:',
user_id
);

console.log(
'USER:',
req.user
);

const result=
await db.query(

`
SELECT

-- عدد العملاء
(
SELECT COUNT(*)
FROM customers
WHERE user_id=$1
)
AS totalCustomers,

-- عدد العقود
(
SELECT COUNT(*)
FROM installments
WHERE user_id=$1
)
AS totalInstallments,

-- إجمالي العقود
(
SELECT
COALESCE(
SUM(total_amount),
0
)
FROM installments
WHERE user_id=$1
)
AS totalContracts,

-- إجمالي الدفعات المقدمة
(
SELECT
COALESCE(
SUM(down_payment),
0
)
FROM installments
WHERE user_id=$1
)
AS totalDownPayments,

-- المدفوع الحقيقي
(
SELECT
COALESCE(

SUM(i.down_payment),

0

)

+

COALESCE(

SUM(
d.paid_amount
),

0

)

FROM installments i

LEFT JOIN
installment_details d

ON
d.installment_id=i.id

WHERE
i.user_id=$1

)

AS totalPaid,


-- المتبقي الحقيقي

(

SELECT

COALESCE(

SUM(i.total_amount),

0

)

-

(

COALESCE(
SUM(i.down_payment),
0
)

+

COALESCE(
SUM(d.paid_amount),
0
)

)

FROM installments i

LEFT JOIN
installment_details d

ON
d.installment_id=i.id

WHERE
i.user_id=$1

)

AS totalRemaining

`,
[user_id]

);

res.json(
result.rows[0]
);

}
catch(err){

console.log(err);

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

      const installmentId =
        req.params.id;


      // نتأكد إن العقد يخص المستخدم

      const check =
        await db.query(

          `
SELECT *

FROM installments

WHERE
id=$1

AND
user_id=$2
`,

          [
            installmentId,
            user_id
          ]

        );


      if (
        check.rows.length === 0
      ) {

        return res
          .status(404)
          .json({

            error:
              'Installment not found'

          });

      }


      const installment =
        check.rows[0];


      // هل فيه أي مبلغ اتدفع؟

      const paid =
        await db.query(

          `

SELECT *

FROM installment_details

WHERE
installment_id=$1

AND
COALESCE(
paid_amount,
0
)>0

`,

          [
            installmentId
          ]

        );


      if (
        paid.rows.length > 0
      ) {

        return res
          .status(400)
          .json({

            error:
              'Cannot delete installment because payments exist'

          });

      }



      // حذف التفاصيل

      await db.query(

        `
DELETE FROM
installment_details

WHERE
installment_id=$1
`,

        [
          installmentId
        ]

      );


      // حذف العقد

      await db.query(

        `
DELETE FROM
installments

WHERE
id=$1
`,

        [
          installmentId
        ]

      );


      res.json({

        message:
          'Installment deleted'

      });

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

  //انشاء pdf
  router.get(
  '/:id/contract',
 // auth,
  async (req, res) => {

    try {

      const user_id = req.user.id;

      const installmentId =
        req.params.id;

      const contract =
        await db.query(
          `
SELECT
i.*,
c.name AS customer_name
FROM installments i
JOIN customers c
ON c.id=i.customer_id
WHERE i.id=$1
AND i.user_id=$2
`,
          [
            installmentId,
            user_id
          ]
        );

      if (
        contract.rows.length === 0
      ) {

        return res
          .status(404)
          .json({
            error:
              'Contract not found'
          });

      }

      const details =
        await db.query(
          `
SELECT *
FROM installment_details
WHERE installment_id=$1
ORDER BY due_date
`,
          [installmentId]
        );

      const data =
        contract.rows[0];

      const doc =
        new PDFDocument();

      res.setHeader(
        'Content-Type',
        'application/pdf'
      );

      res.setHeader(
        'Content-Disposition',
        `attachment; filename=contract_${installmentId}.pdf`
      );

      doc.pipe(res);

      doc.fontSize(20)
        .text(
          'Installment Contract'
        );

      doc.moveDown();

      doc.text(
        `Customer: ${data.customer_name}`
      );

      doc.text(
        `Total Amount: ${data.total_amount}`
      );

      doc.text(
        `Down Payment: ${data.down_payment}`
      );

      doc.text(
        `Installment Value: ${data.installment_value}`
      );

      doc.text(
        `Installments Count: ${data.installment_count}`
      );

      doc.moveDown();

      doc.text(
        'Installments Schedule'
      );

      doc.moveDown();

      details.rows.forEach(
        (
          item,
          index
        ) => {

          doc.text(
            `${index + 1} - ${item.amount} - ${item.due_date}`
          );

        }
      );

      doc.moveDown(2);

      doc.text(
        'Customer Signature: __________________'
      );

      doc.moveDown();

      doc.text(
        'Company Signature: __________________'
      );

      doc.end();

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

  }
);

module.exports = router;