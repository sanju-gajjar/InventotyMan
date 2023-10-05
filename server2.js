if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}
const express = require('express');
const webpack = require('webpack');
const webpackConfig = require('./webpack.config.js');
const { MongoClient } = require('mongodb');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
let favicon = require('serve-favicon');
const compression = require('compression');
const ejs = require('ejs');
const fs = require('fs');
const checkAuthenticated = require('./middleware/authenticateJWT');
const app = express();
const compiler = webpack(webpackConfig);
app.use(require('webpack-dev-middleware')(compiler, {
    publicPath: webpackConfig.output.publicPath
}));
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static("public"));
app.set('views', './views');
app.set('view-engine', 'ejs');
app.use(compression());
app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(express.urlencoded({
    extended: false
}));
app.use(cookieParser());

const {
    getHomePage,
    getOrderPage,
    getBarcodePage,
    getViewStocks,
} = require('./dbOps');
const {
    getStockQuery, deleteStock, fetStockItem
} = require('./stockOps');
const {
     getBarcodeQuery
} = require('./barcodeOps');
const {
    getCustomer
} = require('./customerOps.js');
const { getBillPage, submitBill, fetchOrderItem } = require('./orderOps.js');
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
function renderTml(filename,tmlData) { 
    const template = fs.readFileSync(filename, 'utf-8');
    const compiledTemplate = ejs.compile(template);
    return compiledTemplate(tmlData);
}
const uri = process.env.mongo_host;
const dbName = 'inventoryman';
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
    let data = {
        messages: {
            error: null
        }
    };
    res.send(renderTml('views/login.ejs', data))
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
app.get('/viewstocks', checkAuthenticated, (req, res) => {
    getViewStocks(req, (err, result) => {
        res.render('viewstocks.ejs', result);
    });
});
app.post('/stocks_query', checkAuthenticated, (req, res) => {
    getStockQuery(req, (err, result) => {
        res.render('viewstocks.ejs', result);
    });
});
app.post('/barcode_query', checkAuthenticated, (req, res) => {
    getBarcodeQuery(req, (err, result) => {
        res.render('barcodeFilter.ejs', result);
    });
});
app.post('/fetchcustomer', checkAuthenticated, (req, res) => {
    getCustomer(req, (err, result) => {
        res.json(result);
    });
});
app.post('/barcodegen', checkAuthenticated, (req, res) => {
    res.render('barcodegen.ejs', {
        products: JSON.parse(req.body.allStocks)
    });
});
app.post('/deletestock', checkAuthenticated, (req, res) => {
    deleteStock(req, (err, result) => {
        res.redirect('/viewstocks');
    });
})
app.post('/fetchitem', checkAuthenticated, (req, res) => {
    fetStockItem(req, (err, result) => {
        res.json(result);
    });
})
app.get('/billing', checkAuthenticated, (req, res) => {
    getBillPage(req, (err, result) => {
        res.render('bill.ejs', result)
    });
});
app.post('/submitbill', checkAuthenticated, (req, res) => {
    submitBill(req, (err, result) => {
        res.redirect('/orders');
    });
})
app.post('/fetchorderitem', checkAuthenticated, (req, res) => {
    fetchOrderItem(req, (err, result) => {
        res.json(result);
    });
})
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
