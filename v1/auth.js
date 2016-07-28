"use strict";

const HyperSwitch = require('hyperswitch');

const spec = HyperSwitch.utils.loadSpec(__dirname + '/auth.yaml');

class Auth {
    constructor(options) {
        this.options = options;
    }

    verifyPassword(hyper, req) {
        return {
            status: 200
        }
    }

    resetPassword(hyper, req) {
        return {
            status: 200,
            body: {
                token: 'Hello, I am a token'
            }
        };
    }

    createPassword(hyper, req) {
        return {
            status: 201
        }
    }

    verifyToken(hyper, req) {
        return {
            status: 200
        }
    }

    createToken(hyper, req) {
        return {
            status: 200,
            body: {
                scratch_tokens: [
                    'Hello, I am a token #1',
                    'Hello, I am a token #2',
                    'Hello, I am a token #3',
                    'Hello, I am a token #4',
                    'Hello, I am a token #5',
                ],
                key: 'Hello, I am a key'
            }
        };
    }
}

module.exports = function(options) {
    const auth = new Auth(options);
    return {
        spec: spec,
        operations: {
            verifyPassword: auth.verifyPassword.bind(auth),
            resetPassword: auth.resetPassword.bind(auth),
            createPassword: auth.createPassword.bind(auth),
            verifyToken: auth.verifyToken.bind(auth),
            createToken: auth.createToken.bind(auth),
        }
    }
};