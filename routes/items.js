const express = require('express');
const router = express.Router();

const db = require('../db');
const auth = require('../middleware/auth');

router.post('/', auth, async (req, res) => {

    try {

        const {
            name,
            price,
            notes
        } = req.body;

        const user_id = req.user.id;

        const result = await db.query(

            `
            INSERT INTO items
            (
                name,
                price,
                notes,
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
                price,
                notes,
                user_id
            ]

        );

        res.json(
            result.rows[0]
        );

    }

    catch (err) {

        res.status(500).json({
            error: err.message
        });

    }

});

router.get('/', auth, async (req, res) => {

    try {

        const user_id =
            req.user.id;

        const result =
            await db.query(

                `
                SELECT *
                FROM items
                WHERE user_id=$1
                ORDER BY id DESC
                `,

                [user_id]

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

router.put('/:id', auth, async (req, res) => {

    try {

        const {
            name,
            price,
            notes
        } = req.body;

        const result =
            await db.query(

                `
                UPDATE items
                SET
                    name=$1,
                    price=$2,
                    notes=$3
                WHERE
                    id=$4
                AND
                    user_id=$5
                RETURNING *
                `,

                [
                    name,
                    price,
                    notes,
                    req.params.id,
                    req.user.id
                ]

            );

        if (
            result.rows.length === 0
        ) {

            return res.status(404).json({
                error: 'Item not found'
            });

        }

        res.json(
            result.rows[0]
        );

    }

    catch (err) {

        res.status(500).json({
            error: err.message
        });

    }

});

router.delete('/:id', auth, async (req, res) => {

    try {

        const result =
            await db.query(

                `
                DELETE FROM items
                WHERE
                    id=$1
                AND
                    user_id=$2
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
                error: 'Item not found'
            });

        }

        res.json({
            message:
                'Item deleted successfully'
        });

    }

    catch (err) {

        res.status(500).json({
            error: err.message
        });

    }

});