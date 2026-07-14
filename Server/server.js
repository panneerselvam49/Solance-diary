const express = require('express');
require('dotenv').config();
const cors = require('cors');
const connectDB = require('./config');
const apiRoutes = require('./routes/api');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Connect Database
connectDB();

// Routes
app.use('/api', apiRoutes);

app.listen(4500, () => {
    console.log(`Server running at http://localhost:4500`);
});
