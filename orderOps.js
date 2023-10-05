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
exports.getBillPage = function (req, callback) { 
    const categoryCollection = db.collection('categories');
    const brandCollection = db.collection('brands');
    const sizeCollection = db.collection('sizes');
    const getCategoryData = () => {
        return new Promise((resolve, reject) => {
            categoryCollection.find().toArray((err, category) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(category);
                }
            });
        });
    };

    const getBrandData = () => {
        return new Promise((resolve, reject) => {
            brandCollection.find().toArray((err, brand) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(brand);
                }
            });
        });
    };

    const getSizeData = () => {
        return new Promise((resolve, reject) => {
            sizeCollection.find().toArray((err, size) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(size);
                }
            });
        });
    };

    Promise.all([getCategoryData(), getBrandData(), getSizeData()])
        .then(([category, brand, size]) => {
            let result = {
                user: getUserRole(req),
                category: category,
                brand: brand,
                size: size
            };
            callback(null, result)
        })
        .catch(error => {
            callback(error,null)
        });
}

exports.submitBill = function (req, callback) { 

    const ordersCollection = db.collection('orders');
    const stockCollection = db.collection('stocks');
    const customerCollection = db.collection('customer');
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
        const groupIndex = key.match(/\d+/);

        if (groupIndex) {
            if (groupIndex[0] != currentGroupIndex) {

                if (Object.keys(currentGroup).length > 0) {
                    jsonArrayFinal.push(currentGroup);
                }
                currentGroup = {};
                currentGroupIndex = groupIndex[0];
            }

            const sharedPrefix = key.replace(groupIndex[0], '');
            currentGroup[sharedPrefix] = obj[key];
        }
    });
    if (Object.keys(currentGroup).length > 0) {
        jsonArrayFinal.push(currentGroup);
    }

    const PhoneNumber = req.body.PhoneNumber;
    const CustomerName = req.body.CustomerName;
    const Email = req.body.Email;
    const CGST = req.body.CGST;
    const Pincode = req.body.Pincode;
    const Address = req.body.Address;
    const TodayDate = req.body.todayDate;
    const onlinePayment = req.body.onlinePayment == 'yes' ? true : false;

    const filter = {
        PhoneNumber: PhoneNumber
    };
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
            callback(null, null);
          
        } else {
            console.log(err);

        }
    });
}
exports.fetchOrderItem = function (req, callback) { 
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
                        let result={
                            success: "Get Successfully version 1.0.0",
                            status: 200,
                            rows: rows
                        };
                        callback(null,result)
                    } else {
                        callback(err, null)
                    }
                });
            }

        } else {
            callback(err, null)
        }

    });
}