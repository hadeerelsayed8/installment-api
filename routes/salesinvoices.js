const express = require('express');
const router = express.Router();

const db = require('../db');
const auth = require('../middleware/auth');


// =======================
// إضافة فاتورة
// =======================
router.post('/', auth, async (req, res) => {

    try {

        const {
            customer_id,
            invoice_date,
            subtotal,
            discount,
            total_amount,
            notes,
            items
        } = req.body;

        const user_id = req.user.id;

        const invoiceResult =
            await db.query(

                `
                INSERT INTO sales_invoices
                (
                    customer_id,
                    user_id,
                    invoice_date,
                    subtotal,
                    discount,
                    total_amount,
                    notes,
                    status
                )
                VALUES
                (
                    $1,$2,$3,$4,$5,$6,$7,'OPEN'
                )
                RETURNING *
                `,

                [
                    customer_id,
                    user_id,
                    invoice_date,
                    subtotal,
                    discount,
                    total_amount,
                    notes
                ]

            );

        const invoice =
            invoiceResult.rows[0];

        if (items && items.length > 0) {

            for (const item of items) {

                await db.query(

                    `
                    INSERT INTO sales_invoice_details
                    (
                        invoice_id,
                        item_id,
                        qty,
                        price,
                        total
                    )
                    VALUES
                    (
                        $1,$2,$3,$4,$5
                    )
                    `,

                    [
                        invoice.id,
                        item.item_id,
                        item.qty,
                        item.price,
                        item.total
                    ]

                );

            }

        }

        res.json(invoice);

    }

    catch (err) {

        console.log(err);

        res.status(500).json({
            error: err.message
        });

    }

});


// =======================
// كل الفواتير
// =======================
router.get('/', auth, async (req, res) => {

    try {

        const result =
            await db.query(

                `
                SELECT

                    s.*,

                    c.name AS customer_name

                FROM sales_invoices s

                LEFT JOIN customers c
                    ON c.id = s.customer_id

                WHERE s.user_id = $1

                ORDER BY s.id DESC
                `,

                [req.user.id]

            );

        res.json(
            result.rows
        );

    }

    catch (err) {

        console.log(err);

        res.status(500).json({
            error: err.message
        });

    }

});


// =======================
// تفاصيل فاتورة واحدة
// =======================
router.get('/:id', auth, async (req, res) => {

    try {

        const invoiceResult =
            await db.query(

                `
                SELECT

                    s.*,

                    c.name AS customer_name

                FROM sales_invoices s

                LEFT JOIN customers c
                    ON c.id = s.customer_id

                WHERE

                    s.id = $1

                AND

                    s.user_id = $2
                `,

                [
                    req.params.id,
                    req.user.id
                ]

            );

        if (
            invoiceResult.rows.length === 0
        ) {

            return res.status(404).json({
                error: 'Invoice not found'
            });

        }

        const detailsResult =
            await db.query(

                `
                SELECT

                    d.*,

                    i.name AS item_name

                FROM sales_invoice_details d

                LEFT JOIN items i
                    ON i.id = d.item_id

                WHERE d.invoice_id = $1
                `,

                [req.params.id]

            );

        res.json({

            invoice:
                invoiceResult.rows[0],

            details:
                detailsResult.rows

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({
            error: err.message
        });

    }

});


// =======================
// حذف فاتورة
// =======================
router.delete('/:id', auth, async (req, res) => {

    try {

        await db.query(

            `
            DELETE FROM sales_invoice_details
            WHERE invoice_id = $1
            `,

            [req.params.id]

        );

        const result =
            await db.query(

                `
                DELETE FROM sales_invoices

                WHERE

                    id = $1

                AND

                    user_id = $2

                RETURNING *
                `,

                [
                    req.params.id,
                    req.user.id
                ]

            );

        if (
            result.rows.length === 0
        ) {

            return res.status(404).json({
                error: 'Invoice not found'
            });

        }

        res.json({
            message: 'Invoice deleted'
        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({
            error: err.message
        });

    }

});


module.exports = router;