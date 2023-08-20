if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}
const MongoClient = require('mongodb').MongoClient;

const url = process.env.mongo_host;
const dbName = 'inventoryman';
const express = require('express')
const app = express()
const bcrypt = require('bcrypt')
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')
const mysql = require('mysql');
const bodyparser = require('body-parser');
const dotenv = require('dotenv');

var port = 3000;
app.use(bodyparser.json());

const users = []

users.push({
  id: Date.now().toString(),
  name: 'Admin',
  email: process.env.login_id,
  password: process.env.login_password
})


const initializePassport = require('./passport-config')
const e = require('express')
initializePassport(

  passport,
  email => users.find(user => user.email === email),
  id => users.find(user => user.id === id)
)


app.use(express.static("public"))
app.set('view-engine', 'ejs')
app.use(express.urlencoded({ extended: false }))
app.use(flash())
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(methodOverride('_method'))

app.get('/', checkAuthenticated, (req, res) => {
  MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
    if (err) {
      console.error('Error connecting to MongoDB:', err);
      return;
    }

    console.log('Connected to MongoDB');

    const db = client.db(dbName);

    const stockCollection = db.collection('stocks');

    stockCollection.find({}).toArray((err, resultStocksCount) => {



      const pipelineStock = [
        {
          $group: {
            _id: '_id',
            TotalItemsOrdered: { $sum: '$Amount' }
          }
        }
      ];
      stockCollection.aggregate(pipelineStock).toArray((err, resultStock) => {
        if (err) {
          console.error('Error executing aggregation:', err);
          client.close();
          return;
        }
        const ordersCollection = db.collection('orders');

        ordersCollection.find({}).toArray((err, resultCount) => {

          const pipeline = [
            {
              $group: {
                _id: '_id',
                TotalItemsOrdered: { $sum: '$Amount' }
              }
            }
          ];
          ordersCollection.aggregate(pipeline).toArray((err, result) => {
            if (err) {
              console.error('Error executing aggregation:', err);
              client.close();
              return;
            }

            if (resultStock.length > 0) {
              client.close();
              res.render('index.ejs', {
                total_sales: result,
                ord_num: [{ NumberOfProducts: resultCount.length??0 }],
                stock_num: [{ NumberOfProducts: resultStocksCount.length??0 }],
                total_stock: resultStock ,
              });
            } else {
              client.close();
              res.render('index.ejs', {
                total_sales: [],
                ord_num: [],
                stock_num: [],
                total_stock: []
              });
              console.log('No orders found.');
            }
          });
        });
      });
   //   
    });
 
  });
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
    console.log(users)
    res.redirect('/login')
  } catch {
    res.redirect('/register')
  }
})

app.delete('/logout', (req, res) => {
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
app.get('/employees', (req, res) => {
  MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
    if (err) {
      console.error('Error connecting to MongoDB:', err);
      return;
    }

    console.log('Connected to MongoDB');

    const db = client.db(dbName);
    const warehouseCollection = db.collection('warehouse');

    warehouseCollection.find().toArray((err, rows) => {
      if (!err) {
        res.send(rows);
      } else {
        console.log(err);
      }

      client.close();
    });
  });
})

app.get('/orders', checkAuthenticated, (req, res) => {
  MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
    if (err) {
      console.error('Error connecting to MongoDB:', err);
      return;
    }

    console.log('Connected to MongoDB');

    const db = client.db(dbName);
    const ordersCollection = db.collection('orders');
    ordersCollection.aggregate([
      {
        $group: {
          _id: '$TransactionID',
          Amount: { $first: '$Amount' },
          TransactionDate: { $first: '$TransactionDate' },
          TransactionTime: { $first: '$TransactionTime' }
        }
      }
    ]).toArray((err, rows) => {
      if (!err) {
        ordersCollection.find().toArray((err1, rows1) => {
          console.log("CHECKING ORDER______________");
          console.log(JSON.stringify(rows));
          console.log(JSON.stringify(rows1));
          if (!err1) {
            res.render('orders.ejs', {
              orders: rows,
              sub_orders: rows1,
              selected_item: 'None',
              month_name: 'None',
              year: 'None'
            });
          } else {
            console.log(err1);
          }

          client.close();
        });
      } else {
        console.log(err);
        client.close();
      }
    });
  });
})

