var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');

var session = require('express-session');

var passport = require('passport');
var GitHubStrategy = require('passport-github2');
var OAuthStrategy = require('passport-oauth').OAuthStrategy;

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));


app.use(session({
  secret: 'random_string_goes_here',
}));

// passport.use('github', new OAuthStrategy({
//     requestTokenURL: 'https://github.com/login/oauth/request_token',
//     accessTokenURL: 'https://github.com/login/oauth/access_token',
//     userAuthorizationURL: 'https://github.com/login/oauth/authorize',
//     consumerKey: '9694fd142c05e52543ec',
//     consumerSecret: 'd016148b1dee41d2501e76002b56fcb7f4b28f98',
//     callbackURL: 'http://127.0.0.1:4568/auth/callback'
//   },
//   function(token, tokenSecret, profile, done) {
//     // User.findOrCreate(..., function(err, user) {
//     //   done(err, user);
//     // });
//   }
// ));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new GitHubStrategy({
    clientID: '9694fd142c05e52543ec',
    clientSecret: 'd016148b1dee41d2501e76002b56fcb7f4b28f98',
    callbackURL: "http://127.0.0.1:4568/auth/github/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {
      
      // To keep the example simple, the user's GitHub profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the GitHub account with a user record in your database,
      // and return that user instead.
      return done(null, profile);
    });
  }
))


passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

app.get('/auth/github',
  passport.authenticate('github', { scope: [ 'user:email' ] }));

app.get('/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/');
  });

// app.get('/*') {
//   // check if path name in restricted
//     // check if user logged
//       // carry on to page
//     // else 
//       // redirect login
//   // else
//     // server page as is
// }

app.get('/', util.restrict, function(req, res) {
  res.render('index');
});

app.get('/create', util.restrict, function(req, res) {
  res.render('index');
});

app.get('/links', util.restrict, function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', util.restrict, function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

//TODO: login and signup functionality 

app.get('/login', function(req, res) {
  res.render('login');
});

app.post('/login', function(req, res) {
  util.checkUser(req.body.username, req.body.password, function(exists){ 
    if(exists){ 
      req.session.regenerate(function(){
        req.session.user = req.body.username;
        res.redirect('/');
      });
    } else {
      res.redirect('/login');
    }
  });
});

app.get('/signup', function(req, res) {
  res.render('signup');
});

app.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/');
});


app.post('/signup', function(req, res) {
  new User({ 
    username: req.body.username, 
    password: req.body.password
  }).save().then(function(){
    req.session.regenerate(function(){
        req.session.user = req.body.username;
        res.redirect('/');
      });
    // return res.redirect('/login');
  });
});

//TODO: figure out sessions (use checkUser)
//TODO: figure out logout functionality


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
