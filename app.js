if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}


const {
  connect
} = require('./db/db');

var ObjectID = require('mongodb').ObjectID;
const nodemailer = require("nodemailer");
var favicon = require('serve-favicon')
var path = require('path')

const dbName = 'inventoryman';
const express = require('express')
const app = express();
connect();
const {
  getDatabase,
  close
} = require('./db/db');
const bcrypt = require('bcrypt')
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')
const bodyparser = require('body-parser');
var port = 3002;

// const accountSid = 'YOUR_ACCOUNT_SID';
// const authToken = 'YOUR_AUTH_TOKEN';
// const client = require('twilio')(accountSid, authToken);


app.use(bodyparser.json());

const users = []

users.push({
  id: Date.now().toString(),
  name: 'Admin',
  email: process.env.login_id,
  password: process.env.login_password
})
users.push({
  id: Date.now().toString(),
  name: 'User',
  email: "thecyclehubuser1@gmail.com",
  password: "Thecyclehub@123"
})
const initializePassport = require('./passport-config')
const e = require('express');
const { log } = require('console');
initializePassport(

  passport,
  email => users.find(user => user.email === email),
  id => users.find(user => user.id === id))

app.use(express.static("public"))
app.set('view-engine', 'ejs')
app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(express.urlencoded({
  extended: false
}))
app.use(flash())
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(methodOverride('_method'))

// app.get('/', checkAuthenticated, (req, res) => {
//
//     if (err) {
//       console.error('Error connecting to MongoDB:', err);
//       return;
//     }


//     const db = getDatabase(dbName);

//     const stockCollection = db.collection('stocks');

//     stockCollection.find({}).toArray((err, resultStocksCount) => {


//       const pipelineStock = [
//         {
//           $group: {
//             _id: '_id',
//             TotalItemsOrdered: { $sum: '$Amount' }
//           }
//         }
//       ];
//       stockCollection.aggregate(pipelineStock).toArray((err, resultStock) => {
//         if (err) {
//           console.error('Error executing aggregation:', err);
//
//           return;
//         }
//         const ordersCollection = db.collection('orders');

//         ordersCollection.find({}).toArray((err, resultCount) => {

//           const pipeline = [
//             {
//               $group: {
//                 _id: '_id',
//                 TotalItemsOrdered: { $sum: '$Amount' }
//               }
//             }
//           ];
//           ordersCollection.aggregate(pipeline).toArray((err, result) => {
//             if (err) {
//               console.error('Error executing aggregation:', err);
//
//               return;
//             }

//             if (resultStock.length > 0) {
//
//               res.render('index.ejs', {
//                 total_sales: result,
//                 ord_num: [{ NumberOfProducts: (resultCount != null && resultCount != undefined) ? resultCount.length : 0 }],
//                 stock_num: [{ NumberOfProducts: (resultStocksCount.length != null && resultStocksCount.length != undefined) ? resultStocksCount.length : 0 }],
//                 total_stock: resultStock,
//               });
//             } else {
//
//               res.render('index.ejs', {
//                 total_sales: [],
//                 ord_num: [],
//                 stock_num: [],
//                 total_stock: []
//               });
//             }
//           });
//         });
//       });
//       //
//     });

//   });
// })

app.get('/', checkAuthenticated, (req, res) => {
  //
  // if (err) {
  //   console.error('Error connecting to MongoDB:', err);
  //   return;
  // }


  const db = getDatabase(dbName);

  const stockCollection = db.collection('stocks');

  stockCollection.find({}).toArray((err, resultStocksCount) => {

    const pipelineStock = [{
      $addFields: {
        total: { $multiply: ["$Amount", "$Size"] }
        // Calculate amount * size and store in a new field called "total"
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

        const pipeline = [
          {
            $addFields: {
              total: { $multiply: ["$Amount", "$Size"] }
              // Calculate amount * size and store in a new field called "total"
            }
          }, {
          $group: {
            _id: '_id',
            TotalItemsOrdered: {
              $sum: '$total'
            }
          }
        }
        ];
        ordersCollection.aggregate(pipeline).toArray((err, result) => {
          if (err) {
            console.error('Error executing aggregation:', err);

            return;
          }

          if (resultStock.length > 0) {
            //
            res.render('index.ejs', {
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
            });
          } else {
            //
            res.render('index.ejs', {
              total_sales: [],
              ord_num: [],
              stock_num: [],
              total_stock: []
            });
          }
        });
      });
    });
    //
  });

  //  });
})
app.get('/login', checkNotAuthenticated, (req, res) => {
  res.render('login.ejs')
})

