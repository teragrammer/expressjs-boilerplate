/**
 * Artillery Processor Hooks
 * Custom hooks for request/response processing during load tests.
 */

/**
 * Before request hook - can modify request before sending
 * @param {Object} requestParams - Request parameters
 * @param {Object} context - Scenario context (variables, etc.)
 * @param {Object} event - Artillery event
 * @param {Function} callback - Callback function
 */
function beforeRequest(requestParams, context, event, callback) {
    // Add timestamp header for request tracing
    requestParams.headers = requestParams.headers || {};
    requestParams.headers['X-Request-Time'] = Date.now().toString();

    // Add correlation ID for distributed tracing
    if (!requestParams.headers['X-Correlation-ID']) {
        requestParams.headers['X-Correlation-ID'] = `load-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    callback(null, requestParams);
}

/**
 * After response hook - can process response data
 * @param {Object} requestParams - Request parameters
 * @param {Object} response - Response object
 * @param {Object} context - Scenario context
 * @param {Object} event - Artillery event
 * @param {Function} callback - Callback function
 */
function afterResponse(requestParams, response, context, event, callback) {
    // Log slow responses for analysis (over 500ms)
    if (response.timings && response.timings.phases && response.timings.phases.firstByte > 500) {
        event.emit('counter', 'slow_responses', 1);
        event.emit('histogram', 'response_time_slow', response.timings.phases.firstByte);
    }

    // Track authentication failures
    if (response.statusCode === 401) {
        event.emit('counter', 'auth_failures', 1);
    }

    // Track rate limiting
    if (response.statusCode === 429) {
        event.emit('counter', 'rate_limited', 1);
    }

    callback(null, response);
}

/**
 * Before scenario hook - runs before each scenario
 * @param {Object} context - Scenario context
 * @param {Object} event - Artillery event
 * @param {Function} callback - Callback function
 */
function beforeScenario(context, event, callback) {
    // Initialize scenario-level variables
    context.vars.requestStartTime = Date.now();
    callback();
}

/**
 * After scenario hook - runs after each scenario
 * @param {Object} context - Scenario context
 * @param {Object} event - Artillery event
 * @param {Function} callback - Callback function
 */
function afterScenario(context, event, callback) {
    const duration = Date.now() - (context.vars.requestStartTime || Date.now());
    event.emit('histogram', 'scenario_duration', duration);
    callback();
}

module.exports = {
    beforeRequest,
    afterResponse,
    beforeScenario,
    afterScenario,
};
