const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();

const reportsRoutes=require('./routes/reports');
const itemsRoutes =require('./routes/items');
const salesInvoicesRoutes =require('./routes/salesinvoices');

app.use(cors());
app.use(express.json());

// routes
app.use('/customers', require('./routes/customers'));
app.use('/installments', require('./routes/installments'));
app.use('/payments', require('./routes/payments'));
app.use('/auth', require('./routes/auth'));
app.use('/reports',reportsRoutes);
app.use('/items',itemsRoutes);
app.use('/sales-invoices',salesInvoicesRoutes);

// test
app.get('/', (req, res) => {
  res.send('API is running 🚀');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});