const express = require('express');
const router = express.Router();

const db = require('../db');
const auth = require('../middleware/auth');

router.post('/', auth, async (req, res) => {

    const client = await db.connect();

    try {

        await client.query('BEGIN');

        const {
            customer_id,
            discount = 0,
            notes = '',
            items
        } = req.body;

        const user_id = req.user.id;

        if (
            !customer_id ||
            !items ||
            items.length === 0
        ) {

            return res.status(400).json({
                error: 'Customer and items are required'
            });

        }

        let subtotal = 0;

        for (const item of items) {

            const itemResult =
                await client.query(

                    `
                    SELECT *
                    FROM items
                    WHERE id=$1
                    AND user_id=$2
                    `,

                    [
                        item.item_id,
                        user_id
                    ]

                );

            if (
                itemResult.rows.length === 0
            ) {

                throw new Error(
                    `Item ${item.item_id} not found`
                );

            }

            const price =
                Number(
                    itemResult.rows[0].price
                );

            subtotal +=
                price *
                Number(item.qty);

        }

        const total_amount =
            subtotal -
            Number(discount || 0);

        const invoiceResult =
            await client.query(

                `
                INSERT INTO sales_invoices
                (
                    customer_id,
                    user_id,
                    subtotal,
                    discount,
                    total_amount,
                    status,
                    notes
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    'OPEN',
                    $6
                )
                RETURNING *
                `,

                [
                    customer_id,
                    user_id,
                    subtotal,
                    discount,
                    total_amount,
                    notes
                ]

            );

        const invoice =
            invoiceResult.rows[0];

        for (const item of items) {

            const itemResult =
                await client.query(

                    `
                    SELECT price
                    FROM items
                    WHERE id=$1
                    `,

                    [item.item_id]

                );

            const price =
                Number(
                    itemResult.rows[0].price
                );

            const total =
                price *
                Number(item.qty);

            await client.query(

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
                    $1,
                    $2,
                    $3,
                    $4,
                    $5
                )
                `,

                [
                    invoice.id,
                    item.item_id,
                    item.qty,
                    price,
                    total
                ]

            );

        }

        await client.query('COMMIT');

        res.json(invoice);

    }

    catch (err) {

        await client.query('ROLLBACK');

        console.log(err);

        res.status(500).json({
            error: err.message
        });

    }

    finally {

        client.release();

    }

});

//كل الفواتير
router.get('/', auth, async (req, res) => {

    try {

        const result =
            await db.query(

                `
                SELECT
                    s.*,
                    c.name AS customer_name
                FROM sales_invoices s
                INNER JOIN customers c
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

        res.status(500).json({
            error: err.message
        });

    }

});

//جلب فاتوره واحده مع التفاصيل
router.get('/:id', auth, async (req, res) => {

    try {

        const invoice =
            await db.query(

                `
                SELECT *
                FROM sales_invoices
                WHERE id=$1
                AND user_id=$2
                `,

                [
                    req.params.id,
                    req.user.id
                ]

            );

        if (
            invoice.rows.length === 0
        ) {

            return res.status(404).json({
                error: 'Invoice not found'
            });

        }

        const details =
            await db.query(

                `
                SELECT
                    d.*,
                    i.name AS item_name
                FROM sales_invoice_details d
                INNER JOIN items i
                    ON i.id=d.item_id
                WHERE d.invoice_id=$1
                `,

                [req.params.id]

            );

        res.json({

            invoice:
                invoice.rows[0],

            details:
                details.rows

        });

    }

    catch (err) {

        res.status(500).json({
            error: err.message
        });

    }

});

module.exports = router;