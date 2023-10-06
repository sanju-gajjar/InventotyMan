if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}
const express = require('express');
const webpack = require('webpack');
const webpackConfig = require('./webpack.config.js');
const {
    MongoClient
} = require('mongodb');
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
    getStockQuery,
    deleteStock,
    fetStockItem
} = require('./stockOps');
const {
    getBarcodeQuery
} = require('./barcodeOps');
const {
    getCustomer
} = require('./customerOps.js');
const {
    getBillPage,
    submitBill,
    fetchOrderItem
} = require('./orderOps.js');
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
function renderTml(filename, tmlData) {
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
        user: getUserRole(req),
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
                                user: getUserRole(req),
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
                            user: getUserRole(req),
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
        user: getUserRole(req),
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
        user: getUserRole(req),
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
        }, {
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
                            user: getUserRole(req),
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
        }
        ]).toArray((err, rows) => {
            if (!err) {
                stockCollection.countDocuments({}, (err1, count) => {
                    if (!err1) {
                        res.render('stock_filter.ejs', {
                            user: getUserRole(req),
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
        }
        ];

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
                }
                ];

                ordersCollection.aggregate(totalAggregationPipeline).toArray((err1, rows1) => {
                    if (!err1) {
                        res.render('sales_filter.ejs', {
                            user: getUserRole(req),
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

                    // Close the MongoDB connection

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
        }
        ];

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
                }
                ];

                ordersCollection.aggregate(totalAggregationPipeline).toArray((err1, rows1) => {
                    if (!err1) {
                        const total_amount = rows1;
                        res.render('sales_filter.ejs', {
                            user: getUserRole(req),
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
            user: getUserRole(req),
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
            user: getUserRole(req),
            brand
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
                    user: getUserRole(req),
                    category: category,
                    brand: brand,
                    size: size
                });

            });
        });
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

        if (result.deletedCount > 0) { }
        else { }

        res.redirect('/brands');

    });

})

