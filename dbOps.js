
const {
    getDatabase,
    close
} = require('./db/db');
function getHomePage() { 
    const db = getDatabase(dbName);

    const stockCollection = db.collection('stocks');
    stockCollection.find({}).toArray((err, resultStocksCount) => {
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
                        //
                        return {
                            total_sales: result,
                            ord_num: [{
                                NumberOfProducts: (resultCount != null && resultCount != undefined) ? resultCount.length : 0
                            }],
                            stock_num: [{
                                NumberOfProducts: (resultStocksCount.length != null && resultStocksCount.length != undefined) ? resultStocksCount.length : 0
                            }],
                            total_stock: resultStock,
                        };
                    } else {
                        //
                        return {
                            total_sales: [],
                            ord_num: [],
                            stock_num: [],
                            total_stock: []
                        };
                    }
                });
            });
        });
        //
    });
}
module.exports = { getHomePage };