const {
    connectToMongo
} = require('./db/db');
connectToMongo();
function getUserRole(req) {
    const user = req.cookies.user;
    const role = req.cookies.role;
    return { user, role };
}
exports.getHomePage = function (req,callback) {
    const stockCollection = db.collection('stocks');
    stockCollection.find({}).toArray((err, resultStocksCount) => {
        if (err) { 
            console.log(err);
        }
        const pipelineStock = [{
            $addFields: {
                total: {
                    $multiply: ["$Amount", "$Size"]
                }
            }
        },
        {
            $group: {
                _id: '_id',
                TotalItemsOrdered: {
                    $sum: '$total'
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
                    $addFields: {
                        total: {
                            $multiply: ["$Amount", "$Size"]
                        }
                        // Calculate amount * size and store in a new field called "total"
                    }
                }, {
                    $group: {
                        _id: '_id',
                        TotalItemsOrdered: {
                            $sum: '$total'
                        }
                    }
                }];
                ordersCollection.aggregate(pipeline).toArray((err, result) => {
                    if (err) {
                        console.error('Error executing aggregation:', err);

                        return;
                    }

                    if (resultStock.length > 0) {
                        var returnData = {
                            user: getUserRole(req),
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
                        }
                        callback(err, returnData);
                       // res.render('index.ejs', returnData);
                    } else {
                        var returnData= {
                            user: getUserRole(req),
                            total_sales: [],
                            ord_num: [],
                            stock_num: [],
                            total_stock: []
                        };
                        callback(err, returnData);
                    }
                });
            });
        });
    });
}
exports.getOrderPage = function (req, callback) { 
    const ordersCollection = db.collection('orders');
    const customerCollection = db.collection('customer');
    ordersCollection.aggregate([{
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
    }]).toArray((err, rows) => {
        if (!err) {
            ordersCollection.find().sort({
                _id: -1
            }).toArray((err1, rows1) => {
                if (!err1) {

                    let customerPhonesList = rows.map(x => x.CustomerPhone)
                    customerCollection.find({
                        "PhoneNumber": {
                            $in: customerPhonesList
                        },
                    }).sort({
                        _id: -1
                    }).toArray((err1, customerInfo) => {
                        if (customerInfo != null) {
                            let result= {
                                user: getUserRole(req),
                                orders: rows,
                                sub_orders: rows1,
                                customerInfo: customerInfo,
                                selected_item: 'None',
                                month_name: 'None',
                                year: 'None'
                            };
                            callback(err, result);
                        } else {
                            let result = { 
                                user: getUserRole(),
                                orders: rows,
                                sub_orders: rows1,
                                customerInfo: undefined,
                                selected_item: 'None',
                                month_name: 'None',
                                year: 'None'
                        };
                        callback(err, result);
                        }
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

exports.getBarcodePage = function (req, callback) { 
    try {

        const brandsCollection = db.collection('brands');

        brandsCollection.find().toArray((err1, brands) => {
            if (err1) {
                console.error('Error querying brand collection:', err1);
                callback(err1, null);
            }

            const categoriesCollection = db.collection('categories');

            categoriesCollection.find().toArray((err2, categories) => {
                if (err2) {
                    console.error('Error querying category collection:', err2);

                    callback(err2, null);
                }
                let result = {
                    user: getUserRole(req),
                    brands: brands,
                    categories: categories,
                    display_content: 'None',
                    filter_type: 'None',
                    filter_name: 'None'
                };
                callback(err2, result);

            });
        });
    } catch (error) {
        console.log(error);
    }
}
exports.getViewStocks = function (req, callback) { 
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
                let result={
                    user: getUserRole(req),
                    all_stocks: allStocks,
                    brands: brands,
                    categories: categories,
                    display_content: 'None',
                    filter_type: 'None',
                    filter_name: 'None'
               };
                callback(err2, result);
            });
        });
    });
}