const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();

const reportsRoutes=require('./routes/reports');

app.use(cors());
app.use(express.json());

// routes
app.use('/customers', require('./routes/customers'));
app.use('/installments', require('./routes/installments'));
app.use('/payments', require('./routes/payments'));
app.use('/auth', require('./routes/auth'));
app.use('/reports',reportsRoutes);

// test
app.get('/', (req, res) => {
  res.send('API is running 🚀');
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});