async function sendMail(orderDetails, to) {

    var htmlOrderTable = "";
    var invoiceNumber = orderDetails[0].TransactionID;
    var customerName = orderDetails[0].CustomerName;
    orderDetails.forEach((order) => {
        htmlOrderTable = htmlOrderTable + `<tr><td style="padding: 5px 10px 5px 0"width="80%"align="left"><p>₹{order.ItemName}</p></td><td style="padding: 5px 0"width="20%"align="left"><p>₹{order.Amount}</p></td></tr>`;
    })
    // SMTP config
    const transporter = nodemailer.createTransport({
        host: "mail.thecyclehub.co.in", //
        port: 465,
        auth: {
            user: "phoner@thecyclehub.co.in", // Your Ethereal Email address
            pass: "Keyur@123", // Your Ethereal Email password
        },
    }); // Send the email
    let info = await transporter.sendMail({
        from: '"Keyur Gajjar" <phoner@thecyclehub.co.in>',
        to: to, //'sanju.gajjar2@gmail.com', // Test email address
        subject: `Thank for shoping at Phoner #Invoice: ${invoiceNumber}`,
        text: `Hi, ${customerName}`,
        html: `<!DOCTYPE html PUBLIC'-//W3C//DTD XHTML 1.0 Transitional//EN''http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd'><html xmlns='http://www.w3.org/1999/xhtml'xmlns:o='urn:schemas-microsoft-com:office:office'><head><meta charset='UTF-8'><meta content='width=device-width, initial-scale=1'name='viewport'><meta name='x-apple-disable-message-reformatting'><meta http-equiv='X-UA-Compatible'content='IE=edge'><meta content='telephone=no'name='format-detection'><title></title><!--[if(mso 16)]><style type='text/css'>a{text-decoration:none;}</style><![endif]--><!--[if gte mso 9]><style>sup{font-size:100%!important;}</style><![endif]--><!--[if gte mso 9]><xml><o:OfficeDocumentSettings><o:AllowPNG></o:AllowPNG><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]--></head><body><div class='es-wrapper-color'><!--[if gte mso 9]><v:background xmlns:v='urn:schemas-microsoft-com:vml'fill='t'><v:fill type='tile'color='#eeeeee'></v:fill></v:background><![endif]--><table class='es-wrapper'width='100%'cellspacing='0'cellpadding='0'><tbody><tr><td class='esd-email-paddings'valign='top'><table cellpadding='0'cellspacing='0'class='es-content esd-header-popover'align='center'><tbody><tr><td class='esd-stripe'esd-custom-block-id='7954'align='center'><table class='es-content-body'style='background-color: transparent;'width='600'cellspacing='0'cellpadding='0'align='center'><tbody><tr><td class='esd-structure es-p15t es-p15b es-p10r es-p10l'align='left'><!--[if mso]><table width='580'cellpadding='0'cellspacing='0'><tr><td width='282'valign='top'><![endif]--><table class='es-left'cellspacing='0'cellpadding='0'align='left'><tbody><tr><td class='esd-container-frame'width='282'align='left'><table width='100%'cellspacing='0'cellpadding='0'><tbody><tr><td class='es-infoblock esd-block-text es-m-txt-c'align='left'><p style='font-family: arial, helvetica\ neue, helvetica, sans-serif;'>Put your preheader text here<br></p></td></tr></tbody></table></td></tr></tbody></table><!--[if mso]></td><td width='20'></td><td width='278'valign='top'><![endif]--><table class='es-right'cellspacing='0'cellpadding='0'align='right'><tbody><tr><td class='esd-container-frame'width='278'align='left'><table width='100%'cellspacing='0'cellpadding='0'><tbody><tr><td align='right'class='es-infoblock esd-block-text es-m-txt-c'><p><a href='https://viewstripo.email'class='view'target='_blank'style='font-family: 'arial', 'helvetica neue', 'helvetica', 'sans-serif';'>View in browser</a></p></td></tr></tbody></table></td></tr></tbody></table><!--[if mso]></td></tr></table><![endif]--></td></tr></tbody></table></td></tr></tbody></table><table class='es-content'cellspacing='0'cellpadding='0'align='center'><tbody><tr></tr><tr><td class='esd-stripe'esd-custom-block-id='7681'align='center'><table class='es-header-body'style='background-color: #044767;'width='600'cellspacing='0'cellpadding='0'bgcolor='#044767'align='center'><tbody><tr><td class='esd-structure es-p35t es-p35b es-p35r es-p35l'align='left'><!--[if mso]><table width='530'cellpadding='0'cellspacing='0'><tr><td width='340'valign='top'><![endif]--><table class='es-left'cellspacing='0'cellpadding='0'align='left'><tbody><tr><td class='es-m-p0r es-m-p20b esd-container-frame'width='340'valign='top'align='center'><table width='100%'cellspacing='0'cellpadding='0'><tbody><tr><td class='esd-block-text es-m-txt-c'align='left'><h1 style='color: #ffffff; line-height: 100%;'>Phoner</h1></td></tr></tbody></table></td></tr></tbody></table><!--[if mso]></td><td width='20'></td><td width='170'valign='top'><![endif]--><table cellspacing='0'cellpadding='0'align='right'><tbody><tr class='es-hidden'><td class='es-m-p20b esd-container-frame'esd-custom-block-id='7704'width='170'align='left'><table width='100%'cellspacing='0'cellpadding='0'><tbody><tr><td class='esd-block-spacer es-p5b'align='center'style='font-size:0'><table width='100%'height='100%'cellspacing='0'cellpadding='0'border='0'><tbody><tr><td style='border-bottom: 1px solid #044767; background: rgba(0, 0, 0, 0) none repeat scroll 0% 0%; height: 1px; width: 100%; margin: 0px;'></td></tr></tbody></table></td></tr><tr><td><table cellspacing='0'cellpadding='0'align='right'><tbody><tr><td align='left'><table width='100%'cellspacing='0'cellpadding='0'><tbody><tr><td class='esd-block-text'align='right'><p>The Cycle Hub</p></td></tr></tbody></table></td><td class='esd-block-image es-p10l'valign='top'align='left'style='font-size:0'></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table><!--[if mso]></td></tr></table><![endif]--></td></tr></tbody></table></td></tr></tbody></table><table class='es-content'cellspacing='0'cellpadding='0'align='center'><tbody><tr><td class='esd-stripe'align='center'><table class='es-content-body'width='600'cellspacing='0'cellpadding='0'bgcolor='#ffffff'align='center'><tbody><tr><td class='esd-structure es-p40t es-p35b es-p35r es-p35l'esd-custom-block-id='7685'style='background-color: #f7f7f7;'bgcolor='#f7f7f7'align='left'><table width='100%'cellspacing='0'cellpadding='0'><tbody><tr><td class='esd-container-frame'width='530'valign='top'align='center'><table width='100%'cellspacing='0'cellpadding='0'><tbody><tr><td class='esd-block-image es-p20t es-p25b es-p35r es-p35l'align='center'style='font-size:0'></td></tr><tr><td class='esd-block-text es-p15b'align='center'><h2 style='color: #333333; font-family: 'open sans', 'helvetica neue', helvetica, arial, sans-serif;'>Thanks for your purchase</h2></td></tr><tr><td class='esd-block-text es-m-txt-l es-p20t'align='left'><h3 style='font-size: 18px;'>Hello NAME,</h3></td></tr><tr><td class='esd-block-text es-p15t es-p10b'align='left'><p style='font-size: 16px; color: #777777;'>Please find the invoice below for your purchase</p></td></tr></tbody></table></td></tr></tbody></table></td></tr><tr><td class='esd-structure es-p40t es-p40b es-p35r es-p35l'esd-custom-block-id='7685'align='left'><table width='100%'cellspacing='0'cellpadding='0'><tbody><tr><td class='esd-container-frame'width='530'valign='top'align='center'><table width='100%'cellspacing='0'cellpadding='0'><tbody><tr><td class='esd-block-text es-p20t'align='center'><h3 style='color: #333333;'>INVOICE</h3></td></tr><tr><td class='esd-block-text es-p15t es-p10b'align='center'><p style='font-size: 16px; color: #777777;'>INVOICE NUMBER: ${invoiceNumber}</p></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table><table cellpadding='0'cellspacing='0'class='es-content'align='center'><tbody><tr><td class='esd-stripe'align='center'><table class='es-content-body'width='600'cellspacing='0'cellpadding='0'bgcolor='#ffffff'align='center'><tbody><tr><td class='esd-structure es-p20t es-p35r es-p35l'align='left'><table width='100%'cellspacing='0'cellpadding='0'><tbody><tr><td class='esd-container-frame'width='530'valign='top'align='center'><table width='100%'cellspacing='0'cellpadding='0'><tbody><tr><td class='esd-block-text es-p10t es-p10b es-p10r es-p10l'bgcolor='#eeeeee'align='left'><table style='width: 500px;'class='cke_show_border'cellspacing='1'cellpadding='1'border='0'align='left'><tbody><tr><td width='80%'><h4>Order Confirmation#</h4></td><td width='20%'><h4>${invoiceNumber}</h4></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr><tr><td class='esd-structure es-p35r es-p35l'align='left'><table width='100%'cellspacing='0'cellpadding='0'><tbody><tr><td class='esd-container-frame'width='530'valign='top'align='center'><table width='100%'cellspacing='0'cellpadding='0'><tbody><tr><td class='esd-block-text es-p10t es-p10b es-p10r es-p10l'align='left'><table style='width: 500px;'class='cke_show_border'cellspacing='1'cellpadding='1'border='0'align='left'><tbody>${htmlOrderTable}</tbody></table></td></tr></tbody></table></td></tr><tr><td class='esd-structure es-p10t es-p35r es-p35l'align='left'><table width='100%'cellspacing='0'cellpadding='0'><tbody><tr><td class='esd-container-frame'width='530'valign='top'align='center'><table style='border-top: 3px solid #eeeeee; border-bottom: 3px solid #eeeeee;'width='100%'cellspacing='0'cellpadding='0'><tbody><tr><td class='esd-block-text es-p15t es-p15b es-p10r es-p10l'align='left'><table style='width: 500px;'class='cke_show_border'cellspacing='1'cellpadding='1'border='0'align='left'><tbody><tr><td width='80%'><h4>TOTAL</h4></td><td width='20%'><h4>$115.00</h4></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table><table class='es-content'cellspacing='0'cellpadding='0'align='center'><tbody><tr></tr><tr><td class='esd-stripe'esd-custom-block-id='7797'align='center'><table class='es-content-body'style='background-color: #1b9ba3;'width='600'cellspacing='0'cellpadding='0'bgcolor='#1b9ba3'align='center'><tbody><tr><td class='esd-structure es-p35t es-p35b es-p35r es-p35l'align='left'><table cellpadding='0'cellspacing='0'width='100%'><tbody><tr><td width='530'align='left'class='esd-container-frame'><table cellpadding='0'cellspacing='0'width='100%'><tbody><tr><td align='center'class='esd-empty-container'style='display: none;'></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table><table class='es-footer'cellspacing='0'cellpadding='0'align='center'><tbody><tr><td class='esd-stripe'esd-custom-block-id='7684'align='center'><table class='es-footer-body'width='600'cellspacing='0'cellpadding='0'align='center'><tbody><tr><td class='esd-structure es-p35t es-p40b es-p35r es-p35l'align='left'><table width='100%'cellspacing='0'cellpadding='0'><tbody><tr><td class='esd-container-frame'width='530'valign='top'align='center'><table width='100%'cellspacing='0'cellpadding='0'><tbody><tr><td class='esd-block-text es-p35b'align='center'><p><b>Keyur Gajjar</b></p></td></tr><tr><td esdev-links-color='#777777'align='left'class='esd-block-text es-m-txt-c es-p5b'><p style='color: #777777;'>Thanks your shooping and waiting for your next visit.</p></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table><table class='esd-footer-popover es-content'cellspacing='0'cellpadding='0'align='center'><tbody><tr><td class='esd-stripe'align='center'><table class='es-content-body'style='background-color: transparent;'width='600'cellspacing='0'cellpadding='0'align='center'><tbody><tr><td class='esd-structure es-p30t es-p30b es-p20r es-p20l'align='left'><table width='100%'cellspacing='0'cellpadding='0'><tbody><tr><td class='esd-container-frame'width='560'valign='top'align='center'><table width='100%'cellspacing='0'cellpadding='0'><tbody><tr><td align='center'class='esd-empty-container'style='display: none;'></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table></div></body></html>`,
    });
    console.log("Message sent: %s", info); // Output message ID
    console.log("View email: %s", nodemailer.getTestMessageUrl(info)); // URL to preview email
}
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});