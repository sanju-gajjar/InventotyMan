const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcrypt')

function initialize(passport, getUserByEmail, getUserById) {
  const authenticateUser = async (email, password, done) => {
    const user = getUserByEmail(email)
    if (user == null) {
      return done(null, false, { message: 'No user with that email' })
    }

    try {
      if (password == user.password) {
        return done(null, user)
      } else {
        
        
        
        
        return done(null, false, { message: 'Password incorrect' })
      }
    } catch (e) {
      return done(e)
    }
  }

  passport.use(new LocalStrategy({ usernameField: 'email' }, authenticateUser))
  passport.serializeUser((user, done) => done(null, user.id))
  passport.deserializeUser((id, done) => {
    return done(null, getUserById(id))
  })
}

module.exports = initialize


mlsn.bf184150b16271c73d239eed2fc07dc568d9fb774ee97ad148219864554a3feb    prod token


Enter your SMTP name
thecyclehub
Server
smtp.mailersend.net
Port
Connection security: TLS
587
Username
MS_TXAOnw @thecyclehub.co.in
Password
Reset credentials
wbLLVXd9SBApqqfl