app.get('/viewstocks', checkAuthenticated, (req, res) => {


  MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
    if (err) {
      console.error('Error connecting to MongoDB:', err);
      return;
    }

    console.log('Connected to MongoDB');

    const db = client.db(dbName);

    const stockCollection = db.collection('stocks');

    stockCollection.find().sort({ TYear: -1, Tmonth: -1, TDay: -1, StockTime: -1 }).toArray((err, allStocks) => {
      if (err) {
        console.error('Error querying stock collection:', err);
        client.close();
        return;
      }

      const brandsCollection = db.collection('brands');

      brandsCollection.find().toArray((err1, brands) => {
        if (err1) {
          console.error('Error querying brand collection:', err1);
          client.close();
          return;
        }

        const categoriesCollection = db.collection('categories');

        categoriesCollection.find().toArray((err2, categories) => {
          if (err2) {
            console.error('Error querying category collection:', err2);
            client.close();
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

          client.close();
        });
      });
    });
  });
})

app.post('/stocks_query', checkAuthenticated, (req, res) => {



  MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
    if (err) {
      console.error('Error connecting to MongoDB:', err);
      return;
    }

    console.log('Connected to MongoDB');

    const db = client.db(dbName);

    const stockCollection = db.collection('stocks');

    stockCollection.find().sort({ TYear: -1, Tmonth: -1, TDay: -1, StockTime: -1 }).toArray((err, allStocks) => {
      if (err) {
        console.error('Error querying stock collection:', err);
        client.close();
        return;
      }

      const brandsCollection = db.collection('brands');

      brandsCollection.find().toArray((err1, brands) => {
        if (err1) {
          console.error('Error querying brand collection:', err1);
          client.close();
          return;
        }

        const categoriesCollection = db.collection('categories');

        categoriesCollection.find().toArray((err2, categories) => {
          if (err2) {
            console.error('Error querying category collection:', err2);
            client.close();
            return;
          }

          var selected_item = req.body['exampleRadios'];

          if (selected_item === 'brand') {
            var brand_name = req.body['selected_brand'];

            stockCollection.find({ Brand: brand_name }).toArray((err3, filteredStocks) => {
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

            stockCollection.find({ Category: category_name }).toArray((err3, filteredStocks) => {
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

          client.close();
        });
      });
    });
  });
})

app.post('/fetchitem', checkAuthenticated, (req, res) => {
  MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
    if (err) {
      console.error('Error connecting to MongoDB:', err);
      return;
    }

    console.log('Connected to MongoDB');

    const db = client.db(dbName);
    const stockCollection = db.collection('stocks');

    const item_id = req.body.itemid;

    // Find documents from the stock collection based on ItemID
    stockCollection.find({ ItemID: item_id, Status: { $ne: "sold" } }).toArray((err, rows) => {
      if (!err) {
        console.log(rows);
        res.json({ success: "Updated Successfully", status: 200, rows: rows });
      } else {
        console.log(err);
      }

      // Close the MongoDB connection
      client.close();
    });
  });
})

app.post('/fetchorderitem', checkAuthenticated, (req, res) => {
  MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
    if (err) {
      console.error('Error connecting to MongoDB:', err);
      return;
    }

    console.log('Connected to MongoDB');

    const db = client.db(dbName);
    const stockCollection = db.collection('orders');

    const item_id = req.body.itemid;

    // Find documents from the stock collection based on ItemID
    stockCollection.find({ TransactionID: item_id }).toArray((err, rows) => {
      if (!err) {
        console.log(rows);
        res.json({ success: "Get Successfully", status: 200, rows: rows });
      } else {
        console.log(err);
      }

      // Close the MongoDB connection
      client.close();
    });
  });
})

