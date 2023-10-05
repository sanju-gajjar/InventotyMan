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
    const { selected_brand, selected_category } = req.body;
    async function fetchData() {
        try {
            if (selected_brand == null || selected_category == null) {
                return {
                    user: getUserRole(),
                    all_stocks: [],
                    brands: [],
                    categories: [],
                    filter_type: 'Filter',
                    filter_name: '',
                };
            }
            const stockCollection = db.collection('stocks');
            const allStocks = await stockCollection
                .find({
                    "Category": selected_category,
                    "Brand": selected_brand,
                })
                .sort({
                    TYear: -1,
                    Tmonth: -1,
                    TDay: -1,
                    StockTime: -1
                })
                .toArray();

            const [brands, categories] = await Promise.all([
                db.collection('brands').find().toArray(),
                db.collection('categories').find().toArray()
            ]);

            return {
                user: getUserRole(),
                all_stocks: allStocks,
                brands: brands,
                categories: categories,
                filter_type: 'Filter',
                filter_name: `${selected_brand} ${selected_category}`
            };
        } catch (err) {
            console.error('Error fetching data:', err);
            throw err;
        }
    }
    fetchData()
        .then(result => {
            callback(null, result);
        })
        .catch(error => {
            callback(error, null);
        });
}