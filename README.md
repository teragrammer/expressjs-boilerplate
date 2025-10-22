# ExpressJS Boilerplate API
```
A minimal and clean Express.js boilerplate for building RESTful APIs quickly. 
This starter template includes essential features like routing, middleware setup, error handling, and 
environment configuration to help you kickstart your API development with best practices.
```

### Features
- Database Connection (MySQL and CockroachDB compatible)
- Registration and Login (JWT Token)
- User Roles (Can be manage by admin)
- Two-Factor Authentication Setup (Using Email)
- Password Recovery
- Profile Information and Password Change
- Application Settings (Can be manage by admin)

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

### Hire Me
```
If you like this project and need help with development, customization, or integration, feel free to reach out!

I’m available for freelance work, consulting, and collaboration.

Thank you for checking out ExpressJS Boilerplate API!
Feel free to contribute or open issues.
```