app.get('/billing', checkAuthenticated, (req, res) => {
  MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
    if (err) {
      console.error('Error connecting to MongoDB:', err);
      return;
    }

    console.log('Connected to MongoDB');

    const db = client.db(dbName);
    const categoryCollection = db.collection('categories');
    const brandCollection = db.collection('brands');
    const sizeCollection = db.collection('sizes');

    // Find documents in the category collection
    categoryCollection.find().toArray((err1, category) => {
      if (err1) {
        console.error('Error querying category collection:', err1);
        client.close();
        return;
      }

      // Find documents in the brand collection
      brandCollection.find().toArray((err2, brand) => {
        if (err2) {
          console.error('Error querying brand collection:', err2);
          client.close();
          return;
        }

        // Find documents in the size collection
        sizeCollection.find().toArray((err3, size) => {
          if (err3) {
            console.error('Error querying size collection:', err3);
            client.close();
            return;
          }

          console.log(typeof category);
          console.log(category);
          console.log(brand);
          console.log(size);

          // Render the bill.ejs template with the retrieved data
          res.render('bill.ejs', { category: category, brand: brand, size: size });

          // Close the MongoDB connection
          client.close();
        });
      });
    });
  });
})

app.post('/addcategory', checkAuthenticated, (req, res) => {



  MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
    if (err) {
      console.error('Error connecting to MongoDB:', err);
      return;
    }

    console.log('Connected to MongoDB');

    const db = client.db(dbName);

    const categoriesCollection = db.collection('categories');

    const newCategory = { Category: req.body.new };

    categoriesCollection.insertOne(newCategory, (err2, result) => {
      if (err2) {
        console.error('Error inserting new category:', err2);
        client.close();
        return;
      }

      console.log('New category inserted:', result.insertedId);

      res.redirect('/categories');

      client.close();
    });
  });
})

app.post('/addbrand', checkAuthenticated, (req, res) => {



  MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
    if (err) {
      console.error('Error connecting to MongoDB:', err);
      return;
    }

    console.log('Connected to MongoDB');

    const db = client.db(dbName);

    const brandsCollection = db.collection('brands');

    const newBrand = { Brand: req.body.new };

    brandsCollection.insertOne(newBrand, (err2, result) => {
      if (err2) {
        console.error('Error inserting new brand:', err2);
        client.close();
        return;
      }

      console.log('New brand inserted:', result.insertedId);

      res.redirect('/brands');

      client.close();
    });
  });
})

app.post('/addsize', checkAuthenticated, (req, res) => {



  MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
    if (err) {
      console.error('Error connecting to MongoDB:', err);
      return;
    }

    console.log('Connected to MongoDB');

    const db = client.db(dbName);

    const sizesCollection = db.collection('sizes');

    const newSize = { Size: parseInt(req.body.new) };

    sizesCollection.insertOne(newSize, (err2, result) => {
      if (err2) {
        console.error('Error inserting new size:', err2);
        client.close();
        return;
      }

      console.log('New size inserted:', result.insertedId);

      res.redirect('/sizes');

      client.close();
    });
  });
})

