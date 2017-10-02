# User service for boook.com

## Chạy
```
npm i
node index.js
```

## JWT

Người dùng đăng nhập thành công sẽ trả về 1 token.

Một số router sẽ bắt người dùng phải đăng nhập mới xem được thì khi đó người dùng muốn truy cập trang thì sẽ phải gửi token từ client lên server qua  để kiểm tra.

#### Cài đặt

```
npm i --save express-session
npm i --save jsonwebtoken
npm i --save passport
npm i --save passport-jwt
```

#### Cấu hình

`new JwtStrategy`: Kiểu Authorization mà client gửi lên

Ví dụ:

Nếu client gửi yêu cầu lên server quả request headers:

```javascript
'Authorization': 'JWT '.concat(sessionStorage.token)
```

Thì Server sẽ cấu hình
```javascript
new JwtStrategy = fromAuthHeaderWithScheme('jwt')
```

`secretOrKey`: Chữ ký của token

```javascript
const ExtractJwt = passportJWT.ExtractJwt;
const JwtStrategy = passportJWT.Strategy;
const jwtOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme('jwt'),
    secretOrKey: 'tasmanianDevil'
};
const strategy = new JwtStrategy(jwtOptions, (jwt_payload, next) => {
    const user = users[_.findIndex(users, {id: jwt_payload.id})];
    if (user) {
        next(null, user);
    } else {
        next(null, false);
    }
});
passport.use(strategy);
app.use(passport.initialize());
```

#### Gửi từ host khác

Muốn host khác yêu cầu dữ liệu từ server thì cần phải có:
```javascript
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
```

#### Tạo token khi đăng nhập thành công

`payload`: lưu khóa chính hoặc trường nào là unique để dựa vào đó ta lấy được user (nên để thành object)
```javascript
//Lấy id user
let payload = {id: checkUser.id};

const options = {
  issuer: 'http://localhost:3000',
  subject: 'secret microservice',
  expiresIn: 500 //Expire in 500 seconds
};
// jwtOptions.secretOrKey được lấy ở phần cấu hình
// Tạo ra token
jwt.sign(payload, jwtOptions.secretOrKey, options, (err, token) => {
    if (err) {
        res.status(401).json({msgErr: "Fail to generate jwt token"});
    } else {
        res.json({
            msg: 'ok',
            token
        });
    }
});
```

## RBAC (Role-based access control): phân quyền

#### Cài đặt

```
npm i --save rbac
```

#### Cấu hình

```javascript
const RBAC = require('rbac').default;
//.
const rbac = new RBAC({
  // Tất cả roles có trong user service
  roles: ['superadmin', 'admin', 'user', 'guest'],
  // 
  permissions: {
    user: ['create', 'delete'],
    password: ['change', 'forgot'],
    article: ['create'],
    rbac: ['update']
  },
  // 
  grants: {
    guest: ['create_user', 'forgot_password'],
    user: ['change_password'],
    admin: ['user', 'delete_user', 'update_rbac'],
    superadmin: ['admin']
  }
}, function(err, rbacInstance) {
  if (err) {
    throw err;
  }
});
```

#### Kiểm tra quyền 

Cơ bản

```javascript
rbac.getRole('admin', (err, admin) => {
  if (err) {
    throw err;
  }

  if (!admin) {
    return console.log('Role does not exists');
  }

  admin.can('create', 'article', (err2, can) => {
    if (err2) throw err2;

    if (can) {
      console.log('Admin is able create article');    
    }
  });
});
```

Áp dụng vào user service

- Một user có nhiều quyền: roles

- Một router có nhiều permissions: act

```javascript
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
```

# User API

### Login

## `POST /api/login`

Tham số truyền vào:
```
{
    username,
    password
}
```

Trả về: 
```
{
    msg: 'ok',
    token,
}
```

## `POST /api/register`

Tham số truyền vào:
```
{
    username,
    password
}
```

Trả về:

```
{
    msg: 'Đăng ký thành công.'
}
```

## `GET /api/users`

Trả về:

```
{
    id,
    username,
    password
}
```

## `GET /api/userbyid/{{ id }}`

Trả về:

```
{
    id,
    username,
    password
}
```

## `GET /api/userbyusername/{{ username }}`

Trả về:

```
{
    id,
    username,
    password
}
```