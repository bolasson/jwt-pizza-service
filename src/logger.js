const config = require('./config.js');
const fetch = require('node-fetch');

class Logger {
    httpLogger = (req, res, next) => {
        let send = res.send;
        res.send = (resBody) => {
            try {
                const logData = {
                    authorized: !!req.headers.authorization,
                    path: req.originalUrl,
                    method: req.method,
                    statusCode: res.statusCode,
                    reqBody: JSON.stringify(req.body),
                    resBody: JSON.stringify(this.sanitize(resBody))
                };
                const level = this.statusToLogLevel(res.statusCode);
                this.log(level, 'http', logData);
            } catch (err) {
                console.error('Logging failed:', err);
            }
            res.send = send;
            return res.send(resBody);
        };
        next();
    };

    log(level, type, logData) {
        const labels = { component: config.logging.source, level: level, type: type };
        const values = [this.nowString(), this.sanitize(logData)];
        const logEvent = { streams: [{ stream: labels, values: [values] }] };

        this.sendLogToGrafana(logEvent);
    }

    statusToLogLevel(statusCode) {
        if (statusCode >= 500) return 'error';
        if (statusCode >= 400) return 'warn';
        return 'info';
    }

    nowString() {
        return (Math.floor(Date.now()) * 1000000).toString();
    }

    sanitize(logData) {
        let data = JSON.stringify(logData);
        data = data.replace(/\\"password\\":\s*\\"[^"]*\\"/g, '\\"password\\": \\"*****\\"');
        data = data.replace(/\\"token\\":\s*\\"[^"]*\\"/g, '\\"token\\": \\"*****\\"');
        data = data.replace(/\\"apiKey\\":\s*\\"[^"]*\\"/g, '\\"apiKey\\": \\"*****\\"');
        data = data.replace(/\\"authorization\\":\s*\\"[^"]*\\"/g, '\\"authorization\\": \\"*****\\"');
        return data;
    }

    sendLogToGrafana(event) {
        if (!config.logging.enabled) return;
        const body = JSON.stringify(event);
        fetch(`${config.logging.url}`, {
            method: 'post',
            body: body,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.logging.userId}:${config.logging.apiKey}`,
            },
        }).then((res) => {
            if (!res.ok) console.log('Failed to send log to Grafana');
        });
    }
}

module.exports = new Logger();