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
exports.getBarcodeQuery = function (req, callback) { 
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
                let result= {
                    all_stocks: allStocks,
                    brands: brands,
                    categories: categories,
                    // display_content: filteredStocks,
                    filter_type: 'Filter',
                    filter_name: selected_brand + " " + selected_category
                };
                callback(err2, result);
            });
        });
    });
   
}