app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
  failureFlash: true
}))

app.get('/register', checkNotAuthenticated, (req, res) => {
  res.render('register.ejs')
})

app.post('/register', checkNotAuthenticated, async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10)
    users.push({
      id: Date.now().toString(),
      name: req.body.name,
      email: req.body.email,
      password: hashedPassword
    })
    res.redirect('/login')
  } catch {
    res.redirect('/register')
  }
})

app.delete('/logout', (req, res) => {
  //close();
  req.logOut()
  res.redirect('/login')
})

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  }

  res.redirect('/login')
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {

    return res.redirect('/')
  }

  next()
}
app.listen(port, () => console.log(`Express Server is running at ${port} port`))

app.post('sendWhatsAppMsg', (req, res) => {
  client.messages
    .create({
      body: 'Hello from Node.js!',
      from: 'whatsapp:+YOUR_TWILIO_PHONE_NUMBER',
      to: 'whatsapp:+RECIPIENT_PHONE_NUMBER'
    })
    .then(message => console.log(message.sid));
});
app.get('/employees', (req, res) => {

  const db = getDatabase(dbName);
  const warehouseCollection = db.collection('warehouse');

  warehouseCollection.find().toArray((err, rows) => {
    if (!err) {
      res.send(rows);
    } else {
      console.log(err);
    }

  });

})

app.get('/orders', checkAuthenticated, (req, res) => {

  const db = getDatabase(dbName);
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
  }
  ]).toArray((err, rows) => {
    if (!err) {
      ordersCollection.find().sort({
        _id: -1
      }).toArray((err1, rows1) => {
        if (!err1) {

          let customerPhonesList=rows.map(x => x.CustomerPhone)
          customerCollection.find({
            "PhoneNumber": { $in: customerPhonesList },
          }).sort({
            _id: -1
          }).toArray((err1, customerInfo) => {
            res.render('orders.ejs', {
              orders: rows,
              sub_orders: rows1,
              customerInfo: customerInfo,
              selected_item: 'None',
              month_name: 'None',
              year: 'None'
            });
          });
        } else {
          console.log(err1);
        }

      });
    } else {
      console.log(err);

    }
  });

})
app.get('/viewbarcodepage', checkAuthenticated, (req, res) => {
try {
  

  const db = getDatabase(dbName);
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
          brands: brands,
          categories: categories,
          display_content: 'None',
          filter_type: 'None',
          filter_name: 'None'
        });

      });
    });
} catch (error) {
  console.log(error);
}
})

