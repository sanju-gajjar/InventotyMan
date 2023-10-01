const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { MongoClient } = require('mongodb');
const nodemailer = require("nodemailer");
var favicon = require('serve-favicon');
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static("public"))
app.set('view-engine', 'ejs')
app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(express.urlencoded({
    extended: false
}))
// MongoDB connection URI
const mongoURI = process.env.mongo_host;
const dbName = 'inventoryman';

// JWT secret key
const secretKey = 'your-secret-key';

// Connect to MongoDB
let db;

async function connectToMongo() {
    const client = new MongoClient(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
    db = client.db(dbName);
    console.log('Connected to MongoDB');
}

connectToMongo();

app.get('/login', (req, res) => {
    res.render('login.ejs', { messages: {error:null} })
})

// Register a new user
app.post('/register', async (req, res) => {
    const { username, password,role } = req.body;

    try {
        // Check if the username is already taken
        const existingUser = await db.collection('users').findOne({ username });

        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Generate a salt and hash the password
        bcrypt.genSalt(10, (err, salt) => {
            if (err) {
                throw err;
            }

            bcrypt.hash(password, salt, async (err, hashedPassword) => {
                if (err) {
                    throw err;
                }

                // Create a new user document and insert it into the 'users' collection
                await db.collection('users').insertOne({ username, password: hashedPassword,role });

                res.status(201).json({ message: 'User registered successfully' });
            });
        });
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/', (req, res) => {
    
    const authToken = req.session.authToken;

    if (!authToken) {
        return res.redirect('/login');
    }
    //
    // if (err) {
    //   console.error('Error connecting to MongoDB:', err);
    //   return;
    // }


    const db = getDatabase(dbName);

    const stockCollection = db.collection('stocks');

    stockCollection.find({}).toArray((err, resultStocksCount) => {

        const pipelineStock = [{
            $group: {
                _id: '_id',
                TotalItemsOrdered: {
                    $sum: '$Amount'
                }
            }
        }
        ];
        stockCollection.aggregate(pipelineStock).toArray((err, resultStock) => {
            if (err) {
                console.error('Error executing aggregation:', err);

                return;
            }
            const ordersCollection = db.collection('orders');

            ordersCollection.find({}).toArray((err, resultCount) => {

                const pipeline = [{
                    $group: {
                        _id: '_id',
                        TotalItemsOrdered: {
                            $sum: '$Amount'
                        }
                    }
                }
                ];
                ordersCollection.aggregate(pipeline).toArray((err, result) => {
                    if (err) {
                        console.error('Error executing aggregation:', err);

                        return;
                    }

                    if (resultStock.length > 0) {
                        //
                        res.render('index.ejs', {
                            total_sales: result,
                            ord_num: [{
                                NumberOfProducts: (resultCount != null && resultCount != undefined) ? resultCount.length : 0
                            }
                            ],
                            stock_num: [{
                                NumberOfProducts: (resultStocksCount.length != null && resultStocksCount.length != undefined) ? resultStocksCount.length : 0
                            }
                            ],
                            total_stock: resultStock,
                        });
                    } else {
                        //
                        res.render('index.ejs', {
                            total_sales: [],
                            ord_num: [],
                            stock_num: [],
                            total_stock: []
                        });
                    }
                });
            });
        });
        //
    });

    //  });
})
// User login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Find the user by username
        const user = await db.collection('users').findOne({ username });

        console.log("data login",user);

        if (!user) {
            res.render('login.ejs', { messages: { error: "Invalid credentials" } })
           // return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Compare passwords
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            res.render('login.ejs', { messages: { error: "Invalid credentials" } })
           // return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Create and send a JWT token
        const token = jwt.sign({ username: user.username,sub:user.role }, secretKey, {
            expiresIn: '1h', // Token expires in 1 hour
        });
        req.session.authToken = token;
        res.redirect('/');
    } catch (error) {
        console.error('Error during login:', error);
      //  res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Middleware for authenticating routes
function authenticateJWT(req, res, next) {
    const token = req.header('Authorization');

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    jwt.verify(token, secretKey, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        req.user = user;
        next();
    });
}

// Protected route (authentication required)
app.get('/protected', authenticateJWT, (req, res) => {
    res.json({ message: 'Protected route accessed successfully' });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
