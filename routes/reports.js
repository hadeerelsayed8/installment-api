const express=require('express');

const router=express.Router();

const db = require('../db');
const auth = require('../middleware/auth');


router.get(
'/',
auth,
async(req,res)=>{

try{

const user_id=
req.user.id;

const result=
await db.query(

`
SELECT

(
SELECT COUNT(*)
FROM customers
WHERE user_id=$1
)
AS totalCustomers,

(
SELECT COUNT(*)
FROM installments
WHERE user_id=$1
)
AS totalInstallments,

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

(
SELECT
COALESCE(
SUM(i.down_payment),0
)

+

COALESCE(
SUM(d.paid_amount),0
)

FROM installments i

LEFT JOIN
installment_details d

ON d.installment_id=i.id

WHERE i.user_id=$1

)
AS totalPaid,

(
SELECT

COALESCE(
SUM(i.total_amount),0
)

-

(

COALESCE(
SUM(i.down_payment),0
)

+

COALESCE(
SUM(d.paid_amount),0
)

)

FROM installments i

LEFT JOIN
installment_details d

ON d.installment_id=i.id

WHERE i.user_id=$1

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


//تقرير العملاء المتأخرين
router.get(
'/late-customers',
auth,
async(req,res)=>{

try{

const user_id=
req.user.id;

const result=
await db.query(

`
SELECT

c.id,
c.name,
c.phone,

COUNT(d.id)
AS late_count,

SUM(d.amount)
AS late_amount,

MIN(d.due_date)
AS oldest_due

FROM installment_details d

JOIN installments i

ON i.id=d.installment_id

JOIN customers c

ON c.id=i.customer_id

WHERE

i.user_id=$1

AND d.paid=false

AND d.due_date<CURRENT_DATE

GROUP BY
c.id,
c.name,
c.phone

ORDER BY
oldest_due
`,
[user_id]

);

res.json(
result.rows
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

router.get(
'/today',
auth,
async(req,res)=>{

try{

const user_id=
req.user.id;

const result=
await db.query(

`
SELECT

c.name,

d.amount,

d.due_date,

i.installment_value

FROM installment_details d

JOIN installments i

ON i.id=d.installment_id

JOIN customers c

ON c.id=i.customer_id

WHERE

i.user_id=$1

AND d.paid=false

AND d.due_date=CURRENT_DATE

ORDER BY
c.name
`,
[user_id]

);

res.json(
result.rows
);

}
catch(err){

res.status(500)
.json({

error:
err.message

});

}

});

//تقرير الأقساط المستحقة اليوم

router.get(
'/today-due',
auth,
async(req,res)=>{

try{

const user_id=
req.user.id;

const result=
await db.query(

`

SELECT

d.id,

c.name,

c.phone,

d.amount,

d.due_date,

i.id as installment_id

FROM installment_details d

JOIN installments i

ON i.id=d.installment_id

JOIN customers c

ON c.id=i.customer_id

WHERE

i.user_id=$1

AND d.paid=false

AND DATE(d.due_date)=CURRENT_DATE

ORDER BY d.due_date

`,
[user_id]

);

res.json(
result.rows
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

// عميل معين تقرير 
router.get(
'/customer/:id',
auth,
async(req,res)=>{

try{

const user_id=
req.user.id;

const customerId=
req.params.id;

const result=
await db.query(

`

SELECT

c.name,
c.phone,

i.id as installment_id,

i.total_amount,

i.down_payment,

i.installment_count,

i.installment_value,

COALESCE(
SUM(
d.paid_amount
),0
)
AS paid,

COALESCE(
i.total_amount-
(
i.down_payment+

SUM(
COALESCE(
d.paid_amount,
0
)
)

),
i.total_amount
)
AS remaining


FROM customers c

JOIN installments i

ON c.id=i.customer_id

LEFT JOIN installment_details d

ON d.installment_id=i.id

WHERE

c.id=$1

AND i.user_id=$2

GROUP BY

c.name,
c.phone,
i.id

ORDER BY i.id DESC

`,

[
customerId,
user_id
]

);

res.json(
result.rows
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

module.exports=
router;