app.get('/viewstocks', checkAuthenticated, (req, res) => {

  const db = getDatabase(dbName);

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

  const db = getDatabase(dbName);

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

  const db = getDatabase(dbName);
  console.log(req.body);
  const { selected_brand, selected_category } = req.body;
  if (selected_brand == null || selected_category == null) { 
    res.render('barcpdegen.ejs', { products: []});
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

  const db = getDatabase(dbName);
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

  const db = getDatabase(dbName);
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

  const db = getDatabase(dbName);
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

  const db = getDatabase(dbName);
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

  const db = getDatabase(dbName);

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

  const db = getDatabase(dbName);

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

  const db = getDatabase(dbName);

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
app.get('/edit/:id', async (req, res) => {
  const db = getDatabase(dbName);
  const productFB = db.collection('orders');
  var objectId2 = new ObjectID(req.params.id);
  productFB.find({ _id: objectId2 }).toArray((err, rows) => {
    if (!err) {
      res.render('edit-product-popup.ejs', { product: rows[0] });
     }
  });
  
});

app.post('/edit/:id', async (req, res) => {
  const { name, price } = req.body;
  const db = getDatabase(dbName);
  const productFB = db.collection('orders');
  const update = {
    $set: {
      ItemName:name,
      Amount:price
    }
  };
  var objectId2 = new ObjectID(req.params.id);
  productFB.findOneAndUpdate({ _id: objectId2 }, update);
  res.redirect('/orders');
});
app.get('/orders_query', checkAuthenticated, (req, res) => {
  res.redirect('/orders');
});
app.post('/orders_query', checkAuthenticated, (req, res) => {

  const db = getDatabase(dbName);
  const ordersCollection = db.collection('orders');
  const customerCollection = db.collection('customer');

  // const time_type = req.body['exampleRadios'];
  const phone = req.body['phone'];
  // const month = req.body['month'];
  // const year = req.body['year'];
  console.log(phone);

  // console.log(parseInt(req.body['selected_month']));

  // const selected_year = parseInt(req.body['selected_year']);
  let aggregationPipeline = [];
  let month_name = "";
  // if (time_type === 'month') {
  //   const selected_month = parseInt(req.body['selected_month']);
  //   const monthNames = ["January", "February", "March", "April", "May", "June",
  //     "July", "August", "September", "October", "November", "December"];
  //   month_name = monthNames[selected_month - 1];

  //   aggregationPipeline.push({
  //     $match: {
  //       TMonth: selected_month,
  //       TYear: selected_year
  //     }
  //   }, {
  //     $group: {
  //       _id: '$TransactionID',
  //       Amount: {
  //         $sum: '$Amount'
  //       },
  //       TransactionDate: {
  //         $first: '$TransactionDate'
  //       },
  //       TransactionTime: {
  //         $first: '$TransactionTime'
  //       }
  //     }
  //   });
  // } else if (time_type === 'year') {
  //   aggregationPipeline.push({
  //     $match: {
  //       TYear: selected_year
  //     }
  //   }, {
  //     $group: {
  //       _id: '$TransactionID',
  //       Amount: {
  //         $sum: '$Amount'
  //       },
  //       TransactionDate: {
  //         $first: '$TransactionDate'
  //       },
  //       TransactionTime: {
  //         $first: '$TransactionTime'
  //       }
  //     }
  //   });
  // } 
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
              "PhoneNumber": { $in: [phone] },
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

  const db = getDatabase(dbName);
  const stockCollection = db.collection('stocks');

  var filter_type = req.body['exampleRadios1'];

  if (filter_type === 'brand') {
    stockCollection.aggregate([
      {
        $addFields: {
          total: { $multiply: ["$Amount", "$Size"] }
          // Calculate amount * size and store in a new field called "total"
        }
      },
      {
        $group: {
          _id: "$Brand", // Group by brand
          Amount: { $sum: "$total" },
          Brand: { $first:'$Brand'}, // Sum the calculated values and store in a field called "totalAmount"
          Count: {
            $sum: '$Size'
          },
        }
      },{
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
    stockCollection.aggregate([
      {
        $addFields: {
          total: { $multiply: ["$Amount", "$Size"] }
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

  const db = getDatabase(dbName);
  const ordersCollection = db.collection('orders');

  const time_type = req.body['exampleRadios'];

  if (time_type == 'month') {
    const month = parseInt(req.body['selected_month']);
    const year = parseInt(req.body['selected_year']);
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
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
        Brand: { $first: '$Brand' },
        Category: { $first: '$Category' },
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

  const db = getDatabase(dbName);

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

  const db = getDatabase(dbName);

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

  const db = getDatabase(dbName);

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

  const db = getDatabase(dbName);

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
app.post('/submitbill', checkAuthenticated, (req, res) => {

  const db = getDatabase(dbName);
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
  const onlinePayment = req.body.onlinePayment == 'yes' ? true:false;
  
  // Find documents from the stock collection based on ItemID

  const filter = { PhoneNumber: PhoneNumber };
  // Define the update document
  const update = {
    $set: {
      'PhoneNumber': PhoneNumber,
      'CustomerName': CustomerName,
      'Email': Email,
      'Address': Address,
      'CGST': CGST, 
      'Pincode':Pincode,
    }
  };
  // Define the options for the update operation
  const options = { upsert: true, returnOriginal: false };
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
      // let query = {
      //   ItemID: {
      //     $in: item_ids
      //   }
      // };
      // const newData = {
      //   Status: 'sold'
      // };
      // let newvalues = {
      //   $set: newData
      // }
      // const options = {
      //   upsert: true
      // };

        billAdd.forEach((item) => {
          const { ItemID, Size } = item;

          stockCollection.updateOne(
            { ItemID },
            { $inc: { Size: -Size } },
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

  const db = getDatabase(dbName);
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

  const db = getDatabase(dbName);
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

  const db = getDatabase(dbName);

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

  const db = getDatabase(dbName);

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

app.post('/deletesize', checkAuthenticated, (req, res) => {

  const db = getDatabase(dbName);

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
  res.render('barcodegen.ejs', { products: JSON.parse(req.body.allStocks) });
  // const db = getDatabase(dbName);

  // const stockCollection = db.collection('stocks');

  // stockCollection.find({
  //   Brand: req.body.brand,
  //   Category: req.body.category
  // }).toArray((err, allStocks) => {
  //   if (err) {
  //     console.error('Error stockCollection generate barcde page:', err2);
  //     return;
  //   }
    
  // });
})

app.post('/deletestock', checkAuthenticated, (req, res) => {

  const db = getDatabase(dbName);
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
