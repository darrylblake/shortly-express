var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');


var User = db.Model.extend({
  tableName: 'users', 
  
  initialize: function(){
    this.on('creating', function(model, attrs, options){ 
      var salt = bcrypt.genSaltSync(10);
      var hash = bcrypt.hashSync(model.get('password'), salt);
      model.set('salt', salt)
      model.set('password', hash)
    });
  } 

  //other functionality here? adding a method?
});

module.exports = User;