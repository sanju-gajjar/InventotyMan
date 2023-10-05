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
exports.getCustomer = function (req, callback) { 
    const customerCollection = db.collection('customer');
    const PhoneNumber = req.body.PhoneNumber;

    // Basic input validation
    if (!PhoneNumber || !/^\d{10}$/.test(PhoneNumber)) {
        res.status(400).json({
            error: "Invalid PhoneNumber format"
        });
    } else {
        async function fetchData() {
            try {
                const rows = await customerCollection.find({ PhoneNumber: PhoneNumber }).toArray();
                return rows;
            } catch (err) {
                console.error('Error fetching data:', err);
                throw err;
            }
        }

        fetchData()
            .then(rows => {
               let result={
                    success: "Get Successfully",
                    status: 200,
                    rows: rows
                };
                callback(null, result);
            })
            .catch(error => {
                console.error('Error:', error);
                callback(error, null);
            });
    }
}