app.post('/orders_query', checkAuthenticated, (req, res) => {
  MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
    if (err) {
      console.error('Error connecting to MongoDB:', err);
      return;
    }

    console.log('Connected to MongoDB');

    const db = client.db(dbName);
    const ordersCollection = db.collection('orders');

    const time_type = req.body['exampleRadios'];
    const selected_year = parseInt(req.body['selected_year']);
    let aggregationPipeline = [];

    if (time_type === 'month') {
      const selected_month = parseInt(req.body['selected_month']);
      const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
      const month_name = monthNames[selected_month - 1];

      aggregationPipeline.push(
        {
          $match: {
            TMonth: selected_month,
            TYear: selected_year
          }
        },
        {
          $group: {
            _id: '$TransactionID',
            Amount: { $sum: '$Amount' },
            TransactionDate: { $first: '$TransactionDate' },
            TransactionTime: { $first: '$TransactionTime' }
          }
        }
      );
    } else if (time_type === 'year') {
      aggregationPipeline.push(
        {
          $match: {
            TYear: selected_year
          }
        },
        {
          $group: {
            _id: '$TransactionID',
            Amount: { $sum: '$Amount' },
            TransactionDate: { $first: '$TransactionDate' },
            TransactionTime: { $first: '$TransactionTime' }
          }
        }
      );
    }

    // Aggregate based on the selected time criteria
    ordersCollection.aggregate(aggregationPipeline).toArray((err, rows) => {
      if (!err) {
        // Find all documents in the orders collection
        ordersCollection.find().toArray((err1, rows1) => {
          if (!err1) {
            res.render('orders.ejs', {
              orders: rows,
              sub_orders: rows1,
              selected_item: time_type,
              month_name: time_type === 'month' ? month_name : 'None',
              year: selected_year
            });
          } else {
            console.log(err1);
          }

          // Close the MongoDB connection
          client.close();
        });
      } else {
        console.log(err);
        client.close();
      }
    });
  });
})

app.get('/sales_filter', checkAuthenticated, (req, res) => {
  rows = {}
  res.render('sales_filter.ejs', { is_paramater_set: false, time_type: 'none', filter_type: 'none', display_content: rows, month_name: 'None', year: "None", total_amount: "None" })
})

app.get('/stock_filter', (req, res) => {
  res.render('stock_filter.ejs', { filter_type: 'None', display_content: {}, total_items: {} })
})

app.post('/stock_filter_query', checkAuthenticated, (req, res) => {
  MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
    if (err) {
      console.error('Error connecting to MongoDB:', err);
      return;
    }

    console.log('Connected to MongoDB');

    const db = client.db(dbName);
    const stockCollection = db.collection('stocks');

    var filter_type = req.body['exampleRadios1'];

    if (filter_type === 'brand') {
      stockCollection.aggregate([
        { $group: { _id: '$Brand', Count: { $sum: 1 }, Amount: { $sum: '$Amount' } } },
        { $project: { _id: 0, Brand: '$_id', Count: 1, Amount: 1 } }
      ]).toArray((err, rows) => {
        if (!err) {
          stockCollection.countDocuments({}, (err1, count) => {
            if (!err1) {
              res.render('stock_filter.ejs', { filter_type: filter_type, display_content: rows, total_items: count });
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
        { $group: { _id: '$Category', Count: { $sum: 1 }, Amount: { $sum: '$Amount' } } },
        { $project: { _id: 0, Category: '$_id', Count: 1, Amount: 1 } }
      ]).toArray((err, rows) => {
        if (!err) {
          stockCollection.countDocuments({}, (err1, count) => {
            if (!err1) {
              res.render('stock_filter.ejs', { filter_type: filter_type, display_content: rows, total_items: count });
            } else {
              console.log(err1);
            }
          });
        } else {
          console.log(err);
        }
      });
    }

    client.close();
  });
})

app.post('/sales_filter_query', checkAuthenticated, (req, res) => {
  MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
    if (err) {
      console.error('Error connecting to MongoDB:', err);
      return;
    }

    console.log('Connected to MongoDB');

    const db = client.db(dbName);
    const ordersCollection = db.collection('orders');

    console.log(req.body);
    const time_type = req.body['exampleRadios'];

    if (time_type == 'month') {
      const month = parseInt(req.body['selected_month']);
      const year = parseInt(req.body['selected_year']);
      const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
      const month_name = monthNames[month - 1];

      const filter_type = req.body['exampleRadios1'];

      const aggregationPipeline = [
        {
          $match: {
            TMonth: month,
            TYear: year
          }
        },
        {
          $group: {
            _id: filter_type === 'all' ? '$TransactionDate' : '$' + filter_type,
            Count: { $sum: 1 },
            Amount: { $sum: '$Amount' }
          }
        }
      ];

      ordersCollection.aggregate(aggregationPipeline).toArray((err, rows) => {
        if (!err) {
          const totalAggregationPipeline = [
            {
              $match: {
                TMonth: month,
                TYear: year
              }
            },
            {
              $group: {
                _id: null,
                Amount: { $sum: '$Amount' },
                Count: { $sum: 1 }
              }
            }
          ];

          ordersCollection.aggregate(totalAggregationPipeline).toArray((err1, rows1) => {
            if (!err1) {
              const total_amount = rows1[0];
              res.render('sales_filter.ejs', {
                is_paramater_set: true,
                time_type: 'month',
                filter_type: filter_type,
                display_content: rows,
                month_name: month_name,
                year: year,
                total_amount: total_amount
              });
            } else {
              console.log(err1);
            }

            // Close the MongoDB connection
            client.close();
          });
        } else {
          console.log(err);
          client.close();
        }
      });
    }

    if (time_type == 'year') {
      const year = parseInt(req.body['selected_year']);
      const filter_type = req.body['exampleRadios1'];

      const aggregationPipeline = [
        {
          $match: {
            TYear: year
          }
        },
        {
          $group: {
            _id: filter_type === 'all' ? '$TMonth' : '$' + filter_type,
            Count: { $sum: 1 },
            Amount: { $sum: '$Amount' }
          }
        }
      ];

      ordersCollection.aggregate(aggregationPipeline).toArray((err, rows) => {
        if (!err) {
          const totalAggregationPipeline = [
            {
              $match: {
                TYear: year
              }
            },
            {
              $group: {
                _id: null,
                Amount: { $sum: '$Amount' },
                Count: { $sum: 1 }
              }
            }
          ];

          ordersCollection.aggregate(totalAggregationPipeline).toArray((err1, rows1) => {
            if (!err1) {
              const total_amount = rows1[0];
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
            client.close();
          });
        } else {
          console.log(err);
          client.close();
        }
      });
    }
  });
})

app.get('/categories', checkAuthenticated, (req, res) => {



  MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
    if (err) {
      console.error('Error connecting to MongoDB:', err);
      return;
    }

    console.log('Connected to MongoDB');

    const db = client.db(dbName);

    const categoriesCollection = db.collection('categories');

    categoriesCollection.find().toArray((err1, category) => {
      if (err1) {
        console.error('Error querying collection:', err1);
        client.close();
        return;
      }

      res.render('categories.ejs', { category });

      client.close();
    });
  });
})

