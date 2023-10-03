const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const {
    MongoClient
} = require('mongodb');
var favicon = require('serve-favicon');
const checkAuthenticated = require('./middleware/authenticateJWT');
const app = express();
const port = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}
app.use(bodyParser.json());
app.use(express.static("public"))
app.set('view-engine', 'ejs')
app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(express.urlencoded({
    extended: false
}))
app.use(cookieParser());

const uri = process.env.mongo_host;
const dbName = 'inventoryman';
const {
    getHomePage,
    getOrderPage,
    getBarcodePage
} = require('./dbOps');
const RequestClient = require('twilio/lib/base/RequestClient');
// JWT secret key
const secretKey = process.env.SESSION_SECRET;

// Connect to MongoDB
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
    // Create a Mongo client
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
})
app.get('/register', (req, res) => {
    res.render('register.ejs', {
        messages: {
            error: null
        }
    })
})
// Register a new user
app.post('/register', async (req, res) => {
    const {
        email,
        password,
        role
    } = req.body;

    try {
        // Check if the username is already taken
        const existingUser = await db.collection('users').findOne({
            username: email
        });

        if (existingUser) {
            return res.status(400).json({
                error: 'Username already exists'
            });
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
// User login
app.post('/login', async (req, res) => {
    const {
        email,
        password
    } = req.body;

    try {
        // Find the user by username
        const user = await db.collection('users').findOne({
            username: email
        });

        if (!user) {
            res.render('login.ejs', {
                messages: {
                    error: "Invalid credentials"
                }
            })
            // return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Compare passwords
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            res.render('login.ejs', {
                messages: {
                    error: "Invalid credentials"
                }
            })
            // return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Create and send a JWT token
        const token = jwt.sign({
            username: user.username,
            sub: user.role
        }, secretKey, {
            expiresIn: '1h', // Token expires in 1 hour
        });

        res.cookie('token', token);
        res.cookie('user', email);
        res.cookie('role', user.role);
        res.redirect('/');
    } catch (error) {
        console.error('Error during login:', error);
        //  res.status(500).json({ error: 'Internal Server Error' });
    }
});
app.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login');
})
app.get('/', checkAuthenticated, (req, res) => {
    getHomePage(req, (err, result) => {
        res.render('index.ejs', result);
    });
})

app.get('/orders', checkAuthenticated, (req, res) => {
    getOrderPage(req, (err, result) => {
        res.render('orders.ejs', result);
    });
})
app.get('/viewbarcodepage', checkAuthenticated, (req, res) => {
    getBarcodePage(req, (err, result) => {
        res.render('barcodeFilter.ejs', result);
    });
})

app.get('/viewstocks', checkAuthenticated, (req, res) => {



    const stockCollection = db.collection('stocks');

    stockCollection.find().sort({
        TYear: -1,
        Tmonth: -1,
        TDay: -1,
        StockTime: -1
    }).toArray((err, allStocks) => {
        if (err) {
            console.error('Error querying stock collection:', err);

            return;
        }

        const brandsCollection = db.collection('brands');

        brandsCollection.find().toArray((err1, brands) => {
            if (err1) {
                console.error('Error querying brand collection:', err1);

                return;
            }

            const categoriesCollection = db.collection('categories');

            categoriesCollection.find().toArray((err2, categories) => {
                if (err2) {
                    console.error('Error querying category collection:', err2);

                    return;
                }

                res.render('viewstocks.ejs', {
                    all_stocks: allStocks,
                    brands: brands,
                    categories: categories,
                    display_content: 'None',
                    filter_type: 'None',
                    filter_name: 'None'
                });

            });
        });
    });

})

app.post('/stocks_query', checkAuthenticated, (req, res) => {

    const stockCollection = db.collection('stocks');

    stockCollection.find().sort({
        TYear: -1,
        Tmonth: -1,
        TDay: -1,
        StockTime: -1
    }).toArray((err, allStocks) => {
        if (err) {
            console.error('Error querying stock collection:', err);

            return;
        }

        const brandsCollection = db.collection('brands');

        brandsCollection.find().toArray((err1, brands) => {
            if (err1) {
                console.error('Error querying brand collection:', err1);

                return;
            }

            const categoriesCollection = db.collection('categories');

            categoriesCollection.find().toArray((err2, categories) => {
                if (err2) {
                    console.error('Error querying category collection:', err2);

                    return;
                }

                var selected_item = req.body['exampleRadios'];

                if (selected_item === 'brand') {
                    var brand_name = req.body['selected_brand'];

                    stockCollection.find({
                        Brand: brand_name
                    }).toArray((err3, filteredStocks) => {
                        if (!err3) {
                            res.render('viewstocks.ejs', {
                                all_stocks: allStocks,
                                brands: brands,
                                categories: categories,
                                display_content: filteredStocks,
                                filter_type: 'brand',
                                filter_name: brand_name
                            });
                        } else {
                            console.log(err3);
                        }
                    });
                } else if (selected_item === 'category') {
                    var category_name = req.body['selected_category'];

                    stockCollection.find({
                        Category: category_name
                    }).toArray((err3, filteredStocks) => {
                        if (!err3) {
                            res.render('viewstocks.ejs', {
                                all_stocks: allStocks,
                                brands: brands,
                                categories: categories,
                                display_content: filteredStocks,
                                filter_type: 'category',
                                filter_name: category_name
                            });
                        } else {
                            console.log(err3);
                        }
                    });
                } else {
                    res.render('viewstocks.ejs', {
                        all_stocks: allStocks,
                        brands: brands,
                        categories: categories,
                        display_content: 'None',
                        filter_type: 'None',
                        filter_name: 'None'
                    });
                }

            });
        });
    });

})

app.post('/barcode_query', checkAuthenticated, (req, res) => {


    console.log(req.body);
    const {
        selected_brand,
        selected_category
    } = req.body;
    if (selected_brand == null || selected_category == null) {
        res.render('barcpdegen.ejs', {
            products: []
        });
    }
    const stockCollection = db.collection('stocks');

    stockCollection.find({
        "Category": selected_category,
        "Brand": selected_brand,
    }).sort({
        TYear: -1,
        Tmonth: -1,
        TDay: -1,
        StockTime: -1
    }).toArray((err, allStocks) => {
        if (err) {
            console.error('Error querying stock collection:', err);
            return;
        }
        const brandsCollection = db.collection('brands');

        brandsCollection.find().toArray((err1, brands) => {
            if (err1) {
                console.error('Error querying brand collection:', err1);

                return;
            }

            const categoriesCollection = db.collection('categories');

            categoriesCollection.find().toArray((err2, categories) => {
                if (err2) {
                    console.error('Error querying category collection:', err2);

                    return;
                }
                res.render('barcodeFilter.ejs', {
                    all_stocks: allStocks,
                    brands: brands,
                    categories: categories,
                    // display_content: filteredStocks,
                    filter_type: 'Filter',
                    filter_name: selected_brand + " " + selected_category
                });
            });
        });
    });

})

app.post('/fetchcustomer', checkAuthenticated, (req, res) => {


    const customerCollection = db.collection('customer');
    const PhoneNumber = req.body.PhoneNumber;
    // Find documents from the customer collection based on phone number
    customerCollection.find({
        PhoneNumber: PhoneNumber
    }).toArray((err, rows) => {
        if (!err) {
            res.json({
                success: "Get Successfully",
                status: 200,
                rows: rows
            });
        } else {
            console.log(err);
        }
    });

})

app.post('/fetchitem', checkAuthenticated, (req, res) => {


    const stockCollection = db.collection('stocks');

    const item_id = req.body.itemid;

    // Find documents from the stock collection based on ItemID
    stockCollection.find({
        ItemID: item_id,
        Status: {
            $ne: "sold"
        }
    }).toArray((err, rows) => {
        if (!err) {
            res.json({
                success: "Updated Successfully",
                status: 200,
                rows: rows
            });
        } else {
            console.log(err);
        }

        // Close the MongoDB connection

    });

})

app.post('/fetchorderitem', checkAuthenticated, (req, res) => {


    const stockCollection = db.collection('orders');

    const item_id = req.body.itemid.toString().split('\n')[0];

    // Find documents from the stock collection based on ItemID
    stockCollection.find({
        TransactionID: item_id
    }).toArray((err, rows) => {
        if (!err) {

            if (rows.length > 0) {
                let CustomerPhone = rows[0].CustomerPhone;
                let customDetails = {};
                const customerCollection = db.collection('customer');
                const PhoneNumber = CustomerPhone;
                // Find documents from the customer collection based on phone number
                customerCollection.find({
                    PhoneNumber: PhoneNumber
                }).toArray((err, customerRows) => {
                    if (!err) {
                        customDetails = customerRows[0];

                        rows.forEach(x => {
                            x.CustomerName = customDetails.CustomerName
                            x.CustomerAddress = customDetails.Address
                            x.CustomerPhone = customDetails.PhoneNumber
                            x.CustomerEmail = customDetails.Email
                        })
                        res.json({
                            success: "Get Successfully version 1.0.0",
                            status: 200,
                            rows: rows
                        });
                    } else {
                        console.log(err);
                    }
                });
            }

        } else {
            console.log(err);
        }

        // Close the MongoDB connection

    });

})

app.get('/billing', checkAuthenticated, (req, res) => {


    const categoryCollection = db.collection('categories');
    const brandCollection = db.collection('brands');
    const sizeCollection = db.collection('sizes');

    // Find documents in the category collection
    categoryCollection.find().toArray((err1, category) => {
        if (err1) {
            console.error('Error querying category collection:', err1);

            return;
        }

        // Find documents in the brand collection
        brandCollection.find().toArray((err2, brand) => {
            if (err2) {
                console.error('Error querying brand collection:', err2);

                return;
            }

            // Find documents in the size collection
            sizeCollection.find().toArray((err3, size) => {
                if (err3) {
                    console.error('Error querying size collection:', err3);

                    return;
                }

                // Render the bill.ejs template with the retrieved data
                res.render('bill.ejs', {
                    category: category,
                    brand: brand,
                    size: size
                });

                // Close the MongoDB connection

            });
        });
    });

})

app.post('/addcategory', checkAuthenticated, (req, res) => {



    const categoriesCollection = db.collection('categories');

    const newCategory = {
        Category: req.body.new
    };

    categoriesCollection.insertOne(newCategory, (err2, result) => {
        if (err2) {
            console.error('Error inserting new category:', err2);

            return;
        }

        res.redirect('/categories');

    });

})

app.post('/addbrand', checkAuthenticated, (req, res) => {



    const brandsCollection = db.collection('brands');

    const newBrand = {
        Brand: req.body.new
    };

    brandsCollection.insertOne(newBrand, (err2, result) => {
        if (err2) {
            console.error('Error inserting new brand:', err2);

            return;
        }

        res.redirect('/brands');

    });

})

app.post('/addsize', checkAuthenticated, (req, res) => {



    const sizesCollection = db.collection('sizes');

    const newSize = {
        Size: parseInt(req.body.new)
    };

    sizesCollection.insertOne(newSize, (err2, result) => {
        if (err2) {
            console.error('Error inserting new size:', err2);

            return;
        }

        res.redirect('/sizes');

    });

})

app.get('/orders_query', checkAuthenticated, (req, res) => {
    res.redirect('/orders');
});
app.post('/orders_query', checkAuthenticated, (req, res) => {


    const ordersCollection = db.collection('orders');
    const customerCollection = db.collection('customer');

    // const time_type = req.body['exampleRadios'];
    const phone = req.body['phone'];
    // const month = req.body['month'];
    // const year = req.body['year'];
    console.log(phone);


    let aggregationPipeline = [];
    let month_name = "";
    if (phone != null && phone.length == 10) {
        aggregationPipeline.push({
            $match: {
                CustomerPhone: phone
            }
        }, {
            $group: {
                _id: '$TransactionID',
                Amount: {
                    $sum: '$Amount'
                },
                TransactionDate: {
                    $first: '$TransactionDate'
                },
                TransactionTime: {
                    $first: '$TransactionTime'
                },
                CustomerPhone: {
                    $first: '$CustomerPhone'
                }
            }
        });
    }

    // Aggregate based on the selected time criteria
    ordersCollection.aggregate(aggregationPipeline).toArray((err, rows) => {
        if (!err) {
            // Find all documents in the orders collection
            ordersCollection.find().toArray((err1, rows1) => {
                if (!err1) {

                    if (phone != null && phone.length == 10) {
                        customerCollection.find({
                            "PhoneNumber": {
                                $in: [phone]
                            },
                        }).sort({
                            _id: -1
                        }).toArray((err1, customerInfo) => {
                            res.render('orders.ejs', {
                                orders: rows,
                                customerInfo,
                                sub_orders: rows1,
                                selected_item: "None",
                                month_name: 'Phone',
                                year: phone
                            });
                        });

                    } else {
                        res.render('orders.ejs', {
                            orders: rows,
                            sub_orders: rows1,
                            selected_item: "time_type",
                            month_name: "time_type" === 'month' ? month_name : 'None',
                            year: "selected_year"
                        });
                    }
                } else {
                    console.log(err1);
                }

                // Close the MongoDB connection

            });
        } else {
            console.log(err);

        }
    });

})

app.get('/sales_filter', checkAuthenticated, (req, res) => {
    rows = {}
    res.render('sales_filter.ejs', {
        is_paramater_set: false,
        time_type: 'none',
        filter_type: 'none',
        display_content: rows,
        month_name: 'None',
        year: "None",
        total_amount: "None"
    })
})

app.get('/stock_filter', (req, res) => {
    res.render('stock_filter.ejs', {
        filter_type: 'None',
        display_content: {},
        total_items: {}
    })
})

app.post('/stock_filter_query', checkAuthenticated, (req, res) => {


    const stockCollection = db.collection('stocks');

    var filter_type = req.body['exampleRadios1'];

    if (filter_type === 'brand') {
        stockCollection.aggregate([{
            $addFields: {
                total: {
                    $multiply: ["$Amount", "$Size"]
                }
                // Calculate amount * size and store in a new field called "total"
            }
        },
        {
            $group: {
                _id: "$Brand", // Group by brand
                Amount: {
                    $sum: "$total"
                },
                Brand: {
                    $first: '$Brand'
                }, // Sum the calculated values and store in a field called "totalAmount"
                Count: {
                    $sum: '$Size'
                },
            }
        }, {
            $project: {
                _id: 0,
                Brand: 1,
                Count: 1,
                Amount: 1
            }
        }
        ]).toArray((err, rows) => {
            if (!err) {
                stockCollection.countDocuments({}, (err1, count) => {
                    if (!err1) {
                        res.render('stock_filter.ejs', {
                            filter_type: filter_type,
                            display_content: rows,
                            total_items: count
                        });
                    } else {
                        console.log(err1);
                    }
                });
            } else {
                console.log(err);
            }
        });
    }

    if (filter_type === 'category') {
        stockCollection.aggregate([{
            $addFields: {
                total: {
                    $multiply: ["$Amount", "$Size"]
                }
                // Calculate amount * size and store in a new field called "total"
            }
        }, {
            $group: {
                _id: '$Category',
                Count: {
                    $sum: '$Size'
                },
                Category: {
                    $first: '$Category'
                },
                Amount: {
                    $sum: '$total'
                }
            }
        }, {
            $project: {
                _id: 0,
                Category: 1,
                Count: 1,
                Amount: 1
            }
        }]).toArray((err, rows) => {
            if (!err) {
                stockCollection.countDocuments({}, (err1, count) => {
                    if (!err1) {
                        res.render('stock_filter.ejs', {
                            filter_type: filter_type,
                            display_content: rows,
                            total_items: count
                        });
                    } else {
                        console.log(err1);
                    }
                });
            } else {
                console.log(err);
            }
        });
    }

})

app.post('/sales_filter_query', checkAuthenticated, (req, res) => {


    const ordersCollection = db.collection('orders');

    const time_type = req.body['exampleRadios'];

    if (time_type == 'month') {
        const month = parseInt(req.body['selected_month']);
        const year = parseInt(req.body['selected_year']);
        const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];
        const month_name = monthNames[month - 1];

        const filter_type = req.body['exampleRadios1'];

        const aggregationPipeline = [{
            $match: {
                TMonth: month,
                TYear: year
            }
        }, {
            $group: {
                _id: filter_type === 'all' ? '$TransactionDate' : '$' + filter_type,
                Count: {
                    $sum: 1
                },
                Brand: {
                    $first: '$Brand'
                },
                Category: {
                    $first: '$Category'
                },
                Amount: {
                    $sum: '$Amount'
                }
            }
        }];

        ordersCollection.aggregate(aggregationPipeline).toArray((err, rows) => {
            if (!err) {
                const totalAggregationPipeline = [{
                    $match: {
                        TMonth: month,
                        TYear: year
                    }
                }, {
                    $group: {
                        _id: null,
                        Amount: {
                            $sum: '$Amount'
                        },
                        Count: {
                            $sum: 1
                        }
                    }
                }];

                ordersCollection.aggregate(totalAggregationPipeline).toArray((err1, rows1) => {
                    if (!err1) {
                        res.render('sales_filter.ejs', {
                            is_paramater_set: true,
                            time_type: 'month',
                            filter_type: filter_type,
                            display_content: rows,
                            month_name: month_name,
                            year: year,
                            total_amount: rows1
                        });
                    } else {
                        console.log(err1);
                    }

                });
            } else {
                console.log(err);

            }
        });
    }

    if (time_type == 'year') {
        const year = parseInt(req.body['selected_year']);
        const filter_type = req.body['exampleRadios1'];

        const aggregationPipeline = [{
            $match: {
                TYear: year
            }
        }, {
            $group: {
                _id: filter_type === 'all' ? '$TMonth' : '$' + filter_type,
                Count: {
                    $sum: 1
                },
                Amount: {
                    $sum: '$Amount'
                }
            }
        }];

        ordersCollection.aggregate(aggregationPipeline).toArray((err, rows) => {
            if (!err) {
                const totalAggregationPipeline = [{
                    $match: {
                        TYear: year
                    }
                }, {
                    $group: {
                        _id: null,
                        Amount: {
                            $sum: '$Amount'
                        },
                        Count: {
                            $sum: 1
                        }
                    }
                }];

                ordersCollection.aggregate(totalAggregationPipeline).toArray((err1, rows1) => {
                    if (!err1) {
                        const total_amount = rows1;
                        res.render('sales_filter.ejs', {
                            is_paramater_set: true,
                            time_type: 'year',
                            filter_type: filter_type,
                            display_content: rows,
                            month_name: 'None',
                            year: year,
                            total_amount: total_amount
                        });
                    } else {
                        console.log(err1);
                    }

                    // Close the MongoDB connection

                });
            } else {
                console.log(err);

            }
        });
    }

})

app.get('/categories', checkAuthenticated, (req, res) => {



    const categoriesCollection = db.collection('categories');

    categoriesCollection.find().toArray((err1, category) => {
        if (err1) {
            console.error('Error querying collection:', err1);

            return;
        }

        res.render('categories.ejs', {
            category
        });

    });

})

app.get('/brands', checkAuthenticated, (req, res) => {



    const brandsCollection = db.collection('brands');

    brandsCollection.find().toArray((err2, brand) => {
        if (err2) {
            console.error('Error querying collection:', err2);

            return;
        }

        res.render('brands.ejs', {
            brand
        });

    });

})

app.get('/sizes', checkAuthenticated, (req, res) => {



    const sizesCollection = db.collection('sizes');

    sizesCollection.find().toArray((err2, size) => {
        if (err2) {
            console.error('Error querying collection:', err2);

            return;
        }

        res.render('sizes.ejs', {
            size
        });

    });

})

app.get('/stocks', checkAuthenticated, (req, res) => {



    const categoryCollection = db.collection('categories');
    const brandCollection = db.collection('brands');
    const sizeCollection = db.collection('sizes');

    categoryCollection.find().toArray((err1, category) => {
        if (err1) {
            console.error('Error querying category collection:', err1);

            return;
        }

        brandCollection.find().toArray((err2, brand) => {
            if (err2) {
                console.error('Error querying brand collection:', err2);

                return;
            }

            sizeCollection.find().toArray((err3, size) => {
                if (err3) {
                    console.error('Error querying size collection:', err3);

                    return;
                }

                res.render('stocks.ejs', {
                    category: category,
                    brand: brand,
                    size: size
                });

            });
        });
    });

})
app.post('/submitbill', checkAuthenticated, (req, res) => {


    const ordersCollection = db.collection('orders');
    const stockCollection = db.collection('stocks');
    const customerCollection = db.collection('customer');
    // console.log(req.body);
    let jsonArray = [];
    let counter = 1;
    let obj = {};

    for (let key in req.body) {
        if (key.startsWith('id')) {
            if (obj['id' + counter] !== undefined) {
                jsonArray.push(obj);
                obj = {};
            }
            counter++;
        }
        obj[key] = req.body[key];
    }

    jsonArray.push(obj);

    const jsonArrayFinal = [];
    let currentGroup = {};
    let currentGroupIndex = 0;

    Object.keys(obj).forEach(key => {
        const groupIndex = key.match(/\d+/); // Extract the group index from the key suffix

        if (groupIndex) {
            if (groupIndex[0] != currentGroupIndex) {
                // If a new group is encountered, push the current group into the result array
                if (Object.keys(currentGroup).length > 0) {
                    jsonArrayFinal.push(currentGroup);
                }
                currentGroup = {};
                currentGroupIndex = groupIndex[0];
            }
            // Assign the value to the current group based on the shared prefix
            const sharedPrefix = key.replace(groupIndex[0], '');
            currentGroup[sharedPrefix] = obj[key];
        }
    });

    // Push the last group into the result array
    if (Object.keys(currentGroup).length > 0) {
        jsonArrayFinal.push(currentGroup);
    }
    //console.log(JSON.stringify(jsonArrayFinal));

    // const item_ids = jsonArrayFinal.map(x => x.id);

    const PhoneNumber = req.body.PhoneNumber;
    const CustomerName = req.body.CustomerName;
    const Email = req.body.Email;
    const CGST = req.body.CGST;
    const Pincode = req.body.Pincode;
    const Address = req.body.Address;
    const TodayDate = req.body.todayDate;
    const onlinePayment = req.body.onlinePayment == 'yes' ? true : false;

    // Find documents from the stock collection based on ItemID

    const filter = {
        PhoneNumber: PhoneNumber
    };
    // Define the update document
    const update = {
        $set: {
            'PhoneNumber': PhoneNumber,
            'CustomerName': CustomerName,
            'Email': Email,
            'Address': Address,
            'CGST': CGST,
            'Pincode': Pincode,
        }
    };
    // Define the options for the update operation
    const options = {
        upsert: true,
        returnOriginal: false
    };
    customerCollection.findOneAndUpdate(filter, update, options);
    const request1 = jsonArrayFinal.filter(x => x.id != "");
    const date_format = new Date();

    const transaction_date = date_format.getDate() + '/' + (parseInt(date_format.getMonth() + 1)).toString() + '/' + date_format.getFullYear();
    const transaction_time = date_format.getHours() + ':' + date_format.getMinutes() + ':' + date_format.getSeconds();
    const transaction_id = "TCH" + date_format.getDate() + date_format.getMonth() + date_format.getFullYear() + date_format.getHours() + date_format.getMinutes() + date_format.getSeconds();
    // Insert data into orders collection
    var billAdd = [];
    request1.forEach((ddd) => {
        billAdd.push({
            ItemID: ddd.id,
            OnlinePayment: onlinePayment,
            Category: ddd.category,
            Brand: ddd.brand,
            ItemName: ddd.product,
            Size: parseInt(ddd.unit),
            GST: parseFloat(ddd.gst),
            Discount: parseFloat(ddd.discount),
            Amount: parseFloat(ddd.amount),
            Price: parseFloat(ddd.price),
            CustomerPhone: PhoneNumber,
            BillDate: TodayDate,
            TransactionDate: transaction_date,
            TransactionTime: transaction_time,
            TransactionID: transaction_id,
            TDay: parseInt(date_format.getDate()),
            TMonth: parseInt(date_format.getMonth() + 1),
            TYear: parseInt(date_format.getFullYear())
        });
    })



    ordersCollection.insertMany(billAdd, (err, result) => {
        if (!err) {

            billAdd.forEach((item) => {
                const {
                    ItemID,
                    Size
                } = item;

                stockCollection.updateOne({
                    ItemID
                }, {
                    $inc: {
                        Size: -Size
                    }
                },
                    (err, result) => {
                        if (err) {
                            console.log('Error updating product:', err);
                        } else {
                            console.log(`Product with ID ${ItemID} updated successfully`);
                        }
                    }
                );

            });



            if (req.body.sendMail == "on") {
                sendMail(billAdd, billAdd[0].CustomerEmail).catch(console.error);
            }

            res.redirect('/orders');
        } else {
            console.log(err);

        }
    });

})

app.post('/submitstock', checkAuthenticated, (req, res) => {


    const stockCollection = db.collection('stocks');

    const request1 = req.body;

    const date_format = new Date();
    const transaction_date =
        date_format.getDate() +
        '/' +
        (parseInt(date_format.getMonth() + 1)).toString() +
        '/' +
        date_format.getFullYear();

    const transaction_time =
        date_format.getHours() +
        ':' +
        date_format.getMinutes() +
        ':' +
        date_format.getSeconds();

    const new_req = {};

    for (const i in request1) {
        if (i.includes('number') || i.includes('total')) {
            delete request1[i];
        } else {
            new_req[i] = request1[i];
        }
    }

    const data = Object.entries(new_req).reduce((carry, [key, value]) => {
        const [text] = key.split(/\d+/);
        const index = key.substring(text.length) - 1;
        if (!Array.isArray(carry[index]))
            carry[index] = [];
        carry[index].push(value);
        return carry;
    }, []);

    for (let i = 0; i < data.length; i++) {
        data[i].push(transaction_date);
        data[i].push(transaction_time);
        data[i].push(date_format.getDate());
        data[i].push(date_format.getMonth() + 1);
        data[i].push(date_format.getFullYear());
    }

    var stockAdd = [];
    data.forEach(datas => {
        stockAdd.push({
            ItemID: datas[0],
            ItemName: datas[1],
            Category: datas[2],
            Brand: datas[3],
            Size: parseInt(datas[4]),
            Amount: parseFloat(datas[5]),
            StockDate: datas[6],
            StockTime: datas[7],
            TDay: parseInt(datas[8]),
            TMonth: parseInt(datas[9]),
            TYear: parseInt(datas[10])
        })
    })

    stockCollection.insertMany(stockAdd, (err, result) => {
        if (err) {
            console.error('Error inserting values:', err);

            return;
        }

        res.redirect('/viewstocks');

    });

})

app.post('/deleteitem', checkAuthenticated, (req, res) => {


    const ordersCollection = db.collection('orders');

    const deleteid = req.body.deleteid;

    var objectId2 = new ObjectID(deleteid);

    ordersCollection.deleteMany({
        _id: objectId2
    }, (err, result) => {
        console.log('deleting order ' + deleteid);
        if (err) {
            console.error('Error deleting value:', err);

            return;
        }

        res.redirect('/orders');

    });

})

app.post('/deletecategory', checkAuthenticated, (req, res) => {

    const categoriesCollection = db.collection('categories');

    const deleteCategory = req.body.deleteid;

    categoriesCollection.deleteOne({
        Category: deleteCategory
    }, (err2, result) => {
        if (err2) {
            console.error('Error deleting category:', err2);

            return;
        }

        res.redirect('/categories');

    });

})

app.post('/deletebrand', checkAuthenticated, (req, res) => {

    const brandsCollection = db.collection('brands');

    const deleteBrand = req.body.deleteid;

    brandsCollection.deleteOne({
        Brand: deleteBrand
    }, (err2, result) => {
        if (err2) {
            console.error('Error deleting brand:', err2);

            return;
        }

        if (result.deletedCount > 0) { } else { }

        res.redirect('/brands');

    });

})

app.post('/deletesize', checkAuthenticated, (req, res) => {

    const sizesCollection = db.collection('sizes');

    const deleteSize = req.body.deleteid;

    sizesCollection.deleteOne({
        Size: deleteSize
    }, (err2, result) => {
        if (err2) {
            console.error('Error deleting size:', err2);

            return;
        }
        res.redirect('/sizes');
    });

})

app.post('/barcodegen', checkAuthenticated, (req, res) => {
    res.render('barcodegen.ejs', {
        products: JSON.parse(req.body.allStocks)
    });

})

app.post('/deletestock', checkAuthenticated, (req, res) => {


    const stockCollection = db.collection('stocks');

    const deleteid = req.body.deleteid;

    stockCollection.deleteMany({
        ItemID: deleteid
    }, (err, result) => {
        if (err) {
            console.error('Error deleting value:', err);

            return;
        }

        res.redirect('/viewstocks');

    });

})

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});