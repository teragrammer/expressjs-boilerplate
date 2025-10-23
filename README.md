# ExpressJS Boilerplate API
```
A minimal and clean Express.js boilerplate for building RESTful APIs quickly. 
This starter template includes essential features like routing, middleware setup, error handling, and 
environment configuration to help you kickstart your API development with best practices.
```

### Features
- Database Connection (MySQL and CockroachDB compatible)
- Redis Connection (cache application settings and roles guard)
- Registration and Login (JWT Token)
- User Roles (Can be manage by admin)
- Two-Factor Authentication Setup (Using Email)
- Password Recovery
- Profile Information and Password Change
- Application Settings (Can be manage by admin)

### App Extensions
- `req.app.get("knex")`: Registers knex database connection
- `req.app.get("redis")`: Redis() and redis.duplicate() connection object via .publisher and .subscriber
- `req.app.get("cache_settings")()`: Global application settings are cached in a function for efficient access, with optional support for Redis Pub/Sub to dynamically propagate and update values in real-time across the application
  - `.pri`: use internally by the application
  - `.pub`: can be exposed to clients

### Request Extensions
- `req.credentials`: .jwt payload object from verified jwt header, .user() get the current authenticated user information, .authentication() details of token saved from database
- `req.sanitize`: .body form object, .query parameters
  - `.body.get(key, defaults?)`: get the specific value with default to NULL
  - `.body.only(string[])`: list the objects of selected keys
  - `.body.numeric(key, defaults?)`: convert the value if possible to numeric else default to 0
  - `.query.get(key, defaults?)`: get the specific value with default to NULL
  - `.query.numeric(key, defaults?)`: convert the value if possible to numeric else default to 0

### Getting Started
- Clone the repository
```
$ git clone https://github.com/teragrammer/expressjs-boilerplate.git
$ cd expressjs-boilerplate
```

- Configure your .env (.env.example)

- Initialize Docker
```
$ docker compose up -d
$ sh bin/run.sh
```

- Install dependencies
```
$ npm install
```

- Run test to check if all functions and configuration is set correctly (optional)
```
$ npm test
```

- Start the server (development)
```
$ npm run dev
```

- Production build
```
$ npm run build
$ npm run start
```

### Example API Requests
- Authentication
```
curl -X POST https://localhost:3000/api/v1/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"123456"}'
```

### Contributing
Contributions are welcome! Please follow these steps:
1. Fork the repository.
2. Create a new branch (git checkout -b feature/your-feature).
3. Commit your changes (git commit -m 'Add your feature').
4. Push to the branch (git push origin feature/your-feature).
5. Open a Pull Request.
Please ensure your code follows the project's coding standards and includes relevant tests.

### Hire Me
```
If you like this project and need help with development, customization, or integration, feel free to reach out!

I’m available for freelance work, consulting, and collaboration.

Thank you for checking out ExpressJS Boilerplate API!
Feel free to contribute or open issues.
```

### License
This project is licensed under the MIT License. See the LICENSE file for details.