app.get('/brands', checkAuthenticated, (req, res) => {



  MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
    if (err) {
      console.error('Error connecting to MongoDB:', err);
      return;
    }

    console.log('Connected to MongoDB');

    const db = client.db(dbName);

    const brandsCollection = db.collection('brands');

    brandsCollection.find().toArray((err2, brand) => {
      if (err2) {
        console.error('Error querying collection:', err2);
        client.close();
        return;
      }

      res.render('brands.ejs', { brand });

      client.close();
    });
  });
})

app.get('/sizes', checkAuthenticated, (req, res) => {



  MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
    if (err) {
      console.error('Error connecting to MongoDB:', err);
      return;
    }

    console.log('Connected to MongoDB');

    const db = client.db(dbName);

    const sizesCollection = db.collection('sizes');

    sizesCollection.find().toArray((err2, size) => {
      if (err2) {
        console.error('Error querying collection:', err2);
        client.close();
        return;
      }

      res.render('sizes.ejs', { size });

      client.close();
    });
  });
})

app.get('/stocks', checkAuthenticated, (req, res) => {



  MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
    if (err) {
      console.error('Error connecting to MongoDB:', err);
      return;
    }

    console.log('Connected to MongoDB');

    const db = client.db(dbName);

    const categoryCollection = db.collection('categories');
    const brandCollection = db.collection('brands');
    const sizeCollection = db.collection('sizes');

    categoryCollection.find().toArray((err1, category) => {
      if (err1) {
        console.error('Error querying category collection:', err1);
        client.close();
        return;
      }

      brandCollection.find().toArray((err2, brand) => {
        if (err2) {
          console.error('Error querying brand collection:', err2);
          client.close();
          return;
        }

        sizeCollection.find().toArray((err3, size) => {
          if (err3) {
            console.error('Error querying size collection:', err3);
            client.close();
            return;
          }

          console.log(typeof category);
          console.log(category);
          console.log(brand);
          console.log(size);

          res.render('stocks.ejs', { category: category, brand: brand, size: size });

          client.close();
        });
      });
    });
  });
})

