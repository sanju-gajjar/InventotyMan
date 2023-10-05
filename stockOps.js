const dbName = 'inventoryman';
const {
    connectToMongo
} = require('./db/db');
connectToMongo();
function getUserRole(req) {
    const user = req.cookies.user;
    const role = req.cookies.role;
    return { user, role };
}
exports.getStockQuery = function (req, callback) { 
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

                let selected_item = req.body['exampleRadios'];

                if (selected_item === 'brand') {
                    let brand_name = req.body['selected_brand'];

                    stockCollection.find({
                        Brand: brand_name
                    }).toArray((err3, filteredStocks) => {
                        if (!err3) {
                            let result={
                                all_stocks: allStocks,
                                brands: brands,
                                categories: categories,
                                display_content: filteredStocks,
                                filter_type: 'brand',
                                filter_name: brand_name
                            };
                            callback(err3, result);
                        } else {
                            console.log(err3);
                        }
                    });
                } else if (selected_item === 'category') {
                    let category_name = req.body['selected_category'];
                    stockCollection.find({
                        Category: category_name
                    }).toArray((err3, filteredStocks) => {
                        if (!err3) {
                            let result= {
                                all_stocks: allStocks,
                                brands: brands,
                                categories: categories,
                                display_content: filteredStocks,
                                filter_type: 'category',
                                filter_name: category_name
                            };
                            callback(err3, result);
                        } else {
                            console.log(err3);
                        }
                    });
                } else {
                    let result= {
                        all_stocks: allStocks,
                        brands: brands,
                        categories: categories,
                        display_content: 'None',
                        filter_type: 'None',
                        filter_name: 'None'
                    };
                    callback(err3, result);
                }
            });
        });
    });
}
exports.deleteStock = function (req, callback) { 
    const stockCollection = db.collection('stocks');

    const deleteid = req.body.deleteid;

    stockCollection.deleteMany({
        ItemID: deleteid
    }, (err, result) => {
        if (err) {
            callback(err, null);
        }
        callback(null, null);
        

    });
}

exports.fetStockItem = function (req, callback) { 
    const db = getDatabase(dbName);
    const stockCollection = db.collection('stocks');

    const item_id = req.body.itemid;
    stockCollection.find({
        ItemID: item_id,
        Status: {
            $ne: "sold"
        }
    }).toArray((err, rows) => {
        if (!err) {
           let result={
                success: "Updated Successfully",
                status: 200,
                rows: rows
            };
            callback(err, result);
        } else {
            callback(err, null);
        }
    });

}