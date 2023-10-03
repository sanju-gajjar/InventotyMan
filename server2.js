const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const {
    MongoClient
} = require('mongodb');
let favicon = require('serve-favicon');
const checkAuthenticated = require('./middleware/authenticateJWT');
const app = express();
const port = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}
app.use(bodyParser.json());
app.use(express.static("public"));
app.set('view-engine', 'ejs');
app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(express.urlencoded({
    extended: false
}));
app.use(cookieParser());
const uri = process.env.mongo_host;
const dbName = 'inventoryman';
const {
    getHomePage,
    getOrderPage,
    getBarcodePage
} = require('./dbOps');
const RequestClient = require('twilio/lib/base/RequestClient');
const secretKey = process.env.SESSION_SECRET;
let db;
function getUserRole(req) {
    const user = req.cookies.user;
    const role = req.cookies.role;
    return {
        user,
        role
    };
}
async function connectToMongo() {
    const client = new MongoClient(uri, {
        useUnifiedTopology: true
    });
    await client.connect();
    db = client.db(dbName);
    console.log('Connected to MongoDB');
}
connectToMongo();
app.get('/login', (req, res) => {
    res.render('login.ejs', {
        messages: {
            error: null
        }
    })
});
app.get('/register', (req, res) => {
    res.render('register.ejs', {
        messages: {
            error: null
        }
    })
});
app.post('/register', async (req, res) => {
    const {
        email,
        password,
        role
    } = req.body;
    try {
        const existingUser = await db.collection('users').findOne({
            username: email
        });
        if (existingUser) {
            return res.status(400).json({
                error: 'Username already exists'
            });
        }
        bcrypt.genSalt(10, (err, salt) => {
            if (err) {
                throw err;
            }
            bcrypt.hash(password, salt, async (err, hashedPassword) => {
                if (err) {
                    throw err;
                }
                await db.collection('users').insertOne({
                    username: email,
                    password: hashedPassword,
                    role
                });
                res.render('login.ejs', {
                    messages: {
                        error: "User registered successfully, Login to continue"
                    }
                });
            });
        });
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({
            error: 'Internal Server Error'
        });
    }
});
app.post('/login', async (req, res) => {
    const {
        email,
        password
    } = req.body;
    try {
        const user = await db.collection('users').findOne({
            username: email
        });
        if (!user) {
            res.render('login.ejs', {
                messages: {
                    error: "Invalid credentials"
                }
            })
        }
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            res.render('login.ejs', {
                messages: {
                    error: "Invalid credentials"
                }
            })
        }
        const token = jwt.sign({
            username: user.username,
            sub: user.role
        }, secretKey, {
            expiresIn: '1h',
        });
        res.cookie('token', token);
        res.cookie('user', email);
        res.cookie('role', user.role);
        res.redirect('/');
    } catch (error) {
        console.error('Error during login:', error);
    }
});
app.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login');
});
app.get('/', checkAuthenticated, (req, res) => {
    getHomePage(req, (err, result) => {
        res.render('index.ejs', result);
    });
});
app.get('/orders', checkAuthenticated, (req, res) => {
    getOrderPage(req, (err, result) => {
        res.render('orders.ejs', result);
    });
});
app.get('/viewbarcodepage', checkAuthenticated, (req, res) => {
    getBarcodePage(req, (err, result) => {
        res.render('barcodeFilter.ejs', result);
    });
});
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});