app.post('/submitbill', checkAuthenticated, (req, res) => {

  MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
    if (err) {
      console.error('Error connecting to MongoDB:', err);
      return;
    }

    console.log('Connected to MongoDB');

    const db = client.db(dbName);
    const ordersCollection = db.collection('orders');
    const stockCollection = db.collection('stocks');

    console.log(`\nRequest body = `);
    console.log(req.body);
    console.log("BILL REQUEST " + JSON.stringify(req.body));
    const request1 = req.body;

    console.log("here is the request&&&&&&&&&&&&&&&&&&&&&&&7");
    console.log(JSON.stringify(request1));


    const date_format = new Date();
    const transaction_date = date_format.getDate() + '/' + (parseInt(date_format.getMonth() + 1)).toString() + '/' + date_format.getFullYear();
    const transaction_time = date_format.getHours() + ':' + date_format.getMinutes() + ':' + date_format.getSeconds();
    const transaction_id = "SHW" + date_format.getDate() + date_format.getMonth() + date_format.getFullYear() + date_format.getHours() + date_format.getMinutes() + date_format.getSeconds();

    const item_ids = [];
    for (const i in request1) {
      if (i.includes("itemid")) {
        item_ids.push(request1[i]);
      }
    }

    const new_req = {};
    for (const i in request1) {
      if (i.includes("number") || i.includes("total")) {
        delete i;
      } else {
        new_req[i] = request1[i];
      }
    }

    const data = Object.entries(new_req).reduce((carry, [key, value]) => {
      const [text] = key.split(/\d+/);
      const index = key.substring(text.length) - 1;
      if (!Array.isArray(carry[index])) carry[index] = [];
      carry[index].push(value);
      return carry;
    }, []);

    for (let i = 0; i < data.length; i++) {
      data[i].push(transaction_date);
      data[i].push(transaction_time);
      data[i].push(transaction_id);
      data[i].push(date_format.getDate());
      data[i].push(date_format.getMonth() + 1);
      data[i].push(date_format.getFullYear());
    }

    console.log(`\nINSERT Array = `);
    console.log(data);

    // Insert data into orders collection
    var billAdd = [];
    data.forEach(datas => {
      billAdd.push(
        {
          ItemID: datas[0],
          ItemName: datas[1],
          Category: datas[2],
          Brand: datas[3],
          Size: parseInt(datas[4]),
          Amount: parseFloat(datas[5]),
          CustomerName: datas[6],
          CustomerEmail: datas[7],
          CustomerPhone: datas[8],
          TransactionDate: datas[9],
          TransactionTime: datas[10],
          TransactionID: datas[11],
          TDay: parseInt(datas[12]),
          TMonth: parseInt(datas[13]),
          TYear: parseInt(datas[14])
        })
    })
    console.log("BILL REQUEST billAdd" + JSON.stringify(billAdd));
    ordersCollection.insertMany(billAdd, (err, result) => {
      if (!err) {
        console.log('Successfully inserted values into ordersdb');

        // Delete corresponding values from stocks collection
        let query = { ItemID: { $in: item_ids } };
        const data = { Status: 'sold' };
        const options = { upsert: true };
        // stockCollection.updateMany(query, data,options, (err2, result2) => {
        //   if (!err2) {
        //     console.log('Successfully deleted corresponding values from stockdb');
        //   } else {
        //     console.log(err2);
        //   }

        //   // Close the MongoDB connection
        //   client.close();
        // });

        res.redirect('/orders');
      } else {
        console.log(err);
        client.close();
      }
    });
  });
})

