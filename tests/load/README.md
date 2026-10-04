# Load Testing with Artillery

Production-ready load testing setup for the Express 5 + TypeScript REST API.

## Quick Start

```bash
# 1. Ensure the server is running
npm run dev

# 2. Seed the database (required for authentication scenarios)
npm run db:seed

# 3. Run a quick smoke test
npm run load:test:smoke

# 4. Run the full load test
npm run load:test

# 5. Run a stress test
npm run load:test:stress

# 6. Run a soak test (long duration)
npm run load:test:soak
```

## Prerequisites

Before running load tests, ensure:

1. **Server is running** — `npm run dev` (or `npm run start` for production)
2. **Database is seeded** — `npm run db:seed` (creates test users: admin/manager/customer, password: `123456`)
3. **Database is migrated** — `npm run db:migrate` (if not already done)

## Test Types

| Test        | Duration | Purpose                                 | Command                    |
|-------------|----------|-----------------------------------------|----------------------------|
| **Smoke**   | ~30s     | Quick validation that API is responding | `npm run load:test:smoke`  |
| **Default** | ~6min    | Gradual ramp-up with mixed scenarios    | `npm run load:test`        |
| **Stress**  | ~5min    | High-intensity to find breaking points  | `npm run load:test:stress` |
| **Soak**    | ~45min   | Long-duration to detect memory leaks    | `npm run load:test:soak`   |

## Configuration

### Environment Variables

| Variable     | Default                 | Description                 |
|--------------|-------------------------|-----------------------------|
| `TARGET_URL` | `http://localhost:4000` | Base URL of the API         |
| `OUTPUT_DIR` | `tests/load/reports`    | Directory for test reports  |
| `WORKERS`    | auto                    | Number of artillery workers |

### Custom Target URL

```bash
TARGET_URL=https://api.example.com npm run load:test
```

## Test Scenarios

The load test covers the following API endpoints:

### Public Endpoints (No Auth)

- `GET /health` - Health check
- `POST /api/v1/auth/login` - User authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/password-recovery/send` - Password recovery

### Protected Endpoints (Auth Required)

- `GET /api/v1/auth/logout` - Logout
- `GET /api/v1/users` - Browse users
- `GET /api/v1/users/:id` - View user
- `GET /api/v1/settings` - Browse settings
- `GET /api/v1/settings/values` - Get setting values
- `GET /api/v1/roles` - Browse roles
- `GET /api/v1/roles/:id` - View role
- `GET /api/v1/route/guards` - Browse route guards
- `PUT /api/v1/account/information` - Update account info
- `PUT /api/v1/account/password` - Update password

## Reports

After each test run, reports are generated in `tests/load/reports/`:

- `.json` - Raw metrics data (machine-readable)
- `.html` - Interactive HTML report (human-readable)
- `.log` - Console output log

### Viewing Reports

```bash
# List all reports
ls -la tests/load/reports/

# Open HTML report (macOS)
open tests/load/reports/api_20240101_120000.html

# Open HTML report (Linux)
xdg-open tests/load/reports/api_20240101_120000.html
```

## Project Structure

```
tests/load/
├── README.md              # This file
├── run.sh                 # Runner script
├── api.yml                # Default load test config
├── smoke.yml              # Smoke test config
├── stress.yml             # Stress test config
├── soak.yml               # Soak test config
├── data/
│   └── users.csv          # Test user credentials
├── plugins/
│   └── hooks.js           # Custom artillery hooks
└── reports/               # Generated test reports
```

## Customization

### Adding New Scenarios

Edit `tests/load/api.yml` and add a new scenario under `scenarios:`:

```yaml
  - name: "My Custom Scenario"
    weight: 10
    flow:
      - get:
          url: "/api/v1/my-endpoint"
          headers:
            Authorization: "Bearer {{ authToken }}"
          expect:
            - statusCode: 200
```

### Modifying Load Phases

Edit the `phases` section in the config:

```yaml
  phases:
    - name: "Custom Phase"
      duration: 60        # Duration in seconds
      arrivalRate: 10     # Starting arrival rate
      rampTo: 100         # Ending arrival rate
```

### Adding Test Data

Edit `tests/load/data/users.csv` to add more test users:

```csv
username,password,role
admin,123456,admin
newuser,password123,user
```

## Performance Thresholds

The load test enforces these performance thresholds:

| Metric                   | Threshold | Description                   |
|--------------------------|-----------|-------------------------------|
| `http.response_time.p95` | 500ms     | 95th percentile response time |
| `http.response_time.p99` | 1000ms    | 99th percentile response time |
| `http.codes.2xx`         | 95%       | Success rate                  |

If any threshold is not met, the test will fail.

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Load Test
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run dev &
      - run: sleep 5
      - run: npm run load:test:smoke
```

### GitLab CI Example

```yaml
load_test:
  stage: test
  script:
    - npm ci
    - npm run dev &
    - sleep 5
    - npm run load:test:smoke
  artifacts:
    paths:
      - tests/load/reports/
    expire_in: 30 days
```

## Troubleshooting

### Connection Refused

```
Error: connect ECONNREFUSED 127.0.0.1:4000
```

**Solution:** Ensure the server is running before starting the load test.

### Authentication Failures

If you see many 401 errors in the report:

1. Verify test user credentials in `data/users.csv`
2. Run `npm run db:seed` to ensure seed data exists
3. Check JWT token expiration settings

### High Response Times

1. Check database connection pool settings
2. Verify Redis is running (if using caching)
3. Review application logs for slow queries

## Advanced Usage

### Running with Custom Overrides

```bash
artillery run \
  --config tests/load/api.yml \
  --overrides '{"config":{"phases":[{"duration":60,"arrivalRate":100}]}}' \
  --output reports/custom.json
```

### Distributed Load Testing

For distributed load testing across multiple machines:

```bash
# On each worker machine
artillery run \
  --config tests/load/api.yml \
  --overrides '{"config":{"target":"https://api.example.com"}}'
```

### Programmatic Access

```javascript
const artillery = require('artillery');

artillery.run({
    config: {
        target: 'http://localhost:4000',
        phases: [{duration: 60, arrivalRate: 10}]
    },
    scenarios: [{
        name: 'Test',
        flow: [{get: {url: '/health'}}]
    }]
}).then(report => {
    console.log(report.aggregate);
});
```

## License

ISC
