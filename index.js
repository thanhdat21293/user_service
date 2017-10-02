const express = require('express');
const app = express();
const shortid = require('shortid');
const bcrypt = require('bcrypt');
const request = require("request");
const session = require('express-session');
const bodyParser = require("body-parser");
const jwt = require('jsonwebtoken');
const _ = require("lodash");
const passport = require("passport");
const passportJWT = require("passport-jwt");
const RBAC = require('rbac').default;

const ExtractJwt = passportJWT.ExtractJwt;
const JwtStrategy = passportJWT.Strategy;

const UserDB = [
    {
        id: 1,
        username: 'thanhdat1',
        password: '1',
        roles: ['admin']
    },
    {
        id: 2,
        username: 'thanhdat2',
        password: '11',
        roles: ['shop-manager', 'blog-manager']
    },
    {
        id: 3,
        username: 'thanhdat3',
        password: '111',
        roles: ['shop-manager']
    },
    {
        id: 4,
        username: 'thanhdat4',
        password: '1111',
        roles: ['members']
    }
];

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    next();
});

app.use(session({
    cookie: {maxAge: (3600 * 1000)},
    unser: 'destroy',
    secret: 'JackCodeHammer',
    resave: false,
    saveUninitialized: true,
    cookie: {secure: false}
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));


// Cấu hình jwt
const jwtOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme('jwt'),
    //jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: 'tasmanianDevil'
};

const strategy = new JwtStrategy(jwtOptions, (jwt_payload, next) => {
    console.log('payload received111', jwt_payload);
    const user = UserDB[_.findIndex(UserDB, {id: jwt_payload.id})];
    if (user) {
        next(null, user);
    } else {
        next(null, false);
    }
});


passport.use(strategy);
app.use(passport.initialize());

//Function này để nhưng router nào cần xác thực thì cho vào.
const jwtAuthenticate = () => passport.authenticate('jwt', { session: false });

// Cấu hình rbac
const rbac = new RBAC({
    roles: ['admin', 'shopmanager', 'blogmanager', 'member'],
    permissions: {
        user: ['create', 'delete', 'view'],
        password: ['change', 'forgot'],
        blog: ['create', 'delete', 'view'],
        product: ['create', 'delete', 'view']
    },
    grants: {
        admin: ['create_user'],
        shopmanager: ['create_product', 'delete_product', 'view_product'],
        blogmanager: ['create_blog', 'delete_blog', 'view_blog'],
        member: ['view_user', 'view_blog', 'view_product']
    }
}, (err, rbac) => {
    if (err) throw err;
    console.log(rbac);
});

/*
roles: Quyền user
act: router hiện tại có bao nhiêu permissions có thể truy cập
 */
app.use((req, res, next) => {
    res.renderJson = (act, data = {}) => {
        let roles = ['shopmanager', 'admin'];
        let n = roles.length; // Đếm số roles
        let check = true;
        for (let item = 0; item < n; item++) {
            if(!check) {
                continue;
            }
            let m = act.length; // Đếm xem có bao nhiêu quyền trong router hiện tại
            act.forEach((item1, index) => {
                if(!check)
                    return;

                rbac.can(roles[item], item1.key, item1.name, (err, can) => {
                    if (err) {
                        check = false;
                        res.json({errRole: err.message});
                    }

                    if (can) {
                        check = false;
                        res.json(data)
                    } else if(index == m - 1 && item == n-1) {
                        check = false;
                        res.json({errRole: 'Permission denied!'})
                    }
                });
            });
        }
    };
    next();
});


app.get('/', (req, res) => {
    res.json({msg: 'home'})
});

//Hàm này yêu cầu bảo mật, có một middle ware đứng giữa là passport.authenticate
//Session = false để lần nào request cũng phải authenticate chứ không kiểm tra user có trong session
app.get('/api/users', jwtAuthenticate(), (req, res) => {
    let act = [
        { key: 'view', name: 'user'},
        { key: 'view', name: 'product'},
    ];
    res.renderJson(act, UserDB)
});

app.get('/api/userbyid/:id', jwtAuthenticate(), (req, res) => {
    res.json(UserDB.find(user => user.id == req.params.id) || '')
});

app.get('/api/userbyusername/:username', jwtAuthenticate(), (req, res) => {
    res.json(UserDB.find(user => user.username == req.params.username) || '')
});




app.post("/api/register", (req, res) => {
    let username = req.body.username || '';
    let password = req.body.password || '';
    if (username && password) {
        let checkUser = UserDB.find(user => user.username == username);
        if(checkUser){
            res.json({msgErr: 'Username đã được đăng ký.'})
        }else{
            let obj = {
                id: shortid.generate(),
                roles: ['member'],
                username,
                password
            };
            UserDB.push(obj);
            res.json({msg: 'Đăng ký thành công.'})
        }
    } else {
        res.json({msgErr: 'Không được bỏ trống.'})
    }
});

app.post("/api/login", (req, res) => {
    let username = req.body.username || '';
    let password = req.body.password || '';

    if (username && password) {

        let checkUser = UserDB.find(user => user.username == username);
        if(checkUser) {
            if(checkUser.password === password){
                let payload = {
                    id: checkUser.id,
                    roles: checkUser.roles
                };

                const options = {
                  issuer: 'http://localhost:3000',
                  subject: 'secret micro service',
                  expiresIn: 500 // Expire in 500 seconds
                };

                //Ký vào payload sử dụng secretOrKey
                jwt.sign(payload, jwtOptions.secretOrKey, (err, token) => {
                    if (err) {
                        res.status(401).json({msgErr: "Fail to generate jwt token"});
                    } else {
                        res.json({
                            msg: 'ok',
                            token,
                            username
                        });
                    }
                });
            }else{
                res.json({msgErr: 'Mật khẩu không đúng.'})
            }
        }else{
            res.json({msgErr: 'Username không tồn tại.'})
        }
    } else {
        res.json({msgErr: 'Không được bỏ trống.'})
    }
});

const server = app.listen(3000, function () {
    console.log('Example app listening on port 3000!')
});