app.post('/submitstock', checkAuthenticated, (req, res) => {






  MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
    if (err) {
      console.error('Error connecting to MongoDB:', err);
      return;
    }

    console.log('Connected to MongoDB');

    const db = client.db(dbName);
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
      if (!Array.isArray(carry[index])) carry[index] = [];
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


    console.log("MY DATA HEREH ################################################");
    console.log(JSON.stringify(data));
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
        client.close();
        return;
      }

      console.log('Successfully inserted values:', result.insertedCount);
      res.redirect('/viewstocks');

      client.close();
    });
  });
})

app.post('/deleteitem', checkAuthenticated, (req, res) => {
  MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
    if (err) {
      console.error('Error connecting to MongoDB:', err);
      return;
    }

    console.log('Connected to MongoDB');

    const db = client.db(dbName);
    const ordersCollection = db.collection('orders');

    const deleteid = req.body.deleteid;

    ordersCollection.deleteMany({ ItemID: deleteid }, (err, result) => {
      if (err) {
        console.error('Error deleting value:', err);
        client.close();
        return;
      }

      console.log('Successfully deleted values:', result.deletedCount);
      res.redirect('/orders');

      client.close();
    });
  });
})

app.post('/deletecategory', checkAuthenticated, (req, res) => {




  MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
    if (err) {
      console.error('Error connecting to MongoDB:', err);
      return;
    }

    console.log('Connected to MongoDB');

    const db = client.db(dbName);

    const categoriesCollection = db.collection('categories');

    const deleteCategory = req.body.deleteid;

    categoriesCollection.deleteOne({ Category: deleteCategory }, (err2, result) => {
      if (err2) {
        console.error('Error deleting category:', err2);
        client.close();
        return;
      }

      if (result.deletedCount > 0) {
        console.log('Successfully deleted a category');
      } else {
        console.log('Category not found for deletion');
      }

      res.redirect('/categories');

      client.close();
    });
  });
})

app.post('/deletebrand', checkAuthenticated, (req, res) => {




  MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
    if (err) {
      console.error('Error connecting to MongoDB:', err);
      return;
    }

    console.log('Connected to MongoDB');

    const db = client.db(dbName);

    const brandsCollection = db.collection('brands');

    const deleteBrand = req.body.deleteid;

    brandsCollection.deleteOne({ Brand: deleteBrand }, (err2, result) => {
      if (err2) {
        console.error('Error deleting brand:', err2);
        client.close();
        return;
      }

      if (result.deletedCount > 0) {
        console.log('Successfully deleted a brand');
      } else {
        console.log('Brand not found for deletion');
      }

      res.redirect('/brands');

      client.close();
    });
  });

})

app.post('/deletesize', checkAuthenticated, (req, res) => {
  console.log('deletesize called')




  MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
    if (err) {
      console.error('Error connecting to MongoDB:', err);
      return;
    }

    console.log('Connected to MongoDB');

    const db = client.db(dbName);

    const sizesCollection = db.collection('sizes');

    const deleteSize = req.body.deleteid;

    sizesCollection.deleteOne({ Size: deleteSize }, (err2, result) => {
      if (err2) {
        console.error('Error deleting size:', err2);
        client.close();
        return;
      }

      if (result.deletedCount > 0) {
        console.log('Successfully deleted a size');
      } else {
        console.log('Size not found for deletion');
      }

      res.redirect('/sizes');

      client.close();
    });
  });
})

app.post('/deletestock', checkAuthenticated, (req, res) => {
  MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
    if (err) {
      console.error('Error connecting to MongoDB:', err);
      return;
    }

    console.log('Connected to MongoDB');

    const db = client.db(dbName);
    const stockCollection = db.collection('stocks');

    const deleteid = req.body.deleteid;

    stockCollection.deleteMany({ ItemID: deleteid }, (err, result) => {
      if (err) {
        console.error('Error deleting value:', err);
        client.close();
        return;
      }

      console.log('Successfully deleted values:', result.deletedCount);
      res.redirect('/viewstocks');

      client.close();
    });
  });
})