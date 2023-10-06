const jwt = require('jsonwebtoken');
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}
const secretKey = process.env.SESSION_SECRET;
const checkAuthenticated = (req, res, next) => {
    try {
        const token = req.cookies.token;

        if (!token) {
            res.render('login.ejs', { messages: { error: "Unauthorized, Please Login to continue" } })

        }

        jwt.verify(token, secretKey, (err, user) => {
            if (err) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            const currentTimestamp = Math.floor(Date.now() / 1000);
            if (user.exp < currentTimestamp) {
                res.render('login.ejs', { messages: { error: "Session Timeout, Please Login to continue" } })

            }
            req.user = user;
            next();
        });
    } catch (error) {
        console.log("Error Authentication");
    }
};

module.exports = checkAuthenticated;