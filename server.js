// Express Setup //
const express = require('express');
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(express.static('public'));

// Knex Setup //
const env = process.env.NODE_ENV || 'development';
const config = require('./knexfile')[env];
const knex = require('knex')(config);

// bcrypt setup
let bcrypt = require('bcrypt');
const saltRounds = 10;

// jwt setup
const jwt = require('jsonwebtoken');
let jwtSecret = process.env.jwtSecret;
if (jwtSecret === undefined) {
  console.log("You need to define a jwtSecret environment variable to continue.");
  knex.destroy();
  process.exit();
}

// Verify the token that a client gives us.
// This is setup as middleware, so it can be passed as an additional argument to Express after
// the URL in any route. This will restrict access to only those clients who possess a valid token.
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token)
    return res.status(403).send({ error: 'No token provided.' });
  jwt.verify(token, jwtSecret, function(err, decoded) {
    if (err)
      return res.status(500).send({ error: 'Failed to authenticate token.' });
    // if everything good, save to request for use in other routes
    req.userID = decoded.id;
    next();
  });
}

// multer setup
const multer = require('multer');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'static/uploads')
  },
  filename: (req, file, cb) => {
    cb(null, `${req.userID}-${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({storage: storage});

// Login //

app.post('/api/login', (req, res) => {
  if (!req.body.email || !req.body.password)
    return res.status(400).send();
  knex('users').where('email',req.body.email).first().then(user => {
    if (user === undefined) {
      res.status(403).send("Invalid credentials");
      throw new Error('abort');
    }
    return [bcrypt.compare(req.body.password, user.hash),user];
  }).spread((result,user) => {
    if (result) {
      let token = jwt.sign({ id: user.id }, jwtSecret, {
	expiresIn: '24h' // expires in 24 hours
      });
      res.status(200).json({user:{username:user.username,name:user.name,id:user.id},token:token});
    } else {
      res.status(403).send("Invalid credentials");
    }
    return;
  }).catch(error => {
    if (error.message !== 'abort') {
      console.log(error);
      res.status(500).json({ error });
    }
  });
});

// Registration //

app.post('/api/users', (req, res) => {
  if (!req.body.email || !req.body.password || !req.body.username || !req.body.name)
    return res.status(400).send();
  knex('users').where('email',req.body.email).first().then(user => {
    if (user !== undefined) {
      res.status(403).send("Email address already exists");
      throw new Error('abort');
    }
    return knex('users').where('username',req.body.username).first();
  }).then(user => {
    if (user !== undefined) {
      res.status(409).send("User name already exists");
      throw new Error('abort');
    }
    return bcrypt.hash(req.body.password, saltRounds);
  }).then(hash => {
    return knex('users').insert({email: req.body.email, hash: hash, username:req.body.username,
				 name:req.body.name, role: 'user'});
  }).then(ids => {
    return knex('users').where('id',ids[0]).first().select('username','name','id');
  }).then(user => {
    let token = jwt.sign({ id: user.id }, jwtSecret, {
      expiresIn: '24h' // expires in 24 hours
    });
    res.status(200).json({user:user,token:token});
    return;
  }).catch(error => {
    if (error.message !== 'abort') {
      console.log(error);
      res.status(500).json({ error });
    }
  });
});

app.get('/api/me', verifyToken, (req,res) => {
  knex('users').where('id',req.userID).first().select('username','name','id').then(user => {
    res.status(200).json({user:user});
  }).catch(error => {
    res.status(500).json({ error });
  });
});

app.get('/api/users/:id', (req, res) => {
  let id = parseInt(req.params.id);
  // get user record
  knex('users').where('id',id).first().select('username','name','id').then(user => {
    res.status(200).json({user:user});
  }).catch(error => {
    res.status(500).json({ error });
  });
});


app.get('/api/users/:id/pics', (req, res) => {
  let id = parseInt(req.params.id);
  knex('users').join('pics','users.id','pics.user_id')
    .where('users.id',id)
    .orderBy('created','desc')
    .select('pic','username','name','created','image').then(pics => {
      res.status(200).json({pics:pics});
    }).catch(error => {
      console.log(error);
      res.status(500).json({ error });
    });
});

app.post('/api/users/:id/pics', verifyToken, upload.single('image'), (req, res) => {
  let id = parseInt(req.params.id);
  if (id !== req.userID) {
    res.status(403).send();
    return;
  }
  let path = ''
  if(req.file){
    path = req.file.path;
  }
  knex('users').where('id',id).first().then(user => {
    return knex('pics').insert({user_id: id, pic:req.body.pic, created: new Date(), image:path});
  }).then(ids => {
    return knex('pics').where('id',ids[0]).first();
  }).then(pic => {
    res.status(200).json({pic:pic});
    return;
  }).catch(error => {
    console.log(error);
    res.status(500).json({ error });
  });
});

app.get('/api/pics/search', (req, res) => {
  if (!req.query.keywords)
    return res.status(400).send();
  let offset = 0;
  if (req.query.offset)
    offset = parseInt(req.query.offset);
  let limit = 50;
  if (req.query.limit)
    limit = parseInt(req.query.limit);
  knex('users').join('pics','users.id','pics.user_id')
    .whereRaw("MATCH (pic) AGAINST('" + req.query.keywords + "')")
    .orderBy('created','desc')
    .limit(limit)
    .offset(offset)
    .select('pic','username','name','created','image','users.id as userID').then(pics => {
      res.status(200).json({pics:pics});
    }).catch(error => {
      console.log(error);
      res.status(500).json({ error });
    });
});

app.get('/api/pics/hash/:hashtag', (req, res) => {
  let offset = 0;
  if (req.query.offset)
    offset = parseInt(req.query.offset);
  let limit = 50;
  if (req.query.limit)
    limit = parseInt(req.query.limit);
  knex('users').join('pics','users.id','pics.user_id')
    .whereRaw("pic REGEXP '^#" + req.params.hashtag + "' OR pic REGEXP ' #" + req.params.hashtag + "'")
    .orderBy('created','desc')
    .limit(limit)
    .offset(offset)
    .select('pic','username','name','created','image','users.id as userID').then(pics => {
      res.status(200).json({pics:pics});
    }).catch(error => {
      console.log(error);
      res.status(500).json({ error });
    });
});

// Followers //

// follow someone
app.post('/api/users/:id/follow', verifyToken, (req,res) => {
  // id of the person who is following
  let id = parseInt(req.params.id);
  // check this id
  if (id !== req.userID) {
    res.status(403).send();
    return;
  }
  // id of the person who is being followed
  let follows = req.body.id;
  // make sure both of these users exist
  knex('users').where('id',id).first().then(user => {
    return knex('users').where('id',follows).first();
  }).then(user => {
    // make sure entry doesn't already exist
    return knex('followers').where({user_id:id,follows_id:follows}).first();
  }).then(entry => {
    if (entry === undefined)
      // insert the entry in the followers table
      return knex('followers').insert({user_id: id, follows_id:follows});
    else
      return true;
  }).then(ids => {
    res.sendStatus(200);
    return;
  }).catch(error => {
    console.log(error);
    res.status(500).json({ error });
  });
});

// unfollow someone
app.delete('/api/users/:id/follow/:follower', verifyToken, (req,res) => {
  // id of the person who is following
  let id = parseInt(req.params.id);
  // check this id
  if (id !== req.userID) {
    res.status(403).send();
    return;
  }
  // id of the person who is being followed
  let follows = parseInt(req.params.follower);
  // make sure both of these users exist
  knex('users').where('id',id).first().then(user => {
    return knex('users').where('id',follows).first();
  }).then(user => {
    // delete the entry in the followers table
    return knex('followers').where({'user_id':id,follows_id:follows}).first().del();
  }).then(ids => {
    res.sendStatus(200);
    return;
  }).catch(error => {
    console.log(error);
    res.status(500).json({ error });
  });
});

// get list of people you are following
app.get('/api/users/:id/follow', (req,res) => {
  // id of the person we are interested in
  let id = parseInt(req.params.id);
  // get people this person is following
  knex('users').join('followers','users.id','followers.follows_id')
    .where('followers.user_id',id)
    .select('username','name','users.id').then(users => {
      res.status(200).json({users:users});
    }).catch(error => {
      console.log(error);
      res.status(500).json({ error });
    });
});

app.get('/api/users/:id/followers', (req,res) => {
  let id = parseInt(req.params.id);
  knex('users').join('followers','users.id','followers.user_id')
    .where('followers.follows_id',id)
    .select('username','name','users.id').then(users => {
      res.status(200).json({users:users});
    }).catch(error => {
      console.log(error);
      res.status(500).json({ error });
    });
});

app.get('/api/users/:id/feed', (req,res) => {
  let id = parseInt(req.params.id);
  let offset = 0;
  if (req.query.offset)
    offset = parseInt(req.query.offset);
  let limit = 50;
  if (req.query.limit)
    limit = parseInt(req.query.limit);
  knex('followers').where('followers.user_id',id).then(followed => {
    let following = followed.map(entry=>entry.follows_id);
    following.push(id);
    return knex('pics').join('users','pics.user_id','users.id')
      .whereIn('pics.user_id',following)
      .orderBy('created','desc')
      .limit(limit)
      .offset(offset)
      .select('pic','username','name','created','image','users.id as userID');
  }).then(pics => {
    res.status(200).json({pics:pics});
  }).catch(error => {
    console.log(error);
    res.status(500).json({ error });
  });
});


app.listen(3000, () => console.log('Server listening on port 3000!'));
